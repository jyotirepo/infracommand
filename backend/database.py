"""
SQLite persistence layer for InfraCommand
All host configs, cached metrics, scan results stored here
"""
import json, os
from datetime import datetime, timezone
from sqlalchemy import create_engine, Column, String, Text, DateTime, Float, Integer
from sqlalchemy.orm import DeclarativeBase, Session

DB_PATH = os.getenv("DB_PATH", "/data/infracommand.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})

class Base(DeclarativeBase): pass

class HostModel(Base):
    __tablename__ = "hosts"
    id          = Column(String, primary_key=True)
    name        = Column(String, nullable=False)
    ip          = Column(String, nullable=False)
    os_type     = Column(String, default="linux")
    auth_type   = Column(String, default="password")
    username    = Column(String, default="root")
    password    = Column(String)
    ssh_key     = Column(Text)
    ssh_port    = Column(Integer, default=22)
    winrm_port  = Column(Integer, default=5985)
    group       = Column(String, default="Default")   # Discom / business unit group
    status      = Column(String, default="unknown")
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class MetricsModel(Base):
    __tablename__ = "metrics"
    host_id     = Column(String, primary_key=True)
    data        = Column(Text)   # JSON
    updated_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class VMModel(Base):
    __tablename__ = "vms"
    id          = Column(String, primary_key=True)
    host_id     = Column(String, nullable=False)
    data        = Column(Text)   # JSON full VM object
    updated_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class ScanModel(Base):
    __tablename__ = "scans"
    target_id   = Column(String, primary_key=True)
    data        = Column(Text)   # JSON
    scanned_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class PatchModel(Base):
    __tablename__ = "patches"
    host_id     = Column(String, primary_key=True)
    data        = Column(Text)   # JSON
    updated_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class LogModel(Base):
    __tablename__ = "logs"
    id          = Column(String, primary_key=True)
    host_id     = Column(String)
    data        = Column(Text)   # JSON list
    updated_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

Base.metadata.create_all(engine)

# ── Auto-migrate: add 'group' column to existing DBs that predate this field ──
def _migrate():
    from sqlalchemy import text, inspect
    with engine.connect() as conn:
        cols = [c["name"] for c in inspect(engine).get_columns("hosts")]
        if "group" not in cols:
            conn.execute(text("ALTER TABLE hosts ADD COLUMN \"group\" VARCHAR DEFAULT 'Default'"))
            conn.commit()
try:
    _migrate()
except Exception:
    pass

def get_db():
    with Session(engine) as s:
        yield s

# ── Helper CRUD ──────────────────────────────────────────────────────────────
def db_save_host(db: Session, host: dict):
    # Normalize created_at: column is DateTime, dict may have ISO string
    clean = {}
    for k, v in host.items():
        if k == "created_at" and isinstance(v, str):
            try:
                from datetime import datetime, timezone
                clean[k] = datetime.fromisoformat(v.replace("Z", "+00:00"))
            except Exception:
                clean[k] = datetime.now(timezone.utc)
        else:
            clean[k] = v

    existing = db.get(HostModel, clean["id"])
    if existing:
        for k, v in clean.items():
            if hasattr(existing, k):
                setattr(existing, k, v)
    else:
        db.add(HostModel(**{k: v for k, v in clean.items() if hasattr(HostModel, k)}))
    db.commit()

def db_get_hosts(db: Session) -> list:
    return [_host_to_dict(h) for h in db.query(HostModel).all()]

def db_get_host(db: Session, hid: str) -> dict | None:
    h = db.get(HostModel, hid)
    return _host_to_dict(h) if h else None

def db_delete_host(db: Session, hid: str):
    # Delete the host scan
    scan = db.get(ScanModel, hid)
    if scan: db.delete(scan); db.commit()
    # Delete all VM scans for this host
    vm_rows = db.query(VMModel).filter(VMModel.host_id == hid).all()
    for vm_row in vm_rows:
        vm_scan = db.get(ScanModel, vm_row.id)
        if vm_scan: db.delete(vm_scan); db.commit()
    # Delete host + related data
    h = db.get(HostModel, hid)
    if h: db.delete(h); db.commit()
    # Cascade delete metrics, vms, patches, logs
    for m in [MetricsModel, VMModel, PatchModel, LogModel]:
        obj = db.get(m, hid)
        if obj: db.delete(obj); db.commit()
    # Also delete VM rows directly (in case not caught above)
    db.query(VMModel).filter(VMModel.host_id == hid).delete()
    db.commit()

def _host_to_dict(h: HostModel) -> dict:
    return {c.name: getattr(h, c.name) for c in HostModel.__table__.columns}


def _dedupe_storage_entries(storage: list) -> list:
    """Keep storage rows unique by mountpoint+device while preserving order."""
    if not isinstance(storage, list):
        return []

    unique = []
    seen = set()
    for row in storage:
        if not isinstance(row, dict):
            continue
        mount = str(row.get("mountpoint") or "").strip().lower()
        dev = str(row.get("device") or "").strip().lower()
        key = (mount, dev)
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique

def db_save_metrics(db: Session, host_id: str, data: dict):
    if isinstance(data, dict) and isinstance(data.get("storage"), list):
        data = {**data, "storage": _dedupe_storage_entries(data.get("storage") or [])}

    try:
        serialized = json.dumps(data, default=str)  # default=str handles datetime/None edge cases
    except Exception:
        serialized = json.dumps({"source": "error", "reason": "serialize_failed"})
    existing = db.get(MetricsModel, host_id)
    if existing:
        existing.data = serialized
        existing.updated_at = datetime.now(timezone.utc)
    else:
        db.add(MetricsModel(host_id=host_id, data=serialized))
    db.commit()

def db_get_metrics(db: Session, host_id: str) -> dict | None:
    m = db.get(MetricsModel, host_id)
    if not m:
        return None
    try:
        data = json.loads(m.data)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}

def db_save_vms(db: Session, host_id: str, vms: list):
    # Replace host VM inventory with the latest discovery snapshot.
    # Remove stale rows first so deleted/migrated VMs do not linger after refresh.
    incoming_ids = {vm.get("id") for vm in vms if vm.get("id")}
    existing_rows = db.query(VMModel).filter(VMModel.host_id == host_id).all()
    for row in existing_rows:
        if row.id not in incoming_ids:
            db.delete(row)

    for vm in vms:
        existing = db.get(VMModel, vm["id"])
        existing_data = {}
        if existing:
            try:
                existing_data = json.loads(existing.data) if existing.data else {}
            except Exception:
                existing_data = {}

        manual_ip = bool(existing_data.get("manual_ip"))
        existing_ip = str(existing_data.get("ip") or "").strip()
        incoming_ip = str(vm.get("ip") or "").strip()
        if manual_ip and existing_ip:
            vm = {**vm, "ip": existing_ip, "manual_ip": True}
        elif existing_data.get("manual_ip"):
            vm = {**vm, "manual_ip": True}
        elif incoming_ip:
            vm = {**vm, "manual_ip": bool(vm.get("manual_ip"))}

        if existing:
            existing.host_id = host_id
            existing.data = json.dumps(vm)
            existing.updated_at = datetime.now(timezone.utc)
        else:
            db.add(VMModel(id=vm["id"], host_id=host_id, data=json.dumps(vm, default=str)))
    db.commit()

def db_get_vms(db: Session, host_id: str) -> list:
    rows = db.query(VMModel).filter(VMModel.host_id == host_id).all()
    out = []
    for r in rows:
        try:
            data = json.loads(r.data)
        except Exception:
            continue
        if isinstance(data, dict):
            out.append(data)
    return out

def db_save_scan(db: Session, target_id: str, data: dict):
    existing = db.get(ScanModel, target_id)
    if existing:
        existing.data = json.dumps(data)
        existing.scanned_at = datetime.now(timezone.utc)
    else:
        db.add(ScanModel(target_id=target_id, data=json.dumps(data)))
    db.commit()

def db_get_scan(db: Session, target_id: str) -> dict | None:
    s = db.get(ScanModel, target_id)
    return json.loads(s.data) if s else None

def db_save_patch(db: Session, host_id: str, data: dict):
    existing = db.get(PatchModel, host_id)
    if existing:
        existing.data = json.dumps(data)
        existing.updated_at = datetime.now(timezone.utc)
    else:
        db.add(PatchModel(host_id=host_id, data=json.dumps(data)))
    db.commit()

def db_get_patch(db: Session, host_id: str) -> dict | None:
    p = db.get(PatchModel, host_id)
    return json.loads(p.data) if p else None

def db_save_logs(db: Session, host_id: str, logs: list):
    existing = db.get(LogModel, host_id)
    if existing:
        existing.data = json.dumps(logs)
        existing.updated_at = datetime.now(timezone.utc)
    else:
        db.add(LogModel(id=host_id, host_id=host_id, data=json.dumps(logs)))
    db.commit()

def db_get_logs(db: Session, host_id: str) -> list:
    l = db.get(LogModel, host_id)
    return json.loads(l.data) if l else []
