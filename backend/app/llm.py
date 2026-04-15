import os
import json
from openai import AsyncOpenAI
from .models import (
    WorkflowSuggestRequest, WorkflowSuggestResponse,
    StepDetailRequest, StepDetailResponse,
    StepArtifact, StepLogLine, StepProgress, StepPlan, StepPlanCommand,
    ArtifactContentRequest, ArtifactContentResponse,
    GenerateContextRequest, GenerateContextResponse,
)
from .context import assemble_context

_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            base_url="https://models.inference.ai.azure.com",
            api_key=os.environ["GITHUB_TOKEN"],
        )
    return _client

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

agentRoles 可选值：analyst, pm, ux, architect, sm, dev, qa, quickdev, techwriter"""


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
    completion = await get_client().chat.completions.create(
        model="gpt-4o",
        max_tokens=512,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_message(req)},
        ],
    )

    raw = (completion.choices[0].message.content or "").strip()

    # 提取 JSON（防止模型在前后输出多余文字）
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"模型未返回有效 JSON: {raw[:200]}")

    data = json.loads(raw[start:end])

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
    completion = await get_client().chat.completions.create(
        model="gpt-4o",
        max_tokens=800,
        messages=[
            {"role": "system", "content": STEP_DETAIL_SYSTEM},
            {"role": "user", "content": _build_step_detail_message(req)},
        ],
    )

    raw = (completion.choices[0].message.content or "").strip()
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"模型未返回有效 JSON: {raw[:200]}")

    data = json.loads(raw[start:end])

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
}

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
):
    """逐行 yield 真实 LLM 生成的执行日志。"""
    persona = _AGENT_PERSONAS.get(agent_name, f"你是 {agent_name}，{agent_role or 'AI 助手'}。")
    system = _STREAM_LOG_SYSTEM.format(
        persona=persona, step_name=step_name, commands=commands or step_name
    )
    user_msg = f"需求标题：{req_title}\n需求描述：{req_summary or '（无）'}"

    stream = await get_client().chat.completions.create(
        model="gpt-4o",
        max_tokens=900,
        stream=True,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ],
    )

    buffer = ""
    async for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
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
  "industry": "项目所在行业领域（简短，如：SaaS / 企业软件、AI / 智能化软件、电商 / 零售）",
  "techStack": ["技术1", "技术2", ...],
  "conventions": ["规范1", "规范2", ...]
}

techStack：推断最合适的 3-6 个技术，基于描述中的线索。
conventions：生成 3-5 条适合该项目的研发规范，具体可操作。"""


async def generate_context(req: GenerateContextRequest) -> GenerateContextResponse:
    existing = req.existingContext or {}
    user_msg = f"""项目名称：{req.name}
项目描述：{req.description or "（无描述）"}
代码仓库：{req.repository or "（未填写）"}
已有上下文：{existing}

请根据以上信息生成或补全项目上下文。"""

    completion = await get_client().chat.completions.create(
        model="gpt-4o",
        max_tokens=512,
        messages=[
            {"role": "system", "content": GENERATE_CONTEXT_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
    )

    raw = (completion.choices[0].message.content or "").strip()
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"模型未返回有效 JSON: {raw[:200]}")

    data = json.loads(raw[start:end])
    return GenerateContextResponse(
        industry=data.get("industry", ""),
        techStack=data.get("techStack", []),
        conventions=data.get("conventions", []),
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

    completion = await get_client().chat.completions.create(
        model="gpt-4o",
        max_tokens=1500,
        messages=[
            {"role": "system", "content": ARTIFACT_CONTENT_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
    )

    content = (completion.choices[0].message.content or "").strip()
    return ArtifactContentResponse(
        content=content,
        format="code" if is_code else "markdown",
    )


# ── Worker Agent（真实执行，携带 assemble_context 注入）───────────────────────

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
      "content": "完整 Markdown 或代码内容（500-1200字）"
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
) -> dict:
    """执行 Worker Agent，返回 {artifacts: [...], suggestedContextUpdates: [...]}"""
    persona = _AGENT_PERSONAS.get(agent_name, f"你是 {agent_name}，{agent_role or 'AI 助手'}。")
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

    completion = await get_client().chat.completions.create(
        model="gpt-4o",
        max_tokens=2000,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ],
    )

    raw = (completion.choices[0].message.content or "").strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # 降级：尝试提取第一个完整 JSON 对象
        start = raw.find("{")
        end = raw.rfind("}") + 1
        data = json.loads(raw[start:end]) if start >= 0 and end > 0 else {}

    return {
        "artifacts": data.get("artifacts", []),
        "suggestedContextUpdates": data.get("suggestedContextUpdates", []),
    }

