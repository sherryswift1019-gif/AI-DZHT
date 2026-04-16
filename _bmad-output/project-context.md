---
project_name: 'AI-DZHT'
user_name: 'Zhangshanshan'
date: '2026-04-16'
sections_completed:
  - technology_stack
  - typescript_rules
  - react_patterns
  - state_management
  - styling_system
  - file_conventions
  - mock_data
  - delete_ux
  - routing
  - backend_architecture
  - database_schema
  - llm_abstraction
  - workflow_engine
  - context_injection
---

# Project Context for AI Agents

_AI-DZHT 研发工厂平台：面向研发团队的全流程 AI 协作平台，支撑需求到上线的自动化执行。_
_本文件记录 AI Agent 实现代码时必须遵循的关键规则——聚焦于容易遗漏的非显而易见细节。_

---

## 系统架构总览

```
Browser (React SPA, Vite dev server :5173)
  ↓ HTTP REST（Vite proxy 转发 /api/v1/*）
FastAPI Backend (:8000)
  ├── Routers: projects, requirements, llm_config
  ├── 直接端点: workflow/suggest, steps/detail, steps/stream(SSE), artifacts/content
  ├── Workflow Engine: Commander Agent (tool calling) + Worker Agent
  ├── LLM Abstraction: Anthropic Claude + OpenAI/GitHub Models（运行时切换）
  ├── Context Injection: 按 Agent 角色 scope 过滤规则/教训
  └── Storage: SQLAlchemy Core → SQLite (backend/data.db)
```

**当前状态**：后端已提供项目/需求/LLM配置/工作流执行的完整 API。Agent 管理相关端点暂未实现，前端通过 MSW mock 提供数据。

---

## 技术栈与版本

### 前端

| 层 | 技术 | 版本 |
|---|---|---|
| UI 框架 | React | ^19.2.4 |
| 语言 | TypeScript | ~6.0.2 |
| 构建工具 | Vite | ^8.0.4 |
| 样式 | Tailwind CSS v4 | ^4.2.2 |
| 路由 | React Router DOM | ^7.14.1 |
| 服务端状态 | TanStack React Query | ^5.99.0 |
| 客户端状态 | Zustand | ^5.0.12 |
| 组件原语 | Radix UI (多包) | latest |
| API 模拟 | MSW (Mock Service Worker) | ^2.13.3 |
| 图标 | Lucide React | ^1.8.0 |
| CSS 工具 | clsx + tailwind-merge | latest |

**项目根**：`frontend/`

### 后端

| 层 | 技术 | 版本 |
|---|---|---|
| Web 框架 | FastAPI | latest |
| 数据库 | SQLite（通过 SQLAlchemy Core） | — |
| LLM SDK | anthropic + openai (AsyncClient) | latest |
| 环境变量 | python-dotenv | latest |
| 运行时 | Python 3.12+ | — |

**项目根**：`backend/`

---

## 后端架构

### 模块清单（`backend/app/`）

| 文件 | 职责 |
|---|---|
| `main.py` | FastAPI 入口；CORS；注册路由；直接端点（workflow/suggest, steps/detail, steps/stream, artifacts/content） |
| `models.py` | 所有 Pydantic 请求/响应模型（Project, Requirement, PipelineStep, ProjectContext, LLMConfig 等） |
| `database.py` | SQLAlchemy Core 表定义（7 张表）；引擎初始化；种子数据 |
| `storage.py` | 所有表的 CRUD 操作（get/save/delete）；Legacy dict-like shims |
| `llm.py` | 多 provider LLM 抽象（_chat / _stream_chat / chat_with_tools）；业务函数（suggest_workflow / get_step_detail / execute_worker_agent / generate_context） |
| `context.py` | Agent scope 映射（AGENT_SCOPE_MAP）；上下文组装器（assemble_context） |
| `workflow_engine.py` | Commander 指挥官引擎（run_commander）；tool 分发；Worker 执行；审批暂停/恢复 |
| `routers/projects.py` | 项目 CRUD + 生成上下文 + 待确认建议管理 |
| `routers/requirements.py` | 需求 CRUD + 审批流（approve-step / dismiss-advisory） |
| `routers/llm_config.py` | LLM 配置管理 + 连接测试 + provider 目录 |

### 数据库 Schema（7 张表）

| 表 | 主键 | 核心列 | 用途 |
|---|---|---|---|
| `projects` | id | code, name, context(JSON), settings(JSON), owner_id | 项目元数据 + 四层上下文 |
| `requirements` | id | project_id, code, title, pipeline(JSON), stories(JSON), token_usage(JSON) | 需求 + 执行流水线 |
| `project_seq` | project_id | seq | 每项目单调递增序号（REQ-XXX） |
| `artifacts` | id | req_id, step_id, name, type, summary, content, format | Agent 产出物 |
| `commander_state` | req_id | messages(JSON), pending_tool_call_id | Commander 对话暂停状态 |
| `llm_config` | id="default" | provider, model, auth_type, api_key, base_url | 全平台 LLM 配置 |
| `pending_suggestions` | id | project_id, req_id, step_id, agent_name, suggestion(JSON) | Agent 建议的上下文更新 |

### LLM 多 Provider 抽象

- **GitHub Models**（OpenAI 兼容）：`AsyncOpenAI(api_key=..., base_url="https://models.inference.ai.azure.com")`
- **Anthropic Claude**：`AsyncAnthropic(api_key=...)` 或 OAuth token
- 配置存储在 `llm_config` 表，运行时通过 `_load_config()` 读取
- 统一接口：`_chat()` / `_stream_chat()` / `chat_with_tools()` 自动分发到对应 provider
- 支持模型：GPT-4o/4o-mini（GitHub）、Claude Opus 4.6/Sonnet 4.6/Haiku 4.5（Anthropic）

### Commander 工作流引擎

Commander 是一个维持多轮对话的 LLM，通过 function calling 驱动 Worker Agent 顺序执行流水线。

**5 个工具函数**：
- `invoke_agent(step_id)` — 执行 Worker Agent，存储产出物
- `request_approval(step_id, summary)` — 强制人工审批（暂停流水线）
- `request_advisory_approval(step_id, concern)` — 建议性审批（可忽略）
- `complete_pipeline()` — 标记流水线完成
- `block_pipeline(reason)` — 标记流水线阻塞

**执行流程**：
1. 需求 status 改为 "running" → 触发 `run_commander(req_id, project_id)`
2. Commander loop：发送消息 → 获取 tool_calls → 分发执行 → 追加结果 → 循环
3. 遇到审批：持久化对话到 `commander_state` 表 → 暂停
4. 人工批准：从 DB 恢复对话 → 追加审批结果 → 继续循环
5. 所有步骤完成：`complete_pipeline()` → 标记需求 status="done"

### 上下文注入系统

**AGENT_SCOPE_MAP**（`context.py`）：
```
Mary:    [all, pm]        — 战略商业分析师
John:    [all, pm]        — 产品经理
Sally:   [all, design]    — UX 设计师
Winston: [all, architect, dev] — 系统架构师
Bob:     [all, pm]        — Scrum Master
Amelia:  [all, dev]       — 软件工程师
Quinn:   [all, qa]        — QA 工程师
Barry:   [all, dev]       — 快速开发者
Paige:   [all, dev]       — 技术文档
Commander: [all, dev, qa, pm, design, architect]
```

**注入内容**（`assemble_context()`）：
- [PROJECT] goal + targetUsers — 全 Agent 注入
- [TECH] techStack — 当前全 Agent 注入（设计目标：按角色过滤）
- [ARCH] archSummary — 当前全 Agent 注入（设计目标：按角色过滤）
- [AVOID] avoid — 当前全 Agent 注入（设计目标：按角色过滤）
- [RULES] rules — **按 scope 过滤**
- [DOMAIN] domainModel — 当前全 Agent 注入
- [LESSONS] lessons — **按 scope 过滤**（固化规则全注入 + 最近 5 条相关教训）

### 如何运行后端

```bash
cd backend
pip install -r requirements.txt    # 安装依赖
uvicorn app.main:app --reload      # 启动开发服务器 :8000
```

环境变量（可选）：
- `GITHUB_TOKEN` — GitHub Models API key（默认 provider）
- `DB_PATH` — SQLite 文件路径（默认 `backend/data.db`）

---

## 前端架构

### TypeScript 规则（关键）

- **`verbatimModuleSyntax: true`** — 仅类型导入必须使用 `import type`，否则编译报错
  ```ts
  // 正确
  import type { Requirement } from '@/types/project'
  import { useState } from 'react'
  
  // 错误 — build 失败
  import { Requirement } from '@/types/project'
  ```
- **`noUnusedLocals: true` + `noUnusedParameters: true`** — 未使用变量/参数报错
- **路径别名**：`@/` → `src/`，始终使用 `@/`

### React 模式

- 组件使用**命名导出**（`export function Foo`），不使用默认导出（App.tsx 除外）
- 页面文件名：`XxxPage.tsx`；普通组件：`XxxComponent.tsx`
- 组件目录：`src/components/<feature>/`，`src/pages/<feature>/`
- ESLint 强制 `eslint-plugin-react-hooks`

### 状态管理分层

```
服务端 / 异步数据    → TanStack React Query (useQuery / useMutation)
跨页面持久 UI 状态   → Zustand store (src/stores/xxxStore.ts)
组件局部状态         → React useState / useReducer
```

**当前 Zustand stores**：
- `agentWizardStore.ts` — Agent 创建向导多步骤状态
- `themeStore.ts` — 暗色/亮色主题切换（持久化到 localStorage）

**React Query hooks**（`src/hooks/`）：
| Hook | 对接 |
|---|---|
| `useProjects.ts` | `GET/POST/PATCH/DELETE /api/v1/projects` → **真实后端** |
| `useRequirements.ts` | `/api/v1/projects/:id/requirements/*` + approve/dismiss → **真实后端** |
| `useLLMConfig.ts` | `GET/PUT /api/v1/llm-config` + test → **真实后端** |
| `useWorkflowSuggest.ts` | `POST /api/v1/workflow/suggest` → **真实后端** |
| `useStepDetail.ts` | `POST /api/v1/steps/detail` → **真实后端** |
| `useArtifactContent.ts` | `POST /api/v1/artifacts/content` → **真实后端** |

### 混合开发模式（关键）

**真实后端**（Vite proxy → FastAPI :8000）：
- 所有 `/api/v1/projects/*` — 项目 CRUD、上下文生成、待确认建议
- 所有 `/api/v1/projects/*/requirements/*` — 需求 CRUD、审批流
- `/api/v1/workflow/suggest` — 工作流推荐
- `/api/v1/steps/detail` + `/api/v1/steps/stream` — 步骤详情/日志流
- `/api/v1/artifacts/content` — 产出物内容
- `/api/v1/llm-config/*` — LLM 配置

**MSW Mock**（仅开发模式，`src/mocks/handlers.ts`）：
- `GET /api/v1/agents` + `GET /api/v1/agents/:id` — Agent 列表/详情
- `GET /api/v1/commands` — BMAD 命令库
- `POST /api/v1/steps/detail` — 步骤执行详情（mock 生成器，**与真实后端端点重叠，MSW 优先**）
- `POST /api/v1/artifacts/content` — 产出物内容模板（**与真实后端重叠，MSW 优先**）
- `GET/PUT /api/v1/llm-config` + `POST /api/v1/llm-config/test` — LLM 设置

MSW 配置 `onUnhandledRequest: 'bypass'`，未匹配的请求透传到 Vite proxy → 真实后端。

**新增 API 端点时**：
- 如果是 Agent 管理相关（尚无后端），在 `handlers.ts` 中注册 MSW handler
- 如果是项目/需求/LLM 等（已有后端），直接调用真实 API，**不要**添加 MSW handler

### 路由结构

```
/                       → 重定向到 /projects
/projects               → ProjectListPage（含 AppShell）
/projects/:id           → ProjectDetailPage（含 AppShell）
/agents                 → AgentListPage（含 AppShell）
/agents/:id             → AgentDetailPage（含 AppShell）
/agents/new             → 重定向到 /agents（创建走 Modal）
/agents/:id/edit        → EditAgentPage（全屏，不含导航栏）
/commands               → CommandLibraryPage（含 AppShell）
/settings               → LLMSettingsPage（含 AppShell）
```

### 核心领域类型

位置：`src/types/project.ts`、`src/types/agent.ts`、`src/types/llm.ts`

```
Project         — 项目，含 context(四层模型: goal/targetUsers/industry/techStack/archSummary/avoid/rules/domainModel/lessons)
Requirement     — 需求，含 pipeline(PipelineStep[]) + stories(Story[])
PipelineStep    — 流水线步骤，含 agentName + status(queued/running/done/blocked/pending_approval/pending_advisory_approval)
Story           — 子 Story，含独立 pipeline
AgentRole       — 'analyst'|'pm'|'ux'|'architect'|'sm'|'dev'|'qa'|'quickdev'|'techwriter'
Agent           — Agent 模板，含 promptBlocks(4块结构)
Command         — BMAD 命令，含 code/phase/isProtected
LLMConfig       — provider('github'|'anthropic') + model + authType
```

---

## 样式系统（关键）

### CSS 变量设计令牌

- **绝对不要**写死颜色值（如 `#007AFF`、`rgba(0,0,0,0.5)`）
- **始终**使用 CSS 变量：`var(--token-name)`
- 常用令牌：
  ```
  背景：  --bg-base  --bg-panel  --bg-panel-2  --bg-panel-3  --bg-hover
  文字：  --text-1  --text-2  --text-3
  边框：  --border  --border-strong
  强调色：--accent  --accent-sub
  语义色：--success --success-sub  --warning --warning-sub  --danger --danger-sub
  阴影：  --shadow-sm  --shadow  --shadow-lg
  玻璃态：--glass-bg  --glass-border
  ```

### 主题

- 支持暗色/亮色主题，通过 `useThemeStore` 切换
- CSS 变量定义在 `src/index.css`，覆盖 `[data-theme="dark"]` 和 `[data-theme="light"]`
- Tailwind v4 通过 `@theme inline` 在 `index.css` 中定义，**不使用** `tailwind.config.js`
- 条件类名**始终**使用 `cn()` 工具函数（`import { cn } from '@/lib/utils'`）

---

## 删除确认 UX（强制规范）

- **禁止**使用 `window.confirm()` 进行删除确认
- **必须**使用应用内 Modal（Radix UI Dialog）
- 参考实现：`ProjectDetailPage.tsx` 中的 `deleteTarget` state + Dialog 模式

---

## 文件与目录命名约定

| 类型 | 命名规则 | 示例 |
|---|---|---|
| React 组件 | PascalCase.tsx | `WorkflowConfigModal.tsx` |
| 页面组件 | PascalCase + Page.tsx | `ProjectDetailPage.tsx` |
| Zustand store | camelCase + Store.ts | `agentWizardStore.ts` |
| React Query hook | camelCase.ts (use 前缀) | `useProjects.ts` |
| 类型定义 | camelCase.ts | `project.ts`, `agent.ts`, `llm.ts` |
| Mock 数据 | camelCase.ts | `projects.ts`, `agents.ts` |
| 工具函数 | camelCase.ts | `utils.ts` |
| 目录名 | kebab-case | `agent-management/`, `project-management/` |
| 后端模块 | snake_case.py | `workflow_engine.py` |
| 后端路由 | snake_case.py (routers/) | `llm_config.py` |

---

## 关键约束（当前阶段）

- **无认证**：所有 API 端点公开，无 JWT/会话管理/RBAC（Phase 2 计划）
- **单租户**：无 Organization/Team 层级，项目为扁平列表（Phase 4 计划）
- **SQLite 单写者**：不支持高并发写入，适合单人/小团队开发阶段
- **Token 追踪占位**：`requirements.token_usage` 字段存在但未填充实际数据
- **无测试框架**：无 Vitest/pytest 配置（Phase 1 计划）
- **无数据库迁移**：使用 `CREATE TABLE IF NOT EXISTS` 初始化（Phase 2 计划 Alembic）

---

## 常用命令

```bash
# 前端
cd frontend
pnpm dev       # 启动开发服务器 :5173
pnpm build     # 类型检查 + 构建
pnpm lint      # ESLint 检查

# 后端
cd backend
uvicorn app.main:app --reload   # 启动 API 服务器 :8000

# 同时启动（两个终端）
# Terminal 1: cd backend && uvicorn app.main:app --reload
# Terminal 2: cd frontend && pnpm dev
```
