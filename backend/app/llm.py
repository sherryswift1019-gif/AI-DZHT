"""LLM abstraction layer — supports OpenAI-compatible and Anthropic (via CLI) providers."""
import asyncio
import json
import os
import shutil
from dataclasses import dataclass
from typing import AsyncIterator

from openai import AsyncOpenAI
from sqlalchemy import select

from .database import engine, llm_config_table
from .models import (
    WorkflowSuggestRequest, WorkflowSuggestResponse,
    StepDetailRequest, StepDetailResponse,
    StepArtifact, StepLogLine, StepProgress, StepPlan, StepPlanCommand,
    ArtifactContentRequest, ArtifactContentResponse,
    GenerateContextRequest, GenerateContextResponse,
    TechItem, AvoidItem, Rule,
)
from .context import assemble_context


# ── Config & client management ───────────────────────────────────────────────

@dataclass
class LLMConfig:
    provider: str       # "github" | "anthropic"
    model: str
    auth_type: str      # "api_key" | "oauth_token"
    api_key: str
    base_url: str | None


def _load_config() -> LLMConfig:
    with engine.connect() as conn:
        row = conn.execute(
            select(llm_config_table).where(llm_config_table.c.id == "default")
        ).fetchone()
    if not row:
        raise RuntimeError("LLM 未配置，请先在「设置」页面配置大模型")
    # Anthropic provider can work without a token (CLI uses its own stored credentials)
    if row.provider != "anthropic" and not row.api_key:
        raise RuntimeError("LLM 未配置，请先在「设置」页面配置大模型 Token")
    return LLMConfig(
        provider=row.provider,
        model=row.model,
        auth_type=getattr(row, 'auth_type', 'api_key') or 'api_key',
        api_key=row.api_key or "",
        base_url=row.base_url,
    )

# ── Claude CLI subprocess ───────────────────────────────────────────────────

CLAUDE_CLI = shutil.which("claude") or "claude"


def _build_cli_env(cfg: LLMConfig) -> dict:
    """Build environment dict for Claude CLI subprocess."""
    env = dict(os.environ)
    if cfg.api_key:
        env["CLAUDE_CODE_OAUTH_TOKEN"] = cfg.api_key
    if cfg.base_url:
        env["ANTHROPIC_BASE_URL"] = cfg.base_url
    return env


def _messages_to_prompt(messages: list[dict]) -> str:
    """Combine OpenAI-style messages into a single prompt for claude CLI stdin."""
    system_parts: list[str] = []
    user_parts: list[str] = []
    for m in messages:
        if m["role"] == "system":
            system_parts.append(m["content"])
        else:
            user_parts.append(m["content"])

    parts: list[str] = []
    if system_parts:
        parts.append("\n\n".join(system_parts))
    if user_parts:
        parts.append("\n\n".join(user_parts))
    return "\n\n---\n\n".join(parts)


# ── Unified chat completion ──────────────────────────────────────────────────

async def _chat(
    messages: list[dict],
    max_tokens: int,
    json_mode: bool = False,
) -> str:
    """Send a chat request and return the text content."""
    cfg = _load_config()

    if cfg.provider == "anthropic":
        return await _chat_anthropic(cfg, messages, max_tokens)
    else:
        return await _chat_openai(cfg, messages, max_tokens, json_mode)


async def _chat_openai(
    cfg: LLMConfig,
    messages: list[dict],
    max_tokens: int,
    json_mode: bool = False,
) -> str:
    client = AsyncOpenAI(base_url=cfg.base_url, api_key=cfg.api_key)
    kwargs: dict = {
        "model": cfg.model,
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    resp = await client.chat.completions.create(**kwargs)
    return (resp.choices[0].message.content or "").strip()


async def _chat_anthropic(
    cfg: LLMConfig,
    messages: list[dict],
    max_tokens: int,
) -> str:
    """Call Claude via CLI subprocess (supports OAuth token)."""
    prompt = _messages_to_prompt(messages)
    env = _build_cli_env(cfg)

    proc = await asyncio.create_subprocess_exec(
        CLAUDE_CLI, "-p",
        "--output-format", "json",
        "--model", cfg.model,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    stdout, stderr = await proc.communicate(prompt.encode())

    if proc.returncode != 0:
        # CLI returns error details as JSON on stdout
        try:
            err_data = json.loads(stdout.decode())
            err_msg = err_data.get("result", stderr.decode().strip())
        except (json.JSONDecodeError, UnicodeDecodeError):
            err_msg = stderr.decode().strip() or stdout.decode().strip()
        raise RuntimeError(f"Claude CLI 执行失败: {err_msg}")

    data = json.loads(stdout.decode())
    if data.get("is_error"):
        raise RuntimeError(f"Claude 返回错误: {data.get('result', '')}")
    return (data.get("result") or "").strip()


# ── Unified streaming ────────────────────────────────────────────────────────

async def _stream_chat(
    messages: list[dict],
    max_tokens: int,
) -> AsyncIterator[str]:
    """Yield text deltas from a streaming request."""
    cfg = _load_config()

    if cfg.provider == "anthropic":
        async for delta in _stream_anthropic(cfg, messages, max_tokens):
            yield delta
    else:
        async for delta in _stream_openai(cfg, messages, max_tokens):
            yield delta


async def _stream_openai(
    cfg: LLMConfig,
    messages: list[dict],
    max_tokens: int,
) -> AsyncIterator[str]:
    client = AsyncOpenAI(base_url=cfg.base_url, api_key=cfg.api_key)
    stream = await client.chat.completions.create(
        model=cfg.model,
        max_tokens=max_tokens,
        stream=True,
        messages=messages,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
        if delta:
            yield delta


async def _stream_anthropic(
    cfg: LLMConfig,
    messages: list[dict],
    max_tokens: int,
) -> AsyncIterator[str]:
    """Stream Claude output via CLI subprocess (stream-json format)."""
    prompt = _messages_to_prompt(messages)
    env = _build_cli_env(cfg)

    proc = await asyncio.create_subprocess_exec(
        CLAUDE_CLI, "-p",
        "--output-format", "stream-json",
        "--model", cfg.model,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    assert proc.stdin and proc.stdout

    proc.stdin.write(prompt.encode())
    await proc.stdin.drain()
    proc.stdin.close()

    async for raw_line in proc.stdout:
        line = raw_line.decode().strip()
        if not line:
            continue
        try:
            evt = json.loads(line)
            # content_block_delta carries streaming text chunks
            if evt.get("type") == "content_block_delta":
                text = evt.get("delta", {}).get("text", "")
                if text:
                    yield text
        except json.JSONDecodeError:
            continue

    await proc.wait()


# ── Helper: extract JSON from model output ───────────────────────────────────

def _extract_json(raw: str) -> dict:
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"模型未返回有效 JSON: {raw[:200]}")
    return json.loads(raw[start:end])


# ── Tool-calling chat (for Commander agent) ─────────────────────────────────

async def chat_with_tools(
    messages: list[dict],
    tools: list[dict],
    max_tokens: int = 1024,
) -> dict:
    """Send a chat request with tool definitions and return the full message dict.

    Returns an OpenAI-compatible message dict with 'role', 'content',
    and optionally 'tool_calls'.
    """
    cfg = _load_config()

    if cfg.provider == "anthropic":
        return await _chat_with_tools_anthropic(cfg, messages, tools, max_tokens)
    else:
        return await _chat_with_tools_openai(cfg, messages, tools, max_tokens)


async def _chat_with_tools_openai(
    cfg: LLMConfig,
    messages: list[dict],
    tools: list[dict],
    max_tokens: int,
) -> dict:
    client = AsyncOpenAI(base_url=cfg.base_url, api_key=cfg.api_key)
    resp = await client.chat.completions.create(
        model=cfg.model,
        max_tokens=max_tokens,
        messages=messages,
        tools=tools,
        tool_choice="required",
    )
    msg = resp.choices[0].message
    return {k: v for k, v in msg.model_dump().items() if v is not None}


def _build_tool_system_prompt(messages: list[dict], tools: list[dict]) -> str:
    """Build the system prompt with tool definitions for Commander."""
    # Extract original system content
    system_content = ""
    for m in messages:
        if m.get("role") == "system":
            system_content = m["content"]
            break

    # Build tool definitions
    tool_defs = []
    for t in tools:
        fn = t.get("function", {})
        name = fn["name"]
        params = fn.get("parameters", {}).get("properties", {})
        required = fn.get("parameters", {}).get("required", [])
        param_desc = []
        for pname, pinfo in params.items():
            req_mark = "（必填）" if pname in required else "（可选）"
            param_desc.append(f"    - {pname}: {pinfo.get('description', '')} {req_mark}")
        params_text = "\n".join(param_desc) if param_desc else "    （无参数）"
        tool_defs.append(f"  {name}: {fn.get('description', '')}\n{params_text}")
    tools_block = "\n\n".join(tool_defs)

    return f"""{system_content}

===== 工具调用协议（必须严格遵守）=====

你是一个自动化流水线执行引擎。你只能通过调用工具来执行操作，不能与用户对话。

可用工具：
{tools_block}

【核心规则】
1. 你的每次回复必须且只能是一个合法 JSON 对象
2. 绝对不要输出解释、问候、分析或任何自然语言
3. 这些工具是你唯一的操作方式，你必须调用它们
4. JSON 格式：

{{"tool_calls": [{{"function": {{"name": "工具名", "arguments": {{参数对象}}}}}}]}}

【示例】调用 invoke_agent 执行步骤 s1：
{{"tool_calls": [{{"function": {{"name": "invoke_agent", "arguments": {{"step_id": "s1"}}}}}}]}}"""


def _build_tool_user_prompt(messages: list[dict]) -> str:
    """Build the user prompt with conversation history for Commander."""
    conversation_parts = []
    for m in messages:
        role = m.get("role", "")
        content = m.get("content", "")
        if role == "system":
            continue
        elif role == "user":
            conversation_parts.append(f"[用户]: {content}")
        elif role == "assistant":
            if m.get("tool_calls"):
                for tc in m["tool_calls"]:
                    fn = tc.get("function", {})
                    conversation_parts.append(
                        f'[你的操作]: 调用工具 {fn["name"]}，参数: {fn.get("arguments", "{}")}'
                    )
            elif content:
                conversation_parts.append(f"[你的回复]: {content}")
        elif role == "tool":
            conversation_parts.append(f"[工具返回结果]: {content}")

    history = "\n".join(conversation_parts) if conversation_parts else "（无历史对话）"
    return f"对话历史：\n{history}\n\n请立即输出 JSON 调用下一个工具。"


def _parse_tool_response(raw: str, tools: list[dict]) -> dict:
    """Parse raw LLM text into an OpenAI-compatible message dict with tool_calls."""
    data = None
    try:
        stripped = raw.strip()
        # Remove markdown code fences if present
        if stripped.startswith("```"):
            lines = stripped.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            stripped = "\n".join(lines).strip()
        if stripped.startswith("{"):
            data = json.loads(stripped)
        else:
            data = _extract_json(stripped)
    except (json.JSONDecodeError, ValueError):
        pass

    if data and data.get("tool_calls"):
        tool_calls = []
        for i, tc in enumerate(data["tool_calls"]):
            fn = tc.get("function", {})
            tool_calls.append({
                "id": f"call_{i}",
                "type": "function",
                "function": {
                    "name": fn.get("name", ""),
                    "arguments": json.dumps(fn.get("arguments", {}), ensure_ascii=False),
                },
            })
        result: dict = {"role": "assistant", "tool_calls": tool_calls}
        if data.get("content"):
            result["content"] = data["content"]
        return result

    # Fallback: try to detect a direct tool name + arguments pattern
    tool_names = [t["function"]["name"] for t in tools]
    for tn in tool_names:
        if f'"{tn}"' in (raw or ""):
            try:
                start = raw.find("{")
                end = raw.rfind("}") + 1
                if start >= 0 and end > start:
                    candidate = json.loads(raw[start:end])
                    if candidate.get("tool_calls") or candidate.get("function"):
                        if candidate.get("function"):
                            candidate = {"tool_calls": [candidate]}
                        return _parse_tool_response(
                            json.dumps(candidate, ensure_ascii=False), tools
                        )
            except (json.JSONDecodeError, ValueError):
                pass

    return {"role": "assistant", "content": raw or ""}


async def _chat_with_tools_anthropic(
    cfg: LLMConfig,
    messages: list[dict],
    tools: list[dict],
    max_tokens: int,
) -> dict:
    """Tool-calling via Claude CLI with --bare, --system-prompt, and --tools '' to
    disable built-in Claude Code behavior and force structured JSON output."""
    system_prompt = _build_tool_system_prompt(messages, tools)
    user_prompt = _build_tool_user_prompt(messages)
    env = _build_cli_env(cfg)

    for attempt in range(3):
        cmd = [
            CLAUDE_CLI, "-p",
            "--output-format", "json",
            "--model", cfg.model,
            "--system-prompt", system_prompt,
            "--tools", "",
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        stdout, stderr = await proc.communicate(user_prompt.encode())

        if proc.returncode != 0:
            try:
                err_data = json.loads(stdout.decode())
                err_msg = err_data.get("result", stderr.decode().strip())
            except (json.JSONDecodeError, UnicodeDecodeError):
                err_msg = stderr.decode().strip() or stdout.decode().strip()
            raise RuntimeError(f"Claude CLI 执行失败: {err_msg}")

        data = json.loads(stdout.decode())
        if data.get("is_error"):
            raise RuntimeError(f"Claude 返回错误: {data.get('result', '')}")

        raw = (data.get("result") or "").strip()
        result = _parse_tool_response(raw, tools)

        if result.get("tool_calls"):
            return result

        # Retry: append error feedback to user prompt
        user_prompt = (
            f"{user_prompt}\n\n"
            f"[错误] 你的回复不是合法的工具调用 JSON：{raw[:200]}\n"
            f"只输出 JSON，不要有其他文字。"
        )

    return result


# ══════════════════════════════════════════════════════════════════════════════
# Business functions — unchanged signatures, now provider-agnostic
# ══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """你是一个 AI 研发工厂平台的工作流顾问。
用户会提供项目上下文和一条需求，你需要分析并推荐最合适的 Agent 工作流模板。

可选模板：
- full（全流程）：适合大需求，包含需求分析→UX设计→架构设计→开发实现→自动化测试
- quick（快速开发）：适合小需求或功能迭代，仅快速开发→测试
- bugfix（Bug修复）：适合缺陷修复，仅开发修复→回归测试
- custom（自定义）：需求复杂性不明确或需要特殊组合时使用

必须以合法 JSON 格式响应，不要输出任何其他内容，格式如下：
{
  "recommendedTemplateId": "full|quick|bugfix|custom",
  "reasoning": "1-2句推荐原因",
  "suggestedAgentRoles": ["analyst", "ux", "architect", "dev", "qa"],
  "confidence": "high|medium|low",
  "warnings": ["可选风险提示"]
}

agentRoles 可选值：analyst, pm, ux, architect, sm, dev, qa, quickdev, techwriter, reqLead"""


def build_user_message(req: WorkflowSuggestRequest) -> str:
    ctx = req.projectContext
    rules = ctx.rules or []
    conventions = "\n".join(f"  - {r.text if hasattr(r, 'text') else r}" for r in rules)
    tech_items = ctx.techStack or []
    tech_stack = ", ".join(t.name if hasattr(t, 'name') else t for t in tech_items)
    summary = req.reqSummary.strip() or "（无描述）"
    title = req.reqTitle.strip()[:200] or "（无标题）"
    summary = summary[:500]

    return f"""项目上下文：
- 行业：{ctx.industry}
- 技术栈：{tech_stack}
- 团队规范：
{conventions}

需求信息：
- 标题：{title}
- 描述：{summary}"""


async def suggest_workflow(req: WorkflowSuggestRequest) -> WorkflowSuggestResponse:
    raw = await _chat(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_message(req)},
        ],
        max_tokens=512,
    )

    data = _extract_json(raw)

    return WorkflowSuggestResponse(
        recommendedTemplateId=data.get("recommendedTemplateId", "full"),
        reasoning=data.get("reasoning", ""),
        suggestedAgentRoles=data.get("suggestedAgentRoles", []),
        confidence=data.get("confidence", "medium"),
        warnings=data.get("warnings", []),
    )


# ── Step Detail ───────────────────────────────────────────────────────────────

STEP_DETAIL_SYSTEM = """你是 AI 研发工厂平台的步骤详情生成器。
根据 Agent 信息和需求上下文，生成该流水线步骤的执行详情，必须用中文，以合法 JSON 格式输出，不要有多余文字。

根据 status 字段，JSON 结构不同：

status=queued（未开始）输出：
{
  "summary": "一句话说明该步骤将做什么",
  "plan": {
    "description": "2-3句话描述该 Agent 将要完成的工作",
    "commandDetails": [
      { "code": "命令代码", "name": "命令名称", "description": "该命令的具体作用（1句话）" }
    ],
    "estimatedMinutes": 预计分钟数
  }
}

status=running（进行中）输出：
{
  "summary": "一句话描述正在做什么",
  "progress": {
    "currentCommand": "当前执行的命令代码",
    "completedCommands": ["已完成的命令代码列表"],
    "logLines": [
      { "time": "HH:MM", "text": "日志内容（模拟真实 Agent 日志）" }
    ],
    "startedAt": "HH:MM",
    "estimatedRemainingMinutes": 剩余分钟数
  }
}
日志至少 5 条，时间从 startedAt 开始递增，最后一条用当前时间。

status=done（已完成）输出：
{
  "summary": "一句话总结完成了什么",
  "artifacts": [
    { "name": "产出物名称", "type": "document|code|design|report|plan|test", "summary": "1-2句描述内容" }
  ],
  "duration": "约 N 分钟"
}
产出物数量与 commands 数量对应，至少 1 个。

status=blocked（阻塞）输出：
{
  "summary": "一句话说明当前阻塞状态",
  "blockedReason": "2-3句话描述阻塞原因和建议操作"
}"""


def _build_step_detail_message(req: StepDetailRequest) -> str:
    return f"""Agent：{req.agentName}（{req.agentRole}）
步骤名称：{req.stepName}
当前状态：{req.status}
执行命令：{req.commands}
需求标题：{req.reqTitle}
需求摘要：{req.reqSummary or "（无描述）"}"""


async def get_step_detail(req: StepDetailRequest) -> StepDetailResponse:
    raw = await _chat(
        messages=[
            {"role": "system", "content": STEP_DETAIL_SYSTEM},
            {"role": "user", "content": _build_step_detail_message(req)},
        ],
        max_tokens=800,
    )

    data = _extract_json(raw)

    plan = None
    if data.get("plan"):
        p = data["plan"]
        plan = StepPlan(
            description=p.get("description", ""),
            commandDetails=[
                StepPlanCommand(code=c["code"], name=c["name"], description=c["description"])
                for c in p.get("commandDetails", [])
            ],
            estimatedMinutes=p.get("estimatedMinutes", 20),
        )

    progress = None
    if data.get("progress"):
        pr = data["progress"]
        progress = StepProgress(
            currentCommand=pr.get("currentCommand", ""),
            completedCommands=pr.get("completedCommands", []),
            logLines=[
                StepLogLine(time=l["time"], text=l["text"])
                for l in pr.get("logLines", [])
            ],
            startedAt=pr.get("startedAt", "--:--"),
            estimatedRemainingMinutes=pr.get("estimatedRemainingMinutes", 10),
        )

    artifacts = None
    if data.get("artifacts"):
        artifacts = [
            StepArtifact(name=a["name"], type=a["type"], summary=a["summary"])
            for a in data["artifacts"]
        ]

    return StepDetailResponse(
        status=req.status,
        summary=data.get("summary", ""),
        plan=plan,
        progress=progress,
        artifacts=artifacts,
        duration=data.get("duration"),
        blockedReason=data.get("blockedReason"),
    )



# ── Step Log Streaming ────────────────────────────────────────────────────────

_AGENT_PERSONAS: dict[str, str] = {
    "Mary":    "你是 Mary，战略商业分析师，擅长市场调研、竞品分析和商业报告撰写。",
    "John":    "你是 John，产品经理，擅长需求分析、PRD 撰写和 Epic/Story 拆解。",
    "Sally":   "你是 Sally，UX 设计师，擅长用户流程设计、线框稿和交互说明。",
    "Winston": "你是 Winston，系统架构师，擅长技术选型、架构设计和 API 规范制定。",
    "Bob":     "你是 Bob，Scrum Master，擅长迭代计划制定和 User Story 拆解。",
    "Amelia":  "你是 Amelia，高级开发工程师，擅长功能代码实现和代码质量审查。",
    "Quinn":   "你是 Quinn，QA 工程师，擅长自动化测试设计和缺陷分析。",
    "Barry":   "你是 Barry，全栈快速开发工程师，擅长快速原型实现。",
    "Paige":   "你是 Paige，技术文档专家，擅长接口文档、部署指南编写。",
    "Lena":    "你是 Lena，务实的需求总监，擅长从商业洞察到产品规格的全链路需求管理。",
}


def _build_persona(agent_name: str, agent_role: str, prompt_blocks: dict | None = None) -> str:
    """从 promptBlocks 构建 persona（优先），fallback 到 _AGENT_PERSONAS 硬编码。"""
    if prompt_blocks and prompt_blocks.get("roleDefinition"):
        parts = [prompt_blocks["roleDefinition"]]
        if prompt_blocks.get("capabilityScope"):
            parts.append(f"能力范围：{prompt_blocks['capabilityScope']}")
        if prompt_blocks.get("behaviorConstraints"):
            parts.append(f"行为约束：{prompt_blocks['behaviorConstraints']}")
        if prompt_blocks.get("outputSpec"):
            parts.append(f"输出规范：{prompt_blocks['outputSpec']}")
        return "\n".join(parts)
    return _AGENT_PERSONAS.get(agent_name, f"你是 {agent_name}，{agent_role or 'AI 助手'}。")

_STREAM_LOG_SYSTEM = """{persona}

你正在 AI 研发工厂平台中执行任务。
步骤名称：{step_name}
执行命令：{commands}

请以如下日志格式逐行输出你的完整执行过程，每行一条日志，行与行之间不要空行。
格式规则（严格遵守，每行以 [ 开头）：
- [init] 初始化操作描述
- [tool:<工具名>] 工具调用描述（工具名用英文：web_search/read_file/write_file/run_test/analyze/diagram 等）
- [result] 上个工具的返回结果摘要
- [analysis] 分析结论
- [planning] 规划内容
- [writing] 撰写进度
- [code] 代码实现内容
- [review] 审查结果
- [fix] 修复操作
- [output] ✓ 最终产出物列表（最后一行，必须有）

要求：输出 8-12 条日志，内容具体真实，只输出日志行，不要有任何其他文字"""


async def stream_step_log(
    agent_name: str,
    agent_role: str,
    step_name: str,
    commands: str,
    req_title: str,
    req_summary: str,
    prompt_blocks: dict | None = None,
):
    """逐行 yield 真实 LLM 生成的执行日志。"""
    persona = _build_persona(agent_name, agent_role, prompt_blocks)
    system = _STREAM_LOG_SYSTEM.format(
        persona=persona, step_name=step_name, commands=commands or step_name
    )
    user_msg = f"需求标题：{req_title}\n需求描述：{req_summary or '（无）'}"

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_msg},
    ]

    buffer = ""
    async for delta in _stream_chat(messages, max_tokens=900):
        buffer += delta
        while "\n" in buffer:
            line, buffer = buffer.split("\n", 1)
            line = line.strip()
            if line:
                yield line

    if buffer.strip():
        yield buffer.strip()


# ── Generate Context ──────────────────────────────────────────────────────────

GENERATE_CONTEXT_SYSTEM = """你是 AI 研发工厂平台的项目上下文生成助手。
根据项目名称和描述，生成适合该项目的上下文信息，必须以合法 JSON 格式输出，不要有多余文字。

输出格式：
{
  "goal": "用一句话描述项目核心目标",
  "targetUsers": "目标用户群体",
  "industry": "项目所在行业领域（简短，如：SaaS / 企业软件、AI / 智能化软件、电商 / 零售）",
  "techStack": [
    {"name": "技术名称", "version": "版本号（可选）", "notes": "用途说明（可选）"}
  ],
  "archSummary": "1-2 句话概括推荐的技术架构",
  "avoid": [
    {"item": "应避免的做法", "reason": "原因", "useInstead": "推荐替代方案"}
  ],
  "rules": [
    {"scope": "all", "text": "规范内容", "source": "agent"}
  ]
}

字段说明：
- goal / targetUsers：根据项目名称和描述推断。
- techStack：推断最合适的 3-6 个技术，输出为对象数组。
- archSummary：基于推断的技术栈给出架构概述。
- avoid：生成 2-3 条该类项目常见的反模式或禁忌。
- rules：生成 3-5 条具体可操作的研发规范，scope 可选 all/dev/qa/pm/design/architect。"""


async def generate_context(req: GenerateContextRequest) -> GenerateContextResponse:
    existing = req.existingContext or {}
    user_msg = f"""项目名称：{req.name}
项目描述：{req.description or "（无描述）"}
代码仓库：{req.repository or "（未填写）"}
已有上下文：{existing}

请根据以上信息生成或补全项目上下文。"""

    raw = await _chat(
        messages=[
            {"role": "system", "content": GENERATE_CONTEXT_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=512,
    )

    data = _extract_json(raw)
    return GenerateContextResponse(
        goal=data.get("goal", ""),
        targetUsers=data.get("targetUsers", ""),
        industry=data.get("industry", ""),
        techStack=[
            TechItem(**t) if isinstance(t, dict) else TechItem(name=t)
            for t in data.get("techStack", [])
        ],
        archSummary=data.get("archSummary", ""),
        avoid=[
            AvoidItem(**a) if isinstance(a, dict) else AvoidItem(item=a)
            for a in data.get("avoid", [])
        ],
        rules=[
            Rule(**r) if isinstance(r, dict) else Rule(scope="all", text=r, source="agent")
            for r in data.get("rules", [])
        ],
    )

ARTIFACT_CONTENT_SYSTEM = """你是 AI 研发工厂平台的产出物生成器。
根据 Agent 信息和需求上下文，生成一份完整、专业的产出文档，用中文写作。
输出格式为 Markdown，内容要具体、有实质内容，不能只是框架或占位符。
长度在 600-1200 字之间，结构清晰，符合该文档类型的行业标准格式。
直接输出 Markdown 内容，不要包裹在代码块或 JSON 中。"""


async def get_artifact_content(req: ArtifactContentRequest) -> ArtifactContentResponse:
    is_code = req.artifactType == "code"
    format_hint = (
        "输出为代码文件，使用适当的编程语言，加上注释说明关键逻辑。"
        if is_code
        else f"文档类型：{req.artifactType}，使用标准 Markdown 格式。"
    )

    user_msg = f"""产出物信息：
- 所属 Agent：{req.agentName}（{req.agentRole}）
- 步骤：{req.stepName}
- 产出物名称：{req.artifactName}
- 产出物类型：{req.artifactType}
- 需求标题：{req.reqTitle}
- 需求摘要：{req.reqSummary or "（无描述）"}

{format_hint}

请生成完整的产出物内容。"""

    content = await _chat(
        messages=[
            {"role": "system", "content": ARTIFACT_CONTENT_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=1500,
    )

    return ArtifactContentResponse(
        content=content,
        format="code" if is_code else "markdown",
    )


# ── Worker Agent（真实执行，携带 assemble_context 注入）───────────────────────

_HIGH_TOKEN_CMDS = {"CP", "EP", "CA", "CU"}
_MEDIUM_TOKEN_CMDS = {"BP", "MR", "DR", "TR", "CB", "VP", "QA"}


def _resolve_max_tokens(commands: str) -> int:
    """根据命令类型决定 max_tokens：PRD/架构类 4000，研究类 3000，其余 2000。"""
    codes = {c.strip() for c in (commands or "").replace("→", ",").split(",") if c.strip()}
    if codes & _HIGH_TOKEN_CMDS:
        return 4000
    if codes & _MEDIUM_TOKEN_CMDS:
        return 3000
    return 2000

_WORKER_SYSTEM = """{persona}

你正在执行需求「{req_title}」的步骤「{step_name}」（命令：{commands}）。

{context_block}

前序产出物摘要：
{prev_summaries}

请以合法 JSON 格式输出，包含两个字段：
{{
  "artifacts": [
    {{
      "name": "产出物名称",
      "type": "document|code|design|report|plan|test",
      "summary": "1-2句摘要",
      "content": "完整 Markdown 或代码内容"
    }}
  ],
  "suggestedContextUpdates": [
    {{
      "type": "rule",
      "scope": "all|dev|qa|pm|design|architect",
      "text": "规范内容"
    }},
    {{
      "type": "lesson",
      "scope": "dev",
      "title": "教训标题",
      "background": "背景",
      "correctApproach": "正确做法"
    }}
  ]
}}

artifacts 至少 1 个，与执行命令对应。suggestedContextUpdates 若无建议则为空数组。
只输出 JSON，不要有任何其他文字。"""


async def execute_worker_agent(
    agent_name: str,
    agent_role: str,
    step_name: str,
    commands: str,
    req_title: str,
    req_summary: str,
    project_context: dict,
    prev_artifact_summaries: str,
    prompt_blocks: dict | None = None,
) -> dict:
    """执行 Worker Agent，返回 {artifacts: [...], suggestedContextUpdates: [...]}"""
    persona = _build_persona(agent_name, agent_role, prompt_blocks)
    context_block = assemble_context(project_context, agent_name)

    system = _WORKER_SYSTEM.format(
        persona=persona,
        req_title=req_title,
        step_name=step_name,
        commands=commands or step_name,
        context_block=context_block,
        prev_summaries=prev_artifact_summaries or "（无前序产出物）",
    )
    user_msg = f"需求描述：{req_summary or '（无）'}"

    raw = await _chat(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=_resolve_max_tokens(commands),
        json_mode=True,
    )

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = _extract_json(raw)

    return {
        "artifacts": data.get("artifacts", []),
        "suggestedContextUpdates": data.get("suggestedContextUpdates", []),
    }


# ── 逐命令执行 + 审查 + 知识沉淀 ───────────────────────────────────────────────

_CMD_NAMES: dict[str, str] = {
    "BP": "头脑风暴", "MR": "市场研究", "DR": "领域研究",
    "TR": "技术研究", "CB": "产品简报", "DP": "项目文档化",
    "CP": "创建 PRD", "VP": "验证 PRD", "EP": "编辑 PRD",
    "CU": "创建 UX 设计", "CA": "创建架构", "GPC": "生成项目上下文",
    "DS": "Story 开发", "CS": "创建 Story", "SP": "Sprint 规划",
    "QA": "自动化测试", "CR": "代码审查", "QQ": "快速开发",
    "CE": "创建 Epic", "IR": "就绪检查", "CC": "方向修正",
    "VS": "验证 Story", "SS": "Sprint 状态", "ER": "复盘",
    "WD": "编写文档", "MG": "Mermaid 图表", "VD": "验证文档", "EC": "解释概念",
}

_CMD_REVIEW_POLICY: dict[str, int] = {
    "CP": 3, "EP": 3,              # PRD 类：完整三轮审查
    "MR": 2, "DR": 2, "CB": 2,     # 研究/报告类：两轮
    "BP": 1, "TR": 1,              # 发散/探索类：一轮结构审查
    "VP": 0,                        # 验证命令本身就是审查，跳过
}

_KNOWLEDGE_ENABLED_ROLES = {"reqLead", "analyst", "pm"}

_SINGLE_CMD_SYSTEM = """{persona}

你正在执行需求「{req_title}」中的命令「{cmd_code} — {cmd_name}」。

{context_block}

前序产出物（可参考）：
{prev_outputs}

请以合法 JSON 格式输出，只包含 1 个产出物：
{{
  "artifact": {{
    "name": "产出物名称",
    "type": "document|report|plan|design|code|test",
    "summary": "1-2句摘要",
    "content": "完整 Markdown 内容"
  }}
}}
只输出 JSON，不要有任何其他文字。"""


async def _execute_single_command(
    cmd_code: str,
    cmd_name: str,
    persona: str,
    req_title: str,
    req_summary: str,
    context_block: str,
    prev_outputs: str,
    max_tokens: int = 3000,
) -> dict:
    """单命令执行，返回 1 个 artifact dict。"""
    system = _SINGLE_CMD_SYSTEM.format(
        persona=persona,
        req_title=req_title,
        cmd_code=cmd_code,
        cmd_name=cmd_name,
        context_block=context_block,
        prev_outputs=prev_outputs or "（无）",
    )
    raw = await _chat(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": f"需求描述：{req_summary or '（无）'}"},
        ],
        max_tokens=max_tokens,
        json_mode=True,
    )
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = _extract_json(raw)
    return data.get("artifact", {})


# ── 审查 Prompts ─────────────────────────────────────────────────────────────

_REVIEW_ADVERSARIAL = """你是一个严厉的对抗性审查员。找出以下文档中的：
1. 逻辑缺口和自相矛盾
2. 未经验证的假设
3. 模糊或不可操作的描述
4. 缺失的利益相关者视角
5. 过度乐观的预期

文档内容：
{document}

以 JSON 输出：{{"issues": [{{"severity": "critical|major|minor", "location": "位置", "issue": "问题", "suggestion": "建议"}}], "summary": "总评"}}
只输出 JSON。"""

_REVIEW_EDGE_CASE = """你是一个边界用例猎人。遍历以下文档中每个功能点，找出未处理的：
1. 边界条件（空值、极端值、并发）
2. 异常路径（网络失败、权限不足、数据不一致）
3. 用户误操作场景
4. 跨系统依赖的失败点

文档内容：
{document}

以 JSON 输出：{{"edgeCases": [{{"area": "区域", "scenario": "场景", "risk": "风险", "recommendation": "建议"}}], "summary": "总评"}}
只输出 JSON。"""

_REVIEW_STRUCTURAL = """你是一个结构编辑。审查以下文档的：
1. 结构是否合理（章节顺序、层级）
2. 是否有重复或冗余
3. 是否缺少必要章节（执行摘要、验收标准、非功能需求等）
4. 表述是否清晰无歧义
5. 是否可被下游工程师/设计师直接消费

文档内容：
{document}

以 JSON 输出：{{"structuralIssues": [{{"type": "missing|redundant|unclear|reorder", "location": "位置", "issue": "问题", "suggestion": "建议"}}], "completenessScore": 8, "summary": "总评"}}
只输出 JSON。"""

_REVISE_SYSTEM = """{persona}

你之前产出了一份文档，现在收到了审查反馈。请根据反馈修订文档。

原始文档：
{original}

审查反馈：
{review_feedback}

要求：
1. 逐条处理每个审查问题
2. 保留原文档中没有问题的部分
3. 只输出修订后的完整文档（Markdown 格式）
4. 不要输出任何解释，只输出文档内容"""


# ── 知识沉淀 Prompt ──────────────────────────────────────────────────────────

_KNOWLEDGE_EXTRACT = """你是知识提炼专家。从以下产出物中提取可复用的结构化知识。

产出物内容：
{artifacts_content}

提取以下类型的知识（只提取真正有价值、可复用的条目）：

以 JSON 输出：
{{
  "items": [
    {{
      "type": "domain_term",
      "term": "术语名",
      "definition": "定义",
      "scope": "all"
    }},
    {{
      "type": "business_rule",
      "text": "规则内容",
      "scope": "all|dev|qa|pm|design|architect",
      "source": "来源产出物名称"
    }},
    {{
      "type": "market_insight",
      "title": "洞察标题",
      "insight": "洞察内容",
      "evidence": "支撑数据/来源"
    }},
    {{
      "type": "checklist_item",
      "text": "检查项内容",
      "scope": "all|dev|qa|pm",
      "category": "类别"
    }}
  ]
}}
只输出有价值的条目，宁少勿滥。只输出 JSON。"""


def _knowledge_to_suggestions(items: list[dict]) -> list[dict]:
    """将知识提炼结果转为现有的 suggestedContextUpdates 格式。"""
    suggestions = []
    for item in items:
        item_type = item.get("type")
        if item_type == "business_rule":
            suggestions.append({
                "type": "rule",
                "scope": item.get("scope", "all"),
                "text": item.get("text", ""),
                "source": "agent",
            })
        elif item_type == "domain_term":
            suggestions.append({
                "type": "rule",
                "scope": "all",
                "text": f"[领域术语] {item.get('term', '')}: {item.get('definition', '')}",
                "source": "agent",
            })
        elif item_type == "market_insight":
            suggestions.append({
                "type": "lesson",
                "scope": item.get("scope", "pm"),
                "title": item.get("title", "市场洞察"),
                "background": item.get("evidence", ""),
                "correctApproach": item.get("insight", ""),
            })
        elif item_type == "checklist_item":
            suggestions.append({
                "type": "rule",
                "scope": item.get("scope", "all"),
                "text": f"[检查清单:{item.get('category', '')}] {item.get('text', '')}",
                "source": "agent",
            })
    return suggestions


# ── 访谈 Prompt ──────────────────────────────────────────────────────────────

_INTERVIEW_SYSTEM = """{persona}

你正在为需求「{req_title}」做信息采集，后续要执行命令 [{commands}]。

已有信息：
- 需求描述：{req_summary}
{context_block}
{prev_outputs}
{interview_history_block}

请判断现有信息是否足够开始工作。以 JSON 输出：
{{
  "ready": true或false,
  "message": "若 ready=false，写一段自然、友好的对话（像和同事聊天）。先简要说明你了解到了什么，再自然地追问需要补充的信息。不要用编号列表，用人话。若 ready=true，写一句'信息充分，开始执行'即可。"
}}
只输出 JSON。"""


def _format_interview_history(history: list[dict]) -> str:
    if not history:
        return "（首次交流，尚无对话历史）"
    lines = ["已有的对话记录："]
    for item in history:
        if item.get("type") == "question":
            lines.append(f"  你说：{item.get('text', '')}")
        elif item.get("type") == "answer":
            lines.append(f"  用户回复：{item.get('text', '')}")
    return "\n".join(lines)


def _format_interview_as_context(history: list[dict]) -> str:
    """Extract user answers as context."""
    pairs = []
    for item in history:
        if item.get("type") == "answer" and item.get("text"):
            pairs.append(item["text"])
    return "\n".join(pairs) if pairs else ""


async def execute_worker_with_review(
    agent_name: str,
    agent_role: str,
    step_name: str,
    commands: str,
    req_title: str,
    req_summary: str,
    project_context: dict,
    prev_artifact_summaries: str,
    prompt_blocks: dict | None = None,
    on_progress=None,
    review_rounds: int = 3,
    code_context: str = "",
    interview_history: list[dict] | None = None,
    max_interview_rounds: int = 3,
) -> dict:
    """对话式访谈 → 逐命令执行 → 审查 → 知识沉淀。"""

    async def emit(tag: str, msg: str):
        if on_progress:
            await on_progress(tag, msg)

    persona = _build_persona(agent_name, agent_role, prompt_blocks)
    context_block = assemble_context(project_context, agent_name)
    if code_context:
        context_block += f"\n\n[CODE REPOSITORY]\n{code_context}"

    # ━━ 阶段 0: 对话式访谈 ━━
    cmd_codes = [c.strip() for c in (commands or "").replace("→", ",").split(",") if c.strip()]
    intra_step_outputs = prev_artifact_summaries or ""

    if cmd_codes:
        history = list(interview_history or [])
        history_block = _format_interview_history(history)

        raw = await _chat(
            messages=[{"role": "user", "content": _INTERVIEW_SYSTEM.format(
                persona=persona, req_title=req_title, req_summary=req_summary or "（无）",
                commands=", ".join(cmd_codes),
                context_block=context_block, prev_outputs=intra_step_outputs or "（无）",
                interview_history_block=history_block,
            )}],
            max_tokens=800,
            json_mode=True,
        )
        try:
            interview_data = json.loads(raw)
        except json.JSONDecodeError:
            interview_data = _extract_json(raw)

        if not interview_data.get("ready", True):
            question_count = len([h for h in history if h.get("type") == "question"])
            if question_count < max_interview_rounds:
                await emit("interview", "需要补充信息...")
                return {
                    "status": "need_input",
                    "message": interview_data.get("message", "能否补充一些信息？"),
                }

        # ready → 将访谈收集到的信息追加到执行上下文
        if history:
            interview_context = _format_interview_as_context(history)
            await emit("interview:done", "信息采集完成，开始执行...")
            if interview_context:
                intra_step_outputs += f"\n\n[用户补充信息]\n{interview_context}"

    # ━━ 阶段 1: 逐命令执行 ━━
    artifacts = []

    for cmd_code in cmd_codes:
        cmd_name = _CMD_NAMES.get(cmd_code, cmd_code)
        await emit(f"exec:{cmd_code}", f"正在执行 {cmd_name}...")

        art = await _execute_single_command(
            cmd_code=cmd_code,
            cmd_name=cmd_name,
            persona=persona,
            req_title=req_title,
            req_summary=req_summary,
            context_block=context_block,
            prev_outputs=intra_step_outputs,
            max_tokens=_resolve_max_tokens(cmd_code),
        )

        if art and art.get("content"):
            art["_cmd_code"] = cmd_code
            artifacts.append(art)
            art_name = art.get("name", cmd_name)
            await emit(f"done:{cmd_code}", f"完成 → 产出：{art_name}")
            intra_step_outputs += f"\n\n[{cmd_name}·{art_name}]\n{art['content']}"

    if not artifacts:
        return {"artifacts": [], "suggestedContextUpdates": []}

    # ━━ 阶段 2: 审查 ━━
    REVIEWABLE_TYPES = {"document", "report", "plan", "design"}
    reviews = [
        ("adversarial", "对抗性审查", _REVIEW_ADVERSARIAL),
        ("edge-case", "边界用例审查", _REVIEW_EDGE_CASE),
        ("structural", "结构完整性审查", _REVIEW_STRUCTURAL),
    ]

    for i, art in enumerate(artifacts):
        if art.get("type") not in REVIEWABLE_TYPES:
            continue

        cmd = art.get("_cmd_code", "")
        art_review_rounds = _CMD_REVIEW_POLICY.get(cmd, 2)
        if art_review_rounds == 0:
            continue

        current_content = art.get("content", "")
        art_name = art.get("name", "产出物")

        for review_id, review_name, review_template in reviews[:art_review_rounds]:
            await emit(f"review:{review_id}", f"正在对「{art_name}」进行{review_name}...")

            review_raw = await _chat(
                messages=[{"role": "user", "content": review_template.format(document=current_content)}],
                max_tokens=2000,
                json_mode=True,
            )
            try:
                review_data = json.loads(review_raw)
            except json.JSONDecodeError:
                review_data = _extract_json(review_raw)

            await emit("findings", f"[{review_name}] {review_data.get('summary', '审查完成')}")

            has_issues = (
                review_data.get("issues")
                or review_data.get("edgeCases")
                or review_data.get("structuralIssues")
            )
            if not has_issues:
                await emit("pass", f"「{art_name}」{review_name}通过")
                continue

            await emit("revise", f"正在根据{review_name}反馈修订「{art_name}」...")
            revised = await _chat(
                messages=[{"role": "user", "content": _REVISE_SYSTEM.format(
                    persona=persona, original=current_content, review_feedback=review_raw,
                )}],
                max_tokens=_resolve_max_tokens(cmd),
            )
            current_content = revised

        artifacts[i]["content"] = current_content
        artifacts[i]["summary"] = f"[经 {art_review_rounds} 轮审查] " + art.get("summary", "")
        await emit("output", f"「{art_name}」定稿完成（经 {art_review_rounds} 轮审查）")

    # 清理内部字段
    for art in artifacts:
        art.pop("_cmd_code", None)

    # ━━ 阶段 3: 知识沉淀（仅限特定角色） ━━
    context_updates: list[dict] = []
    if agent_role in _KNOWLEDGE_ENABLED_ROLES:
        await emit("knowledge", "正在从产出物中提炼可复用知识...")

        all_content = "\n\n---\n\n".join(
            f"## {a.get('name', '')}\n{a.get('content', '')}" for a in artifacts
        )
        knowledge_raw = await _chat(
            messages=[{"role": "user", "content": _KNOWLEDGE_EXTRACT.format(artifacts_content=all_content)}],
            max_tokens=2000,
            json_mode=True,
        )
        try:
            knowledge_data = json.loads(knowledge_raw)
        except json.JSONDecodeError:
            knowledge_data = _extract_json(knowledge_raw)

        knowledge_items = knowledge_data.get("items", [])
        context_updates = _knowledge_to_suggestions(knowledge_items)

        if knowledge_items:
            type_counts: dict[str, int] = {}
            for item in knowledge_items:
                t = item.get("type", "unknown")
                type_counts[t] = type_counts.get(t, 0) + 1
            summary_parts = [f"{v} 条{k}" for k, v in type_counts.items()]
            await emit("knowledge:done", f"提取了 {'、'.join(summary_parts)}")
        else:
            await emit("knowledge:done", "未发现需要沉淀的新知识")

    return {
        "artifacts": artifacts,
        "suggestedContextUpdates": context_updates,
    }
