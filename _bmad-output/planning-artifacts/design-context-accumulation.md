---
title: "设计文档：项目上下文体系 — 高质量上下文的产生与沉淀"
status: "confirmed"
created: "2026-04-15"
updated: "2026-04-15"
priority: "高"
---

# 项目上下文体系设计

> **核心主张**：上下文不是填表，是研发过程的副产品。平台让每个执行阶段自动沉淀知识，同时按角色精准注入，让整套系统越用越懂这个团队。

---

## 一、为什么上下文是一等功能

当前 AI 研发工具的最大痛点不是 Agent 不够聪明，而是 Agent **每次都从零开始**：

- 不知道团队禁止什么（`window.confirm`、裸 `fetch` 调用……）
- 不知道上次因为什么出错（之前重复修了 3 次才固化的规范）
- 不知道业务边界在哪里（需求删除前要检查 pipeline 状态……）

**AI-DZHT 的差异化**：通过持续经营上下文，让系统越用越懂这个团队。这是时间护城河，无法被快速复制。

---

## 二、上下文的闭环架构

注入和沉淀是同一个系统的两面，必须一起设计：

```
项目上下文（数据库）
       ↓ 注入（按 Agent 角色过滤）
[Mary]→[John]→[Sally]→[Winston]→[Bob]→[Amelia]→[Quinn]
       ↑______________ 沉淀 ___________________________↑
              人工触发 + Agent 主动建议
```

---

## 三、四层模型（知识分级）

```
┌─────────────────────────────────────────┐
│  层 4：过往决策与教训（最难产生，最有价值）  │
├─────────────────────────────────────────┤
│  层 3：业务领域知识（让 Agent 懂业务语义）  │
├─────────────────────────────────────────┤
│  层 2：架构决策（为什么 + 禁止什么）        │
├─────────────────────────────────────────┤
│  层 1：技术事实（版本、工具、路径）          │
└─────────────────────────────────────────┘
```

**来源与权威性**：
- `project-context.md`（静态文件，版本控制）→ 负责层 1 技术事实，稳定不变
- 数据库 `ProjectContext`（UI 可编辑）→ 负责层 2-4，随项目演化，**冲突时数据库优先**

---

## 四、最终数据模型

### 4.1 TypeScript 类型定义（Frontend）

```typescript
type RuleScope = 'all' | 'dev' | 'qa' | 'pm' | 'design' | 'architect'

type TechItem = {
  name: string        // "React"
  version?: string    // "19.2"
  notes?: string      // "Zustand 管 UI 状态；TanStack Query 管服务端数据；禁 Redux"
}

type AvoidItem = {
  item: string          // "window.confirm()"
  reason?: string       // "全项目视觉一致性"
  useInstead?: string   // "Radix UI Dialog"
}

type Rule = {
  scope: RuleScope
  text: string
  source: 'human' | 'agent'  // human = 最高可信度；agent = 待人工确认
  lessonId?: string           // 来源教训 id，可溯源
}

type ContextLesson = {
  id: string
  date: string
  title: string
  background: string
  correctApproach: string
  promotedToRule: boolean
  scope?: RuleScope            // 与哪类 Agent 相关
}

type ProjectContext = {
  // 项目定位（所有 Agent 必读，永远排第一）
  goal: string          // "AI 驱动的研发流水线编排平台"
  targetUsers: string   // "B 端 PM 和研发负责人，操作频率低，容错优先速度"

  // 层 1 — 技术事实
  industry: string
  techStack: TechItem[]

  // 层 2 — 架构决策
  archSummary: string   // "SPA → REST /api/v1/* → SQLite；dev 用 MSW mock"
  avoid: AvoidItem[]

  // 层 2+3 — 规范与领域规则
  rules: Rule[]
  domainModel: string   // Arrow Notation 格式（见 4.3 节）

  // 层 4 — 教训
  lessons: ContextLesson[]
}
```

### 4.2 Python 模型定义（Backend）

```python
from typing import Optional, Literal
from pydantic import BaseModel

RuleScope = Literal['all', 'dev', 'qa', 'pm', 'design', 'architect']

class TechItem(BaseModel):
    name: str
    version: Optional[str] = None
    notes: Optional[str] = None

class AvoidItem(BaseModel):
    item: str
    reason: Optional[str] = None
    useInstead: Optional[str] = None

class Rule(BaseModel):
    scope: RuleScope
    text: str
    source: Literal['human', 'agent'] = 'human'
    lessonId: Optional[str] = None

class ContextLesson(BaseModel):
    id: str
    date: str
    title: str
    background: str
    correctApproach: str
    promotedToRule: bool = False
    scope: Optional[RuleScope] = None

class ProjectContext(BaseModel):
    goal: str = ""
    targetUsers: str = ""
    industry: str = ""
    techStack: list[TechItem] = []
    archSummary: str = ""
    avoid: list[AvoidItem] = []
    rules: list[Rule] = []
    domainModel: str = ""
    lessons: list[ContextLesson] = []
```

### 4.3 `domainModel` 格式约定

使用 Arrow Notation，不做结构化 JSON（降低维护门槛）：

```
Project(1) → Requirement(N) → PipelineStep(N)
Requirement(1) → Story(N) → PipelineStep(N)
PipelineStep.status: queued → running → done | blocked
AgentRole: analyst | pm | ux | architect | sm | dev | qa | quickdev | techwriter
```

---

## 五、注入架构

### 5.1 Agent → Scope 静态映射表

写在代码里，不进数据库（Agent 职责不随项目变化）：

```python
# backend/app/context.py
AGENT_SCOPE_MAP: dict[str, list[str]] = {
    "Mary":    ["all", "pm"],
    "John":    ["all", "pm"],
    "Sally":   ["all", "design"],
    "Winston": ["all", "architect", "dev"],
    "Bob":     ["all", "pm"],
    "Amelia":  ["all", "dev"],
    "Quinn":   ["all", "qa"],
    "Barry":   ["all", "dev"],
    "Paige":   ["all", "dev"],
}
```

### 5.2 各 Agent 注入层级矩阵

| Agent | goal/targetUsers | techStack/arch | avoid/rules | domainModel | lessons |
|---|---|---|---|---|---|
| Mary（分析师） | ✅ 全量 | — | — | ✅ 全量 | ⚙️ pm |
| John（PM） | ✅ 全量 | — | ⚙️ pm | ✅ 全量 | ⚙️ pm |
| Sally（UX） | ✅ 全量 | — | ⚙️ design | ⚙️ 页面相关 | ⚙️ design |
| Winston（架构） | ✅ 全量 | ✅ 全量 | ✅ 全量 | ✅ 全量 | ✅ 全量 |
| Bob（SM） | ✅ 全量 | — | ⚙️ pm | ✅ 全量 | ⚙️ pm |
| Amelia（开发） | ✅ 全量 | ✅ 全量 | ⚙️ dev | ✅ 全量 | ⚙️ dev |
| Quinn（QA） | ✅ 全量 | ⚙️ 技术栈 | ⚙️ qa | ✅ 全量 | ⚙️ qa+dev |
| Barry（快速开发） | ✅ 全量 | ✅ 全量 | ⚙️ dev | ✅ 全量 | ⚙️ dev |
| Paige（文档） | ✅ 全量 | ⚙️ 技术栈 | ⚙️ all | — | ⚙️ all |

> ✅ 全量注入 / ⚙️ 按 scope 过滤 / — 不注入

### 5.3 注入组装器逻辑

```python
def assemble_context(ctx: ProjectContext, agent_name: str) -> str:
    scopes = set(AGENT_SCOPE_MAP.get(agent_name, ["all"]))

    relevant_rules = [r for r in ctx.rules if r.scope in scopes]

    # 两级 Lessons 策略
    promoted = [l for l in ctx.lessons if l.promotedToRule]
    recent = [
        l for l in ctx.lessons
        if not l.promotedToRule and (not l.scope or l.scope in scopes)
    ][-5:]

    return _build_prompt_block(ctx, relevant_rules, promoted + recent)
```

### 5.4 注入后 Prompt Block 示例（Amelia，dev Agent）

```
[PROJECT]
目标: AI 驱动的研发流水线编排平台
用户: B 端 PM 和研发负责人，操作频率低，容错优先于速度

[TECH] 行业: SaaS / 企业软件
React 19.2 — Zustand UI状态；TanStack Query服务端数据；禁Redux
FastAPI + SQLite | MSW mock拦截 /api/v1/*（dev）

[ARCH] SPA → REST /api/v1/* → SQLite；dev 用 MSW mock

[AVOID]
• window.confirm() → Radix UI Dialog（全项目视觉一致性）
• TypeScript any → unknown 或具体类型

[RULES]
• [dev] import type 用于纯类型导入（verbatimModuleSyntax: true）
• [dev] 服务端数据禁止放 Zustand，用 TanStack Query
• [all] 破坏性操作必须 Modal 二次确认

[DOMAIN]
Project(1)→Requirement(N)→PipelineStep(N)
Requirement(1)→Story(N)→PipelineStep(N)

[LESSONS]
• [固化][2026-04-12] 删除确认统一用 Modal
  正确做法: Radix UI Dialog，不用 window.confirm
```

**估算 token：约 380**（按 scope 过滤后）

---

## 六、沉淀架构

### 6.1 路径 A — 人工触发（最高质量）

```
Agent 完成步骤
      ↓
人工审查输出
      ↓
    修改了？
   /        \
  是          否
  ↓           ↓
弹出捕获弹窗   可选快捷记录（一键跳过）
  ↓
填写：标题 / 背景 / 正确做法 / scope / 是否固化为规则
      ↓
写入 lessons（source='human'）
若固化 → 同时写入 rules（source='human'）
```

触发条件：**人工修改了 Agent 输出**，平台自动弹出捕获弹窗。

### 6.2 路径 B — Agent 主动建议（自动化）

每个 Agent 完成任务后，在正常输出之外额外返回建议块：

```json
{
  "output": "...正常产出物...",
  "suggestedContextUpdates": [
    {
      "type": "rule",
      "scope": "architect",
      "text": "Redis 用于会话存储，SQLite 不支持高并发写入",
      "source": "agent",
      "confidence": "high"
    },
    {
      "type": "lesson",
      "scope": "dev",
      "title": "状态机转换要加原子锁",
      "background": "并发请求导致状态不一致",
      "correctApproach": "用数据库事务包裹状态转换"
    }
  ]
}
```

这些建议在 UI 中显示为**"待确认的上下文建议"**，人工确认后 source 升级为 `'human'`，拒绝则丢弃。**不自动写入。**

### 6.3 两条路径对比

| | 路径 A（人工触发） | 路径 B（Agent 建议） |
|---|---|---|
| 触发时机 | 人工修改输出时 | Agent 完成后自动产生 |
| 质量 | 最高（有感知的真实错误） | 中等（需人工确认） |
| 遗漏率 | 高（人懒得填） | 低（自动产生） |
| 噪音率 | 低 | 中（Agent 会猜） |
| 结论 | 捕获**高价值**教训 | 捕获**日常模式** |

**两条路径互补，都需要实现。**

### 6.4 高价值沉淀节点

| 节点 | 沉淀内容 | 价值 |
|---|---|---|
| Winston 架构决策 | 技术选型 + 被否方案 | ⭐⭐⭐ 最高 |
| 人工推翻任何 Agent | 直接证明 Agent 犯了什么错 | ⭐⭐⭐ 最高 |
| Quinn 测试失败 | Bug 模式 + 边界条件 | ⭐⭐⭐ 高 |
| Amelia 代码实现 | 使用的模式 + 规避的坑 | ⭐⭐ 中 |
| Mary 需求澄清 | 业务规则 + 边界条件 | ⭐⭐ 中 |
| Bob Sprint 计划 | 过期快，沉淀意义低 | ⭐ 低 |

---

## 七、实现优先级

### P0 — 本次 Sprint（注入闭环）

- [ ] 更新 `ProjectContext` 数据模型（TypeScript + Python）
- [ ] 新建 `backend/app/context.py`：`AGENT_SCOPE_MAP` + `assemble_context()`
- [ ] `get_step_detail` / `stream_step_log` 接入 `assemble_context()`
- [ ] 更新 `ProjectSettingsModal` 适配新字段 UI
- [ ] 更新 AI 生成上下文接口，生成新结构字段

### P1 — 下一个 Sprint（沉淀闭环）

- [ ] 路径 A：步骤完成后的"修改捕获弹窗"
- [ ] 路径 B：Agent 输出增加 `suggestedContextUpdates` 字段
- [ ] UI：待确认的上下文建议列表（human 确认后升级 source）
- [ ] Winston 专项：架构决策结构化捕获（含被否方案）

### P2 — 未来

- [ ] 按 Agent 角色过滤相关性评分
- [ ] 上下文健康度仪表盘（哪层是空的，哪些已过期）
- [ ] `project-context.md` 与数据库自动同步

---

## 八、评估指标

| 指标 | 基线 | 目标（3 个月） |
|---|---|---|
| 同类 Agent 错误重现率 | — | 首次出现后 < 5% |
| 层 4 教训条目数 | 0 | > 20 条/项目 |
| 人工推翻后经验捕获率 | 0% | > 80% |
| 需求启动时上下文注入覆盖率 | 0% | 100% |
| Agent 建议被采纳率 | — | > 60%（quality signal） |

---

## 九、与 BMAD 的关系

```
BMAD 做的：
  冷启动 → 扫描代码 → 生成初始 project-context.md（层 1）✅

AI-DZHT 增加的：
  每次执行 → 识别知识信号 → 结构化提取
           → 人工确认 → 版本化更新 → 分层注入
```

BMAD 是**上下文初始化引擎**，AI-DZHT 流水线是**上下文演化引擎**。

---

*v0.2 — 2026-04-15 — 数据模型、注入矩阵、沉淀架构已确认*
