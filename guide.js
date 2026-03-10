const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumber, Header, Footer
} = require('docx');
const fs = require('fs');

const C = {
  dark:'0D1B2A', accent:'1A73E8', green:'1E8E3E', orange:'E37400',
  red:'C5221F', purple:'7B2FBE', teal:'007B83', mid:'DADCE0',
  white:'FFFFFF', text:'202124', muted:'5F6368', light:'F8F9FA',
  codebg:'1E2A3A', codefg:'E8F4FD',
};

const b   = (c=C.mid) => ({ style:BorderStyle.SINGLE, size:1, color:c });
const nb  = ()        => ({ style:BorderStyle.NONE,   size:0, color:'FFFFFF' });
const all = (x)       => ({ top:x, bottom:x, left:x, right:x });

const p = (text, opts={}) => new Paragraph({
  spacing:{ after:100 },
  children:[new TextRun({ text, font:'Calibri', size:22, color:C.text, ...opts })]
});
const sp = (n=1) => Array.from({length:n}, ()=>
  new Paragraph({ spacing:{after:0}, children:[new TextRun('')] }));
const cmd = (text) => new Paragraph({
  spacing:{ before:60, after:60 },
  shading:{ fill:C.codebg, type:ShadingType.CLEAR },
  indent:{ left:360, right:360 },
  border:{ left:{ style:BorderStyle.SINGLE, size:18, color:C.accent, space:6 } },
  children:[new TextRun({ text, font:'Courier New', size:18, color:C.codefg })]
});
const cmds = (lines) => lines.map(cmd);
const li = (text) => new Paragraph({
  numbering:{ reference:'bullets', level:0 },
  spacing:{ after:80 },
  children:[new TextRun({ text, font:'Calibri', size:22, color:C.text })]
});
const note = (text, col=C.orange) => new Paragraph({
  spacing:{ before:80, after:80 },
  indent:{ left:360 },
  border:{ left:{ style:BorderStyle.SINGLE, size:16, color:col, space:8 } },
  shading:{ fill:col===C.red?'FFF0F0':col===C.green?'F0FFF4':'FFF8E7', type:ShadingType.CLEAR },
  children:[new TextRun({ text, font:'Calibri', size:20, color:C.text })]
});
const h1 = (text) => new Paragraph({
  heading:HeadingLevel.HEADING_1, pageBreakBefore:true,
  children:[new TextRun({ text, font:'Calibri', size:36, bold:true, color:C.dark })]
});
const h2 = (text) => new Paragraph({
  heading:HeadingLevel.HEADING_2,
  children:[new TextRun({ text, font:'Calibri', size:28, bold:true, color:C.accent })]
});
const h3 = (text) => new Paragraph({
  heading:HeadingLevel.HEADING_3,
  children:[new TextRun({ text, font:'Calibri', size:24, bold:true, color:C.dark })]
});

const th = (text, w, bg=C.dark) => new TableCell({
  borders:all(b(C.mid)), width:{size:w,type:WidthType.DXA},
  shading:{fill:bg,type:ShadingType.CLEAR},
  margins:all(100),
  children:[new Paragraph({ children:[new TextRun({text,font:'Calibri',size:19,bold:true,color:C.white})] })]
});
const td = (text, w, bg=C.white, col=C.text, bold=false, mono=false) => new TableCell({
  borders:all(b(C.mid)), width:{size:w,type:WidthType.DXA},
  shading:{fill:bg,type:ShadingType.CLEAR},
  margins:{ top:70, bottom:70, left:120, right:120 },
  children:[new Paragraph({ children:[new TextRun({text,font:mono?'Courier New':'Calibri',size:mono?18:20,color:col,bold})] })]
});

const row = (cells) => new TableRow({ children:cells });

// ─── Tables ────────────────────────────────────────────────────────────────────
const vmTable = () => new Table({
  width:{size:9360,type:WidthType.DXA},
  columnWidths:[1800,2200,1600,1700,2060],
  rows:[
    row([th('VM Name',1800),th('Role',2200),th('IP',1600),th('Resources',1700),th('Ports',2060)]),
    ...[ ['jenkins-vm',       'Jenkins CI Server',      '192.168.1.10','4GB / 2vCPU','8080 (UI), 50000 (agents)'],
         ['sonar-vm',         'SonarQube Server',       '192.168.1.11','4GB / 2vCPU','9000'],
         ['nexus-vm',         'Nexus Artifact Registry','192.168.1.12','4GB / 2vCPU','8081 (UI), 8082 (Docker)'],
         ['k8s-master',       'Kubernetes Control Plane','192.168.1.20','4GB / 2vCPU','6443 (API)'],
         ['k8s-worker-1',     'Kubernetes Worker Node', '192.168.1.21','4GB / 2vCPU','NodePort 30000-32767'],
         ['grafana-vm',       'Grafana + Prometheus',   '192.168.1.30','2GB / 2vCPU','3000 (Grafana), 9090'],
    ].map(([n,r,ip,res,pt],i) => row([
      td(n,  1800,i%2?C.light:C.white,C.accent,true,true),
      td(r,  2200,i%2?C.light:C.white),
      td(ip, 1600,i%2?C.light:C.white,C.text,false,true),
      td(res,1700,i%2?C.light:C.white,C.muted),
      td(pt, 2060,i%2?C.light:C.white,C.text,false,true),
    ]))
  ]
});

const stagesTable = () => new Table({
  width:{size:9360,type:WidthType.DXA},
  columnWidths:[480,2400,1480,5000],
  rows:[
    row([th('#',480),th('Stage',2400),th('Tool',1480),th('What happens',5000)]),
    ...[
      ['1','Git Checkout',              'Git / GitHub','Clone main · capture commit hash, author, message'],
      ['2','Install Backend Deps',      'pip / Python 3.11','python -m venv venv → pip install -r requirements.txt'],
      ['3','Install Frontend Deps',     'npm / Node 18','npm install in frontend/'],
      ['4','Test Backend',              'pytest','Run pytest tests/ (skips gracefully if none defined)'],
      ['5','Build Frontend',            'npm run build','Production React bundle → frontend/build/'],
      ['6','File System Scan',          'Trivy','Scan source + venv for CVEs, secrets, misconfigs → HTML report'],
      ['7','SonarQube Analysis',        'SonarQube','Static analysis on backend (Python) + frontend/src (JS)'],
      ['8','Quality Gate',              'SonarQube','Wait for gate · abortPipeline:false (warn, not fail)'],
      ['9','Build Backend Docker Image','Docker','docker build FastAPI image · tag for Nexus AND Docker Hub'],
      ['10','Build Frontend Docker Image','Docker','docker build nginx image · tag for Nexus AND Docker Hub'],
      ['11','Scan Backend Image',       'Trivy','CVE scan of backend Docker image layers → HTML report'],
      ['12','Scan Frontend Image',      'Trivy','CVE scan of frontend Docker image layers → HTML report'],
      ['13','Push Images to Nexus',     'Nexus','Push :BUILD_NUMBER + :latest to private Nexus Docker registry'],
      ['14','Push Docker Images',       'Docker Hub','Push :BUILD_NUMBER + :latest to public Docker Hub'],
      ['15','Archive Reports',          'Jenkins','Archive all 3 Trivy HTML reports as build artefacts'],
      ['16','Deploy To Kubernetes',     'Kubernetes','Create namespace · pull secret · apply 4 manifests · rollout wait'],
      ['17','Verify the Deployment',    'Kubernetes','kubectl get pods / svc / ingress / hpa — audit trail in log'],
      ['18','Grafana Deploy Annotation','Grafana','POST annotation to dashboard — correlate metrics with deploys'],
    ].map(([n,s,t,w],i) => row([
      new TableCell({ borders:all(b(C.mid)), width:{size:480,type:WidthType.DXA},
        shading:{fill:i%2?C.accent:C.dark,type:ShadingType.CLEAR}, margins:all(80),
        children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:n,font:'Calibri',size:18,bold:true,color:C.white})]})] }),
      td(s,2400,i%2?C.light:C.white,C.dark,true),
      td(t,1480,i%2?C.light:C.white,C.teal),
      td(w,5000,i%2?C.light:C.white,C.text),
    ]))
  ]
});

const credsTable = () => new Table({
  width:{size:9360,type:WidthType.DXA},
  columnWidths:[2300,1700,5360],
  rows:[
    row([th('Credential ID',2300),th('Type',1700),th('Used in',5360)]),
    ...[
      ['git-credentials',   'Username/Password','Stage 1 — GitHub checkout'],
      ['docker-cred',       'Username/Password','Stage 14 — Docker Hub push'],
      ['nexus-cred',        'Username/Password','Stages 13 & 16 — Nexus push + K8s pull secret'],
      ['k8-cred',           'KubeConfig File',  'Stages 16 & 17 — kubectl apply and verify'],
      ['sonar-token',       'Secret Text',       'Stage 8 — Quality Gate polling'],
      ['grafana-api-token', 'Secret Text',       'Stage 18 — Grafana annotation POST'],
    ].map(([id,t,u],i) => row([
      td(id,2300,i%2?C.light:C.white,C.accent,true,true),
      td(t, 1700,i%2?C.light:C.white,C.purple),
      td(u, 5360,i%2?C.light:C.white,C.text),
    ]))
  ]
});

const urlsTable = () => new Table({
  width:{size:9360,type:WidthType.DXA},
  columnWidths:[2600,2800,3960],
  rows:[
    row([th('Service',2600),th('URL',2800),th('Notes',3960)]),
    ...[
      ['InfraCommand Dashboard', 'http://infracommand.local',         'Add to /etc/hosts: 192.168.1.21  infracommand.local'],
      ['InfraCommand API',       'http://infracommand.local/api/health','FastAPI health endpoint'],
      ['FastAPI Docs (Swagger)', 'http://infracommand.local/api/docs', 'Interactive API docs — auto-generated by FastAPI'],
      ['Jenkins',                'http://192.168.1.10:8080',           'admin / (set during install)'],
      ['SonarQube',              'http://192.168.1.11:9000',           'admin / admin → change on first login'],
      ['Nexus UI',               'http://192.168.1.12:8081',           'admin / (from admin.password file)'],
      ['Nexus Docker Registry',  'http://192.168.1.12:8082',           'Docker registry — K8s pulls images from here'],
      ['Grafana',                'http://192.168.1.30:3000',           'admin / admin → change on first login'],
      ['Prometheus',             'http://192.168.1.30:9090',           'No login — metrics query UI'],
    ].map(([s,u,n],i) => row([
      td(s,2600,i%2?C.light:C.white,C.dark,true),
      td(u,2800,i%2?C.light:C.white,C.accent,false,true),
      td(n,3960,i%2?C.light:C.white,C.muted),
    ]))
  ]
});

// ─── Document ──────────────────────────────────────────────────────────────────
const doc = new Document({
  numbering:{
    config:[{
      reference:'bullets',
      levels:[{ level:0, format:LevelFormat.BULLET, text:'\u2022', alignment:AlignmentType.LEFT,
        style:{paragraph:{indent:{left:540,hanging:260}}} }]
    }]
  },
  styles:{
    default:{document:{run:{font:'Calibri',size:22}}},
    paragraphStyles:[
      {id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,
        run:{size:36,bold:true,font:'Calibri',color:C.dark},paragraph:{spacing:{before:480,after:200},outlineLevel:0}},
      {id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,
        run:{size:28,bold:true,font:'Calibri',color:C.accent},paragraph:{spacing:{before:320,after:160},outlineLevel:1}},
      {id:'Heading3',name:'Heading 3',basedOn:'Normal',next:'Normal',quickFormat:true,
        run:{size:24,bold:true,font:'Calibri',color:C.dark},paragraph:{spacing:{before:240,after:120},outlineLevel:2}},
    ]
  },
  sections:[{
    properties:{
      page:{ size:{width:12240,height:15840}, margin:{top:1080,right:1080,bottom:1080,left:1080} }
    },
    headers:{
      default: new Header({ children:[
        new Paragraph({
          border:{bottom:{style:BorderStyle.SINGLE,size:4,color:C.accent,space:6}},
          children:[new TextRun({text:`InfraCommand — Full DevOps Setup Guide  |  ${new Date().toLocaleDateString('en-GB',{year:'numeric',month:'long'})}`,font:'Calibri',size:18,color:C.muted})]
        })
      ]})
    },
    footers:{
      default: new Footer({ children:[
        new Paragraph({
          border:{top:{style:BorderStyle.SINGLE,size:4,color:C.mid,space:6}},
          children:[
            new TextRun({text:'InfraCommand DevOps  |  Page ',font:'Calibri',size:16,color:C.muted}),
            new TextRun({children:[PageNumber.CURRENT],font:'Calibri',size:16,color:C.muted}),
            new TextRun({text:' of ',font:'Calibri',size:16,color:C.muted}),
            new TextRun({children:[PageNumber.TOTAL_PAGES],font:'Calibri',size:16,color:C.muted}),
          ]
        })
      ]})
    },
    children:[

      // ── Cover ──────────────────────────────────────────────────────────────
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:2000,after:200},
        children:[new TextRun({text:'INFRACOMMAND',font:'Calibri',size:96,bold:true,color:C.dark})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:120},
        children:[new TextRun({text:'Full DevOps Setup & Deployment Guide',font:'Calibri',size:40,color:C.accent})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:80},
        children:[new TextRun({text:'React + FastAPI  ·  Jenkins  ·  Git  ·  Docker  ·  Kubernetes  ·  Trivy  ·  SonarQube  ·  Nexus  ·  Grafana',font:'Calibri',size:24,color:C.muted})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:80},
        children:[new TextRun({text:`${new Date().toLocaleDateString('en-GB',{year:'numeric',month:'long',day:'numeric'})}  ·  v1.0`,font:'Calibri',size:22,color:C.muted})]}),
      ...sp(2),

      // Scope box
      new Table({ width:{size:9360,type:WidthType.DXA}, columnWidths:[9360], rows:[ new TableRow({ children:[
        new TableCell({
          borders:all(b(C.accent)), width:{size:9360,type:WidthType.DXA},
          shading:{fill:'EBF5FF',type:ShadingType.CLEAR},
          margins:all(280),
          children:[
            new Paragraph({spacing:{after:120},children:[new TextRun({text:'What this guide covers',font:'Calibri',size:26,bold:true,color:C.dark})]}),
            li('6 Ubuntu 22.04 VMs — full install from scratch (Jenkins, SonarQube, Nexus, K8s, Grafana)'),
            li('React frontend + Python FastAPI backend — complete application code'),
            li('13-stage Jenkinsfile — Git → pip → npm → Trivy → SonarQube → Docker → Nexus → K8s → Grafana'),
            li('4 Kubernetes manifests — namespace, backend, frontend, ingress, HPA'),
            li('Browser-accessible URL — http://infracommand.local opens the dashboard'),
            li('6 dashboard views — Overview, Resources, Logs, Patches, Alerts, On-demand Vuln Scan'),
            li('Troubleshooting table — 8 most common problems with exact fixes'),
          ]
        })
      ]})]}),

      // ── 1. Architecture ────────────────────────────────────────────────────
      h1('1. Infrastructure Architecture'),
      p('This guide uses 6 Ubuntu 22.04 VMs. Each VM has a single role. Replace 192.168.1.x with your actual IPs throughout.'),
      ...sp(1),
      vmTable(),
      ...sp(1),
      note('Add insecure registry on Jenkins VM and all K8s nodes:\necho \'{"insecure-registries":["192.168.1.12:8082"]}\' | sudo tee /etc/docker/daemon.json && sudo systemctl restart docker', C.orange),
      ...sp(1),
      h2('1.2  Traffic Flow'),
      li('Developer pushes to GitHub → webhook triggers Jenkins'),
      li('Jenkins runs 18 stages — pip install, npm build, Trivy scan, SonarQube, Docker build, Nexus push, K8s deploy'),
      li('Kubernetes worker node pulls images from Nexus via pull secret'),
      li('NGINX Ingress routes http://infracommand.local → frontend; /api → FastAPI backend'),
      li('Grafana reads cluster metrics from Prometheus; Jenkins posts a deploy annotation after each build'),

      // ── 2. Tool Install ────────────────────────────────────────────────────
      h1('2. Install All Tools'),

      h2('2.1  All VMs — common setup'),
      ...cmds([
        'sudo apt update && sudo apt upgrade -y',
        'sudo apt install -y curl wget git unzip apt-transport-https ca-certificates gnupg lsb-release',
      ]),

      h2('2.2  Jenkins VM  (192.168.1.10)'),
      h3('Java + Jenkins'),
      ...cmds([
        'sudo apt install -y fontconfig openjdk-17-jre',
        'sudo wget -O /usr/share/keyrings/jenkins-keyring.asc \\',
        '  https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key',
        'echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \\',
        '  https://pkg.jenkins.io/debian-stable binary/" | sudo tee /etc/apt/sources.list.d/jenkins.list',
        'sudo apt update && sudo apt install -y jenkins',
        'sudo systemctl enable --now jenkins',
        '# Get initial admin password',
        'sudo cat /var/lib/jenkins/secrets/initialAdminPassword',
      ]),
      p('Open http://192.168.1.10:8080 → paste password → Install Suggested Plugins → create admin user.'),
      h3('Docker on Jenkins VM'),
      ...cmds([
        'curl -fsSL https://get.docker.com | sudo sh',
        'sudo usermod -aG docker jenkins && sudo systemctl restart jenkins',
      ]),
      h3('Python 3.11 on Jenkins VM'),
      ...cmds([
        'sudo apt install -y python3.11 python3.11-venv python3-pip',
        'python3.11 --version',
      ]),
      h3('Node.js 18 on Jenkins VM'),
      ...cmds([
        'curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -',
        'sudo apt install -y nodejs && node --version',
      ]),
      h3('Trivy on Jenkins VM'),
      ...cmds([
        'wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | \\',
        '  sudo gpg --dearmor -o /usr/share/keyrings/trivy.gpg',
        'echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] \\',
        '  https://aquasecurity.github.io/trivy-repo/deb generic main" | \\',
        '  sudo tee /etc/apt/sources.list.d/trivy.list',
        'sudo apt update && sudo apt install -y trivy',
      ]),
      h3('kubectl on Jenkins VM'),
      ...cmds([
        'curl -LO "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"',
        'sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl',
      ]),
      h3('Jenkins Plugins (install via Manage Jenkins → Plugins)'),
      li('Pipeline'), li('NodeJS Plugin'), li('Docker Pipeline'),
      li('Kubernetes CLI Plugin'), li('SonarQube Scanner'), li('Email Extension Plugin'),

      ...sp(1),
      h2('2.3  SonarQube VM  (192.168.1.11)'),
      ...cmds([
        'sudo apt install -y openjdk-17-jre',
        'echo "vm.max_map_count=524288" | sudo tee -a /etc/sysctl.conf && sudo sysctl -p',
        'cd /opt && sudo wget https://binaries.sonarsource.com/Distribution/sonarqube/sonarqube-10.3.0.82913.zip',
        'sudo unzip sonarqube-10.3.0.82913.zip && sudo mv sonarqube-10.3.0.82913 sonarqube',
        'sudo useradd -r -s /bin/false sonar && sudo chown -R sonar:sonar /opt/sonarqube',
        'sudo tee /etc/systemd/system/sonarqube.service << EOF',
        '[Unit]',
        'Description=SonarQube',
        '[Service]',
        'Type=forking',
        'ExecStart=/opt/sonarqube/bin/linux-x86-64/sonar.sh start',
        'ExecStop=/opt/sonarqube/bin/linux-x86-64/sonar.sh stop',
        'User=sonar',
        'Restart=on-failure',
        '[Install]',
        'WantedBy=multi-user.target',
        'EOF',
        'sudo systemctl enable --now sonarqube',
      ]),
      p('Open http://192.168.1.11:9000. Login admin/admin. Change password. Generate token: My Account → Security → Generate Token → type: Global Analysis → copy it → add to Jenkins as sonar-token.'),

      ...sp(1),
      h2('2.4  Nexus VM  (192.168.1.12)'),
      ...cmds([
        'sudo apt install -y openjdk-17-jre',
        'cd /opt && sudo wget https://download.sonatype.com/nexus/3/nexus-3.64.0-04-java17-unix.tar.gz',
        'sudo tar -xzf nexus-3.64.0-04-java17-unix.tar.gz && sudo mv nexus-3.64.0-04 nexus',
        'sudo useradd -r -s /bin/false nexus',
        'sudo chown -R nexus:nexus /opt/nexus /opt/sonatype-work',
        'echo "run_as_user=nexus" | sudo tee /opt/nexus/bin/nexus.rc',
        'sudo systemctl enable --now nexus',
        '# Get initial admin password',
        'sudo cat /opt/sonatype-work/nexus3/admin.password',
      ]),
      p('Open http://192.168.1.12:8081 → admin / <password above>. Create Docker hosted repo:'),
      li('Settings → Repositories → Create → docker (hosted)'),
      li('Name: infracommand-docker  ·  HTTP port: 8082  ·  Allow anonymous pull: ✓'),
      li('Save'),

      ...sp(1),
      h2('2.5  Kubernetes — Master (192.168.1.20) + Worker (192.168.1.21)'),
      h3('Both nodes'),
      ...cmds([
        'sudo swapoff -a && sudo sed -i "/swap/d" /etc/fstab',
        'sudo modprobe overlay br_netfilter',
        'sudo tee /etc/sysctl.d/k8s.conf <<EOF',
        'net.bridge.bridge-nf-call-iptables=1',
        'net.ipv4.ip_forward=1',
        'EOF',
        'sudo sysctl --system',
        'sudo apt install -y containerd && containerd config default | sudo tee /etc/containerd/config.toml',
        'sudo sed -i "s/SystemdCgroup = false/SystemdCgroup = true/" /etc/containerd/config.toml',
        'sudo systemctl restart containerd',
        'curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.29/deb/Release.key | \\',
        '  sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg',
        'echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] \\',
        '  https://pkgs.k8s.io/core:/stable:/v1.29/deb/ /" | sudo tee /etc/apt/sources.list.d/kubernetes.list',
        'sudo apt update && sudo apt install -y kubelet kubeadm kubectl',
        'sudo apt-mark hold kubelet kubeadm kubectl',
      ]),
      h3('Master node only'),
      ...cmds([
        'sudo kubeadm init --pod-network-cidr=10.244.0.0/16 --apiserver-advertise-address=192.168.1.20',
        'mkdir -p $HOME/.kube && sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config',
        'sudo chown $(id -u):$(id -g) $HOME/.kube/config',
        'kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml',
        'kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.5/deploy/static/provider/baremetal/deploy.yaml',
        '# Print join command — paste this on worker nodes',
        'kubeadm token create --print-join-command',
      ]),
      h3('Worker node only'),
      ...cmds(['sudo kubeadm join 192.168.1.20:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>']),
      h3('Export kubeconfig to Jenkins'),
      ...cmds([
        'cat ~/.kube/config',
        '# Jenkins → Manage Jenkins → Credentials → Add → KubeConfig file → paste content → ID: k8-cred',
      ]),

      ...sp(1),
      h2('2.6  Grafana VM  (192.168.1.30)'),
      ...cmds([
        '# Prometheus',
        'sudo useradd --no-create-home --shell /bin/false prometheus',
        'cd /tmp && wget https://github.com/prometheus/prometheus/releases/download/v2.49.1/prometheus-2.49.1.linux-amd64.tar.gz',
        'tar -xzf prometheus-2.49.1.linux-amd64.tar.gz',
        'sudo cp prometheus-2.49.1.linux-amd64/prometheus /usr/local/bin/',
        'sudo systemctl enable --now prometheus',
        '# Grafana',
        'wget -q -O - https://apt.grafana.com/gpg.key | sudo apt-key add -',
        'echo "deb https://apt.grafana.com stable main" | sudo tee /etc/apt/sources.list.d/grafana.list',
        'sudo apt update && sudo apt install -y grafana && sudo systemctl enable --now grafana-server',
      ]),
      p('Open http://192.168.1.30:3000 → admin/admin. Add Prometheus data source (http://localhost:9090). Create API key: Administration → API Keys → Editor role → copy → add to Jenkins as grafana-api-token.'),

      // ── 3. Jenkins Config ──────────────────────────────────────────────────
      h1('3. Configure Jenkins'),
      h2('3.1  Global Tools'),
      li('Manage Jenkins → Tools → NodeJS → Add → Name: node18 → Version: 18.x'),
      li('Manage Jenkins → Tools → SonarQube Scanner → Add → Name: sonar-scanner → Install automatically'),
      h2('3.2  SonarQube Server'),
      li('Manage Jenkins → System → SonarQube Servers → Add: Name: sonar · URL: http://192.168.1.11:9000 · Token: sonar-token'),
      h2('3.3  All Credentials'),
      credsTable(),
      ...sp(1),
      h2('3.4  Pipeline Job'),
      li('New Item → name: infracommand → Pipeline → OK'),
      li('Definition: Pipeline script from SCM → Git → URL: https://github.com/jyotirepo/infracommand.git'),
      li('Branch: */main · Script Path: Jenkinsfile → Save'),
      h2('3.5  GitHub Webhook'),
      ...cmds([
        'GitHub repo → Settings → Webhooks → Add:',
        '  Payload URL:  http://192.168.1.10:8080/github-webhook/',
        '  Content type: application/json  · Event: push',
        'Jenkins job → Configure → Build Triggers → ✓ GitHub hook trigger',
      ]),

      // ── 4. Pipeline Stages ─────────────────────────────────────────────────
      h1('4. Pipeline — All 13 Stages'),
      stagesTable(),

      // ── 5. K8s Manifests ───────────────────────────────────────────────────
      h1('5. Kubernetes Manifests'),
      p('Place all files in a k8s/ directory at the repo root. Jenkins applies them in numbered order.'),
      ...sp(1),
      h2('5.1  00-namespace.yaml'),
      ...cmds(['apiVersion: v1','kind: Namespace','metadata:','  name: infracommand']),
      h2('5.2  01-backend.yaml  — FastAPI Deployment + Service'),
      p('Deployment with 2 replicas, Nexus imagePullSecret, health probes on /api/health, resource limits. Service type ClusterIP on port 5000.'),
      h2('5.3  02-frontend.yaml  — React/nginx Deployment + Service'),
      p('Deployment with 2 replicas, nginx serves React build, proxies /api/ to backend service. Service type ClusterIP on port 80.'),
      h2('5.4  03-ingress.yaml  — Browser URL'),
      ...cmds([
        'host: infracommand.local',
        '/api  →  infracommand-backend:5000',
        '/     →  infracommand-frontend:80',
      ]),
      note('Add to /etc/hosts on your local machine:\n192.168.1.21  infracommand.local\nThen open http://infracommand.local in your browser.', C.green),
      h2('5.5  04-hpa.yaml  — Auto-scaling'),
      p('Scale infracommand-backend from 2 to 8 replicas when CPU exceeds 70%.'),

      // ── 6. Browser URLs ────────────────────────────────────────────────────
      h1('6. Browser-Accessible URLs'),
      urlsTable(),

      // ── 7. Verify ──────────────────────────────────────────────────────────
      h1('7. Verification Checklist'),
      h2('7.1  Kubernetes'),
      ...cmds([
        'kubectl get nodes                       # both nodes Ready',
        'kubectl get pods -n infracommand        # all pods Running',
        'kubectl get svc   -n infracommand       # services listed',
        'kubectl get ingress -n infracommand     # ADDRESS filled',
        'kubectl get hpa   -n infracommand       # TARGETS showing',
      ]),
      h2('7.2  Browser checks'),
      li('http://infracommand.local — React dashboard loads'),
      li('http://infracommand.local/api/health — {"status":"ok"} response'),
      li('http://infracommand.local/api/docs — Swagger UI (auto-generated by FastAPI)'),
      li('http://192.168.1.10:8080 — Jenkins, last build green'),
      li('http://192.168.1.11:9000 — SonarQube, project InfraCommand shows analysis'),
      li('http://192.168.1.12:8081 — Nexus, repository has new images'),
      li('http://192.168.1.30:3000 — Grafana, deploy annotation visible'),
      h2('7.3  Rollback'),
      ...cmds([
        'kubectl rollout undo deployment/infracommand-backend  -n infracommand',
        'kubectl rollout undo deployment/infracommand-frontend -n infracommand',
      ]),

      // ── 8. Troubleshooting ─────────────────────────────────────────────────
      h1('8. Troubleshooting'),
      new Table({
        width:{size:9360,type:WidthType.DXA}, columnWidths:[3200,6160],
        rows:[
          row([th('Problem',3200),th('Fix',6160)]),
          ...[
            ['Pod stuck ImagePullBackOff',  'Check nexus-pull-secret exists in infracommand namespace. Check /etc/docker/daemon.json has 192.168.1.12:8082 as insecure-registry on worker nodes.'],
            ['Ingress has no ADDRESS',      'NGINX Ingress controller not running. Run: kubectl get pods -n ingress-nginx'],
            ['infracommand.local not found','Add 192.168.1.21  infracommand.local to /etc/hosts on your local machine (use worker node IP, not master).'],
            ['FastAPI returns 502',         'Backend pod is not healthy. Check: kubectl logs -n infracommand deploy/infracommand-backend'],
            ['Quality Gate never returns',  'Add sonar-token to Jenkins credentials. Add webhook in SonarQube → Administration → Webhooks pointing to Jenkins.'],
            ['Nexus push: unauthorized',    'Verify nexus-cred in Jenkins is correct username/password. Check Nexus Docker repo has HTTP port 8082 enabled.'],
            ['Jenkins cannot reach K8s',    'Regenerate kubeconfig on master node: cat ~/.kube/config → re-save as k8-cred in Jenkins.'],
            ['Grafana annotation fails',    'Confirm grafana-api-token has Editor role. Verify GRAFANA_URL in Jenkinsfile matches your Grafana IP.'],
          ].map(([pr,fx],i) => row([
            td(pr,3200,i%2?C.light:C.white,'C5221F',true),
            td(fx,6160,i%2?C.light:C.white,C.text),
          ]))
        ]
      }),

      ...sp(2),
      new Paragraph({ alignment:AlignmentType.CENTER,
        children:[new TextRun({text:'InfraCommand DevOps  ·  React + FastAPI  ·  Full Setup Guide  ·  CONFIDENTIAL',font:'Calibri',size:18,color:C.muted})]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('/mnt/user-data/outputs/InfraCommand-Setup-Guide.docx', buf);
  console.log('Done');
});
