"""User management API — CRUD + enable/disable for platform users."""
from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException

from ..models import (
    UserCreateRequest,
    UserListResponse,
    UserOut,
    UserPatchRequest,
)
from ..storage import (
    get_all_users,
    get_user,
    get_user_by_username,
    save_user,
    delete_user as _db_delete_user,
)

router = APIRouter(prefix="/api/v1/users", tags=["users"])


def _ensure_user(user_id: str) -> dict:
    user = get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ── Users CRUD ──────────────────────────────────────────────────────────────

@router.get("", response_model=UserListResponse)
def list_users() -> dict:
    users = get_all_users()
    users.sort(key=lambda u: u.get("createdAt", 0))
    return {"data": users, "total": len(users)}


@router.get("/{user_id}", response_model=UserOut)
def get_user_endpoint(user_id: str) -> dict:
    return _ensure_user(user_id)


@router.post("", response_model=UserOut, status_code=201)
def create_user(body: UserCreateRequest) -> dict:
    # Check username uniqueness
    if get_user_by_username(body.username):
        raise HTTPException(status_code=409, detail="Username already exists")

    now = int(time.time())
    user_id = f"u-{int(time.time() * 1000)}"
    data = {
        "id": user_id,
        "username": body.username,
        "displayName": body.displayName,
        "email": body.email,
        "role": body.role,
        "status": "active",
        "avatar": body.avatar,
        "createdAt": now,
        "updatedAt": now,
    }
    save_user(user_id, data)
    return data


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: str, body: UserPatchRequest) -> dict:
    user = _ensure_user(user_id)
    patch = body.model_dump(exclude_none=True)

    # If username is being changed, check uniqueness
    if "username" in patch and patch["username"] != user["username"]:
        existing = get_user_by_username(patch["username"])
        if existing:
            raise HTTPException(status_code=409, detail="Username already exists")

    user.update(patch)
    user["updatedAt"] = int(time.time())
    save_user(user_id, user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user_endpoint(user_id: str) -> None:
    _ensure_user(user_id)
    _db_delete_user(user_id)


# ── Enable / Disable ────────────────────────────────────────────────────────

@router.post("/{user_id}/disable", response_model=UserOut)
def disable_user(user_id: str) -> dict:
    user = _ensure_user(user_id)
    if user["status"] == "disabled":
        raise HTTPException(status_code=400, detail="User is already disabled")
    user["status"] = "disabled"
    user["updatedAt"] = int(time.time())
    save_user(user_id, user)
    return user


@router.post("/{user_id}/enable", response_model=UserOut)
def enable_user(user_id: str) -> dict:
    user = _ensure_user(user_id)
    if user["status"] == "active":
        raise HTTPException(status_code=400, detail="User is already active")
    user["status"] = "active"
    user["updatedAt"] = int(time.time())
    save_user(user_id, user)
    return user
