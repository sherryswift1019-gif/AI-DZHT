---
title: "开发路线图 — AI-DZHT"
status: "current"
created: "2026-04-16"
updated: "2026-04-16"
note: "统一所有文档的分期定义，以代码实现为基准"
---

# AI-DZHT 开发路线图

> 本文档是唯一权威的分期路线图。产品简报、PRD、设计文档中的分期描述若与本文档冲突，以本文档为准。

---

## Phase 0 — 当前已完成

> 核心流水线引擎 + 前端交互框架

### 后端（FastAPI + SQLite）

| 功能 | 状态 | 代码位置 |
|---|---|---|
| 项目 CRUD（创建/读取/更新/删除，级联删除） | ✅ 完成 | `routers/projects.py` |
| 需求 CRUD + 自动编号（REQ-XXX） | ✅ 完成 | `routers/requirements.py` |
| Commander 工作流引擎（tool calling + 审批暂停/恢复） | ✅ 完成 | `workflow_engine.py` |
| Worker Agent 执行 + 产出物持久化 | ✅ 完成 | `workflow_engine.py` + `storage.py` |
| 多 Provider LLM 抽象（Anthropic + OpenAI/GitHub Models） | ✅ 完成 | `llm.py` |
| 上下文注入系统（scope 过滤 rules/lessons） | ✅ 完成 | `context.py` |
| AI 生成项目上下文（四层模型） | ✅ 完成 | `llm.py:generate_context` |
| 工作流模板推荐（AI 建议） | ✅ 完成 | `llm.py:suggest_workflow` |
| 步骤详情/日志流（SSE） | ✅ 完成 | `main.py` + `llm.py` |
| 产出物内容获取（DB 优先 + LLM 生成兜底） | ✅ 完成 | `main.py:artifact_content` |
| LLM 配置管理 + 连接测试 | ✅ 完成 | `routers/llm_config.py` |
| Path B 上下文建议（Agent → pending_suggestions → 确认/拒绝） | ✅ 完成 | `workflow_engine.py` + `routers/projects.py` |
| 审批流（强制审批 + 建议性审批 + 教训录入） | ✅ 完成 | `routers/requirements.py` |
| 数据库 7 张表 + 种子数据 | ✅ 完成 | `database.py` |

### 前端（React + Vite + TanStack Query）

| 功能 | 状态 | 代码位置 |
|---|---|---|
| 项目列表/详情页 | ✅ 完成 | `pages/project-management/` |
| 需求管理（CRUD + 流水线可视化） | ✅ 完成 | `ProjectDetailPage.tsx` |
| 审批 UI（pending_approval + pending_advisory_approval） | ✅ 完成 | `ProjectDetailPage.tsx` |
| 工作流配置弹窗（模板选择 + 自定义） | ✅ 完成 | `WorkflowConfigModal.tsx` |
| 项目设置弹窗（上下文编辑 + AI 生成） | ✅ 完成 | `ProjectSettingsModal.tsx` |
| Agent 列表/详情/创建向导/编辑 | ✅ 完成（**MSW mock**） | `pages/agent-management/` |
| BMAD 命令库 | ✅ 完成（**MSW mock**） | `pages/commands/` |
| LLM 设置页 | ✅ 完成 | `pages/settings/` |
| 暗色/亮色主题切换 | ✅ 完成 | `themeStore.ts` + `index.css` |
| 6 个 React Query hooks 对接真实后端 | ✅ 完成 | `hooks/` |

### 未完成

| 缺失项 | 影响 |
|---|---|
| 认证/授权 | 所有 API 公开 |
| Token 用量追踪 | tokenUsage 字段为 NULL |
| Agent 管理后端 | 前端仅 MSW mock |
| 上下文注入矩阵完整对齐 | techStack 等全量注入（设计目标按角色） |
| Path A 教训捕获 UI | 人工修改触发弹窗未实现 |
| Path B 建议 UI | 前端无待确认列表 |
| 测试框架 | 零测试 |
| 数据库迁移 | 无 Alembic |
| 外部集成 | 无 GitHub/Jenkins/钉钉 |
| 可观测大盘 | 无 Dashboard 页面 |

---

## Phase 1 — 基础补全

> 消除 mock，补齐核心功能闭环

| 优先级 | 功能 | 说明 |
|---|---|---|
| P0 | Agent 管理后端 | CRUD API + DB 持久化，替换 MSW mock |
| P0 | 上下文注入矩阵对齐 | `assemble_context()` 按 Agent 角色过滤 techStack/arch/avoid/domain |
| P0 | Path B 建议 UI | 前端展示待确认上下文建议列表，支持确认/拒绝 |
| P1 | Path A 教训捕获 | 人工修改 Agent 输出时弹出教训录入弹窗 |
| P1 | Token 用量追踪 | LLM 调用时记录实际 token 消耗并回写需求 |
| P1 | 基础测试框架 | Vitest（前端）+ pytest（后端）+ 关键路径测试用例 |
| P2 | Commander 对话压缩 | 长流水线消息摘要/截断，防止超出 context window |
| P2 | `_chat_with_tools_anthropic` 修复 | 使用 `_make_anthropic_client(cfg)` 统一客户端创建 |

---

## Phase 2 — 平台成熟

> 多人使用基础 + 可观测性

| 功能 | 说明 |
|---|---|
| 认证 + 用户模型 | JWT 登录；用户表 + 密码/OAuth |
| 基础 RBAC | 项目负责人 vs 研发成员；按项目隔离 |
| Agent 版本管理 | 修改自动创建快照；版本对比 |
| 可观测大盘页面 | Agent 状态、Token 消耗、需求进度一屏可见 |
| 数据库迁移框架 | Alembic 集成，schema 变更版本化 |
| 运行中锁定 | Agent 有活跃实例时禁止编辑 |

---

## Phase 3 — 外部集成

> 连接研发工具链

| 功能 | 说明 |
|---|---|
| GitHub/GitLab 集成 | Commit 触发、PR 联动、代码产出自动提交 |
| CI/CD 集成 | Jenkins / GitHub Actions 触发构建部署 |
| 通知系统 | 钉钉/Slack webhook，审批提醒、状态更新推送 |
| SSE/WebSocket 实时更新 | 替换 5 秒轮询 |

---

## Phase 4 — 企业级

> SaaS 化基础

| 功能 | 说明 |
|---|---|
| 多租户 | Organization → Team → Project 层级；tenant_id 隔离 |
| 完整 RBAC | 四角色（组织管理员/平台管理员/项目负责人/研发成员） |
| Agent 市场 / 跨团队共享 | 发布、申请、Fork + 独立版本 |
| 高级分析 | Agent 效能分析、需求交付时间统计、ROI 度量 |
| 迁移 PostgreSQL | 高并发写入支持 |

---

## 里程碑依赖关系

```
Phase 0（已完成）
    │
    ├── Phase 1（无外部依赖，可立即开始）
    │     │
    │     └── Phase 2（依赖 Phase 1 的 Agent 后端 + 测试框架）
    │           │
    │           ├── Phase 3（依赖 Phase 2 的认证系统）
    │           │
    │           └── Phase 4（依赖 Phase 2 的 RBAC + Phase 3 的外部集成）
    │
    └── 文档对齐（当前，与 Phase 1 并行）
```

---

*v1.0 — 2026-04-16*
