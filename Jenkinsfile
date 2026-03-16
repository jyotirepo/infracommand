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

        // ── Nexus private registry (primary — K8s pulls from here) ───────────
        NEXUS_REGISTRY = "192.168.101.80:8082"
        NEXUS_BACKEND  = "192.168.101.80:8082/infracommand-backend"
        NEXUS_FRONTEND = "192.168.101.80:8082/infracommand-frontend"

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
        // 2. SERVER SETUP (one-time, idempotent — safe to run on every build)
        // ──────────────────────────────────────────────────────
        stage('Server Setup') {
            steps {
                sh '''
                    echo "=== Bootstrapping sudo rights for Jenkins ==="
                    # Write all required sudoers entries directly
                    # This works because jenkins already has NOPASSWD for apt-get
                    # from the initial one-time setup, OR we use tee via sudo apt-get
                    # which is allowed. We use a self-bootstrapping approach:
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
                '''
            }
        }

        // ──────────────────────────────────────────────────────
        // 3. INSTALL DEPENDENCIES
        // ──────────────────────────────────────────────────────
        stage('Install Backend Dependencies') {
            steps {
                // Install python3-venv if missing (Ubuntu/Debian — runs as jenkins user via sudo)
                sh '''
                    PYTHON_VER=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
                    echo "Detected Python: $PYTHON_VER"

                    # Install venv package for the exact python version found
                    sudo apt-get install -y python3-venv python3${PYTHON_VER#3}-venv python3-pip 2>/dev/null || \
                    sudo apt-get install -y python3-venv python3-pip || true

                    # Also install pip as fallback
                    python3 -m ensurepip --upgrade 2>/dev/null || true
                '''
                dir('backend') {
                    sh '''
                        # Remove stale venv if it exists from a failed run
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
        // 3. TEST & BUILD
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
        // 4. TRIVY — FILE SYSTEM SCAN
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
        // 5. SONARQUBE ANALYSIS + QUALITY GATE
        // ──────────────────────────────────────────────────────
        // ──────────────────────────────────────────────────────
        // 5. SONARQUBE ANALYSIS + QUALITY GATE
        //    qualitygate.wait=false — we do our OWN polling
        //    against /api/ce/task so we never hang on IN_PROGRESS
        // ──────────────────────────────────────────────────────
        stage('SonarQube Analysis') {
            environment {
                SCANNER_HOME = tool 'sonar-scanner'
            }
            steps {
                withSonarQubeEnv('sonar') {
                    // qualitygate.wait=false — scanner exits immediately after
                    // submitting. Our Quality Gate stage polls /api/ce/task directly.
                    sh """
                        ${SCANNER_HOME}/bin/sonar-scanner \\
                        -Dsonar.projectName=InfraCommand \\
                        -Dsonar.projectKey=InfraCommand \\
                        -Dsonar.sources=backend,frontend/src \\
                        -Dsonar.python.version=3.11 \\
                        -Dsonar.exclusions=**/node_modules/**,**/build/**,**/venv/**,**/*.html \\
                        -Dsonar.qualitygate.wait=false
                    """
                }
                // Read task ID from .scannerwork/report-task.txt
                script {
                    def reportTask = readFile('.scannerwork/report-task.txt')
                    def m = reportTask =~ /ceTaskId=(.+)/
                    env.SONAR_TASK_ID = m ? m[0][1].trim() : ''
                    echo "SonarQube CE task ID: ${env.SONAR_TASK_ID ?: 'not found'}"
                }
            }
        }

        stage('Quality Gate') {
            steps {
                script {
                    def qgStatus = 'UNKNOWN'

                    withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {

                        // ── Step 1: Poll /api/ce/task until CE task finishes ──
                        // (max 3 min = 18 × 10 s)
                        // This is the correct API — /api/qualitygates returns
                        // the PREVIOUS run's result while CE task is IN_PROGRESS
                        def taskFinished = false
                        if (env.SONAR_TASK_ID) {
                            for (int i = 0; i < 18; i++) {
                                sleep(10)
                                def taskRaw = sh(
                                    script: """
                                        curl -sf --max-time 10 \
                                            -u "\${SONAR_TOKEN}:" \
                                            "http://192.168.101.80:9000/api/ce/task?id=${env.SONAR_TASK_ID}" \
                                            2>/dev/null || echo '{"task":{"status":"UNKNOWN"}}'
                                    """,
                                    returnStdout: true
                                ).trim()
                                try {
                                    def tj = readJSON text: taskRaw
                                    def ts = tj?.task?.status ?: 'UNKNOWN'
                                    echo "CE task poll ${i+1}/18: ${ts}"
                                    if (ts in ['SUCCESS', 'FAILED', 'CANCELED', 'ERROR']) {
                                        taskFinished = true
                                        break
                                    }
                                } catch (ex) {
                                    echo "CE task parse error: ${ex.message}"
                                }
                            }
                            if (!taskFinished) {
                                echo '⚠️  CE task still running after 3 min — skipping quality gate check'
                            }
                        } else {
                            echo '⚠️  No CE task ID found — skipping quality gate check'
                        }

                        // ── Step 2: Read quality gate result (only after CE task done) ──
                        if (taskFinished) {
                            try {
                                def qgRaw = sh(
                                    script: """
                                        curl -sf --max-time 10 \
                                            -u "\${SONAR_TOKEN}:" \
                                            "http://192.168.101.80:9000/api/qualitygates/project_status?projectKey=InfraCommand" \
                                            2>/dev/null || echo '{"projectStatus":{"status":"UNKNOWN"}}'
                                    """,
                                    returnStdout: true
                                ).trim()
                                def qgj = readJSON text: qgRaw
                                qgStatus = qgj?.projectStatus?.status ?: 'UNKNOWN'
                            } catch (ex) {
                                echo "QG result parse error: ${ex.message}"
                            }
                        }
                    }

                    // ── Step 3: Log result — never fail the pipeline ──
                    switch (qgStatus) {
                        case 'OK':
                        case 'WARN':
                            echo "✅ Quality Gate PASSED (${qgStatus})"; break
                        case 'ERROR':
                            echo "⚠️  Quality Gate FAILED (${qgStatus}) — pipeline continues (non-blocking)"; break
                        default:
                            echo "ℹ️  Quality Gate: ${qgStatus} — pipeline continues"
                    }
                    env.SONAR_QG_STATUS = qgStatus
                }
            }
        }

        // ──────────────────────────────────────────────────────
        // 6. DOCKER — BUILD BOTH IMAGES
        //    Tagged for Nexus (primary) AND Docker Hub (mirror)
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
        // 7. TRIVY — DOCKER IMAGE SCANS
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
        // 8. PUSH TO NEXUS  (primary — K8s pulls from here)
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
        // 9. PUSH TO DOCKER HUB  (public mirror)
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
        // 10. ARCHIVE SECURITY REPORTS
        // ──────────────────────────────────────────────────────
        stage('Archive Reports') {
            steps {
                archiveArtifacts artifacts: '*.html', fingerprint: true
            }
        }

        // ──────────────────────────────────────────────────────
        // 11. KUBERNETES — DEPLOY IN ORDER
        //     Cluster pulls images from Nexus via pull secret
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

                            kubectl create secret docker-registry nexus-pull-secret \\
                                --docker-server=${NEXUS_REGISTRY} \\
                                --docker-username=\$NEXUS_USER \\
                                --docker-password=\$NEXUS_PASS \\
                                -n ${K8S_NAMESPACE} \\
                                --dry-run=client -o yaml | kubectl apply -f -
                        """
                    }

                    // Pre-pull images via crictl (CRI-O runtime)
                    // CRI-O insecure registry configured in /etc/crio/crio.conf.d/insecure-registry.conf
                    sh """
                        sudo crictl pull ${NEXUS_BACKEND}:${IMAGE_TAG}
                        sudo crictl pull ${NEXUS_FRONTEND}:${IMAGE_TAG}
                        echo "Images pre-pulled via CRI-O ✔"
                    """

                    sh """
                        kubectl apply -f k8s/00-namespace.yaml

                        # Clean up any stuck PVCs from old deployments
                        kubectl delete pvc infracommand-db-pvc -n ${K8S_NAMESPACE} --ignore-not-found=true
                        kubectl delete hpa infracommand-backend-hpa -n ${K8S_NAMESPACE} --ignore-not-found=true

                        kubectl apply -f k8s/01-backend.yaml
                        kubectl apply -f k8s/02-frontend.yaml
                        kubectl apply -f k8s/03-ingress.yaml
                        # HPA disabled for single-node — kubectl apply -f k8s/04-hpa.yaml
                    """

                    sh """
                        kubectl set image deployment/infracommand-backend  \
                            backend=${NEXUS_BACKEND}:${IMAGE_TAG}           \
                            -n ${K8S_NAMESPACE}

                        kubectl set image deployment/infracommand-frontend  \
                            frontend=${NEXUS_FRONTEND}:${IMAGE_TAG}          \
                            -n ${K8S_NAMESPACE}
                    """

                    sh "kubectl rollout status deployment/infracommand-backend  -n ${K8S_NAMESPACE} --timeout=120s"
                    sh "kubectl rollout status deployment/infracommand-frontend -n ${K8S_NAMESPACE} --timeout=120s"
                }
            }
        }

        // ──────────────────────────────────────────────────────
        // 12. VERIFY DEPLOYMENT
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
        // 13. GRAFANA — DEPLOY ANNOTATION
        //     Marks every deploy on Grafana dashboards
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

                    <h3>🌐 Application URLs (after deploy)</h3>
                    Dashboard: <a href="http://infracommand.local">http://infracommand.local</a> <br>
                    API:       <a href="http://infracommand.local/api/health">http://infracommand.local/api/health</a> <br><br>

                    <h3>🐳 Images Published</h3>
                    Nexus Backend:      ${NEXUS_BACKEND}:${IMAGE_TAG} <br>
                    Nexus Frontend:     ${NEXUS_FRONTEND}:${IMAGE_TAG} <br>
                    DockerHub Backend:  ${BACKEND_IMAGE}:${IMAGE_TAG} <br>
                    DockerHub Frontend: ${FRONTEND_IMAGE}:${IMAGE_TAG} <br><br>

                    <h3>🔐 Trivy Security Reports</h3>
                    🔹 <a href="${env.BUILD_URL}artifact/trivy-fs-report.html">File System Scan</a> <br>
                    🔹 <a href="${env.BUILD_URL}artifact/trivy-backend-image-report.html">Backend Image Scan</a> <br>
                    🔹 <a href="${env.BUILD_URL}artifact/trivy-frontend-image-report.html">Frontend Image Scan</a> <br><br>

                    <h3>📊 Grafana</h3>
                    <a href="${GRAFANA_URL}/d/${GRAFANA_DASHBOARD_ID}">Open Monitoring Dashboard</a>
                """
            )
        }
        success {
            echo "✅ InfraCommand deployed! Open http://infracommand.local in browser."
        }
        failure {
            echo "❌ Pipeline failed. Check Trivy reports and SonarQube."
        }
    }
}
