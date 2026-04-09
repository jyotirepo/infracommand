# InfraCommand

InfraCommand is a full-stack infrastructure monitoring and vulnerability-scanning platform for mixed environments (Linux hosts, Windows hosts, KVM VMs, Hyper-V VMs).

It includes:
- **Backend**: FastAPI service for inventory, telemetry collection, patch status, logs, and scans.
- **Frontend**: React dashboard for operations teams.
- **Scanner integration**: Trivy-based vulnerability scanning with asynchronous scan jobs.
- **Deployment assets**: Docker, Docker Compose, and Kubernetes manifests.

---

## 1) Who is this for?

This README is written for new contributors/operators who want to:
- Run InfraCommand locally.
- Deploy InfraCommand to Kubernetes.
- Understand how Linux vs Windows scanning works.
- Troubleshoot common scan issues quickly.

---

## 2) Repository layout

```text
infracommand/
├── backend/
│   ├── main.py                # FastAPI app + API routes + background scan jobs
│   ├── collectors.py          # SSH/WinRM collectors, patch and vulnerability logic
│   ├── database.py            # SQLAlchemy models and persistence helpers
│   ├── auth.py                # RBAC permissions
│   ├── auth_routes.py         # Auth/user routes
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile
│   └── tests/
├── frontend/
│   ├── src/App.jsx            # Main UI
│   ├── src/api/client.js      # API client wrapper
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── k8s/
│   ├── 00-namespace.yaml
│   ├── 01-backend.yaml
│   ├── 02-frontend.yaml
│   ├── 03-ingress.yaml
│   ├── 04-hpa.yaml
│   ├── 05-trivy.yaml
│   └── 06-rbac.yaml
├── docker-compose.yml
├── Jenkinsfile
└── README.md
```

---

## 3) Core capabilities

- Host/VM inventory and resource monitoring.
- Linux collection over **SSH**.
- Windows collection over **WinRM**.
- Patch visibility (Linux package updates + Windows update/hotfix information).
- Vulnerability scan orchestration:
  - Linux: Trivy rootfs workflow.
  - Windows: WinRM update/hotfix + Trivy SBOM workflow.
- Async scan execution with status polling endpoints.

---

## 4) Prerequisites

### System
- Linux/macOS shell environment for local dev.
- Python **3.10+** (3.11 recommended).
- Node.js **18+** and npm.
- Docker (for compose/container flows).
- Optional: Kubernetes cluster (`kubectl`) for in-cluster deployment.

### Access/network
- Reachability to target hosts:
  - Linux: SSH (default 22).
  - Windows: WinRM (default 5985/5986).
- If using Trivy server mode, backend must reach Trivy service endpoint(s).

---

## 5) Quick start (local development)

### Option A — Docker Compose (fastest)

```bash
git clone <your-fork-or-origin-url>
cd infracommand
docker compose up --build
```

Open:
- Frontend: http://localhost:3000
- Backend docs (if mapped by compose): http://localhost:5000/docs or `/api/docs` via frontend proxy

### Option B — Run backend/frontend separately

#### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 5000
```

#### Frontend (new terminal)
```bash
cd frontend
npm install
REACT_APP_API_URL=http://localhost:5000/api npm start
```

Open http://localhost:3000

---

## 6) Running tests

From repo root:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install pytest httpx
pytest -q
```

> `httpx` is required by FastAPI/Starlette test client.

---

## 7) Configuration (important environment variables)

Backend scanning behavior is controlled by environment variables.

| Variable | Purpose | Default |
|---|---|---|
| `TRIVY_BINARY_PATH` | Path to trivy binary on backend container/host | `/usr/local/bin/trivy` |
| `TRIVY_SERVER_URL` | Primary Trivy server endpoint | `http://trivy-server.infracommand.svc.cluster.local:4954` |
| `TRIVY_SERVER_EXTERNAL_URL` | Secondary/failover endpoint | `http://192.168.101.80:4954` |
| `TRIVY_SKIP_DB_UPDATE` | If `true`, avoid Trivy DB update attempts | `false` |

---

## 8) Vulnerability scanning behavior

### Linux targets
- Uses SSH to collect package metadata.
- Builds a minimal rootfs package view.
- Attempts Trivy scan via server endpoint(s).
- If server endpoints fail, local Trivy fallback may be used (depending on runtime setup).

### Windows targets
- Uses WinRM to collect Windows Update / hotfix data.
- Builds SBOM from installed software entries.
- Attempts Trivy SBOM vulnerability scan.
- Results are merged and returned in a unified response.

---

## 9) API quick reference

### Health and summary
- `GET /api/health`
- `GET /api/summary`

### Hosts
- `GET /api/hosts`
- `POST /api/hosts`
- `GET /api/hosts/{id}`
- `DELETE /api/hosts/{id}`

### Scans
- `POST /api/hosts/{id}/scan` (start async scan)
- `GET /api/hosts/{id}/scan/status` (poll progress)
- `GET /api/hosts/{id}/scan` (latest result)
- `GET /api/scans` (all latest scan records)

### VMs
- `POST /api/hosts/{hid}/vms/{vid}/scan`
- `GET /api/hosts/{hid}/vms/{vid}/scan/status`
- `GET /api/hosts/{hid}/vms/{vid}/scan`

OpenAPI docs are available from the backend docs route (for example `/api/docs` behind ingress).

---

## 10) Kubernetes deployment

Typical flow:

```bash
# 1) Build images
# (update image tags/registry to your environment)
docker build -t <registry>/infracommand-backend:<tag> ./backend
docker build -t <registry>/infracommand-frontend:<tag> ./frontend

# 2) Push images
docker push <registry>/infracommand-backend:<tag>
docker push <registry>/infracommand-frontend:<tag>

# 3) Deploy manifests
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-backend.yaml
kubectl apply -f k8s/02-frontend.yaml
kubectl apply -f k8s/03-ingress.yaml
kubectl apply -f k8s/04-hpa.yaml
kubectl apply -f k8s/05-trivy.yaml
kubectl apply -f k8s/06-rbac.yaml
```

Then verify:
```bash
kubectl -n infracommand get pods
kubectl -n infracommand get svc
kubectl -n infracommand get ingress
```

---

## 11) Troubleshooting guide

### A) Linux scan fails with Trivy server EOF/connection refused
1. Check Trivy server pod/service:
   ```bash
   kubectl -n infracommand get pods,svc | grep -i trivy
   ```
2. Verify backend can resolve/reach configured endpoint.
3. Confirm `TRIVY_SERVER_URL` and `TRIVY_SERVER_EXTERNAL_URL` are correct for your network topology.
4. Confirm Trivy binary exists at `TRIVY_BINARY_PATH` inside backend runtime.

### B) Windows scan hangs or returns only update/hotfix entries
1. Validate WinRM connectivity and credentials.
2. Ensure firewall allows 5985/5986.
3. Check backend logs for WinRM transport errors.
4. Check backend logs for Trivy SBOM step warnings (scan may continue with only Windows Update/hotfix data).

### C) Tests fail at import time with `httpx` missing
Install test extras:
```bash
pip install httpx pytest
```

---

## 12) Security notes

- Use least-privilege credentials for monitored hosts.
- Prefer secured WinRM configuration in production.
- Protect secrets via Kubernetes Secrets / CI secret stores.
- Restrict ingress exposure and API access with RBAC.

---

## 13) Contributing

1. Fork and create a feature branch.
2. Make focused changes with clear commit messages.
3. Run lint/tests locally.
4. Open a PR with:
   - Problem statement
   - What changed
   - Validation steps
   - Any operational impact/migration notes

---

## 14) Maintainer checklist for new deployments

- [ ] Backend and frontend images built and pushed.
- [ ] Kubernetes manifests applied in correct order.
- [ ] Ingress host/DNS configured.
- [ ] Trivy server reachable from backend.
- [ ] At least one Linux + one Windows host validated.
- [ ] Scan status and report download tested from UI.

---

For production operations, see the dedicated SRE runbook: **[`README-OPERATIONS.md`](README-OPERATIONS.md)**.
