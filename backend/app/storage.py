"""Persistent storage backed by SQLite (via database.py).

Public API
----------
Projects
  get_all_projects()          -> list[dict]
  get_project(id)             -> dict | None
  save_project(id, data)      -> None
  delete_project(id)          -> None

Requirements
  get_requirements(project_id) -> list[dict]
  get_requirement(id)          -> dict | None
  save_requirement(id, data)   -> None
  delete_requirement(id)       -> None

Sequences
  next_req_seq(project_id)    -> int   (atomically increments + returns new value)

Backward-compat shims (used by existing router code)
  projects_store  – thin wrapper dict-like for read; use save_project/delete_project to mutate
  requirements_store – same
  project_seq     – same
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import delete, insert, select, update

from .database import (
    engine,
    project_seq_table,
    projects_table,
    requirements_table,
    row_to_project,
    row_to_requirement,
)


# ── Projects ──────────────────────────────────────────────────────────────────

def get_all_projects() -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(select(projects_table)).fetchall()
    return [row_to_project(r) for r in rows]


def get_project(project_id: str) -> dict[str, Any] | None:
    with engine.connect() as conn:
        row = conn.execute(
            select(projects_table).where(projects_table.c.id == project_id)
        ).fetchone()
    return row_to_project(row) if row else None


def save_project(project_id: str, data: dict[str, Any]) -> None:
    """Insert or replace a project row."""
    row = {
        "id": data["id"],
        "code": data["code"],
        "name": data["name"],
        "description": data.get("description", ""),
        "status": data.get("status", "planning"),
        "owner_id": data["ownerId"],
        "member_ids": json.dumps(data.get("memberIds", [])),
        "color": data.get("color", "#0A84FF"),
        "context": json.dumps(data.get("context", {})),
        "settings": json.dumps(data["settings"]) if data.get("settings") is not None else None,
        "start_date": data.get("startDate"),
        "end_date": data.get("endDate"),
        "budget": data.get("budget"),
        "created_at": data.get("_created_at", 0),
    }
    with engine.begin() as conn:
        exists = conn.execute(
            select(projects_table.c.id).where(projects_table.c.id == project_id)
        ).fetchone()
        if exists:
            conn.execute(
                update(projects_table).where(projects_table.c.id == project_id).values(**row)
            )
        else:
            conn.execute(insert(projects_table).values(**row))


def delete_project(project_id: str) -> None:
    with engine.begin() as conn:
        conn.execute(delete(projects_table).where(projects_table.c.id == project_id))
        conn.execute(delete(project_seq_table).where(project_seq_table.c.project_id == project_id))
        conn.execute(delete(requirements_table).where(requirements_table.c.project_id == project_id))


# ── Requirements ──────────────────────────────────────────────────────────────

def get_requirements(project_id: str) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(
            select(requirements_table).where(requirements_table.c.project_id == project_id)
        ).fetchall()
    return [row_to_requirement(r) for r in rows]


def get_requirement(req_id: str) -> dict[str, Any] | None:
    with engine.connect() as conn:
        row = conn.execute(
            select(requirements_table).where(requirements_table.c.id == req_id)
        ).fetchone()
    return row_to_requirement(row) if row else None


def save_requirement(req_id: str, data: dict[str, Any]) -> None:
    """Insert or replace a requirement row."""
    row = {
        "id": data["id"],
        "project_id": data["projectId"],
        "code": data["code"],
        "title": data["title"],
        "summary": data.get("summary", ""),
        "priority": data.get("priority", "P1"),
        "status": data.get("status", "queued"),
        "assignee_id": data.get("assigneeId", ""),
        "pipeline": json.dumps(data.get("pipeline", [])),
        "stories": json.dumps(data.get("stories", [])),
        "token_usage": json.dumps(data["tokenUsage"]) if data.get("tokenUsage") is not None else None,
        "created_at": data.get("_created_at", 0),
    }
    with engine.begin() as conn:
        exists = conn.execute(
            select(requirements_table.c.id).where(requirements_table.c.id == req_id)
        ).fetchone()
        if exists:
            conn.execute(
                update(requirements_table).where(requirements_table.c.id == req_id).values(**row)
            )
        else:
            conn.execute(insert(requirements_table).values(**row))


def delete_requirement(req_id: str) -> None:
    with engine.begin() as conn:
        conn.execute(delete(requirements_table).where(requirements_table.c.id == req_id))


# ── Sequences ─────────────────────────────────────────────────────────────────

def next_req_seq(project_id: str) -> int:
    """Atomically increment and return the new sequence value for a project."""
    with engine.begin() as conn:
        row = conn.execute(
            select(project_seq_table).where(project_seq_table.c.project_id == project_id)
        ).fetchone()
        if row:
            new_seq = row.seq + 1
            conn.execute(
                update(project_seq_table)
                .where(project_seq_table.c.project_id == project_id)
                .values(seq=new_seq)
            )
        else:
            new_seq = 300
            conn.execute(
                insert(project_seq_table).values(project_id=project_id, seq=new_seq)
            )
    return new_seq


# ── Legacy shims (kept so imports in routers don't break) ─────────────────────
# These are NOT used for writes; they exist only for isinstance checks or
# any read paths that haven't been migrated yet.

class _ProjectsStore:
    """Read-only dict-like shim around the DB."""
    def get(self, key: str, default: Any = None) -> Any:
        return get_project(key) or default

    def __contains__(self, key: str) -> bool:
        return get_project(key) is not None

    def values(self) -> list[dict]:  # type: ignore[override]
        return get_all_projects()

    def __getitem__(self, key: str) -> dict:
        result = get_project(key)
        if result is None:
            raise KeyError(key)
        return result

    def __setitem__(self, key: str, value: dict) -> None:
        save_project(key, value)

    def __delitem__(self, key: str) -> None:
        delete_project(key)


class _RequirementsStore:
    """Read-only dict-like shim around the DB."""
    def get(self, key: str, default: Any = None) -> Any:
        return get_requirement(key) or default

    def __contains__(self, key: str) -> bool:
        return get_requirement(key) is not None

    def values(self) -> list[dict]:  # type: ignore[override]
        return []  # not used; use get_requirements(project_id) instead

    def __getitem__(self, key: str) -> dict:
        result = get_requirement(key)
        if result is None:
            raise KeyError(key)
        return result

    def __setitem__(self, key: str, value: dict) -> None:
        save_requirement(key, value)

    def __delitem__(self, key: str) -> None:
        delete_requirement(key)


class _ProjectSeq:
    def get(self, key: str, default: int = 299) -> int:
        with engine.connect() as conn:
            row = conn.execute(
                select(project_seq_table).where(project_seq_table.c.project_id == key)
            ).fetchone()
        return row.seq if row else default

    def __contains__(self, key: str) -> bool:
        with engine.connect() as conn:
            row = conn.execute(
                select(project_seq_table.c.project_id)
                .where(project_seq_table.c.project_id == key)
            ).fetchone()
        return row is not None

    def __delitem__(self, key: str) -> None:
        pass  # handled in delete_project cascade


projects_store = _ProjectsStore()
requirements_store = _RequirementsStore()
project_seq = _ProjectSeq()
