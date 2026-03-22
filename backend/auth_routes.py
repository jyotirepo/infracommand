"""
InfraCommand — Auth API Routes
/api/auth/*  — login, logout, change-password, me
/api/users/* — user management (admin only)
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from auth import (
    UserModel, ROLE_DESCRIPTIONS, ALL_PERMS, BUILTIN_ROLES,
    get_user_perms, hash_password, verify_password, create_token,
    get_current_user, require_perm,
    generate_hex_password, send_welcome_email, bootstrap_admin,
)

router = APIRouter()

# ── Pydantic schemas ─────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class CreateUserRequest(BaseModel):
    username:     str
    email:        str
    full_name:    str = ""
    role:         str = "viewer"
    custom_perms: List[str] = []   # only used when role=="custom"

class UpdateUserRequest(BaseModel):
    full_name:    Optional[str]       = None
    role:         Optional[str]       = None
    custom_perms: Optional[List[str]] = None
    is_active:    Optional[bool]      = None

# ── Auth ─────────────────────────────────────────────────────────────────────
@router.post("/auth/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    bootstrap_admin(db)
    user = db.query(UserModel).filter(UserModel.username == body.username).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "Invalid username or password")
    if not user.is_active:
        raise HTTPException(403, "Account disabled — contact your administrator")
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    token = create_token(user)
    perms = get_user_perms(user.role, user.custom_perms or "")
    return {
        "access_token":   token,
        "token_type":     "bearer",
        "must_change_pw": user.must_change_pw,
        "user": _user_dict(user),
    }

@router.get("/auth/me")
def get_me(cu: dict = Depends(get_current_user)):
    return cu

@router.post("/auth/logout")
def logout(cu: dict = Depends(get_current_user)):
    return {"message": "Logged out"}

@router.post("/auth/change-password")
def change_password(
    body: ChangePasswordRequest,
    cu:   dict    = Depends(get_current_user),
    db:   Session = Depends(get_db),
):
    user = db.get(UserModel, cu["id"])
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(400, "Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if body.new_password == body.current_password:
        raise HTTPException(400, "New password must be different from current password")
    user.hashed_password = hash_password(body.new_password)
    user.must_change_pw  = False
    db.commit()
    # Issue a new token with must_change_pw=False
    return {"message": "Password changed successfully", "access_token": create_token(user)}

# ── User management ──────────────────────────────────────────────────────────
@router.get("/users")
def list_users(cu: dict = Depends(require_perm("manage_users")), db: Session = Depends(get_db)):
    return [_user_dict(u) for u in db.query(UserModel).all()]

@router.post("/users")
def create_user(
    body: CreateUserRequest,
    cu:   dict    = Depends(require_perm("manage_users")),
    db:   Session = Depends(get_db),
):
    valid_roles = list(ROLE_DESCRIPTIONS.keys())
    if body.role not in valid_roles:
        raise HTTPException(400, f"Invalid role. Choose from: {', '.join(valid_roles)}")
    if body.role == "custom" and not body.custom_perms:
        raise HTTPException(400, "custom role requires at least one permission")
    invalid_perms = set(body.custom_perms) - ALL_PERMS
    if invalid_perms:
        raise HTTPException(400, f"Invalid permissions: {invalid_perms}. Valid: {ALL_PERMS}")

    if db.query(UserModel).filter(UserModel.username == body.username).first():
        raise HTTPException(409, "Username already exists")
    if db.query(UserModel).filter(UserModel.email == body.email).first():
        raise HTTPException(409, "Email already exists")

    temp_pw = generate_hex_password(16)
    custom_perms_str = ",".join(body.custom_perms) if body.role == "custom" else ""

    user = UserModel(
        id              = "u" + uuid.uuid4().hex[:8],
        username        = body.username,
        email           = body.email,
        full_name       = body.full_name,
        hashed_password = hash_password(temp_pw),
        role            = body.role,
        custom_perms    = custom_perms_str,
        is_active       = True,
        must_change_pw  = True,
        created_by      = cu["username"],
    )
    db.add(user); db.commit()

    email_sent = send_welcome_email(
        body.email, body.full_name or body.username,
        body.username, temp_pw, body.role,
    )
    return {
        "user":          _user_dict(user),
        "temp_password": temp_pw,
        "email_sent":    email_sent,
        "message": (
            f"User created. Welcome email sent to {body.email}."
            if email_sent else
            f"User created. SMTP not configured — share password manually."
        ),
    }

@router.get("/users/{uid}")
def get_user(uid: str, _=Depends(require_perm("manage_users")), db: Session = Depends(get_db)):
    u = db.get(UserModel, uid)
    if not u: raise HTTPException(404, "User not found")
    return _user_dict(u)

@router.patch("/users/{uid}")
def update_user(
    uid:  str,
    body: UpdateUserRequest,
    cu:   dict    = Depends(require_perm("manage_users")),
    db:   Session = Depends(get_db),
):
    u = db.get(UserModel, uid)
    if not u: raise HTTPException(404, "User not found")
    if uid == cu["id"]:
        if body.is_active is False:
            raise HTTPException(400, "Cannot disable your own account")
        if body.role and body.role != "admin":
            raise HTTPException(400, "Cannot change your own role away from admin")

    if body.role:
        if body.role not in ROLE_DESCRIPTIONS:
            raise HTTPException(400, f"Invalid role: {body.role}")
        if body.role == "custom":
            perms = body.custom_perms or []
            bad = set(perms) - ALL_PERMS
            if bad:
                raise HTTPException(400, f"Invalid permissions: {bad}")
            u.custom_perms = ",".join(perms)
        u.role = body.role

    if body.full_name  is not None: u.full_name  = body.full_name
    if body.is_active  is not None: u.is_active  = body.is_active
    if body.custom_perms is not None and u.role == "custom":
        bad = set(body.custom_perms) - ALL_PERMS
        if bad: raise HTTPException(400, f"Invalid permissions: {bad}")
        u.custom_perms = ",".join(body.custom_perms)
    db.commit()
    return _user_dict(u)

@router.delete("/users/{uid}")
def delete_user(uid: str, cu: dict = Depends(require_perm("manage_users")), db: Session = Depends(get_db)):
    if uid == cu["id"]: raise HTTPException(400, "Cannot delete your own account")
    u = db.get(UserModel, uid)
    if not u: raise HTTPException(404, "User not found")
    db.delete(u); db.commit()
    return {"message": f"User {u.username} deleted"}

@router.post("/users/{uid}/reset-password")
def reset_password(
    uid: str,
    cu:  dict    = Depends(require_perm("manage_users")),
    db:  Session = Depends(get_db),
):
    u = db.get(UserModel, uid)
    if not u: raise HTTPException(404, "User not found")
    new_pw = generate_hex_password(16)
    u.hashed_password = hash_password(new_pw)
    u.must_change_pw  = True
    db.commit()
    email_sent = send_welcome_email(
        u.email, u.full_name or u.username, u.username, new_pw, u.role,
    )
    return {
        "temp_password": new_pw,
        "email_sent":   email_sent,
        "message": f"Password reset. {'Email sent.' if email_sent else 'Share password manually: ' + new_pw}",
    }

@router.get("/roles")
def list_roles(_=Depends(require_perm("manage_users"))):
    return [
        {
            "role":        r,
            "description": d,
            "permissions": sorted(BUILTIN_ROLES.get(r, ALL_PERMS) if r != "custom" else ALL_PERMS),
            "is_custom":   r == "custom",
        }
        for r, d in ROLE_DESCRIPTIONS.items()
    ]

@router.get("/permissions")
def list_permissions(_=Depends(require_perm("manage_users"))):
    return sorted(ALL_PERMS)

# ── Helper ────────────────────────────────────────────────────────────────────
def _user_dict(u: UserModel) -> dict:
    perms = get_user_perms(u.role, u.custom_perms or "")
    return {
        "id":            u.id,
        "username":      u.username,
        "email":         u.email,
        "full_name":     u.full_name,
        "role":          u.role,
        "custom_perms":  [p for p in (u.custom_perms or "").split(",") if p],
        "is_active":     u.is_active,
        "must_change_pw": u.must_change_pw,
        "created_at":    u.created_at.isoformat() if u.created_at else None,
        "created_by":    u.created_by,
        "last_login":    u.last_login.isoformat() if u.last_login else None,
        "perms":         sorted(perms),
    }
