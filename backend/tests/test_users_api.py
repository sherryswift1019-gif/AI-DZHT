"""Tests for the User Management API (/api/v1/users)."""
import os
import tempfile

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _fresh_db(tmp_path, monkeypatch):
    """Use a temporary SQLite database for each test to ensure isolation."""
    db_path = str(tmp_path / "test.db")
    monkeypatch.setenv("DB_PATH", db_path)

    # Re-import with the new DB_PATH so engine points to the temp file.
    # We need to reload the modules to pick up the new env var.
    import importlib
    from app import database, storage, main

    # Recreate engine with new path
    from sqlalchemy import create_engine
    new_engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    monkeypatch.setattr(database, "engine", new_engine)
    monkeypatch.setattr(storage, "engine", new_engine)

    database.metadata.create_all(new_engine)
    database._seed_if_empty()
    database._seed_users_if_empty()

    yield


@pytest.fixture
def client():
    from app.main import app
    return TestClient(app)


# ── List ────────────────────────────────────────────────────────────────────

class TestListUsers:
    def test_list_returns_seeded_users(self, client):
        r = client.get("/api/v1/users")
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 4
        assert len(body["data"]) == 4
        usernames = {u["username"] for u in body["data"]}
        assert "zhangshanshan" in usernames

    def test_list_response_shape(self, client):
        r = client.get("/api/v1/users")
        user = r.json()["data"][0]
        assert "id" in user
        assert "username" in user
        assert "displayName" in user
        assert "email" in user
        assert "role" in user
        assert "status" in user


# ── Get Single ──────────────────────────────────────────────────────────────

class TestGetUser:
    def test_get_existing_user(self, client):
        r = client.get("/api/v1/users/u1")
        assert r.status_code == 200
        assert r.json()["username"] == "zhangshanshan"
        assert r.json()["role"] == "admin"

    def test_get_nonexistent_returns_404(self, client):
        r = client.get("/api/v1/users/nonexistent")
        assert r.status_code == 404


# ── Create ──────────────────────────────────────────────────────────────────

class TestCreateUser:
    def test_create_user_success(self, client):
        r = client.post("/api/v1/users", json={
            "username": "newuser",
            "displayName": "新用户",
            "email": "new@example.com",
            "role": "viewer",
        })
        assert r.status_code == 201
        body = r.json()
        assert body["username"] == "newuser"
        assert body["displayName"] == "新用户"
        assert body["role"] == "viewer"
        assert body["status"] == "active"
        assert body["id"].startswith("u-")

    def test_create_user_default_role(self, client):
        r = client.post("/api/v1/users", json={
            "username": "default_role",
            "displayName": "Default",
            "email": "default@example.com",
        })
        assert r.status_code == 201
        assert r.json()["role"] == "member"

    def test_create_duplicate_username_returns_409(self, client):
        r = client.post("/api/v1/users", json={
            "username": "zhangshanshan",
            "displayName": "Dup",
            "email": "dup@example.com",
        })
        assert r.status_code == 409

    def test_create_user_appears_in_list(self, client):
        client.post("/api/v1/users", json={
            "username": "listcheck",
            "displayName": "List Check",
            "email": "lc@example.com",
        })
        r = client.get("/api/v1/users")
        assert r.json()["total"] == 5

    def test_create_missing_required_field(self, client):
        r = client.post("/api/v1/users", json={
            "displayName": "NoUsername",
            "email": "no@example.com",
        })
        assert r.status_code == 422


# ── Update ──────────────────────────────────────────────────────────────────

class TestUpdateUser:
    def test_patch_display_name(self, client):
        r = client.patch("/api/v1/users/u2", json={"displayName": "李明(更新)"})
        assert r.status_code == 200
        assert r.json()["displayName"] == "李明(更新)"

    def test_patch_role(self, client):
        r = client.patch("/api/v1/users/u3", json={"role": "viewer"})
        assert r.status_code == 200
        assert r.json()["role"] == "viewer"

    def test_patch_username_uniqueness(self, client):
        r = client.patch("/api/v1/users/u2", json={"username": "zhangshanshan"})
        assert r.status_code == 409

    def test_patch_nonexistent_returns_404(self, client):
        r = client.patch("/api/v1/users/nonexistent", json={"displayName": "X"})
        assert r.status_code == 404

    def test_patch_updates_timestamp(self, client):
        before = client.get("/api/v1/users/u1").json()["updatedAt"]
        import time; time.sleep(1.1)
        client.patch("/api/v1/users/u1", json={"displayName": "Updated"})
        after = client.get("/api/v1/users/u1").json()["updatedAt"]
        assert after > before


# ── Delete ──────────────────────────────────────────────────────────────────

class TestDeleteUser:
    def test_delete_user_success(self, client):
        r = client.delete("/api/v1/users/u4")
        assert r.status_code == 204
        # Verify gone
        r = client.get("/api/v1/users/u4")
        assert r.status_code == 404

    def test_delete_nonexistent_returns_404(self, client):
        r = client.delete("/api/v1/users/nonexistent")
        assert r.status_code == 404

    def test_delete_reduces_total(self, client):
        before = client.get("/api/v1/users").json()["total"]
        client.delete("/api/v1/users/u3")
        after = client.get("/api/v1/users").json()["total"]
        assert after == before - 1


# ── Disable / Enable ────────────────────────────────────────────────────────

class TestDisableEnable:
    def test_disable_user(self, client):
        r = client.post("/api/v1/users/u2/disable")
        assert r.status_code == 200
        assert r.json()["status"] == "disabled"

    def test_disable_already_disabled_returns_400(self, client):
        client.post("/api/v1/users/u2/disable")
        r = client.post("/api/v1/users/u2/disable")
        assert r.status_code == 400

    def test_enable_disabled_user(self, client):
        client.post("/api/v1/users/u2/disable")
        r = client.post("/api/v1/users/u2/enable")
        assert r.status_code == 200
        assert r.json()["status"] == "active"

    def test_enable_already_active_returns_400(self, client):
        r = client.post("/api/v1/users/u1/enable")
        assert r.status_code == 400

    def test_disable_nonexistent_returns_404(self, client):
        r = client.post("/api/v1/users/nonexistent/disable")
        assert r.status_code == 404

    def test_enable_nonexistent_returns_404(self, client):
        r = client.post("/api/v1/users/nonexistent/enable")
        assert r.status_code == 404
