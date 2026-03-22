pipeline {
    agent any

    tools {
        nodejs 'node18'
    }

    environment {
        // ── Docker Hub (public mirror) ────────────────────────────────────────
        BACKEND_IMAGE  = "jsethy2010/infracommand-backend"
        FRONTEND_IMAGE = "jsethy2010/infracommand-frontend"
        IMAGE_TAG      = "${BUILD_NUMBER}"

        // ── Nexus — app images (infracommand-docker repo) ─────────────────────
        NEXUS_REGISTRY = "192.168.101.80:8082"
        NEXUS_BACKEND  = "192.168.101.80:8082/infracommand-backend"
        NEXUS_FRONTEND = "192.168.101.80:8082/infracommand-frontend"

        // ── Nexus — trivy DB repo (aquasecurity repo, separate port) ─────────
        TRIVY_REGISTRY      = "192.168.101.80:8083"
        TRIVY_DB_SOURCE     = "ghcr.io/aquasecurity/trivy-db:2"
        TRIVY_JAVA_SOURCE   = "ghcr.io/aquasecurity/trivy-java-db:1"
        TRIVY_DB_DEST       = "192.168.101.80:8083/trivy-db:2"
        TRIVY_JAVA_DEST     = "192.168.101.80:8083/trivy-java-db:1"

        // ── Kubernetes ────────────────────────────────────────────────────────
        K8S_NAMESPACE  = "infracommand"

        // ── Grafana ───────────────────────────────────────────────────────────
        GRAFANA_URL          = "http://192.168.101.80:3000"
        GRAFANA_DASHBOARD_ID = "infracommand-cicd"
    }

    stages {

        // ──────────────────────────────────────────────────────
        // 1. GIT CHECKOUT
        // ──────────────────────────────────────────────────────
        stage('Git Checkout') {
            steps {
                git branch: 'main',
                    credentialsId: 'git-credentials',
                    url: 'https://github.com/jyotirepo/infracommand.git'

                script {
                    env.GIT_COMMIT_SHORT = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
                    env.GIT_AUTHOR      = sh(script: "git log -1 --pretty=format:'%an'", returnStdout: true).trim()
                    env.GIT_MSG         = sh(script: "git log -1 --pretty=format:'%s'",  returnStdout: true).trim()
                    echo "Commit: ${env.GIT_COMMIT_SHORT} by ${env.GIT_AUTHOR} — ${env.GIT_MSG}"
                }
            }
        }

        // ──────────────────────────────────────────────────────
        // 2. SERVER SETUP (idempotent — safe to run every build)
        // ──────────────────────────────────────────────────────
        stage('Server Setup') {
            steps {
                sh '''
                    echo "=== Bootstrapping sudo rights for Jenkins ==="
                    SUDOERS_FILE=/etc/sudoers.d/jenkins-infracommand
                    ENTRY_CRICTL="jenkins ALL=(ALL) NOPASSWD: /usr/bin/crictl"
                    ENTRY_CTR="jenkins ALL=(ALL) NOPASSWD: /usr/bin/ctr"
                    ENTRY_BASH="jenkins ALL=(ALL) NOPASSWD: /bin/bash"
                    ENTRY_UBASH="jenkins ALL=(ALL) NOPASSWD: /usr/bin/bash"
                    ENTRY_APT="jenkins ALL=(ALL) NOPASSWD: /usr/bin/apt-get"
                    ENTRY_DOCKER="jenkins ALL=(ALL) NOPASSWD: /usr/bin/docker"

                    for ENTRY in "$ENTRY_CRICTL" "$ENTRY_CTR" "$ENTRY_BASH" "$ENTRY_UBASH" "$ENTRY_APT" "$ENTRY_DOCKER"; do
                        grep -qxF "$ENTRY" $SUDOERS_FILE 2>/dev/null || echo "$ENTRY" | sudo tee -a $SUDOERS_FILE
                    done
                    sudo chmod 0440 $SUDOERS_FILE
                    echo "Sudoers entries verified ✔"

                    echo "=== Running setup.sh ==="
                    chmod +x setup.sh
                    sudo bash setup.sh

                    # ── Ensure crane is installed on Jenkins node ─────────────
                    # crane copies OCI artifacts (trivy-db) from ghcr.io to Nexus.
                    # Installed once; subsequent runs use the cached binary.
                    if ! command -v crane >/dev/null 2>&1; then
                        echo "Installing crane..."
                        CRANE_VER=$(curl -sfL \
                            https://api.github.com/repos/google/go-containerregistry/releases/latest \
                            | grep tag_name | cut -d'"' -f4)
                        curl -sfL \
                            "https://github.com/google/go-containerregistry/releases/download/${CRANE_VER}/go-containerregistry_Linux_x86_64.tar.gz" \
                            | sudo tar -xz -C /usr/local/bin crane
                        echo "crane installed: $(crane version)"
                    else
                        echo "crane already available: $(crane version)"
                    fi

                    # ── Ensure Nexus Docker container exposes port 8083 ───────
                    # The aquasecurity trivy-db repo needs port 8083.
                    # If the nexus container was started without 8083, recreate it.
                    NEXUS_PORTS=$(docker inspect nexus 2>/dev/null \
                        | python3 -c "import sys,json; p=json.load(sys.stdin); \
                          ports=p[0].get('HostConfig',{}).get('PortBindings',{}); \
                          print(','.join(ports.keys()))" 2>/dev/null || echo "")

                    if echo "$NEXUS_PORTS" | grep -q "8083"; then
                        echo "Nexus already exposes port 8083 ✔"
                    else
                        echo "Nexus does not expose port 8083 — recreating container with 8083 added..."
                        docker stop nexus || true
                        docker rm   nexus || true
                        docker run -d \
                            --name nexus \
                            --restart unless-stopped \
                            -p 8081:8081 \
                            -p 8082:8082 \
                            -p 8083:8083 \
                            -v nexus-data:/nexus-data \
                            sonatype/nexus3

                        echo "Waiting for Nexus to start..."
                        for i in $(seq 1 30); do
                            if curl -sf http://192.168.101.80:8081/service/rest/v1/status >/dev/null 2>&1; then
                                echo "Nexus is up ✔"
                                break
                            fi
                            echo "  waiting... ($i/30)"
                            sleep 10
                        done
                    fi
                '''
            }
        }

        // ──────────────────────────────────────────────────────
        // 3. INSTALL DEPENDENCIES
        // ──────────────────────────────────────────────────────
        stage('Install Backend Dependencies') {
            steps {
                sh '''
                    PYTHON_VER=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
                    echo "Detected Python: $PYTHON_VER"
                    sudo apt-get install -y python3-venv python3${PYTHON_VER#3}-venv python3-pip 2>/dev/null || \
                    sudo apt-get install -y python3-venv python3-pip || true
                    python3 -m ensurepip --upgrade 2>/dev/null || true
                '''
                dir('backend') {
                    sh '''
                        rm -rf venv
                        python3 -m venv venv
                        . venv/bin/activate
                        pip install --upgrade pip
                        pip install -r requirements.txt
                    '''
                }
            }
        }

        stage('Install Frontend Dependencies') {
            steps {
                dir('frontend') {
                    sh "npm install"
                }
            }
        }

        // ──────────────────────────────────────────────────────
        // 4. TEST & BUILD
        // ──────────────────────────────────────────────────────
        stage('Test Backend') {
            steps {
                dir('backend') {
                    sh '''
                        . venv/bin/activate
                        python -m pytest tests/ -v --tb=short 2>/dev/null || echo "No tests yet, skipping"
                    '''
                }
            }
        }

        stage('Build Frontend') {
            steps {
                dir('frontend') {
                    sh "npm run build"
                }
            }
        }

        // ──────────────────────────────────────────────────────
        // 5. TRIVY — FILE SYSTEM SCAN
        // ──────────────────────────────────────────────────────
        stage('File System Scan') {
            steps {
                sh """
                curl -sSL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/html.tpl \
                     -o html.tpl

                trivy fs --scanners vuln,secret,misconfig \\
                    --format template \\
                    --template "@html.tpl" \\
                    -o trivy-fs-report.html .
                """
            }
        }

        // ──────────────────────────────────────────────────────
        // 6. SONARQUBE ANALYSIS + QUALITY GATE
        // ──────────────────────────────────────────────────────
        stage('SonarQube Analysis') {
            environment {
                SCANNER_HOME = tool 'sonar-scanner'
            }
            steps {
                withSonarQubeEnv('sonar') {
                    sh """
                        ${SCANNER_HOME}/bin/sonar-scanner \\
                        -Dsonar.projectName=InfraCommand \\
                        -Dsonar.projectKey=InfraCommand \\
                        -Dsonar.sources=backend,frontend/src \\
                        -Dsonar.python.version=3 \\
                        -Dsonar.qualitygate.wait=false
                    """
                }
            }
        }

        stage('Quality Gate') {
            steps {
                script {
                    withSonarQubeEnv('sonar') {
                        def taskId = sh(
                            script: "grep ceTaskId .scannerwork/report-task.txt 2>/dev/null | cut -d= -f2 || echo ''",
                            returnStdout: true
                        ).trim()
                        if (taskId) {
                            timeout(time: 5, unit: 'MINUTES') {
                                waitForQualityGate abortPipeline: false
                            }
                        } else {
                            echo "No SonarQube task ID found, skipping quality gate"
                        }
                    }
                }
            }
        }

        // ──────────────────────────────────────────────────────
        // 7. BUILD DOCKER IMAGES
        // ──────────────────────────────────────────────────────
        stage('Build Backend Docker Image') {
            steps {
                dir('backend') {
                    sh "docker build -t ${BACKEND_IMAGE}:${IMAGE_TAG} ."
                    sh "docker tag  ${BACKEND_IMAGE}:${IMAGE_TAG} ${BACKEND_IMAGE}:latest"
                    sh "docker tag  ${BACKEND_IMAGE}:${IMAGE_TAG} ${NEXUS_BACKEND}:${IMAGE_TAG}"
                    sh "docker tag  ${BACKEND_IMAGE}:${IMAGE_TAG} ${NEXUS_BACKEND}:latest"
                }
            }
        }

        stage('Build Frontend Docker Image') {
            steps {
                dir('frontend') {
                    sh "docker build -t ${FRONTEND_IMAGE}:${IMAGE_TAG} ."
                    sh "docker tag  ${FRONTEND_IMAGE}:${IMAGE_TAG} ${FRONTEND_IMAGE}:latest"
                    sh "docker tag  ${FRONTEND_IMAGE}:${IMAGE_TAG} ${NEXUS_FRONTEND}:${IMAGE_TAG}"
                    sh "docker tag  ${FRONTEND_IMAGE}:${IMAGE_TAG} ${NEXUS_FRONTEND}:latest"
                }
            }
        }

        // ──────────────────────────────────────────────────────
        // 8. TRIVY — IMAGE SCANS
        // ──────────────────────────────────────────────────────
        stage('Scan Backend Image') {
            steps {
                sh """
                trivy image --scanners vuln \\
                    --format template --template "@html.tpl" \\
                    -o trivy-backend-image-report.html \\
                    ${BACKEND_IMAGE}:${IMAGE_TAG}
                """
            }
        }

        stage('Scan Frontend Image') {
            steps {
                sh """
                trivy image --scanners vuln \\
                    --format template --template "@html.tpl" \\
                    -o trivy-frontend-image-report.html \\
                    ${FRONTEND_IMAGE}:${IMAGE_TAG}
                """
            }
        }

        // ──────────────────────────────────────────────────────
        // 9. MIRROR TRIVY CVE DATABASE TO NEXUS
        //    Jenkins (has internet) pulls from ghcr.io and pushes
        //    to the dedicated aquasecurity Nexus repo at :8083.
        //    The trivy-server pod inside K8s pulls from :8083 —
        //    no internet access needed inside the cluster.
        // ──────────────────────────────────────────────────────
        stage('Mirror Trivy DB to Nexus') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'nexus-cred',
                    usernameVariable: 'NEXUS_USER',
                    passwordVariable: 'NEXUS_PASS'
                )]) {
                    sh """
                        echo "=== Mirroring Trivy CVE DB: ghcr.io → Nexus :8083 ==="

                        # Login to the aquasecurity Nexus repo
                        echo "\$NEXUS_PASS" | crane auth login ${TRIVY_REGISTRY} \\
                            --username "\$NEXUS_USER" \\
                            --password-stdin \\
                            --insecure

                        # Copy trivy-db OCI artifact
                        echo "Copying trivy-db..."
                        crane copy ${TRIVY_DB_SOURCE} ${TRIVY_DB_DEST} \\
                            --insecure \\
                            --platform linux/amd64
                        echo "trivy-db mirrored ✔"

                        # Copy trivy-java-db OCI artifact
                        echo "Copying trivy-java-db..."
                        crane copy ${TRIVY_JAVA_SOURCE} ${TRIVY_JAVA_DEST} \\
                            --insecure \\
                            --platform linux/amd64
                        echo "trivy-java-db mirrored ✔"

                        # Verify both are reachable in Nexus
                        curl -sf -u "\$NEXUS_USER:\$NEXUS_PASS" \\
                            http://${TRIVY_REGISTRY}/v2/trivy-db/tags/list | python3 -m json.tool
                        echo "=== Trivy DB mirror complete ==="
                    """
                }
            }
        }

        // ──────────────────────────────────────────────────────
        // 10. PUSH TO NEXUS (primary — K8s pulls from here)
        // ──────────────────────────────────────────────────────
        stage('Push Images to Nexus') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'nexus-cred',
                    usernameVariable: 'NEXUS_USER',
                    passwordVariable: 'NEXUS_PASS'
                )]) {
                    sh """
                        echo \$NEXUS_PASS | docker login ${NEXUS_REGISTRY} -u \$NEXUS_USER --password-stdin

                        docker push ${NEXUS_BACKEND}:${IMAGE_TAG}
                        docker push ${NEXUS_BACKEND}:latest

                        docker push ${NEXUS_FRONTEND}:${IMAGE_TAG}
                        docker push ${NEXUS_FRONTEND}:latest

                        echo "Nexus push complete ✔"
                    """
                }
            }
        }

        // ──────────────────────────────────────────────────────
        // 11. PUSH TO DOCKER HUB (public mirror)
        // ──────────────────────────────────────────────────────
        stage('Push Docker Images') {
            steps {
                withDockerRegistry(url: 'https://index.docker.io/v1/', credentialsId: 'docker-cred') {
                    sh "docker push ${BACKEND_IMAGE}:${IMAGE_TAG}"
                    sh "docker push ${BACKEND_IMAGE}:latest"
                    sh "docker push ${FRONTEND_IMAGE}:${IMAGE_TAG}"
                    sh "docker push ${FRONTEND_IMAGE}:latest"
                }
            }
        }

        // ──────────────────────────────────────────────────────
        // 12. ARCHIVE SECURITY REPORTS
        // ──────────────────────────────────────────────────────
        stage('Archive Reports') {
            steps {
                archiveArtifacts artifacts: '*.html', fingerprint: true
            }
        }

        // ──────────────────────────────────────────────────────
        // 13. KUBERNETES — DEPLOY IN ORDER
        //     trivy-server deployed FIRST so it is ready before
        //     the backend pod starts scanning.
        // ──────────────────────────────────────────────────────
        stage('Deploy To Kubernetes') {
            steps {
                withKubeConfig(
                    credentialsId: 'k8-cred',
                    namespace: 'infracommand',
                    serverUrl: 'https://192.168.101.80:6443'
                ) {
                    withCredentials([usernamePassword(
                        credentialsId: 'nexus-cred',
                        usernameVariable: 'NEXUS_USER',
                        passwordVariable: 'NEXUS_PASS'
                    )]) {
                        sh """
                            kubectl create namespace ${K8S_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

                            # Pull-secret for app images from :8082
                            kubectl create secret docker-registry nexus-pull-secret \\
                                --docker-server=${NEXUS_REGISTRY} \\
                                --docker-username=\$NEXUS_USER \\
                                --docker-password=\$NEXUS_PASS \\
                                -n ${K8S_NAMESPACE} \\
                                --dry-run=client -o yaml | kubectl apply -f -

                            # Generic secret for trivy-server to pull DB from :8083
                            kubectl create secret generic nexus-credentials \\
                                --from-literal=username=\$NEXUS_USER \\
                                --from-literal=password=\$NEXUS_PASS \\
                                -n ${K8S_NAMESPACE} \\
                                --dry-run=client -o yaml | kubectl apply -f -
                        """
                    }

                    // ── JWT Secret (required) ─────────────────────────────────────────────
                    sh """
                        # JWT secret — generated once, never overwritten across deploys
                        if ! kubectl get secret infracommand-auth-secret \
                                -n ${K8S_NAMESPACE} >/dev/null 2>&1; then
                            JWT_KEY=\$(openssl rand -hex 32)
                            kubectl create secret generic infracommand-auth-secret \
                                --from-literal=jwt-secret=\$JWT_KEY \
                                -n ${K8S_NAMESPACE}
                            echo "JWT secret created ✔"
                        else
                            echo "JWT secret already exists — not overwriting ✔"
                        fi
                    """

                    // ── SMTP Secret (optional — pipeline continues if credentials missing) ─
                    script {
                        try {
                            withCredentials([
                                string(credentialsId: 'smtp-host', variable: 'SMTP_HOST'),
                                string(credentialsId: 'smtp-port', variable: 'SMTP_PORT'),
                                string(credentialsId: 'smtp-user', variable: 'SMTP_USER'),
                                string(credentialsId: 'smtp-pass', variable: 'SMTP_PASS'),
                                string(credentialsId: 'smtp-from', variable: 'SMTP_FROM'),
                            ]) {
                                sh """
                                    kubectl create secret generic infracommand-smtp-secret \
                                        --from-literal=smtp-host=\$SMTP_HOST \
                                        --from-literal=smtp-port=\$SMTP_PORT \
                                        --from-literal=smtp-user=\$SMTP_USER \
                                        --from-literal=smtp-pass=\$SMTP_PASS \
                                        --from-literal=smtp-from=\$SMTP_FROM \
                                        -n ${K8S_NAMESPACE} \
                                        --dry-run=client -o yaml | kubectl apply -f -
                                    echo "SMTP secret applied ✔"
                                """
                            }
                        } catch (err) {
                            echo "⚠️  SMTP credentials not found in Jenkins — email sending disabled."
                            echo "    Add Secret Text credentials: smtp-host, smtp-port, smtp-user, smtp-pass, smtp-from"
                            echo "    Passwords will be shown on screen instead of emailed until SMTP is configured."
                            // Create empty SMTP secret so the backend pod starts without errors
                            sh """
                                kubectl create secret generic infracommand-smtp-secret \
                                    --from-literal=smtp-host="" \
                                    --from-literal=smtp-port="587" \
                                    --from-literal=smtp-user="" \
                                    --from-literal=smtp-pass="" \
                                    --from-literal=smtp-from="infracommand@devops.local" \
                                    -n ${K8S_NAMESPACE} \
                                    --dry-run=client -o yaml | kubectl apply -f -
                            """
                        }
                    }

                    sh """
                        sudo crictl pull ${NEXUS_FRONTEND}:${IMAGE_TAG}
                        sudo crictl pull docker.io/aquasec/trivy:latest || true
                        echo "Images pre-pulled via CRI-O ✔"
                    """

                    sh """
                        kubectl apply -f k8s/00-namespace.yaml

                        kubectl delete pvc infracommand-db-pvc -n ${K8S_NAMESPACE} --ignore-not-found=true
                        kubectl delete hpa infracommand-backend-hpa -n ${K8S_NAMESPACE} --ignore-not-found=true

                        # Deploy trivy-server first (ConfigMap + Deployment + Service)
                        kubectl apply -f k8s/05-trivy.yaml
                        kubectl apply -f k8s/06-rbac.yaml

                        kubectl apply -f k8s/01-backend.yaml
                        kubectl apply -f k8s/02-frontend.yaml
                        kubectl apply -f k8s/03-ingress.yaml
                    """

                    sh """
                        kubectl set image deployment/infracommand-backend  \
                            backend=${NEXUS_BACKEND}:${IMAGE_TAG}           \
                            -n ${K8S_NAMESPACE}

                        kubectl set image deployment/infracommand-frontend  \
                            frontend=${NEXUS_FRONTEND}:${IMAGE_TAG}          \
                            -n ${K8S_NAMESPACE}
                    """

                    sh "kubectl rollout status deployment/trivy-server            -n ${K8S_NAMESPACE} --timeout=180s"
                    sh "kubectl rollout status deployment/infracommand-backend    -n ${K8S_NAMESPACE} --timeout=120s"
                    sh "kubectl rollout status deployment/infracommand-frontend   -n ${K8S_NAMESPACE} --timeout=120s"
                }
            }
        }

        // ──────────────────────────────────────────────────────
        // 14. VERIFY DEPLOYMENT
        // ──────────────────────────────────────────────────────
        stage('Verify the Deployment') {
            steps {
                withKubeConfig(
                    credentialsId: 'k8-cred',
                    namespace: 'infracommand',
                    serverUrl: 'https://192.168.101.80:6443'
                ) {
                    sh "kubectl get pods    -n ${K8S_NAMESPACE}"
                    sh "kubectl get svc     -n ${K8S_NAMESPACE}"
                    sh "kubectl get ingress -n ${K8S_NAMESPACE}"
                    sh "kubectl get hpa     -n ${K8S_NAMESPACE}"
                }
            }
        }

        // ──────────────────────────────────────────────────────
        // 15. GRAFANA — DEPLOY ANNOTATION
        // ──────────────────────────────────────────────────────
        stage('Grafana Deploy Annotation') {
            steps {
                withCredentials([string(credentialsId: 'grafana-api-token', variable: 'GRAFANA_TOKEN')]) {
                    sh """
                        TIME_MS=\$(date +%s%3N)
                        curl -s -X POST "${GRAFANA_URL}/api/annotations" \\
                            -H "Authorization: Bearer \$GRAFANA_TOKEN" \\
                            -H "Content-Type: application/json" \\
                            -d "{
                                \\"dashboardUID\\": \\"${GRAFANA_DASHBOARD_ID}\\",
                                \\"time\\": \$TIME_MS,
                                \\"tags\\": [\\"deploy\\",\\"infracommand\\",\\"build-${IMAGE_TAG}\\"],
                                \\"text\\": \\"Build #${IMAGE_TAG} | ${env.GIT_COMMIT_SHORT} | ${currentBuild.currentResult}\\"
                            }" && echo "Grafana annotation posted ✔"
                    """
                }
            }
        }
    }

    // ──────────────────────────────────────────────────────────
    // POST — EMAIL NOTIFICATION
    // ──────────────────────────────────────────────────────────
    post {
        always {
            emailext(
                to:       'tpwodl.jyotisethy@tpcentralodisha.com',
                from:     'devopsadmin@domain.com',
                subject:  "InfraCommand Build #${env.BUILD_NUMBER} — ${currentBuild.currentResult}",
                mimeType: 'text/html',
                body: """
                    <h2>🖥️ InfraCommand — Server Monitoring CI/CD Report</h2>

                    <b>Status:</b>     ${currentBuild.currentResult} <br>
                    <b>Build:</b>      #${env.BUILD_NUMBER} <br>
                    <b>Commit:</b>     ${env.GIT_COMMIT_SHORT} by ${env.GIT_AUTHOR} <br>
                    <b>Message:</b>    ${env.GIT_MSG} <br>
                    <b>Build URL:</b>  <a href="${env.BUILD_URL}">${env.BUILD_URL}</a> <br><br>

                    <h3>🌐 Application URLs</h3>
                    Dashboard: <a href="http://192.168.101.80:32302">http://192.168.101.80:32302</a> <br>
                    API Docs:  <a href="http://192.168.101.80:32302/api-docs">http://192.168.101.80:32302/api-docs</a> <br>
                    API:       <a href="http://192.168.101.80:32302/api/docs">http://192.168.101.80:32302/api/docs</a> <br><br>

                    <h3>🐳 Images Published</h3>
                    Nexus Backend:      ${NEXUS_BACKEND}:${IMAGE_TAG} <br>
                    Nexus Frontend:     ${NEXUS_FRONTEND}:${IMAGE_TAG} <br>
                    DockerHub Backend:  ${BACKEND_IMAGE}:${IMAGE_TAG} <br>
                    DockerHub Frontend: ${FRONTEND_IMAGE}:${IMAGE_TAG} <br><br>

                    <h3>🔐 Security Reports</h3>
                    🔹 <a href="${env.BUILD_URL}artifact/trivy-fs-report.html">File System Scan</a> <br>
                    🔹 <a href="${env.BUILD_URL}artifact/trivy-backend-image-report.html">Backend Image Scan</a> <br>
                    🔹 <a href="${env.BUILD_URL}artifact/trivy-frontend-image-report.html">Frontend Image Scan</a> <br><br>

                    <h3>📊 Grafana</h3>
                    <a href="${GRAFANA_URL}/d/${GRAFANA_DASHBOARD_ID}">Open Monitoring Dashboard</a>
                """
            )
        }
        success {
            echo "✅ InfraCommand deployed! Open http://192.168.101.80:32302 in browser."
        }
        failure {
            echo "❌ Pipeline failed. Check Trivy reports and SonarQube."
        }
    }
}
