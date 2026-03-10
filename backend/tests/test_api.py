"""
InfraCommand — API Tests
Run: pytest tests/ -v
"""
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_summary():
    r = client.get("/api/summary")
    assert r.status_code == 200
    data = r.json()
    assert "hosts" in data
    assert "total_vms" in data
    assert "avg_cpu" in data


def test_get_hosts():
    r = client.get("/api/hosts")
    assert r.status_code == 200
    hosts = r.json()
    assert isinstance(hosts, list)
    assert len(hosts) >= 1
    assert "id" in hosts[0]
    assert "name" in hosts[0]
    assert "metrics" in hosts[0]


def test_get_single_host():
    r = client.get("/api/hosts/h1")
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == "h1"
    assert "vms" in data
    assert "metrics" in data
    assert "patch" in data


def test_get_host_not_found():
    r = client.get("/api/hosts/nonexistent")
    assert r.status_code == 404


def test_add_and_delete_host():
    # Add
    r = client.post("/api/hosts", json={"name": "test-host", "ip": "10.0.0.99"})
    assert r.status_code == 201
    hid = r.json()["id"]
    # Delete
    r = client.delete(f"/api/hosts/{hid}")
    assert r.status_code == 200


def test_metrics():
    r = client.get("/api/hosts/h1/metrics")
    assert r.status_code == 200
    m = r.json()
    assert "cpu" in m
    assert "ram" in m
    assert "disk" in m


def test_metrics_history():
    r = client.get("/api/metrics/history")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) == 24


def test_get_all_logs():
    r = client.get("/api/logs")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_get_logs_with_filter():
    r = client.get("/api/logs?level=ERROR&limit=10")
    assert r.status_code == 200
    logs = r.json()
    for l in logs:
        assert l["level"] == "ERROR"


def test_get_host_logs():
    r = client.get("/api/hosts/h1/logs")
    assert r.status_code == 200


def test_patches():
    r = client.get("/api/patches")
    assert r.status_code == 200
    patches = r.json()
    assert isinstance(patches, list)
    assert "os" in patches[0]
    assert "status" in patches[0]


def test_alerts():
    r = client.get("/api/alerts")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_scan_result_not_found_before_scan():
    r = client.get("/api/hosts/h1/scan")
    assert r.status_code == 404


def test_trigger_scan():
    r = client.post("/api/hosts/h1/scan")
    assert r.status_code == 200
    data = r.json()
    assert data["host_id"] == "h1"
    assert "vulns" in data
    assert "summary" in data
    assert data["summary"]["total"] >= 0


def test_get_scan_after_trigger():
    # Trigger first
    client.post("/api/hosts/h2/scan")
    # Then fetch
    r = client.get("/api/hosts/h2/scan")
    assert r.status_code == 200
    assert "vulns" in r.json()


def test_all_scans():
    r = client.get("/api/scans")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
