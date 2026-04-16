"""LLM configuration API — platform-level model provider settings."""
from __future__ import annotations

import asyncio
import json
import os
import shutil
import time

from fastapi import APIRouter, HTTPException
from sqlalchemy import select, update

from ..database import engine, llm_config_table
from ..models import (
    LLMConfigOut,
    LLMConfigUpdateRequest,
    LLMModelInfo,
    LLMProviderInfo,
    LLMTestResponse,
)

router = APIRouter(prefix="/api/v1/llm-config", tags=["llm-config"])

# ── Supported providers & models ─────────────────────────────────────────────

PROVIDERS: list[dict] = [
    {
        "id": "github",
        "name": "GitHub Models (OpenAI)",
        "authType": "api_key",
        "authLabel": "GitHub Token",
        "authHint": "使用 GitHub Personal Access Token",
        "defaultBaseUrl": "https://models.inference.ai.azure.com",
        "models": [
            {"id": "gpt-4o", "name": "GPT-4o", "description": "多模态旗舰模型，速度与质量兼顾"},
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "description": "轻量快速，适合简单任务"},
        ],
    },
    {
        "id": "anthropic",
        "name": "Anthropic Claude",
        "authType": "oauth_token",
        "authLabel": "OAuth Token",
        "authHint": "可选：输入 OAuth Token 覆盖，留空则使用本机 Claude CLI 认证",
        "defaultBaseUrl": None,
        "models": [
            {"id": "claude-opus-4-6", "name": "Claude Opus 4.6", "description": "最强智能模型，适合复杂 Agent 任务与代码生成"},
            {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6", "description": "速度与智能最佳平衡，推荐日常使用"},
            {"id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5", "description": "最快速模型，适合高吞吐场景"},
        ],
    },
]


# ── GET /models — provider & model catalog ───────────────────────────────────

@router.get("/models", response_model=list[LLMProviderInfo])
def list_models() -> list[LLMProviderInfo]:
    return [
        LLMProviderInfo(
            id=p["id"],
            name=p["name"],
            authType=p["authType"],
            authLabel=p["authLabel"],
            authHint=p["authHint"],
            defaultBaseUrl=p.get("defaultBaseUrl"),
            models=[LLMModelInfo(**m) for m in p["models"]],
        )
        for p in PROVIDERS
    ]


# ── GET / — current config ───────────────────────────────────────────────────

@router.get("", response_model=LLMConfigOut)
def get_config() -> LLMConfigOut:
    with engine.connect() as conn:
        row = conn.execute(
            select(llm_config_table).where(llm_config_table.c.id == "default")
        ).fetchone()
    if not row:
        raise HTTPException(404, "LLM config not initialised")
    return LLMConfigOut(
        provider=row.provider,
        model=row.model,
        authType=getattr(row, 'auth_type', 'api_key') or 'api_key',
        hasToken=bool(row.api_key),
        baseUrl=row.base_url,
    )


# ── PUT / — update config ───────────────────────────────────────────────────

@router.put("", response_model=LLMConfigOut)
def update_config(req: LLMConfigUpdateRequest) -> LLMConfigOut:
    values: dict = {
        "provider": req.provider,
        "model": req.model,
        "updated_at": int(time.time()),
    }
    if req.authType is not None:
        values["auth_type"] = req.authType
    if req.token is not None:
        values["api_key"] = req.token
    if req.baseUrl is not None:
        values["base_url"] = req.baseUrl
    elif req.provider == "anthropic":
        values["base_url"] = None

    with engine.begin() as conn:
        conn.execute(
            update(llm_config_table)
            .where(llm_config_table.c.id == "default")
            .values(**values)
        )
        row = conn.execute(
            select(llm_config_table).where(llm_config_table.c.id == "default")
        ).fetchone()

    return LLMConfigOut(
        provider=row.provider,
        model=row.model,
        authType=getattr(row, 'auth_type', 'api_key') or 'api_key',
        hasToken=bool(row.api_key),
        baseUrl=row.base_url,
    )


# ── POST /test — verify connectivity ────────────────────────────────────────

@router.post("/test", response_model=LLMTestResponse)
async def test_connection(req: LLMConfigUpdateRequest) -> LLMTestResponse:
    token = req.token
    if not token:
        # Fall back to stored token
        with engine.connect() as conn:
            row = conn.execute(
                select(llm_config_table).where(llm_config_table.c.id == "default")
            ).fetchone()
        token = row.api_key if row else None

    if not token:
        if req.provider != "anthropic":
            return LLMTestResponse(success=False, message="未配置 Token")

    auth_type = req.authType or ("oauth_token" if req.provider == "anthropic" else "api_key")

    try:
        if req.provider == "anthropic":
            # Use Claude CLI subprocess — token optional (CLI uses own credentials if absent)
            claude_cli = shutil.which("claude") or "claude"
            env = dict(os.environ)
            if token:
                env["CLAUDE_CODE_OAUTH_TOKEN"] = token
            if req.baseUrl:
                env["ANTHROPIC_BASE_URL"] = req.baseUrl
            proc = await asyncio.create_subprocess_exec(
                claude_cli, "-p",
                "--output-format", "json",
                "--model", req.model,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )
            stdout, stderr = await proc.communicate(b"hi")
            if proc.returncode != 0:
                # CLI returns error as JSON on stdout, not stderr
                try:
                    err_data = json.loads(stdout.decode())
                    err_msg = err_data.get("result", stderr.decode().strip())
                except (json.JSONDecodeError, UnicodeDecodeError):
                    err_msg = stderr.decode().strip() or stdout.decode().strip()
                return LLMTestResponse(
                    success=False,
                    message=f"连接失败: {err_msg}",
                )
            data = json.loads(stdout.decode())
            if data.get("is_error"):
                return LLMTestResponse(
                    success=False,
                    message=f"连接失败: {data.get('result', '')}",
                )
            return LLMTestResponse(
                success=True,
                message=f"连接成功 — {req.model}",
                model=req.model,
            )
        else:
            from openai import AsyncOpenAI
            base_url = req.baseUrl or "https://models.inference.ai.azure.com"
            client = AsyncOpenAI(base_url=base_url, api_key=token)
            resp = await client.chat.completions.create(
                model=req.model,
                max_tokens=10,
                messages=[{"role": "user", "content": "hi"}],
            )
            return LLMTestResponse(
                success=True,
                message=f"连接成功 — {req.model}",
                model=resp.model,
            )
    except Exception as e:
        return LLMTestResponse(success=False, message=f"连接失败: {e}")
