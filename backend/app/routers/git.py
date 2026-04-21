"""Git 管理 API 端点：连接测试、PR 状态、重试推送、手动创建 PR。"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..storage import (
    get_project,
    get_requirement,
    save_project,
    save_requirement,
    decrypt_token,
    encrypt_token,
    token_status,
    save_commander_event,
)
from ..git_provider import GitHubProvider, parse_repo_url
from ..workspace import WorkspaceManager, WORKSPACE_ROOT

router = APIRouter(prefix="/api/v1/projects/{project_id}", tags=["git"])


def _ensure_project(project_id: str) -> dict:
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _get_git_config(project: dict) -> dict:
    settings = project.get("settings") or {}
    return settings.get("gitConfig") or {}


# ── Test Connection ──────────────────────────────────────────────────────────

class TestConnectionResponse(BaseModel):
    ok: bool
    error: Optional[str] = None
    login: Optional[str] = None
    defaultBranch: Optional[str] = None
    permissions: Optional[dict] = None
    tokenStatus: Optional[str] = None


@router.post("/git/test-connection", response_model=TestConnectionResponse)
async def test_connection(project_id: str) -> TestConnectionResponse:
    project = _ensure_project(project_id)
    settings = project.get("settings") or {}
    repo_url = settings.get("repository")
    if not repo_url:
        raise HTTPException(status_code=400, detail="未配置仓库地址")

    git_config = _get_git_config(project)
    encrypted = git_config.get("githubToken")
    token = decrypt_token(encrypted)
    if not token:
        return TestConnectionResponse(
            ok=False,
            error="Token 未配置或已失效",
            tokenStatus=token_status(encrypted),
        )

    try:
        owner, repo = parse_repo_url(repo_url)
    except ValueError as e:
        return TestConnectionResponse(ok=False, error=str(e))

    provider = GitHubProvider(owner, repo, token)
    try:
        result = await provider.test_connection()
        if result["ok"]:
            # 自动回填默认分支
            if result.get("default_branch"):
                git_config["defaultBranch"] = result["default_branch"]
                settings["gitConfig"] = git_config
                project["settings"] = settings
                save_project(project_id, project)
            return TestConnectionResponse(
                ok=True,
                login=result.get("login"),
                defaultBranch=result.get("default_branch"),
                permissions=result.get("permissions"),
                tokenStatus="valid",
            )
        return TestConnectionResponse(
            ok=False,
            error=result.get("error"),
            tokenStatus="valid",  # Token 有效但权限不足
        )
    except Exception as e:
        return TestConnectionResponse(ok=False, error=str(e)[:200])
    finally:
        await provider.close()


# ── PR Status ────────────────────────────────────────────────────────────────

class PRStatusResponse(BaseModel):
    state: Optional[str] = None
    mergeable: Optional[bool] = None
    reviewCount: int = 0
    approved: bool = False
    changesRequested: bool = False
    additions: int = 0
    deletions: int = 0
    changedFiles: int = 0
    checksBlocked: bool = False


@router.get("/requirements/{req_id}/git/pr-status", response_model=PRStatusResponse)
async def get_pr_status(project_id: str, req_id: str) -> PRStatusResponse:
    project = _ensure_project(project_id)
    req = get_requirement(req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    gi = req.get("gitInfo") or {}
    pr_number = gi.get("prNumber")
    if not pr_number:
        raise HTTPException(status_code=404, detail="No PR associated")

    git_config = _get_git_config(project)
    token = decrypt_token(git_config.get("githubToken"))
    if not token:
        raise HTTPException(status_code=400, detail="Token 未配置或已失效")

    settings = project.get("settings") or {}
    repo_url = settings.get("repository", "")
    owner, repo = parse_repo_url(repo_url)
    provider = GitHubProvider(owner, repo, token)

    try:
        status = await provider.get_pr_status(pr_number)
        # 更新 DB 中的 prState
        new_state = status["state"]
        if status.get("changes_requested"):
            new_state = "changes_requested"
        elif status.get("approved"):
            new_state = "approved"
        if gi.get("prState") != new_state:
            gi["prState"] = new_state
            req["gitInfo"] = gi
            save_requirement(req_id, req)
        return PRStatusResponse(
            state=new_state,
            mergeable=status.get("mergeable"),
            reviewCount=status.get("review_count", 0),
            approved=status.get("approved", False),
            changesRequested=status.get("changes_requested", False),
            additions=status.get("additions", 0),
            deletions=status.get("deletions", 0),
            changedFiles=status.get("changed_files", 0),
            checksBlocked=status.get("checks_blocked", False),
        )
    finally:
        await provider.close()


# ── Retry Push ───────────────────────────────────────────────────────────────

class RetryPushResponse(BaseModel):
    ok: bool
    message: str


@router.post("/requirements/{req_id}/git/retry-push", response_model=RetryPushResponse)
async def retry_push(project_id: str, req_id: str) -> RetryPushResponse:
    project = _ensure_project(project_id)
    req = get_requirement(req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    settings = project.get("settings") or {}
    repo_url = settings.get("repository")
    if not repo_url:
        raise HTTPException(status_code=400, detail="未配置仓库地址")

    git_config = settings.get("gitConfig") or {}
    ws = WorkspaceManager(project_id, repo_url, git_config, req_code=req["code"])
    branch = f"{ws.branch_prefix}{req['code']}"

    if not ws.work_dir.exists():
        raise HTTPException(status_code=400, detail="工作目录不存在，可能已被清理")

    try:
        ws.push(branch)
        save_commander_event(
            req_id, "system_info", "system", "Commander",
            f"已推送分支 {branch} 到远程仓库",
            {"branch": branch},
        )
        return RetryPushResponse(ok=True, message=f"已推送分支 {branch}")
    except Exception as e:
        from ..workflow_engine import _diagnose_git_error
        hint, action = _diagnose_git_error(e)
        save_commander_event(
            req_id, "git_error", "system", "Commander",
            f"推送分支失败：{hint}",
            {"error_type": "push", "action": action},
        )
        return RetryPushResponse(ok=False, message=hint)


# ── Create PR ────────────────────────────────────────────────────────────────

class CreatePRResponse(BaseModel):
    ok: bool
    message: str
    prUrl: Optional[str] = None
    prNumber: Optional[int] = None


@router.post("/requirements/{req_id}/git/create-pr", response_model=CreatePRResponse)
async def create_pr(project_id: str, req_id: str) -> CreatePRResponse:
    project = _ensure_project(project_id)
    req = get_requirement(req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    settings = project.get("settings") or {}
    repo_url = settings.get("repository")
    if not repo_url:
        raise HTTPException(status_code=400, detail="未配置仓库地址")

    git_config = settings.get("gitConfig") or {}
    token = decrypt_token(git_config.get("githubToken"))
    if not token:
        raise HTTPException(status_code=400, detail="Token 未配置或已失效")

    gi = req.get("gitInfo") or {}
    branch = gi.get("branch")
    if not branch:
        raise HTTPException(status_code=400, detail="尚未创建工作分支")

    owner, repo = parse_repo_url(repo_url)
    provider = GitHubProvider(owner, repo, token)
    default_branch = git_config.get("defaultBranch", "main")

    try:
        existing = await provider.get_pr_for_branch(branch)
        if existing:
            pr_url = existing["html_url"]
            pr_number = existing["number"]
            gi["prUrl"] = pr_url
            gi["prNumber"] = pr_number
            gi["prState"] = "open"
            req["gitInfo"] = gi
            save_requirement(req_id, req)
            save_commander_event(
                req_id, "git_pr_linked", "system", "Commander",
                f"检测到已有 PR #{pr_number}，已关联",
                {"pr_url": pr_url, "pr_number": pr_number, "branch": branch, "created": False},
            )
            return CreatePRResponse(ok=True, message=f"已关联 PR #{pr_number}",
                                     prUrl=pr_url, prNumber=pr_number)

        title = f"[{req['code']}] {req['title']}"
        body = _build_simple_pr_body(req)
        pr = await provider.create_pr(branch, default_branch, title, body)
        gi["prUrl"] = pr["url"]
        gi["prNumber"] = pr["number"]
        gi["prState"] = "open"
        req["gitInfo"] = gi
        save_requirement(req_id, req)
        save_commander_event(
            req_id, "git_pr_created", "system", "Commander",
            f"已创建 Pull Request #{pr['number']}",
            {"pr_url": pr["url"], "pr_number": pr["number"], "branch": branch, "created": True},
        )
        return CreatePRResponse(ok=True, message=f"已创建 PR #{pr['number']}",
                                 prUrl=pr["url"], prNumber=pr["number"])
    except Exception as e:
        return CreatePRResponse(ok=False, message=str(e)[:200])
    finally:
        await provider.close()


def _build_simple_pr_body(req: dict) -> str:
    """构建默认 PR body。"""
    steps_done = [s for s in req.get("pipeline", []) if s.get("status") == "done"]
    steps_summary = "\n".join(
        f"- {s.get('name')} ({s.get('agentName')})" for s in steps_done
    )
    return f"""## {req.get('code', '')} — {req.get('title', '')}

### 需求描述
{req.get('summary', '无')}

### 执行步骤（{len(steps_done)} 步完成）
{steps_summary or '无'}

---
> 由 AI-DZHT 多 Agent 平台自动生成"""
