# 需求总监 Agent (Lena) 实施计划

## Context

当前 AI-DZHT 平台有 9 个内置 Agent，其中需求分析由 Mary（分析师，做研究）和 John（产品经理，做 PRD）分工。问题是：
1. **Mary → John 交接信息损耗**：前序产出物只传摘要，研究洞察到 PRD 时大量丢失
2. **`promptBlocks` 形同虚设**：`execute_worker_agent()` 使用硬编码的 `_AGENT_PERSONAS`，数据库中的 promptBlocks 从未被使用
3. **所有命令共用同一个浅 prompt**：BP（头脑风暴）和 MR（市场研究）的执行逻辑完全一样
4. **输出质量受限**：max_tokens=2000，内容限 500-1200 字，对 PRD 级别的产出远远不够
5. **产出物无审查**：Agent 一次性输出就是终稿，没有自审/复审环节，文档质量无法保证
6. **执行过程不可见**：用户只看到"开始工作"和"完成"两个事件，中间过程是黑盒
7. **无交互式需求采集**：Worker Agent 是 fire-and-forget，不能在执行前与用户对话收集信息。需求分析本质是对话式引导

本计划新增第 10 个内置 Agent **Lena（需求总监）**，角色 `reqLead`，融合 Mary 的研究能力 + John 的 PRD 能力，同时修复上述基础问题，引入**交互式访谈 → 逐命令执行 → 三轮自审 → 知识沉淀**的完整执行流程。

---

## Phase 1: 修复 promptBlocks 不生效的核心缺陷

> 所有后续 Phase 依赖此步。此修复让所有 Agent（包括自定义/fork Agent）的 promptBlocks 真正驱动行为。

### 1.1 `backend/app/storage.py` — 新增 `get_agent_by_name()`

在现有 `get_agent(agent_id)` 函数附近新增：

```python
def get_agent_by_name(name: str) -> dict[str, Any] | None:
    """按 Agent 名称查找（pipeline step 存的是 agentName 不是 ID）"""
    with engine.connect() as conn:
        row = conn.execute(
            agents_table.select().where(agents_table.c.name == name)
        ).mappings().first()
    if not row:
        return None
    return _row_to_agent(dict(row))
```

其中 `_row_to_agent()` 复用现有 `get_agent()` 中的行转换逻辑（解析 JSON 字段、解析 command_ids）。如果该逻辑当前内联在 `get_agent()` 中，先提取为 `_row_to_agent()` 辅助函数。

### 1.2 `backend/app/workflow_engine.py` — 传递 promptBlocks 给 Worker

修改 `_execute_worker()` (line 357)：

```python
from .storage import get_agent_by_name  # 新增 import

async def _execute_worker(req_id, project_id, step_id):
    # ...existing code...
    
    # 新增：从 DB 查找 Agent 记录，提取 promptBlocks
    agent_record = get_agent_by_name(step["agentName"])
    prompt_blocks = agent_record.get("promptBlocks") if agent_record else None

    result = await execute_worker_agent(
        agent_name=step["agentName"],
        agent_role=step.get("role", ""),
        step_name=step["name"],
        commands=step.get("commands", ""),
        req_title=req["title"],
        req_summary=req.get("summary", ""),
        project_context=project.get("context", {}),
        prev_artifact_summaries=prev_summaries,
        prompt_blocks=prompt_blocks,          # ← 新增参数
    )
```

### 1.3 `backend/app/llm.py` — 使用 promptBlocks 构建 persona

修改 `execute_worker_agent()` (line 863) 和 `stream_step_log()` (line 681)：

- 新增参数 `prompt_blocks: dict | None = None`
- persona 构建逻辑改为：

```python
def _build_persona(agent_name: str, agent_role: str, prompt_blocks: dict | None) -> str:
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
```

`_AGENT_PERSONAS` 保留作为兜底 fallback，不删除。

### 1.4 `backend/app/llm.py` — 移除输出字数硬限制

`_WORKER_SYSTEM` 模板 (line 840) 中的 `"content": "完整 Markdown 或代码内容（500-1200字）"` 改为 `"content": "完整 Markdown 或代码内容"`。具体长度由各 Agent 的 `outputSpec` 自行约束。

### 1.5 `backend/app/llm.py` — 命令感知的 max_tokens

在 `execute_worker_agent()` 中，替换固定的 `max_tokens=2000`：

```python
_HIGH_TOKEN_CMDS = {"CP", "EP", "CA", "CU"}      # PRD/架构/UX 需要更多空间
_MEDIUM_TOKEN_CMDS = {"BP", "MR", "DR", "TR", "CB", "VP", "QA"}

def _resolve_max_tokens(commands: str) -> int:
    codes = {c.strip() for c in (commands or "").replace("→", ",").split(",") if c.strip()}
    if codes & _HIGH_TOKEN_CMDS:
        return 4000
    if codes & _MEDIUM_TOKEN_CMDS:
        return 3000
    return 2000
```

---

## Phase 2: 新增 `reqLead` 角色 + Lena Agent 种子数据

### 2.1 `backend/app/models.py` — 扩展 AgentRole

```python
AgentRole = Literal[
    'analyst', 'pm', 'ux', 'architect', 'sm', 'dev', 'qa', 'quickdev', 'techwriter',
    'reqLead',  # ← 新增
]
```

### 2.2 `backend/app/database.py` — Lena 种子数据

在 `_seed_agents_if_empty()` 的 Paige 之后、自定义 Agent 之前插入：

```python
{"id": "agent-reqlead", "name": "Lena",
 "description": "商业研究 · 市场分析 · 行业深研 · PRD 全生命周期 · 全链路需求管理",
 "role": "reqLead", "source": "builtin", "status": "active", "version": "v1",
 "command_ids": json.dumps(["c1", "c3", "c2", "c4", "c20", "c31", "c5", "c15", "c6"]),
 #                           BP   MR   DR   TR   CB    DP    CP   VP    EP
 "prompt_blocks": json.dumps({
     "roleDefinition": (
         "你是 Lena，AI-DZHT 的需求总监 Agent。你务实、专业、全面，"
         "从商业洞察到产品规格一气呵成。你不是空想家——每一个结论都有数据或逻辑支撑，"
         "每一份 PRD 都经过严格的内部自检。你像一个资深的需求架构师，"
         "既能洞察市场全貌，又能精确到每一条验收标准。"
     ),
     "capabilityScope": (
         "负责需求全链路管理：头脑风暴、市场研究、行业深研、竞品分析、产品简报，"
         "到 PRD 创建、验证与修订。产出覆盖从模糊想法到可交付规格的完整转化。"
         "不包含 Epic/Story 拆解和实现就绪评审——那是产品经理的后续工作。"
     ),
     "behaviorConstraints": (
         "1. 研究阶段产出必须有信息来源标注或逻辑推导链；"
         "2. PRD 必须与研究阶段产出物交叉引用，不能凭空编造需求；"
         "3. 每个命令产出物都必须可被下游 Agent 直接消费；"
         "4. 避免空洞的管理语言，所有输出须具体可操作。"
     ),
     "outputSpec": (
         "使用 Markdown 格式，层级清晰。研究类产出物须包含数据表格和结论摘要。"
         "PRD 须包含执行摘要、用户故事、功能需求、非功能需求和验收标准。"
         "每份产出物开头须有 50 字以内的摘要。"
     ),
 }),
 "share_scope": "team", "is_protected": 1, "forked_from": None,
 "created_by": "system", "created_at": "2026-01-01T00:00:00Z",
 "updated_at": "2026-04-16T00:00:00Z"},
```

同时在 `init_db()` 中新增 `_ensure_reqlead_agent()` 迁移函数，确保已有数据库也能获得 Lena：

```python
def _ensure_reqlead_agent():
    """已有 DB 的增量迁移：如果 agent-reqlead 不存在则插入"""
    with engine.connect() as conn:
        exists = conn.execute(
            agents_table.select().where(agents_table.c.id == "agent-reqlead")
        ).first()
        if not exists:
            conn.execute(agents_table.insert().values({...Lena seed data...}))
            conn.commit()
```

### 2.3 `backend/app/context.py` — 新增 Lena 的 scope

```python
AGENT_SCOPE_MAP = {
    ...existing entries...,
    "Lena": ["all", "pm", "design"],   # ← 新增：看全局 + PM + 设计约束
}
```

### 2.4 `backend/app/llm.py` — 更新两处

1. `_AGENT_PERSONAS` 新增 Lena 条目（作为 fallback）：
   ```python
   "Lena": "你是 Lena，务实的需求总监，擅长从商业洞察到产品规格的全链路需求管理。",
   ```

2. `SYSTEM_PROMPT`（workflow suggest，line 485）的 `agentRoles 可选值` 加上 `reqLead`

---

## Phase 3: 前端类型 + UI 更新

### 3.1 `frontend/src/types/agent.ts` — 扩展 AgentRole

添加 `'reqLead'` 到 AgentRole 联合类型。

### 3.2 `frontend/src/components/ui/AgentAvatar.tsx` — 新增 roleConfig

```typescript
reqLead: { emoji: '📝', gradient: 'from-indigo-900 to-indigo-600' },
```

### 3.3 `frontend/src/components/requirements/WorkflowConfigModal.tsx` — 四处修改

**a) ROLE_META 新增：**
```typescript
reqLead: { personaName: 'Lena', personaTitle: '需求总监' },
```

**b) AGENT_COMMANDS 新增：**
```typescript
reqLead: [
  { code: 'BP', name: '头脑风暴' }, { code: 'MR', name: '市场研究' },
  { code: 'DR', name: '领域研究' }, { code: 'TR', name: '技术研究' },
  { code: 'CB', name: '产品简报' }, { code: 'DP', name: '文档项目' },
  { code: 'CP', name: '创建 PRD' }, { code: 'VP', name: '验证 PRD' },
  { code: 'EP', name: '编辑 PRD' },
],
```

**c) WorkflowTemplate['id'] 类型扩展** + 新增"需求驱动"模板：
```typescript
id: 'full' | 'quick' | 'bugfix' | 'requirements' | 'custom'
// ↑ 新增 'requirements'

// WORKFLOW_TEMPLATES 数组中 bugfix 之后、custom 之前插入：
{
  id: 'requirements',
  icon: '📝',
  label: '需求驱动',
  desc: '从研究到 PRD 一气呵成→UX→架构→开发→测试',
  steps: [
    { name: '需求研究与规划', agentRole: 'reqLead' },
    { name: 'UX 设计',       agentRole: 'ux' },
    { name: '架构设计',       agentRole: 'architect' },
    { name: '开发实现',       agentRole: 'dev' },
    { name: '自动化测试',     agentRole: 'qa' },
  ],
},
```

**d) custom 模板的 steps 数组** 添加 reqLead 节点：
```typescript
{ name: '需求总监', agentRole: 'reqLead' },
```

### 3.4 `frontend/src/components/requirements/CommanderChatPanel.tsx` — AGENT_ROLE_MAP 新增

```typescript
Lena: 'reqLead',
```

---

## Phase 4: 前端 Mock 数据更新

### 4.1 `frontend/src/mocks/data/agents.ts` — 添加 Lena 到 mockAgents

在 Paige 之后、自定义 Agent 之前添加 Lena 的完整 Agent 对象（role: 'reqLead', source: 'builtin', isProtected: true，commands 包含 9 个命令）。

### 4.2 `frontend/src/mocks/data/bmadAgentDefs.ts` — 添加 Lena 定义

```typescript
{
  id: 'reqLead',
  skillName: 'bmad-agent-reqlead',
  personaName: 'Lena',
  personaTitle: '需求总监',
  avatar: '📝',
  phase: 'analysis',
  commandCodes: ['BP', 'MR', 'DR', 'TR', 'CB', 'DP', 'CP', 'VP', 'EP'],
  description: '我是 Lena，你的需求总监。我从商业洞察到产品规格一气呵成...',
}
```

### 4.3 `frontend/src/mocks/handlers.ts` — 三处新增

- **ARTIFACTS** map 新增 `Lena` 条目（3 个产出物：商业研究报告、产品简报、PRD）
- **PLAN_DESC** map 新增 `Lena` 条目
- **LIVE_LOGS** map 新增 `Lena` 条目

---

## Phase 5: 同 Agent 连续步骤的全量产出物传递

> 解决需求驱动模板中 Lena 分步执行时的上下文传递问题

### 5.1 `backend/app/workflow_engine.py` — 优化 `_build_prev_summaries()`

当连续步骤使用**同一个 Agent** 时，传递完整产出物内容而非仅摘要：

```python
def _build_prev_summaries(req_id, pipeline, current_step_id):
    current_agent = None
    for s in pipeline:
        if s["id"] == current_step_id:
            current_agent = s.get("agentName")
            break
    
    lines = []
    for s in pipeline:
        if s["id"] == current_step_id:
            break
        if s.get("status") == "done":
            for a in get_artifacts(req_id, s["id"]):
                if s.get("agentName") == current_agent:
                    # 同 Agent 连续步骤：传全文（截断保护 3000 字符）
                    content = a.get("content", a["summary"])
                    if len(content) > 3000:
                        content = content[:3000] + "\n...(已截断)"
                    lines.append(f"[{s['name']}·{a['name']}]\n{content}")
                else:
                    # 不同 Agent：仍传摘要
                    lines.append(f"[{s['name']}·{a['name']}] {a['summary']}")
    return "\n\n".join(lines) if lines else "（无前序产出物）"
```

---

## Phase 6: 逐命令执行 + 三轮自审 + 知识沉淀

> 核心：将单次 LLM 调用拆分为逐命令执行，每个命令产出独立 artifact，最后统一审查并提炼知识。

### 6.0 完整执行流程设计

用户在 Commander 面板看到的效果：

```
┌─────────────────────────────────────────────────────────┐
│  Step: 需求研究与规划 (Lena, commands: BP→MR→CP)         │
│                                                         │
│  ▶ 逐命令执行                                            │
│    ⚡ [BP] 正在执行头脑风暴...                             │
│    ✅ [BP] 完成 → 产出：创意发散清单                       │
│    ⚡ [MR] 正在执行市场研究...                             │
│    ✅ [MR] 完成 → 产出：市场研究报告                       │
│    ⚡ [CP] 正在创建 PRD...                                │
│    ✅ [CP] 完成 → 产出：产品需求文档（草稿）                │
│                                                         │
│  ▶ 三轮审查（对每个 document/report 类产出物）              │
│    🔍 正在对「市场研究报告」进行对抗性审查...                │
│    📋 发现 2 个逻辑缺口，正在修订...                       │
│    🎯 正在对「市场研究报告」进行边界用例审查...              │
│    ✅ 边界审查通过                                        │
│    📐 正在进行结构完整性审查...                            │
│    ✏️ 正在修订...                                        │
│    🔍 正在对「产品需求文档」进行对抗性审查...                │
│    ...                                                  │
│                                                         │
│  ▶ 知识沉淀                                              │
│    🧠 正在从产出物中提炼知识...                            │
│    📖 提取了 3 条业务规则、5 个领域术语、2 条市场洞察        │
│    💾 已提交知识沉淀建议（待确认）                          │
│                                                         │
│  ✓ 定稿完成（3 份产出物，经 3 轮审查，提炼 10 条知识）      │
└─────────────────────────────────────────────────────────┘
```

### 6.1 `backend/app/llm.py` — 命令名称映射

新增命令 code → 中文名的映射（从 database.py seed 数据提取，硬编码在 llm.py）：

```python
_CMD_NAMES: dict[str, str] = {
    "BP": "头脑风暴", "MR": "市场研究", "DR": "领域研究",
    "TR": "技术研究", "CB": "产品简报", "DP": "项目文档化",
    "CP": "创建 PRD", "VP": "验证 PRD", "EP": "编辑 PRD",
    "CU": "创建 UX 设计", "CA": "创建架构", "GPC": "生成项目上下文",
    "DS": "Story 开发", "CS": "创建 Story", "SP": "Sprint 规划",
    "QA": "自动化测试", "CR": "代码审查", "QQ": "快速开发",
    # ... 其余命令
}
```

### 6.2 `backend/app/llm.py` — 单命令执行函数

新增 `_execute_single_command()`，每个命令独立调用 LLM，产出 1 个 artifact：

```python
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
    """单命令执行，返回 1 个 artifact dict"""
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
```

### 6.3 `backend/app/llm.py` — 三个审查 prompt 模板

```python
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

以 JSON 输出：{{"structuralIssues": [{{"type": "missing|redundant|unclear|reorder", "location": "位置", "issue": "问题", "suggestion": "建议"}}], "completenessScore": 1-10, "summary": "总评"}}
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
```

### 6.4 `backend/app/llm.py` — 知识沉淀 prompt 模板

```python
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
      "category": "类别（如：PRD 检查清单、研究检查清单）"
    }}
  ]
}}
只输出有价值的条目，宁少勿滥。只输出 JSON。"""
```

### 6.5 `backend/app/llm.py` — 核心函数 `execute_worker_with_review()`

整合逐命令执行 + 审查 + 知识沉淀的完整流程：

```python
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
    on_progress: Callable[[str, str], Awaitable[None]] | None = None,
    review_rounds: int = 3,
) -> dict:
    """逐命令执行 → 三轮审查 → 知识沉淀"""
    
    async def emit(tag: str, msg: str):
        if on_progress:
            await on_progress(tag, msg)

    persona = _build_persona(agent_name, agent_role, prompt_blocks)
    context_block = assemble_context(project_context, agent_name)

    # ━━ 阶段 1: 逐命令执行 ━━
    cmd_codes = [c.strip() for c in (commands or "").replace("→", ",").split(",") if c.strip()]
    artifacts = []
    intra_step_outputs = prev_artifact_summaries or ""  # 步骤内累积的上下文
    
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
            artifacts.append(art)
            art_name = art.get("name", cmd_name)
            await emit(f"done:{cmd_code}", f"完成 → 产出：{art_name}")
            # 将本命令产出物全文追加到步骤内上下文，供后续命令使用
            intra_step_outputs += f"\n\n[{cmd_name}·{art_name}]\n{art['content']}"
    
    if not artifacts:
        return {"artifacts": [], "suggestedContextUpdates": []}

    # ━━ 阶段 2: 三轮审查 ━━
    REVIEWABLE_TYPES = {"document", "report", "plan", "design"}
    reviews = [
        ("adversarial", "对抗性审查", _REVIEW_ADVERSARIAL),
        ("edge-case",   "边界用例审查", _REVIEW_EDGE_CASE),
        ("structural",  "结构完整性审查", _REVIEW_STRUCTURAL),
    ]
    
    for i, art in enumerate(artifacts):
        if art.get("type") not in REVIEWABLE_TYPES:
            continue
        
        current_content = art.get("content", "")
        art_name = art.get("name", "产出物")
        
        for review_id, review_name, review_template in reviews[:review_rounds]:
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
            
            has_issues = review_data.get("issues") or review_data.get("edgeCases") or review_data.get("structuralIssues")
            if not has_issues:
                await emit("pass", f"「{art_name}」{review_name}通过")
                continue
            
            await emit("revise", f"正在根据{review_name}反馈修订「{art_name}」...")
            revised = await _chat(
                messages=[{"role": "user", "content": _REVISE_SYSTEM.format(
                    persona=persona, original=current_content, review_feedback=review_raw,
                )}],
                max_tokens=_resolve_max_tokens(commands),
            )
            current_content = revised
        
        artifacts[i]["content"] = current_content
        artifacts[i]["summary"] = f"[经 {review_rounds} 轮审查] " + art.get("summary", "")
        await emit("output", f"✓「{art_name}」定稿完成（经 {review_rounds} 轮审查）")

    # ━━ 阶段 3: 知识沉淀 ━━
    await emit("knowledge", "正在从产出物中提炼可复用知识...")
    
    all_content = "\n\n---\n\n".join(
        f"## {a.get('name','')}\n{a.get('content','')}" for a in artifacts
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
    
    # 将知识项转为 suggestedContextUpdates 格式
    context_updates = _knowledge_to_suggestions(knowledge_items)
    
    if knowledge_items:
        type_counts = {}
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
```

### 6.6 `backend/app/llm.py` — 知识项到 suggestedContextUpdates 的转换

```python
def _knowledge_to_suggestions(items: list[dict]) -> list[dict]:
    """将知识提炼结果转为现有的 suggestedContextUpdates 格式"""
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
            # 领域术语 → 写入 rule，带 [术语] 标记便于识别
            suggestions.append({
                "type": "rule",
                "scope": "all",
                "text": f"[领域术语] {item.get('term', '')}: {item.get('definition', '')}",
                "source": "agent",
            })
        
        elif item_type == "market_insight":
            # 市场洞察 → 写入 lesson（有时效性，适合 lesson 的"教训"语义）
            suggestions.append({
                "type": "lesson",
                "scope": item.get("scope", "pm"),
                "title": item.get("title", "市场洞察"),
                "background": item.get("evidence", ""),
                "correctApproach": item.get("insight", ""),
            })
        
        elif item_type == "checklist_item":
            # 检查清单 → 写入 rule，带 [检查清单] 标记
            suggestions.append({
                "type": "rule",
                "scope": item.get("scope", "all"),
                "text": f"[检查清单:{item.get('category','')}] {item.get('text', '')}",
                "source": "agent",
            })
    
    return suggestions
```

**设计决策**：知识沉淀复用现有的 `rule` + `lesson` 类型，通过 `[领域术语]`、`[检查清单:xxx]` 前缀标记区分。这样**不需要修改 ProjectContext 模型**，不需要改数据库 schema，不需要新的前端确认流程——全部走现有的 pending suggestions → 人工确认 → 写入 context 通路。

### 6.7 `backend/app/workflow_engine.py` — `_execute_worker()` 接入完整流程

```python
async def _execute_worker(req_id: str, project_id: str, step_id: str) -> dict:
    req = get_requirement(req_id)
    project = get_project(project_id)
    step = next((s for s in req["pipeline"] if s["id"] == step_id), None)
    if not step:
        return {"error": f"step {step_id} not found"}

    prev_summaries = _build_prev_summaries(req_id, req["pipeline"], step_id)
    _update_step(req_id, step_id, "running")

    agent_record = get_agent_by_name(step["agentName"])
    prompt_blocks = agent_record.get("promptBlocks") if agent_record else None

    # 加载访谈历史（跨暂停累积）
    interview_history = get_interview_history(req_id, step_id)

    if not interview_history:
        save_commander_event(
            req_id, "agent_working", "agent", step["agentName"],
            f"{step['agentName']} 开始工作...",
            {"step_id": step_id, "step_name": step["name"]},
        )

    # 进度回调 → Commander 面板实时日志
    async def on_progress(tag: str, message: str):
        save_commander_event(
            req_id, "agent_working", "agent", step["agentName"],
            f"[{tag}] {message}",
            {"step_id": step_id, "phase": tag},
        )

    # 获取 Git 工作空间（若项目配置了仓库）
    ws = _get_workspace(project_id, project)

    result = await execute_worker_with_review(
        agent_name=step["agentName"],
        agent_role=step.get("role", ""),
        step_name=step["name"],
        commands=step.get("commands", ""),
        req_title=req["title"],
        req_summary=req.get("summary", ""),
        project_context=project.get("context", {}),
        prev_artifact_summaries=prev_summaries,
        prompt_blocks=prompt_blocks,
        on_progress=on_progress,
        interview_history=interview_history,
        code_context=ws.build_code_context() if ws else "",
    )
    
    # need_input → 返回给 _dispatch 做代码级拦截
    if result.get("status") == "need_input":
        return result

    # 持久化产出物（DB + Git 文件）
    artifacts = result.get("artifacts", [])
    for art in artifacts:
        save_artifact(req_id, step_id, ...)
        if ws:
            file_path = ws.write_artifact(req["code"], step.get("agentRole", ""), art)
            art["filePath"] = file_path
    if ws and artifacts:
        ws.commit(f"[{step['agentName']}] {step['name']} 完成")

    # Path B：Agent 建议的上下文更新
    for suggestion in result.get("suggestedContextUpdates", []):
        if suggestion:
            save_pending_suggestion(project_id, req_id, step_id,
                                    step["agentName"], suggestion)
    # ...后续 _update_step + agent_done 事件...
```

### 6.8 `backend/app/llm.py` — 命令级审查策略（控制 token 消耗）

不同命令的产出物质量要求不同，审查轮次应该差异化：

```python
_CMD_REVIEW_POLICY: dict[str, int] = {
    "CP": 3, "EP": 3,              # PRD 类：完整三轮审查
    "MR": 2, "DR": 2, "CB": 2,     # 研究/报告类：两轮
    "BP": 1, "TR": 1,              # 发散/探索类：一轮结构审查
    "VP": 0,                        # 验证命令本身就是审查，跳过
}
```

在 `_execute_single_command()` 返回的 artifact 中追踪命令来源：`art["_cmd_code"] = cmd_code`

审查阶段按每个产出物对应的命令策略决定轮次：

```python
for i, art in enumerate(artifacts):
    if art.get("type") not in REVIEWABLE_TYPES:
        continue
    cmd = art.get("_cmd_code", "")
    art_review_rounds = _CMD_REVIEW_POLICY.get(cmd, 2)  # 默认 2 轮
    if art_review_rounds == 0:
        continue
    # ... 审查循环使用 art_review_rounds ...
```

### 6.9 `backend/app/llm.py` — 知识沉淀限制角色

只有需求/分析/产品类角色执行知识沉淀，开发/测试 Agent 跳过：

```python
_KNOWLEDGE_ENABLED_ROLES = {"reqLead", "analyst", "pm"}

# 在 execute_worker_with_review() 的知识沉淀阶段
if agent_role in _KNOWLEDGE_ENABLED_ROLES:
    await emit("knowledge", "正在提炼知识...")
    # ... 知识沉淀逻辑 ...
else:
    context_updates = []
```

---

## Phase 7: 前端执行日志渲染

> 让 Commander 面板正确展示逐命令执行 + 审查 + 知识沉淀的全过程日志。

### 7.1 `CommanderChatPanel.tsx` — 解析 tag 前缀 + 图标映射

```typescript
function parseProgressTag(content: string): { tag: string; message: string } {
  const match = content.match(/^\[([^\]]+)\]\s*(.*)/)
  if (match) return { tag: match[1], message: match[2] }
  return { tag: '', message: content }
}

const PROGRESS_ICONS: Record<string, string> = {
  // 命令执行
  'exec':    '⚡', 'done':    '✅',
  // exec:BP, done:BP 等动态 tag 也匹配前缀
  // 审查
  'review:adversarial': '🔍', 'review:edge-case': '🎯', 'review:structural': '📐',
  'findings': '📋', 'revise': '✏️', 'pass': '✅',
  // 知识沉淀
  'knowledge': '🧠', 'knowledge:done': '📖',
  // 最终
  'output': '✓', 'draft': '📝',
}

function getIcon(tag: string): string {
  if (PROGRESS_ICONS[tag]) return PROGRESS_ICONS[tag]
  if (tag.startsWith('exec:')) return '⚡'
  if (tag.startsWith('done:')) return '✅'
  if (tag.startsWith('review:')) return '🔍'
  return '▸'
}
```

### 7.2 `CommanderChatPanel.tsx` — agent_working 事件分组堆叠

同一 agent + 同一 step_id 的连续 `agent_working` 事件合并为一个气泡，内部堆叠显示为日志列表：

```typescript
// 预处理：分组
type GroupedEvent =
  | { type: 'working_group'; events: CommanderEvent[] }
  | { type: 'single'; event: CommanderEvent }

function groupEvents(events: CommanderEvent[]): GroupedEvent[] {
  const result: GroupedEvent[] = []
  let currentGroup: CommanderEvent[] | null = null
  
  for (const evt of events) {
    if (evt.eventType === 'agent_working') {
      const stepId = (evt.metadata as any)?.step_id
      if (currentGroup && (currentGroup[0].metadata as any)?.step_id === stepId) {
        currentGroup.push(evt)
      } else {
        if (currentGroup) result.push({ type: 'working_group', events: currentGroup })
        currentGroup = [evt]
      }
    } else {
      if (currentGroup) {
        result.push({ type: 'working_group', events: currentGroup })
        currentGroup = null
      }
      result.push({ type: 'single', event: evt })
    }
  }
  if (currentGroup) result.push({ type: 'working_group', events: currentGroup })
  return result
}
```

渲染效果：
- Agent 头像只显示一次
- 每条日志一行：`{icon} {message}`
- 最后一条若需求 running → 显示 spinner
- 整个组在一个气泡内，形成完整的执行日志

---

## Phase 8: 对话式访谈（简化设计）

> **设计原则**：交互的内核就是聊天。Lena 在 Commander 面板直接发消息，用户在同一面板回复自由文本——和 Claude 对话完全一样的体验。不需要新的 Commander Tool，不依赖 LLM 中转。未来接入钉钉只需将事件流对接消息 API。

### 8.0 简化后的交互流程

```
Commander 调用 invoke_agent(step_id)
  → _execute_worker() 运行访谈评估（Lena LLM 判断信息是否充足）
    → ready=false → 返回 {"status": "need_input", "message": "Lena 的自然语言提问"}
  → _dispatch() invoke_agent handler 代码级拦截（不需要 LLM 判断）
    → 设置步骤 pending_input → 保存 user_input_request 事件 → 暂停流水线
  → 前端 Commander 面板：显示 Lena 的消息 + 激活底部聊天输入框
  → 用户输入自由文本 → POST /user-input/{step_id}
    → 保存 user_input_response 事件 → run_commander 恢复
  → Commander 再次调用 invoke_agent → _execute_worker 加载历史重新评估
  → ready=true → 进入命令执行 | ready=false → 再次对话（最多 3 轮）
```

### 8.1 `backend/app/workflow_engine.py` — `invoke_agent` handler 代码级拦截

不新增 Commander Tool。直接在 `_dispatch()` 的 `invoke_agent` 分支中拦截：

```python
if name == "invoke_agent":
    # ...existing event logging...
    result = await _execute_worker(req_id, project_id, args["step_id"])
    
    # ★ 代码级拦截：Worker 需要用户输入，直接暂停
    if result.get("status") == "need_input":
        req = get_requirement(req_id)
        step = next((s for s in req["pipeline"] if s["id"] == args["step_id"]), None)
        agent_name = step["agentName"] if step else "Agent"
        _update_step(req_id, args["step_id"], "pending_input")
        
        # 保存访谈问题到事件流
        save_interview_turn(req_id, args["step_id"], "question",
                            {"agent": agent_name, "text": result.get("message", "")})
        save_commander_event(
            req_id, "user_input_request", "agent", agent_name,
            result.get("message", "需要补充信息"),
            {"step_id": args["step_id"], "type": "interview"},
        )
        
        # 暂停流水线，tool response 引导 Commander 恢复后重试
        return {
            "status": "awaiting_user_input",
            "step_id": args["step_id"],
            "message": "用户补充了信息。请再次调用 invoke_agent(step_id='{}') 继续执行该步骤。".format(args["step_id"]),
        }, True  # ← True = 直接暂停，等同于 requiresApproval 的处理方式
    
    # ...existing requiresApproval check...
```

**关键决策**：暂停时保存的 tool response 明确告诉 Commander "再次调用 invoke_agent"。恢复后 Commander 看到这条消息，自然会重新调用同一步骤——和审批恢复后的行为一致。

### 8.2 `backend/app/llm.py` — 访谈 prompt（自由文本，非结构化问题）

```python
_INTERVIEW_SYSTEM = """{persona}

你正在为需求「{req_title}」做信息采集，后续要执行命令 [{commands}]。

已有信息：
- 需求描述：{req_summary}
{context_block}
{prev_outputs}
{interview_history_block}

请判断现有信息是否足够开始工作。以 JSON 输出：
{{
  "ready": true/false,
  "message": "若 ready=false，写一段自然、友好的对话（像和同事聊天）。先简要说明你了解到了什么，再自然地追问需要补充的信息。不要用编号列表，用人话。若 ready=true，写一句'信息充分，开始执行'即可。"
}}
只输出 JSON。"""
```

### 8.3 `backend/app/llm.py` — `execute_worker_with_review()` 访谈阶段

在「阶段 1: 逐命令执行」之前插入「阶段 0: 对话式访谈」：

```python
async def execute_worker_with_review(
    ...,
    interview_history: list[dict] | None = None,
    max_interview_rounds: int = 3,
    code_context: str = "",
) -> dict:
    ...
    
    # ━━ 阶段 0: 对话式访谈 ━━
    if cmd_codes:
        history = list(interview_history or [])
        history_block = _format_interview_history(history)
        
        raw = await _chat(
            messages=[{"role": "user", "content": _INTERVIEW_SYSTEM.format(
                persona=persona, req_title=req_title, req_summary=req_summary or "（无）",
                commands=", ".join(cmd_codes),
                context_block=context_block, prev_outputs=prev_artifact_summaries or "（无）",
                interview_history_block=history_block,
            )}],
            max_tokens=800, json_mode=True,
        )
        interview_data = json.loads(raw)
        
        if not interview_data.get("ready", True):
            if (len([h for h in history if h.get("type") == "question"]) < max_interview_rounds):
                await emit("interview", "需要补充信息...")
                return {
                    "status": "need_input",
                    "message": interview_data.get("message", "能否补充一些信息？"),
                }
        
        # ready → 将访谈收集到的信息追加到执行上下文
        if history:
            interview_context = _format_interview_as_context(history)
            await emit("interview:done", "信息采集完成，开始执行...")
            intra_step_outputs += f"\n\n[用户补充信息]\n{interview_context}"
    
    # 追加代码仓库上下文
    if code_context:
        context_block += f"\n\n{code_context}"
    
    # ━━ 阶段 1: 逐命令执行 ━━ (existing code)
    ...
```

### 8.4 `backend/app/llm.py` — 访谈历史格式化

```python
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
    """将对话提炼为上下文摘要"""
    pairs = []
    for item in history:
        if item.get("type") == "answer" and item.get("text"):
            pairs.append(item["text"])
    return "\n".join(pairs) if pairs else ""
```

### 8.5 `backend/app/storage.py` — 访谈存储（复用 events 表）

```python
def save_interview_turn(req_id: str, step_id: str, turn_type: str, data: dict) -> None:
    """保存访谈轮次。turn_type: 'question' | 'answer'"""
    save_commander_event(
        req_id,
        event_type=f"interview_{turn_type}",
        role="agent" if turn_type == "question" else "user",
        agent_name=data.get("agent", ""),
        content=data.get("text", ""),
        metadata={"step_id": step_id, "turn_type": turn_type},
    )


def get_interview_history(req_id: str, step_id: str) -> list[dict]:
    """获取指定步骤的访谈历史"""
    all_events = get_commander_events(req_id, after_seq=0)
    return [
        {"type": evt["metadata"].get("turn_type"), "text": evt["content"]}
        for evt in all_events
        if evt.get("metadata", {}).get("step_id") == step_id
        and evt["eventType"] in ("interview_question", "interview_answer")
    ]
```

### 8.6 `backend/app/routers/requirements.py` — 用户回复端点

```python
class UserInputBody(BaseModel):
    text: str           # 自由文本
    skip: bool = False  # True = 跳过访谈直接执行


@router.post("/{project_id}/requirements/{req_id}/user-input/{step_id}",
             response_model=RequirementOut)
def submit_user_input(
    project_id: str, req_id: str, step_id: str,
    body: UserInputBody, background_tasks: BackgroundTasks,
) -> dict:
    _ensure_project(project_id)
    req = get_requirement(req_id)
    if not req or req["projectId"] != project_id:
        raise HTTPException(404, "Requirement not found")
    step = next((s for s in req["pipeline"] if s["id"] == step_id), None)
    if not step or step["status"] != "pending_input":
        raise HTTPException(400, "Step is not pending user input")

    if body.skip:
        # 跳过访谈：标记 ready，恢复执行
        save_commander_event(req_id, "user_input_response", "user", "",
            "（用户选择跳过，直接执行）", {"step_id": step_id, "action": "skip"})
    else:
        save_interview_turn(req_id, step_id, "answer", {"text": body.text})
        save_commander_event(req_id, "user_input_response", "user", "",
            body.text, {"step_id": step_id, "action": "answer"})

    background_tasks.add_task(run_commander, req_id, project_id,
        {"approved": True, "step_id": step_id, "skip_interview": body.skip})
    return req
```

### 8.7 前端：Commander 面板聊天输入

在 `CommanderChatPanel.tsx` 底部增加文本输入区域：

```typescript
const [inputText, setInputText] = useState('')
const submitInput = useSubmitUserInput()
const pendingInputStep = requirement?.pipeline.find(s => s.status === 'pending_input')

// 底部输入区域（pending_input 时激活）
<div className="border-t p-3">
  <div className="flex gap-2">
    <input
      className="flex-1 rounded border p-2 text-sm"
      placeholder={pendingInputStep ? "回复 Agent..." : "等待 Agent 执行中..."}
      disabled={!pendingInputStep}
      value={inputText}
      onChange={(e) => setInputText(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
    />
    <button disabled={!pendingInputStep || !inputText.trim()} onClick={handleSubmit}>
      发送
    </button>
  </div>
  {pendingInputStep && (
    <button className="mt-1 text-xs text-muted-foreground hover:underline"
      onClick={() => submitInput.mutate({...stepInfo, text: '', skip: true})}>
      跳过，直接开始执行
    </button>
  )}
</div>
```

### 8.8 `frontend/src/hooks/useCommanderEvents.ts` — Hook + 轮询

新增 `useSubmitUserInput()` hook：

```typescript
export function useSubmitUserInput() {
  const qc = useQueryClient()
  return useMutation<Requirement, Error,
    { projectId: string; reqId: string; stepId: string; text: string; skip?: boolean }>({
    mutationFn: async ({ projectId, reqId, stepId, text, skip }) => {
      const res = await fetch(
        `${BASE}/${projectId}/requirements/${reqId}/user-input/${stepId}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, skip: skip ?? false }) },
      )
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      return res.json()
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['requirements', vars.projectId] })
    },
  })
}
```

轮询增加 `pending_input` 状态：

```typescript
const hasPending = requirement.pipeline.some(
  (step) => step.status === 'pending_approval'
    || step.status === 'pending_advisory_approval'
    || step.status === 'pending_input',  // ← 新增
)
```

### 8.9 `frontend/src/types/project.ts` — 类型扩展

```typescript
// PipelineStepStatus 新增
| 'pending_input'

// CommanderEventType 新增
| 'user_input_request'
| 'user_input_response'
```

---

## Phase 9: Git 工作空间管理

> 每个需求在团队仓库上创建独立分支，Agent 产出物同时存 DB + 写入 Git 文件。需求完成后推送分支，由 pipeline 审批控制 MR。

### 9.1 `backend/app/workspace.py` — 新模块

使用 `subprocess` 调用 git 命令（无需额外依赖），核心类 `WorkspaceManager`：

```python
import subprocess, os
from pathlib import Path

WORKSPACE_ROOT = Path(os.environ.get("WORKSPACE_ROOT", "./workspaces"))

# 产出物默认文件路径约定：(agent_role, artifact_type) → path template
_FILE_PATH_RULES = {
    ("reqLead", "document"): "docs/requirements/{req_code}/{name}.md",
    ("reqLead", "report"):   "docs/research/{req_code}/{name}.md",
    ("ux", "design"):        "docs/design/{req_code}/{name}.md",
    ("architect", "document"): "docs/architecture/{req_code}/{name}.md",
    ("dev", "code"):          "src/{name}",
    ("qa", "test"):           "tests/{name}",
}
_DEFAULT_PATH = "docs/{req_code}/{name}.md"


class WorkspaceManager:
    def __init__(self, project_id: str, repo_url: str, git_config: dict | None = None):
        self.project_id = project_id
        self.repo_url = repo_url
        self.repo_dir = WORKSPACE_ROOT / project_id / "repo"
        self.default_branch = (git_config or {}).get("defaultBranch", "main")
        self.branch_prefix = (git_config or {}).get("branchPrefix", "req/")

    def ensure_repo(self) -> bool:
        """克隆或 pull 仓库"""
        if not self.repo_url:
            return False
        if (self.repo_dir / ".git").exists():
            self._git("fetch", "origin")
            return True
        self.repo_dir.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", self.repo_url, str(self.repo_dir)], check=True)
        return True

    def create_branch(self, req_code: str) -> str:
        """从默认分支创建需求分支"""
        branch = f"{self.branch_prefix}{req_code}"
        self._git("checkout", self.default_branch)
        self._git("pull", "origin", self.default_branch)
        try:
            self._git("checkout", branch)          # 分支已存在（恢复执行）
        except subprocess.CalledProcessError:
            self._git("checkout", "-b", branch)     # 新建分支
        return branch

    def write_artifact(self, req_code: str, agent_role: str, artifact: dict) -> str:
        """写入产出物文件，返回相对路径"""
        path = self._resolve_path(req_code, agent_role, artifact)
        full_path = self.repo_dir / path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(artifact.get("content", ""), encoding="utf-8")
        self._git("add", path)
        return path

    def commit(self, message: str) -> str:
        """提交当前变更，返回 commit hash"""
        try:
            self._git("commit", "-m", message)
            return self._git("rev-parse", "HEAD").strip()
        except subprocess.CalledProcessError:
            return ""  # nothing to commit

    def push(self, branch: str) -> None:
        self._git("push", "-u", "origin", branch)

    def get_tree(self, max_depth: int = 3) -> str:
        """获取文件树（排除 .git、node_modules 等）"""
        ignore = {".git", "node_modules", "__pycache__", ".venv", "dist", "build"}
        lines = []
        def walk(p: Path, depth: int, prefix: str):
            if depth > max_depth:
                return
            try:
                entries = sorted(p.iterdir(), key=lambda x: (x.is_file(), x.name))
            except PermissionError:
                return
            for entry in entries:
                if entry.name in ignore:
                    continue
                lines.append(f"{prefix}{entry.name}{'/' if entry.is_dir() else ''}")
                if entry.is_dir():
                    walk(entry, depth + 1, prefix + "  ")
        walk(self.repo_dir, 0, "")
        return "\n".join(lines[:200])  # 限制行数

    def read_file(self, path: str, max_lines: int = 200) -> str:
        """读取仓库中的文件内容"""
        full = self.repo_dir / path
        if not full.exists() or not full.is_file():
            return ""
        lines = full.read_text(encoding="utf-8", errors="ignore").splitlines()
        return "\n".join(lines[:max_lines])

    def build_code_context(self, max_chars: int = 12000) -> str:
        """构建代码仓库上下文，供 Agent prompt 使用"""
        parts = []
        # 1. 文件结构
        tree = self.get_tree(max_depth=3)
        if tree:
            parts.append(f"[REPO STRUCTURE]\n{tree}")
        # 2. 关键文件
        for f in ["README.md", "package.json", "pyproject.toml",
                   "docker-compose.yml", ".env.example"]:
            content = self.read_file(f, max_lines=60)
            if content:
                parts.append(f"[FILE: {f}]\n{content}")
        result = "\n\n".join(parts)
        return result[:max_chars] if len(result) > max_chars else result

    def _resolve_path(self, req_code: str, agent_role: str, artifact: dict) -> str:
        # 优先使用 Agent 输出中指定的路径
        if artifact.get("filePath"):
            return artifact["filePath"]
        key = (agent_role, artifact.get("type", "document"))
        template = _FILE_PATH_RULES.get(key, _DEFAULT_PATH)
        name = artifact.get("name", "untitled").replace(" ", "-").replace("/", "-")
        return template.format(req_code=req_code, name=name)

    def _git(self, *args) -> str:
        r = subprocess.run(["git", *args], cwd=self.repo_dir,
                           capture_output=True, text=True, check=True)
        return r.stdout
```

### 9.2 `backend/app/workflow_engine.py` — 集成 Git 工作空间

**辅助函数**：

```python
from .workspace import WorkspaceManager

def _get_workspace(project_id: str, project: dict) -> WorkspaceManager | None:
    """获取项目的 Git 工作空间（若配置了仓库）"""
    settings = project.get("settings", {})
    repo_url = settings.get("repository")
    if not repo_url:
        return None
    git_config = settings.get("gitConfig", {})
    ws = WorkspaceManager(project_id, repo_url, git_config)
    return ws if ws.ensure_repo() else None
```

**需求启动时创建分支**——在 `_commander_loop()` 全新启动分支中：

```python
if not saved:
    # 新增：创建需求分支
    ws = _get_workspace(project_id, project)
    if ws:
        branch = ws.create_branch(req["code"])
        save_commander_event(req_id, "system_info", "system", "Commander",
            f"已创建工作分支 {branch}", {"branch": branch})
    
    messages = [
        {"role": "system", "content": _build_commander_system(req, project)},
        {"role": "user", "content": "请开始执行流水线。"},
    ]
    ...
```

**流水线完成时推送**——在 `_mark_pipeline_done()` 末尾：

```python
def _mark_pipeline_done(req_id: str) -> None:
    req = get_requirement(req_id)
    # ...existing: mark all steps done, save...
    
    # 新增：推送分支
    project = get_project(req["projectId"])
    ws = _get_workspace(req["projectId"], project)
    if ws:
        branch = f"{ws.branch_prefix}{req['code']}"
        try:
            ws.push(branch)
            save_commander_event(req_id, "system_info", "system", "Commander",
                f"已推送分支 {branch} 到远程仓库", {"branch": branch})
        except Exception as e:
            save_commander_event(req_id, "system_info", "system", "Commander",
                f"推送分支失败：{e}", {"error": str(e)})
```

### 9.3 `backend/app/models.py` — ProjectSettings 扩展

```python
class GitConfig(BaseModel):
    defaultBranch: str = "main"
    branchPrefix: str = "req/"

class ProjectSettings(BaseModel):
    repository: Optional[str] = None
    gitConfig: GitConfig = GitConfig()    # ← 新增
    environments: list[EnvLink] = []
    context: ProjectContext = ProjectContext()
```

### 9.4 `backend/app/llm.py` — 产出物输出格式扩展

`_SINGLE_CMD_SYSTEM` 的 artifact JSON spec 新增可选 `filePath`：

```python
# artifact schema
{
  "name": "产出物名称",
  "type": "document|report|plan|design|code|test",
  "summary": "1-2句摘要",
  "content": "完整内容",
  "filePath": "（可选）建议的文件路径，相对于仓库根目录"
}
```

### 9.5 前端：项目设置增加 Git 配置

在 `ProjectSettingsModal.tsx` 的「环境配置」tab 中，代码仓库输入框下方增加：

```typescript
<Field label="默认分支">
  <input value={gitConfig.defaultBranch} onChange={...} placeholder="main" />
</Field>
<Field label="需求分支前缀">
  <input value={gitConfig.branchPrefix} onChange={...} placeholder="req/" />
</Field>
```

---

## Phase 10: 代码上下文注入

> 让 Agent 能"看到"代码仓库的文件结构和关键文件，而不仅仅依赖手工填写的 ProjectContext。

### 10.1 集成到 Agent 执行

在 `execute_worker_with_review()` 中，接收并使用 `code_context` 参数：

```python
async def execute_worker_with_review(
    ...,
    code_context: str = "",    # ← 新增：由 _execute_worker 从 workspace 获取
) -> dict:
    ...
    context_block = assemble_context(project_context, agent_name)
    if code_context:
        context_block += f"\n\n[CODE REPOSITORY]\n{code_context}"
    ...
```

调用方 `_execute_worker()` 已在 Phase 6.7 中传递：

```python
code_context=ws.build_code_context() if ws else "",
```

### 10.2 `_SINGLE_CMD_SYSTEM` 更新

在单命令执行 prompt 中加入代码仓库上下文占位符：

```python
_SINGLE_CMD_SYSTEM = """{persona}

你正在执行需求「{req_title}」中的命令「{cmd_code} — {cmd_name}」。

{context_block}

前序产出物（可参考）：
{prev_outputs}

若产出物需要存为文件，请在 filePath 中指定相对于仓库根目录的路径。
...
"""
```

`{context_block}` 已经包含了 `[CODE REPOSITORY]` 段（如果项目配置了仓库）。

### 10.3 上下文读取的作用域控制

不同角色的 Agent 需要不同深度的代码上下文：

```python
# workspace.py
def build_code_context(self, agent_role: str = "", max_chars: int = 12000) -> str:
    parts = []
    # 所有角色都看文件树
    parts.append(f"[REPO STRUCTURE]\n{self.get_tree(max_depth=3)}")
    
    # 通用关键文件
    for f in ["README.md", "package.json", "pyproject.toml"]:
        content = self.read_file(f, max_lines=60)
        if content:
            parts.append(f"[FILE: {f}]\n{content}")
    
    # 角色特定文件
    if agent_role in ("dev", "qa", "architect"):
        for f in ["docker-compose.yml", ".env.example", "tsconfig.json",
                   "src/index.ts", "src/main.py"]:
            content = self.read_file(f, max_lines=100)
            if content:
                parts.append(f"[FILE: {f}]\n{content}")
    
    # 已有需求文档（本分支上的 docs/ 目录）
    if agent_role in ("reqLead", "pm", "ux"):
        docs_dir = self.repo_dir / "docs"
        if docs_dir.exists():
            for md in sorted(docs_dir.rglob("*.md"))[:5]:
                rel = md.relative_to(self.repo_dir)
                content = self.read_file(str(rel), max_lines=50)
                if content:
                    parts.append(f"[DOC: {rel}]\n{content}")
    
    result = "\n\n".join(parts)
    return result[:max_chars]
```

---

## 改动文件清单

| 文件 | Phase | 改动类型 |
|------|-------|----------|
| `backend/app/storage.py` | 1, 8 | 新增 `get_agent_by_name()` + `save_interview_turn()` + `get_interview_history()` |
| `backend/app/workspace.py` | 9 | **新文件** — `WorkspaceManager` 类：Git 克隆/分支/写文件/提交/推送 + `build_code_context()` |
| `backend/app/workflow_engine.py` | 1, 5, 6, 8, 9 | promptBlocks + 产出物传递 + `execute_worker_with_review` 接入 + 代码级 `need_input` 拦截 + Git 分支创建/推送 + `_get_workspace()` |
| `backend/app/llm.py` | 1, 2, 6, 8, 10 | promptBlocks 生效 + max_tokens + 逐命令执行 + 审查模板(含策略) + 知识沉淀(限角色) + `_INTERVIEW_SYSTEM` prompt + 访谈历史格式化 + `code_context` 参数 + artifact `filePath` |
| `backend/app/models.py` | 2, 9 | 新增 `reqLead` 角色 + `GitConfig` + `ProjectSettings.gitConfig` |
| `backend/app/database.py` | 2 | Lena 种子数据 + 增量迁移 |
| `backend/app/context.py` | 2 | Lena scope 映射 |
| `backend/app/routers/requirements.py` | 8 | 新增 `POST /{req_id}/user-input/{step_id}` 端点（自由文本 + skip） |
| `frontend/src/types/agent.ts` | 3 | 新增 `reqLead` 类型 |
| `frontend/src/types/project.ts` | 8 | 新增 `pending_input` 状态 + `user_input_request/response` eventType |
| `frontend/src/components/ui/AgentAvatar.tsx` | 3 | 新增 Lena 头像配置 |
| `frontend/src/components/requirements/WorkflowConfigModal.tsx` | 3 | ROLE_META + AGENT_COMMANDS + 需求驱动模板 |
| `frontend/src/components/requirements/CommanderChatPanel.tsx` | 3, 7, 8 | AGENT_ROLE_MAP + tag 解析 + 图标映射 + 事件分组堆叠 + 底部聊天输入框 + 跳过按钮 |
| `frontend/src/components/project/ProjectSettingsModal.tsx` | 9 | Git 配置 UI（默认分支 + 分支前缀） |
| `frontend/src/hooks/useCommanderEvents.ts` | 8 | 新增 `useSubmitUserInput()` hook + 轮询包含 `pending_input` |
| `frontend/src/mocks/data/agents.ts` | 4 | Mock Agent 数据 |
| `frontend/src/mocks/data/bmadAgentDefs.ts` | 4 | BmadAgentDef 数据 |
| `frontend/src/mocks/handlers.ts` | 4, 8 | ARTIFACTS + PLAN_DESC + LIVE_LOGS + user-input mock handler |

---

## 依赖关系

```
Phase 1 (promptBlocks 修复) ← 基础，所有后续依赖
  └── Phase 2 (新角色 + 种子数据)
       ├── Phase 3 (前端类型 + UI)
       │    └── Phase 4 (Mock 数据)
       ├── Phase 5 (产出物传递优化)
       └── Phase 6 (逐命令执行 + 审查 + 知识沉淀) ← 含 6.8 审查策略 + 6.9 知识角色限制
            ├── Phase 7 (前端日志渲染)
            ├── Phase 8 (对话式访谈) ← 代码级拦截，不依赖 Commander Tool
            └── Phase 9 (Git 工作空间) ← 独立于 Phase 6，仅依赖 Phase 1
                 └── Phase 10 (代码上下文注入) ← 依赖 Phase 9
```

**建议实施顺序**：1 → 2 → 3/4 → 5 → 6 → 9 → 10 → 8 → 7（先基础后交互）

---

## 验证方案

1. **DB 种子验证**：删除 `data.db` → 重启后端 → `GET /api/v1/agents` 返回 12 个 Agent（10 内置 + 2 自定义），Lena 在列
2. **promptBlocks 生效验证**：创建自定义 Agent → 配置到流水线 → 启动 Commander → 检查 LLM system prompt 使用了自定义 promptBlocks 而非硬编码 persona
3. **逐命令执行验证**：启动 Lena 步骤（commands: BP→MR→CP）→ `commander_events` 表中依次出现 `[exec:BP]`、`[done:BP]`...事件，每个命令产出独立 artifact
4. **审查策略验证**：BP 产出物只经历 1 轮审查，CP 产出物经历 3 轮审查（检查 events 数量）
5. **知识沉淀验证**：Lena 执行后 `pending_suggestions` 表有知识项；Dev Agent 执行后无知识项
6. **前端日志可见性验证**：Commander 面板中 Lena 的执行过程以堆叠日志形式展示，每条带图标
7. **对话式访谈验证**：启动 Lena 步骤 → Lena 判断信息不足 → 面板出现自然语言提问 + 底部输入框激活 → 用户打字回复 → Lena 继续（或再问）→ 最多 3 轮后自动执行
8. **跳过访谈验证**：用户点击「跳过，直接开始」→ 步骤立即进入命令执行，不再提问
9. **Git 分支验证**：项目配置了仓库 URL → 启动需求 → 自动创建 `req/REQ-{n}` 分支 → 每步完成后文件写入 + commit → 流水线完成后 push 到远程
10. **产出物文件落盘验证**：`workspaces/{project_id}/repo/docs/requirements/REQ-42/xxx.md` 文件存在，内容与 DB `artifacts.content` 一致
11. **代码上下文验证**：项目有仓库 → Agent 的 system prompt 中包含 `[REPO STRUCTURE]` 和 `[FILE: README.md]` 等代码上下文段
12. **无仓库兼容验证**：项目未配置仓库 → 所有功能正常，产出物仅存 DB，无 Git 操作，无代码上下文
13. **向后兼容验证**：Mary/John 的流水线仍正常工作
14. **前端模板验证**：工作流配置弹窗显示 5 个模板，"需求驱动"模板可选
