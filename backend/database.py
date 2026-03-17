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
    h = db.get(HostModel, hid)
    if h: db.delete(h); db.commit()
    # Cascade
    for m in [MetricsModel, VMModel, ScanModel, PatchModel, LogModel]:
        obj = db.get(m, hid)
        if obj: db.delete(obj); db.commit()

def _host_to_dict(h: HostModel) -> dict:
    return {c.name: getattr(h, c.name) for c in HostModel.__table__.columns}

def db_save_metrics(db: Session, host_id: str, data: dict):
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
    return json.loads(m.data) if m else None

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
        if existing:
            existing.host_id = host_id
            existing.data = json.dumps(vm)
            existing.updated_at = datetime.now(timezone.utc)
        else:
            db.add(VMModel(id=vm["id"], host_id=host_id, data=json.dumps(vm)))
    db.commit()

def db_get_vms(db: Session, host_id: str) -> list:
    rows = db.query(VMModel).filter(VMModel.host_id == host_id).all()
    return [json.loads(r.data) for r in rows]

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
