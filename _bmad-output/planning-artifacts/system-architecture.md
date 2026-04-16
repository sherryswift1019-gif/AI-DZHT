---
title: "系统架构文档 — AI-DZHT"
status: "current"
created: "2026-04-16"
updated: "2026-04-16"
aligned_with: "代码实现 (2026-04-16)"
---

# AI-DZHT 系统架构文档

> 本文档描述 AI-DZHT 当前实现的系统架构，以代码为事实基础。

---

## 一、系统总览

```
┌─────────────────────────────────────────────────┐
│              Browser (React SPA)                 │
│  React 19 · TypeScript · Vite :5173             │
│  TanStack Query · Zustand · Radix UI            │
└──────────────────┬──────────────────────────────┘
                   │ HTTP REST (Vite proxy)
                   ▼
┌─────────────────────────────────────────────────┐
│           FastAPI Backend (:8000)                │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │             API Routers                   │   │
│  │  projects.py · requirements.py            │   │
│  │  llm_config.py · main.py (直接端点)       │   │
│  └──────────────┬───────────────────────────┘   │
│                 │                                 │
│  ┌──────────────▼───────────────────────────┐   │
│  │        Business Logic Layer               │   │
│  │                                           │   │
│  │  workflow_engine.py  ← Commander Agent    │   │
│  │    └── Worker Agent 执行                  │   │
│  │  llm.py ← 多 Provider LLM 抽象           │   │
│  │  context.py ← Agent Scope 过滤注入        │   │
│  └──────────────┬───────────────────────────┘   │
│                 │                                 │
│  ┌──────────────▼───────────────────────────┐   │
│  │        Persistence Layer                  │   │
│  │  storage.py → SQLAlchemy Core → SQLite   │   │
│  │  (backend/data.db)                        │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## 二、后端模块清单

### 2.1 入口与路由

| 文件 | 路径 | 职责 |
|---|---|---|
| `main.py` | `backend/app/main.py` | FastAPI 应用创建；CORS 配置；路由注册；直接端点（workflow/suggest, steps/detail, steps/stream, artifacts/content）；生命周期管理（DB 初始化） |
| `routers/projects.py` | `backend/app/routers/projects.py` | 项目 CRUD（GET/POST/PATCH/DELETE）；AI 生成上下文；Path B 待确认建议管理（list/confirm/reject） |
| `routers/requirements.py` | `backend/app/routers/requirements.py` | 需求 CRUD；审批流端点（approve-step 强制审批、dismiss-advisory 建议性审批 + 教训录入）；启动 Commander 后台任务 |
| `routers/llm_config.py` | `backend/app/routers/llm_config.py` | LLM 配置 GET/PUT；Provider 目录；连接测试（支持 GitHub Models + Anthropic OAuth） |

### 2.2 业务逻辑

| 文件 | 路径 | 职责 |
|---|---|---|
| `llm.py` | `backend/app/llm.py` | 多 Provider LLM 抽象层（`_chat` / `_stream_chat` / `chat_with_tools`）；业务函数（`suggest_workflow` / `get_step_detail` / `stream_step_log` / `get_artifact_content` / `generate_context` / `execute_worker_agent`） |
| `workflow_engine.py` | `backend/app/workflow_engine.py` | Commander 指挥官引擎：`run_commander()` 主入口 → `_commander_loop()` 多轮循环 → `_dispatch()` 工具分发 → `_execute_worker()` Worker 执行；5 个 Commander 工具；并发锁保护；审批暂停/恢复 |
| `context.py` | `backend/app/context.py` | `AGENT_SCOPE_MAP` 静态映射（9 个 Agent + Commander）；`assemble_context()` 按 scope 过滤 rules/lessons 并组装 ~300-500 token Prompt Block |

### 2.3 数据层

| 文件 | 路径 | 职责 |
|---|---|---|
| `database.py` | `backend/app/database.py` | SQLAlchemy Core 引擎（SQLite）；7 张表定义；种子数据（2 个示例项目 + 2 个示例需求）；`init_db()` 初始化 |
| `storage.py` | `backend/app/storage.py` | 所有表的 CRUD 操作（get/save/delete）；产出物 upsert；Commander 状态持久化；Legacy dict-like shims |
| `models.py` | `backend/app/models.py` | Pydantic 模型：上下文（TechItem, AvoidItem, Rule, ContextLesson, ProjectContext）；项目/需求 IO；工作流/步骤/产出物；LLM 配置；审批请求 |

---

## 三、API 端点目录

### 3.1 核心工作流

| # | 方法 | 路径 | 描述 |
|---|---|---|---|
| 1 | GET | `/health` | 健康检查 |
| 2 | POST | `/api/v1/workflow/suggest` | 根据需求标题/描述推荐工作流模板 |
| 3 | POST | `/api/v1/steps/detail` | 获取步骤执行详情（plan/progress/artifacts） |
| 4 | GET | `/api/v1/steps/stream` | SSE 流式步骤日志 |
| 5 | POST | `/api/v1/artifacts/content` | 获取产出物内容（DB 优先，无则 LLM 生成） |

### 3.2 项目管理

| # | 方法 | 路径 | 描述 |
|---|---|---|---|
| 6 | POST | `/api/v1/projects/generate-context` | AI 生成项目上下文 |
| 7 | GET | `/api/v1/projects` | 项目列表 |
| 8 | POST | `/api/v1/projects` | 创建项目 |
| 9 | GET | `/api/v1/projects/{id}` | 项目详情 |
| 10 | PATCH | `/api/v1/projects/{id}` | 更新项目 |
| 11 | DELETE | `/api/v1/projects/{id}` | 删除项目（级联删除需求 + seq） |

### 3.3 上下文建议（Path B）

| # | 方法 | 路径 | 描述 |
|---|---|---|---|
| 12 | GET | `/api/v1/projects/{id}/pending-suggestions` | 列出待确认 Agent 建议 |
| 13 | POST | `/api/v1/projects/{id}/pending-suggestions/{sid}/confirm` | 确认建议（写入 context） |
| 14 | POST | `/api/v1/projects/{id}/pending-suggestions/{sid}/reject` | 拒绝建议（删除记录） |

### 3.4 需求管理

| # | 方法 | 路径 | 描述 |
|---|---|---|---|
| 15 | GET | `/api/v1/projects/{pid}/requirements` | 需求列表 |
| 16 | POST | `/api/v1/projects/{pid}/requirements` | 创建需求 |
| 17 | GET | `/api/v1/projects/{pid}/requirements/{rid}` | 需求详情 |
| 18 | PATCH | `/api/v1/projects/{pid}/requirements/{rid}` | 更新需求（status="running" 触发 Commander） |
| 19 | DELETE | `/api/v1/projects/{pid}/requirements/{rid}` | 删除需求 |

### 3.5 审批流

| # | 方法 | 路径 | 描述 |
|---|---|---|---|
| 20 | POST | `.../requirements/{rid}/approve-step/{sid}` | 批准审批（恢复 Commander） |
| 21 | POST | `.../requirements/{rid}/dismiss-advisory/{sid}` | 驳回建议性审批（可录入教训） |

### 3.6 LLM 配置

| # | 方法 | 路径 | 描述 |
|---|---|---|---|
| 22 | GET | `/api/v1/llm-config/models` | Provider + 模型目录 |
| 23 | GET | `/api/v1/llm-config` | 获取当前配置 |
| 24 | PUT | `/api/v1/llm-config` | 更新配置 |
| 25 | POST | `/api/v1/llm-config/test` | 测试连接 |

---

## 四、数据库 Schema

### 4.1 表关系

```
projects (1) ──→ (N) requirements
    │                    │
    │                    ├──→ (N) artifacts
    │                    └──→ (1) commander_state
    │
    └──→ (N) pending_suggestions
    
projects (1) ──→ (1) project_seq

llm_config (singleton, id="default")
```

### 4.2 表定义

**projects**
| 列 | 类型 | 说明 |
|---|---|---|
| id | String PK | "proj-{timestamp}" |
| code | String | "PRJ-XXXX" |
| name | String | 项目名称 |
| description | String | 描述 |
| status | String | planning / active / paused / done |
| owner_id | String | 负责人 ID |
| member_ids | Text(JSON) | 成员 ID 列表 |
| color | String | 卡片颜色 |
| context | Text(JSON) | 四层上下文（ProjectContext） |
| settings | Text(JSON) | 项目设置 |
| start_date | String | 开始日期 |
| end_date | String | 结束日期 |
| budget | Integer | 预算 |
| created_at | Integer | 创建时间戳 |

**requirements**
| 列 | 类型 | 说明 |
|---|---|---|
| id | String PK | "req-{timestamp}" |
| project_id | String FK | 所属项目 |
| code | String | "REQ-{seq}" |
| title | String | 需求标题 |
| summary | String | 描述 |
| priority | String | P0-P3 |
| status | String | queued / running / blocked / done |
| assignee_id | String | 负责人 |
| pipeline | Text(JSON) | PipelineStep[] |
| stories | Text(JSON) | Story[] |
| token_usage | Text(JSON) | Token 用量（当前为 NULL，占位） |
| created_at | Integer | 创建时间戳 |

**artifacts**
| 列 | 类型 | 说明 |
|---|---|---|
| id | String PK | UUID |
| req_id | String | 所属需求 |
| step_id | String | 所属步骤 |
| name | String | 产出物名称 |
| type | String | document / code / design 等 |
| summary | String | 摘要 |
| content | Text | 完整内容 |
| format | String | markdown / code |

**commander_state**
| 列 | 类型 | 说明 |
|---|---|---|
| req_id | String PK | 对应需求 |
| messages | Text(JSON) | Commander 对话历史 |
| pending_tool_call_id | String | 暂停时的 tool_call_id |
| updated_at | Integer | 更新时间戳 |

**llm_config**
| 列 | 类型 | 说明 |
|---|---|---|
| id | String PK | 固定 "default" |
| provider | String | "github" / "anthropic" |
| model | String | 模型 ID |
| auth_type | String | "api_key" / "oauth_token" |
| api_key | String | Token 值 |
| base_url | String | 自定义端点（可选） |
| updated_at | Integer | 更新时间戳 |

**pending_suggestions**
| 列 | 类型 | 说明 |
|---|---|---|
| id | String PK | UUID |
| project_id | String | 所属项目 |
| req_id | String | 来源需求 |
| step_id | String | 来源步骤 |
| agent_name | String | 建议 Agent |
| suggestion | Text(JSON) | 建议内容 {type, scope, text/title/...} |
| created_at | Integer | 创建时间戳 |

**project_seq**
| 列 | 类型 | 说明 |
|---|---|---|
| project_id | String PK | 所属项目 |
| seq | Integer | 当前序号（REQ-{seq}） |

---

## 五、核心数据流

### 5.1 需求执行流

```
用户在前端启动需求（PATCH status="running"）
  ↓
requirements.py → BackgroundTasks.add_task(run_commander)
  ↓
workflow_engine.py → _commander_loop()
  ↓ 循环
chat_with_tools(messages, COMMANDER_TOOLS)
  ↓ LLM 返回 tool_calls
_dispatch(tool_call)
  ├── invoke_agent(step_id)
  │     └── _execute_worker() → execute_worker_agent()
  │           ├── 生成产出物 → save_artifact()
  │           └── 建议上下文更新 → save_pending_suggestion()
  │     └── _update_step(status="done")
  │
  ├── request_approval(step_id)
  │     └── _update_step(status="pending_approval")
  │     └── save_commander_state() → 暂停，等待人工
  │
  ├── request_advisory_approval(step_id, concern)
  │     └── _update_step(status="pending_advisory_approval")
  │     └── save_commander_state() → 暂停
  │
  ├── complete_pipeline()
  │     └── _mark_pipeline_done() → requirement.status="done"
  │
  └── block_pipeline(reason)
        └── _mark_pipeline_blocked() → requirement.status="blocked"
```

### 5.2 审批恢复流

```
人工在前端点击"批准"
  ↓
approve-step 端点 → BackgroundTasks.add_task(run_commander, approval_result)
  ↓
workflow_engine.py → get_commander_state(req_id)
  ↓
恢复对话历史 → 追加审批结果作为 tool response
  ↓
继续 _commander_loop()...
```

### 5.3 上下文注入流

```
项目上下文（project.context JSON）
  ↓
assemble_context(ctx, agent_name)
  ↓
AGENT_SCOPE_MAP[agent_name] → 获取可见 scope 列表
  ↓
过滤 rules（按 scope）+ 过滤 lessons（按 scope + 固化全注入 + 最近 5 条）
  ↓
组装 Prompt Block:
  [PROJECT] goal + targetUsers
  [TECH] techStack（当前全量，设计目标按角色过滤）
  [ARCH] archSummary
  [AVOID] avoid items
  [RULES] scope 过滤后的规则
  [DOMAIN] domainModel
  [LESSONS] 固化 + 最近相关教训
  ↓
注入 Worker Agent system prompt（约 300-500 token）
```

### 5.4 Path B 上下文沉淀流

```
Worker Agent 执行完成
  ↓
返回 { artifacts, suggestedContextUpdates }
  ↓
suggestedContextUpdates 非空时:
  save_pending_suggestion(project_id, req_id, step_id, agent_name, suggestion)
  ↓
前端展示待确认列表（GET /pending-suggestions）
  ↓
人工确认 → confirm 端点:
  ├── type=rule → 写入 project.context.rules（source='human'）
  └── type=lesson → 写入 project.context.lessons
        └── 可选固化为 rule（promoteToRule=true）
  ↓
delete_pending_suggestion()
```

---

## 六、前端架构

### 6.1 页面结构

| 路由 | 页面组件 | 功能 |
|---|---|---|
| `/projects` | ProjectListPage | 项目列表，搜索/筛选/创建 |
| `/projects/:id` | ProjectDetailPage | 需求列表，流水线可视化，审批操作，设置弹窗 |
| `/agents` | AgentListPage | Agent 模板列表（**MSW mock 数据**） |
| `/agents/:id` | AgentDetailPage | Agent 详情/配置/实例/历史（**MSW mock**） |
| `/agents/:id/edit` | EditAgentPage | Agent 编辑（**MSW mock**） |
| `/commands` | CommandLibraryPage | BMAD 命令库（**MSW mock**） |
| `/settings` | LLMSettingsPage | LLM 配置管理 |

### 6.2 数据获取策略

```
真实后端 API（通过 Vite proxy → FastAPI :8000）
  ├── useProjects.ts      → 项目 CRUD
  ├── useRequirements.ts  → 需求 CRUD + 审批
  ├── useLLMConfig.ts     → LLM 配置
  ├── useWorkflowSuggest.ts → 工作流推荐
  ├── useStepDetail.ts    → 步骤详情
  └── useArtifactContent.ts → 产出物内容

MSW Mock（仅开发模式）
  ├── GET /api/v1/agents   → Agent 列表
  ├── GET /api/v1/agents/:id → Agent 详情
  └── GET /api/v1/commands → BMAD 命令库
```

### 6.3 状态管理

| 层级 | 工具 | 用途 |
|---|---|---|
| 服务端状态 | TanStack React Query | API 数据缓存、自动重取、乐观更新 |
| 跨页面 UI 状态 | Zustand | 主题切换（themeStore）、Agent 向导（agentWizardStore） |
| 组件局部状态 | React useState | 表单状态、弹窗开关、临时 UI 状态 |

### 6.4 实时更新策略

- 需求列表在 status="running" 时启用 5 秒轮询（React Query `refetchInterval: 5000`）
- 步骤日志通过 SSE（`/api/v1/steps/stream`）实时推送
- 审批状态通过轮询检测（pending_approval / pending_advisory_approval）

---

## 七、Agent 角色体系（9 个）

| Agent | 角色 | Scope | 典型命令 |
|---|---|---|---|
| Mary | 战略商业分析师 | all, pm | BP→CB→DP |
| John | 产品经理 | all, pm | CP→VP→EP→CE |
| Sally | UX 设计师 | all, design | CU |
| Winston | 系统架构师 | all, architect, dev | CA |
| Bob | Scrum Master | all, pm | SP→CS→VS→SS |
| Amelia | 软件工程师 | all, dev | DS |
| Quinn | QA 工程师 | all, qa | QA |
| Barry | 快速开发者 | all, dev | DS（快速模式） |
| Paige | 技术文档 | all, dev | — |

> 注：Agent 角色定义硬编码在 `context.py` 的 `AGENT_SCOPE_MAP` 中。Agent 管理（创建/编辑/版本）当前无后端实现，前端使用 MSW mock。

---

*v1.0 — 与代码实现对齐，2026-04-16*
