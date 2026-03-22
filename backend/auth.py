"""
InfraCommand — Authentication & User Management
JWT-based sessions · bcrypt passwords · role-based access control
Roles: admin, operator, viewer, custom (per-feature permissions)
"""
import os, secrets, smtplib
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Boolean, DateTime, Text
import jwt
import bcrypt

from database import Base, engine, get_db

# ── Config ─────────────────────────────────────────────────────────────────
JWT_SECRET  = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_EXPIRE  = int(os.environ.get("JWT_EXPIRE_HOURS", "8"))
SMTP_HOST   = os.environ.get("SMTP_HOST", "")
SMTP_PORT   = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER   = os.environ.get("SMTP_USER", "")
SMTP_PASS   = os.environ.get("SMTP_PASS", "")
SMTP_FROM   = os.environ.get("SMTP_FROM", "devopsadmin@domain.com")
APP_URL     = os.environ.get("APP_URL", "http://192.168.101.80:32302")

# ── Role definitions ────────────────────────────────────────────────────────
# All available permissions in the system
ALL_PERMS = {
    "view", "scan", "refresh", "patch", "logs",
    "add_host", "delete_host", "manage_users",
}

# Built-in roles with fixed permission sets
BUILTIN_ROLES = {
    "admin":    ALL_PERMS,
    "operator": {"view", "scan", "refresh", "patch", "logs"},
    "viewer":   {"view"},
}

ROLE_DESCRIPTIONS = {
    "admin":    "Full access including user management and host CRUD",
    "operator": "View + scan + refresh + patch + logs. Cannot add/delete hosts or manage users",
    "viewer":   "Read-only. Dashboard and metrics only",
    "custom":   "Per-feature permissions defined individually for this user",
}

def get_user_perms(role: str, custom_perms: str = "") -> set:
    """Return the effective permission set for a user."""
    if role in BUILTIN_ROLES:
        return BUILTIN_ROLES[role]
    if role == "custom":
        # custom_perms stored as comma-separated string
        return set(p.strip() for p in custom_perms.split(",") if p.strip() in ALL_PERMS)
    return set()

# ── User model ──────────────────────────────────────────────────────────────
class UserModel(Base):
    __tablename__   = "users"
    id              = Column(String,  primary_key=True)
    username        = Column(String,  unique=True, nullable=False)
    email           = Column(String,  unique=True, nullable=False)
    full_name       = Column(String,  default="")
    hashed_password = Column(String,  nullable=False)
    role            = Column(String,  default="viewer")
    custom_perms    = Column(Text,    default="")   # used when role=="custom"
    is_active       = Column(Boolean, default=True)
    must_change_pw  = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_by      = Column(String,  default="system")
    last_login      = Column(DateTime, nullable=True)

Base.metadata.create_all(engine)

# ── Password utilities ──────────────────────────────────────────────────────
def generate_hex_password(length: int = 16) -> str:
    """Generate a random hex password e.g. a3f9c2d1b8e4f705"""
    return secrets.token_hex(length // 2)

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False

# ── JWT ─────────────────────────────────────────────────────────────────────
def create_token(user: "UserModel") -> str:
    perms = get_user_perms(user.role, user.custom_perms or "")
    payload = {
        "sub":           user.id,
        "username":      user.username,
        "role":          user.role,
        "must_change_pw": user.must_change_pw,
        "perms":         list(perms),
        "exp":           datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE),
        "iat":           datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired — please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ── FastAPI dependencies ────────────────────────────────────────────────────
bearer = HTTPBearer(auto_error=False)

def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db)
) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(creds.credentials)
    user = db.get(UserModel, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or disabled")
    perms = get_user_perms(user.role, user.custom_perms or "")
    return {
        "id":            user.id,
        "username":      user.username,
        "email":         user.email,
        "full_name":     user.full_name,
        "role":          user.role,
        "custom_perms":  user.custom_perms or "",
        "must_change_pw": user.must_change_pw,
        "perms":         list(perms),
    }

def require_perm(perm: str):
    """Dependency factory: blocks access if user lacks the permission."""
    def _check(current_user: dict = Depends(get_current_user)):
        if current_user.get("must_change_pw"):
            raise HTTPException(
                status_code=403,
                detail="You must change your password before using InfraCommand"
            )
        if perm not in set(current_user.get("perms", [])):
            raise HTTPException(
                status_code=403,
                detail=f"Your role does not have \'{perm}\' permission"
            )
        return current_user
    return _check

# ── Email ───────────────────────────────────────────────────────────────────
def send_welcome_email(to_email: str, full_name: str, username: str,
                       temp_password: str, role: str) -> bool:
    if not SMTP_HOST or not SMTP_USER:
        return False

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;
      background:#f8fafc;padding:32px;border-radius:12px">
      <div style="background:#1e293b;padding:20px 24px;border-radius:8px;margin-bottom:24px">
        <h1 style="color:#fff;margin:0;font-size:20px">&#x1F5A5; InfraCommand</h1>
        <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">Infrastructure Monitoring</p>
      </div>
      <h2 style="color:#1e293b;font-size:16px">Welcome, {full_name or username}!</h2>
      <p style="color:#475569;font-size:14px">Your account has been created:</p>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;
        padding:20px;margin:20px 0">
        <table style="width:100%;font-size:14px;border-collapse:collapse">
          <tr><td style="color:#64748b;padding:8px 0;width:110px">URL</td>
              <td><a href="{APP_URL}">{APP_URL}</a></td></tr>
          <tr><td style="color:#64748b;padding:8px 0">Username</td>
              <td style="font-weight:600">{username}</td></tr>
          <tr><td style="color:#64748b;padding:8px 0">Password</td>
              <td><code style="background:#1e293b;color:#e2e8f0;padding:6px 12px;
                border-radius:6px;font-size:16px;letter-spacing:3px;
                font-family:monospace">{temp_password}</code></td></tr>
          <tr><td style="color:#64748b;padding:8px 0">Role</td>
              <td><span style="background:#dbeafe;color:#1d4ed8;padding:3px 10px;
                border-radius:4px;font-size:12px;font-weight:600">
                {role.upper()}</span></td></tr>
        </table>
      </div>
      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;
        padding:14px;margin:16px 0">
        <p style="margin:0;font-size:13px;color:#92400e">
          <strong>&#x26A0; Change your password immediately after first login.</strong>
          You will not be able to use the application until you do.
        </p>
      </div>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">
        InfraCommand automated message. Do not reply to this email.
      </p>
    </div>"""

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "InfraCommand — Your Account Details"
        msg["From"]    = SMTP_FROM
        msg["To"]      = to_email
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as s:
            s.ehlo()
            if SMTP_PORT == 587:
                s.starttls()
            if SMTP_USER and SMTP_PASS:
                s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(SMTP_FROM, [to_email], msg.as_string())
        return True
    except Exception as e:
        print(f"[SMTP] Failed to send to {to_email}: {e}")
        return False

# ── Bootstrap ────────────────────────────────────────────────────────────────
def bootstrap_admin(db: Session):
    """Create default admin on first run if no users exist."""
    if db.query(UserModel).count() > 0:
        return
    default_pw = "Admin@123"
    db.add(UserModel(
        id="admin-001", username="admin",
        email="admin@infracommand.local",
        full_name="Administrator",
        hashed_password=hash_password(default_pw),
        role="admin", is_active=True, must_change_pw=True,
        created_by="system",
    ))
    db.commit()
    print(f"[Auth] Default admin created  username=admin  password={default_pw}")
    print("[Auth] CHANGE THIS PASSWORD immediately after first login!")
