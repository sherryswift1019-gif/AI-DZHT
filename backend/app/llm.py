import os
import json
from openai import AsyncOpenAI
from .models import (
    WorkflowSuggestRequest, WorkflowSuggestResponse,
    StepDetailRequest, StepDetailResponse,
    StepArtifact, StepLogLine, StepProgress, StepPlan, StepPlanCommand,
    ArtifactContentRequest, ArtifactContentResponse,
)

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
    conventions = "\n".join(f"  - {c}" for c in ctx.conventions)
    tech_stack = ", ".join(ctx.techStack)
    summary = req.reqSummary.strip() or "（无描述）"
    title = req.reqTitle.strip()[:200] or "（无标题）"
    summary = summary[:500]

    return f"""项目上下文：
- 行业：{ctx.industry}
- 技术栈：{tech_stack}
- 团队约定：
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


# ── Artifact Content ──────────────────────────────────────────────────────────

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
