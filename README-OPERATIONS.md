# InfraCommand Operations Runbook (SRE)

This runbook is for SRE/operations teams running InfraCommand in production.

It focuses on:
- day-2 operations,
- incident response,
- backup and restore,
- upgrade and rollback,
- scanning reliability checks.

---

## 1) Service map

InfraCommand runtime components:
- `backend` (FastAPI API + scan orchestrator)
- `frontend` (React + nginx)
- `trivy-server` (vulnerability DB/RPC service)
- data store used by backend (`backend/data/...` persistence path inside runtime)

Kubernetes manifests (default):
- `k8s/00-namespace.yaml`
- `k8s/01-backend.yaml`
- `k8s/02-frontend.yaml`
- `k8s/03-ingress.yaml`
- `k8s/04-hpa.yaml`
- `k8s/05-trivy.yaml`
- `k8s/06-rbac.yaml`

---

## 2) SLO/SLA suggestions (customize)

Recommended starting targets:
- API availability (`/api/health`): **99.9%** monthly.
- Scan request acceptance (`POST /scan`): **99.5%** monthly.
- Scan completion time (P95):
  - Linux: **< 10 minutes**
  - Windows: **< 12 minutes**
- Failed scan ratio: **< 5%** over rolling 1h.

---

## 3) Daily/shift checks

## Kubernetes health
```bash
kubectl -n infracommand get pods -o wide
kubectl -n infracommand get svc
kubectl -n infracommand get ingress
```

## Backend readiness
```bash
kubectl -n infracommand logs deploy/infracommand-backend --tail=200
kubectl -n infracommand exec deploy/infracommand-backend -- curl -fsS http://localhost:5000/api/health
```

## Trivy server readiness
```bash
kubectl -n infracommand logs deploy/trivy-server --tail=200
kubectl -n infracommand get endpoints trivy-server
```

---

## 4) Alerting recommendations

Create alerts for:
- backend pod restart storm (`restarts > 3 in 10m`),
- trivy-server unavailable (`endpoints=0` or repeated connection refused),
- scan timeout spike,
- API 5xx rate threshold breach,
- latency and error budget burn rate,
- node disk pressure (scan jobs can use temp storage).

Suggested severity policy:
- **P1**: API down, all scans failing, data loss risk.
- **P2**: elevated scan failures/timeouts, degraded performance.
- **P3**: intermittent host-specific failures, warning-level SLO drift.

---

## 5) Incident playbooks

### A. Linux scan failures (`EOF`, `connection refused`, `twirp ...`)

1. Check trivy-server pods/services/endpoints:
```bash
kubectl -n infracommand get pods,svc,endpoints | grep -i trivy
```
2. Inspect logs:
```bash
kubectl -n infracommand logs deploy/trivy-server --tail=300
kubectl -n infracommand logs deploy/infracommand-backend --tail=300 | grep -Ei 'trivy|scan|twirp|timeout'
```
3. Validate env in backend deployment:
```bash
kubectl -n infracommand get deploy infracommand-backend -o yaml | grep -E 'TRIVY_SERVER_URL|TRIVY_SERVER_EXTERNAL_URL|TRIVY_SKIP_DB_UPDATE|TRIVY_BINARY_PATH'
```
4. If required, restart backend + trivy-server during maintenance window:
```bash
kubectl -n infracommand rollout restart deploy/infracommand-backend
kubectl -n infracommand rollout restart deploy/trivy-server
```

### B. Windows scan stuck/slow

1. Validate WinRM path from backend network.
2. Confirm credentials, firewall ports (5985/5986), and target responsiveness.
3. Inspect backend logs for WinRM warnings/timeouts.
4. Re-run scan and verify `scan/status` transitions from `running` to terminal state.

### C. API degraded/high 5xx

1. Inspect backend logs and pod resource usage.
2. Check DB/storage path health and disk space.
3. Scale backend temporarily:
```bash
kubectl -n infracommand scale deploy/infracommand-backend --replicas=3
```
4. If issue persists, roll back to previous image tag (see rollback section).

---

## 6) Backup procedure

> Adapt paths/storage class for your environment. If backend persistence is mounted via PVC, back up that volume regularly.

## What to back up
- backend persisted DB/data directory,
- host configuration inventory,
- Kubernetes manifests/Helm values used in production,
- secret material references (not plain-text exports).

## Example (PVC snapshot approach)
1. Use CSI `VolumeSnapshot` policy.
2. Schedule snapshot every 6h (or per RPO).
3. Retain daily snapshots for 14 days (example policy).

## Example (file-level backup from pod)
```bash
kubectl -n infracommand exec deploy/infracommand-backend -- tar czf /tmp/infracommand-data.tgz /app/backend/data
kubectl -n infracommand cp <backend-pod>:/tmp/infracommand-data.tgz ./infracommand-data-$(date +%F).tgz
```

---

## 7) Restore procedure

1. Deploy matching app version/manifests first.
2. Stop writes/scan jobs temporarily (maintenance mode).
3. Restore backend data volume/files.
4. Restart backend deployment.
5. Validate:
```bash
curl -fsS http://<app-host>/api/health
# Check hosts list and latest scan records in UI/API
```
6. Resume traffic and monitor error/latency for 30-60 min.

---

## 8) Upgrade procedure

1. Pre-checks
- confirm cluster capacity,
- verify backups are recent and restorable,
- note current image tags and commit SHA.

2. Stage
- deploy to non-prod/staging,
- run smoke checks:
  - login and dashboard load,
  - host list and metrics,
  - Linux scan and Windows scan,
  - scan status transitions and report output.

3. Production rollout
```bash
kubectl -n infracommand set image deploy/infracommand-backend backend=<registry>/infracommand-backend:<new-tag>
kubectl -n infracommand set image deploy/infracommand-frontend frontend=<registry>/infracommand-frontend:<new-tag>
kubectl -n infracommand rollout status deploy/infracommand-backend
kubectl -n infracommand rollout status deploy/infracommand-frontend
```

4. Post-checks
- API health,
- error rate,
- scan success ratio,
- UI functionality.

---

## 9) Rollback procedure

Trigger rollback if:
- repeated 5xx spike,
- scan success ratio falls below threshold,
- severe functionality regression.

Rollback commands:
```bash
kubectl -n infracommand rollout undo deploy/infracommand-backend
kubectl -n infracommand rollout undo deploy/infracommand-frontend
kubectl -n infracommand rollout status deploy/infracommand-backend
kubectl -n infracommand rollout status deploy/infracommand-frontend
```

If schema/data incompatibility exists, restore volume snapshot or backup and roll back app/manifests together.

---

## 10) Capacity and performance tuning

- Ensure backend has sufficient CPU/memory for concurrent scan jobs.
- Keep scan timeout aligned with real-world host latency.
- Use HPA for backend where appropriate.
- Monitor temporary storage and `/tmp` usage for scan workloads.

---

## 11) Security operations

- Rotate host credentials periodically.
- Store secrets in Kubernetes Secrets / vault integration.
- Restrict ingress exposure and IP allow-lists where possible.
- Audit RBAC and API access logs.

---

## 12) Change management template

For every production change, record:
- change ID,
- owner and approver,
- risk level,
- affected components,
- rollout plan,
- rollback plan,
- validation evidence.

---

## 13) Escalation checklist

Before escalating to engineering, provide:
- timestamps (UTC),
- affected targets (IPs/host IDs),
- backend + trivy-server logs,
- deployment revisions/image tags,
- whether rollback attempted,
- business impact summary.

