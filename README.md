# InfraCommand — Centralized Server Monitoring & Vulnerability Management

A production-grade, Kubernetes-deployable monitoring dashboard built with React + FastAPI.

## 🗂 Project Structure

```
infracommand/
├── backend/                        # Python FastAPI API server
│   ├── main.py                     # All API endpoints
│   ├── requirements.txt            # Python dependencies
│   ├── Dockerfile                  # python:3.11-slim image
│   ├── .env.example                # Environment variable template
│   └── tests/
│       ├── __init__.py
│       └── test_api.py             # pytest test suite (18 tests)
│
├── frontend/                       # React dashboard
│   ├── public/
│   │   └── index.html              # HTML entry point
│   ├── src/
│   │   ├── App.jsx                 # Main app — all 6 views
│   │   ├── index.js                # React entry point
│   │   ├── index.css               # Global dark theme CSS
│   │   └── api/
│   │       └── client.js           # All axios API calls
│   ├── package.json                # npm dependencies
│   ├── Dockerfile                  # Multi-stage: node build → nginx serve
│   └── nginx.conf                  # Proxy /api/ to backend service
│
├── k8s/                            # Kubernetes manifests
│   ├── 00-namespace.yaml           # Namespace: infracommand
│   ├── 01-backend.yaml             # FastAPI Deployment + ClusterIP Service
│   ├── 02-frontend.yaml            # React/nginx Deployment + ClusterIP Service
│   ├── 03-ingress.yaml             # Ingress → http://infracommand.local
│   └── 04-hpa.yaml                 # HorizontalPodAutoscaler (2–8 replicas)
│
├── Jenkinsfile                     # 13-stage CI/CD pipeline
├── docker-compose.yml              # Local development
└── README.md                       # This file
```

## 🛠 Tech Stack

| Layer    | Technology               |
|----------|--------------------------|
| Frontend | React 18 + Recharts      |
| Backend  | Python 3.11 + FastAPI    |
| Server   | Uvicorn (ASGI)           |
| Nginx    | Reverse proxy for React  |
| CI/CD    | Jenkins (13 stages)      |
| Registry | Nexus (primary) + DockerHub |
| Deploy   | Kubernetes (kubeadm)     |
| Security | Trivy (FS + image scans) |
| Quality  | SonarQube + Quality Gate |
| Monitor  | Grafana + Prometheus     |

## 🖥 Dashboard Views

| View         | Description |
|--------------|-------------|
| Overview     | Host/VM count KPIs + 24h CPU/RAM charts + host table |
| Resources    | Per-host CPU/RAM/Disk/Network gauges + VM table |
| Logs         | Live system logs — filterable by host and level |
| Patches & OS | OS version, kernel, last patch date, patch status |
| Alerts       | Auto-generated from live metrics, dismissible |
| Vuln Scan    | On-demand CVE scanner — click to scan, download report |

## 🚀 Quick Start (Local)

### Option 1 — Docker Compose
```bash
git clone https://github.com/jyotirepo/infracommand.git
cd infracommand
docker-compose up --build
```
Open http://localhost:3000

### Option 2 — Manual
```bash
# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 5000

# Frontend (new terminal)
cd frontend
npm install
REACT_APP_API_URL=http://localhost:5000/api npm start
```
Open http://localhost:3000

## 🧪 Run Tests
```bash
cd backend
source venv/bin/activate
pip install httpx pytest
pytest tests/ -v
```

## ☸️ Deploy to Kubernetes

```bash
# 1. Build and push images to Nexus
docker build -t 192.168.1.12:8082/infracommand-backend:1  ./backend
docker build -t 192.168.1.12:8082/infracommand-frontend:1 ./frontend
docker push 192.168.1.12:8082/infracommand-backend:1
docker push 192.168.1.12:8082/infracommand-frontend:1

# 2. Apply manifests
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-backend.yaml
kubectl apply -f k8s/02-frontend.yaml
kubectl apply -f k8s/03-ingress.yaml
kubectl apply -f k8s/04-hpa.yaml

# 3. Add to /etc/hosts on your machine
echo "192.168.1.21  infracommand.local" | sudo tee -a /etc/hosts

# 4. Open in browser
# http://infracommand.local
```

## 🔌 API Endpoints

| Method | Endpoint                        | Description                    |
|--------|---------------------------------|--------------------------------|
| GET    | /api/health                     | Health check                   |
| GET    | /api/summary                    | Global KPI summary             |
| GET    | /api/hosts                      | All hosts with live metrics    |
| GET    | /api/hosts/{id}                 | Single host details            |
| POST   | /api/hosts                      | Add a new host                 |
| DELETE | /api/hosts/{id}                 | Remove a host                  |
| GET    | /api/hosts/{id}/metrics         | Live metrics for host          |
| GET    | /api/metrics/history            | 24h history for charts         |
| GET    | /api/logs                       | All logs (filterable)          |
| GET    | /api/hosts/{id}/logs            | Logs for specific host         |
| GET    | /api/patches                    | Patch status for all hosts     |
| GET    | /api/alerts                     | Auto-generated alerts          |
| POST   | /api/hosts/{id}/scan            | Trigger on-demand vuln scan    |
| GET    | /api/hosts/{id}/scan            | Get last scan result           |
| GET    | /api/scans                      | All scan results               |

Interactive Swagger docs: http://infracommand.local/api/docs

## 🔐 Jenkins Credentials Required

| ID                  | Type               | Used For                        |
|---------------------|--------------------|---------------------------------|
| git-credentials     | Username/Password  | GitHub checkout                 |
| docker-cred         | Username/Password  | Docker Hub push                 |
| nexus-cred          | Username/Password  | Nexus push + K8s pull secret    |
| k8-cred             | KubeConfig File    | kubectl apply and verify        |
| sonar-token         | Secret Text        | SonarQube Quality Gate          |
| grafana-api-token   | Secret Text        | Grafana deploy annotation       |

## 🌐 All Service URLs

| Service               | URL                              |
|-----------------------|----------------------------------|
| InfraCommand App      | http://infracommand.local        |
| InfraCommand API Docs | http://infracommand.local/api/docs |
| Jenkins               | http://192.168.1.10:8080         |
| SonarQube             | http://192.168.1.11:9000         |
| Nexus UI              | http://192.168.1.12:8081         |
| Nexus Docker Registry | http://192.168.1.12:8082         |
| Grafana               | http://192.168.1.30:3000         |
| Prometheus            | http://192.168.1.30:9090         |
