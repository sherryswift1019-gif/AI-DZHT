---
title: "实现状态矩阵 — AI-DZHT"
status: "current"
created: "2026-04-16"
updated: "2026-04-16"
---

# 实现状态矩阵

> 映射 PRD 功能需求、产品简报承诺与代码实现状态。

---

## 一、产品简报核心承诺

| 承诺 | 来源 | 状态 | 代码位置 |
|---|---|---|---|
| 指挥官 Agent 调度各阶段 | 产品简报 MVP | ✅ 已实现 | `workflow_engine.py` |
| 关键节点人工审批可配置 | 产品简报 MVP | ✅ 已实现 | `requirements.py:approve-step/dismiss-advisory` |
| Agent 状态可追踪 | 产品简报 MVP | ✅ 已实现 | `ProjectDetailPage.tsx` 流水线可视化 |
| Token 消耗可追踪 | 产品简报 MVP | ⚠️ 占位 | `models.py:tokenUsage` 字段存在但始终 NULL |
| 输出在大盘可追踪 | 产品简报 MVP | ❌ 未实现 | 无 Dashboard 页面 |
| GitHub/GitLab 集成 | 产品简报 MVP | ❌ 未实现 | 计划 Phase 3 |
| Jenkins + K8s 部署 | 产品简报 MVP | ❌ 未实现 | 计划 Phase 3 |
| 钉钉通知 | 产品简报 MVP | ❌ 未实现 | 计划 Phase 3 |
| 知识积累（Path B） | 设计文档 | ✅ 后端完成 | `storage.py:pending_suggestions` + `projects.py:confirm/reject` |
| 知识积累（Path A） | 设计文档 | ❌ 未实现 | 人工修改触发弹窗未开发 |
| 多 Provider LLM | ADR-003 | ✅ 已实现 | `llm.py:_chat/_stream_chat/chat_with_tools` |

---

## 二、PRD Agent 管理功能（prd-agent-management.md）

### Phase 1 MVP 功能

| ID | 功能 | 状态 | 说明 |
|---|---|---|---|
| F01 | 命令库基础管理 | ✅ 仅 Mock | 前端 `CommandLibraryPage.tsx` + MSW mock |
| F03 | 能力按研发阶段分组 | ✅ 仅 Mock | mock 数据按 phase 分组 |
| F04 | 三步创建向导 | ✅ 仅 Mock | `wizard/Step1/Step2/Step3` 组件完整 |
| F05 | AI 生成提示词草稿 | ✅ 仅 Mock | 前端调用 mock handler |
| F22 | 项目上下文配置 | ✅ 已实现 | `ProjectSettingsModal.tsx` + 真实后端 |
| F10 | 内置 Agent 保护 | ✅ 仅 Mock | mock 数据 `isProtected: true` |

### Phase 2 功能

| ID | 功能 | 状态 |
|---|---|---|
| F12 | 能力反查 | ❌ 未实现 |
| F13 | 重复警告 | ❌ 未实现 |
| F17 | 停用依赖扫描 | ❌ 未实现 |
| F18 | 运行中锁定（完整版） | ❌ 未实现 |
| F21 | 历史版本快照 | ❌ 未实现 |

### Phase 3-4 功能

| ID | 功能 | 状态 |
|---|---|---|
| F02 | 命令库扩展 | ❌ 未实现 |
| F06 | 三级共享范围 | ❌ 未实现 |
| F07 | 跨团队模板市场 | ❌ 未实现 |
| F08 | 创建时实时预览 | ❌ 未实现 |
| F23 | 共享申请流程 | ❌ 未实现 |
| F25 | 会话回放 | ❌ 未实现 |

---

## 三、上下文体系（design-context-accumulation.md）

| 功能 | 状态 | 代码位置 |
|---|---|---|
| ProjectContext 四层数据模型（Python） | ✅ 已实现 | `models.py:ProjectContext` |
| ProjectContext 四层数据模型（TypeScript） | ✅ 已实现 | `types/project.ts` |
| AGENT_SCOPE_MAP + assemble_context() | ✅ 已实现 | `context.py` |
| Worker Agent 接入 assemble_context | ✅ 已实现 | `workflow_engine.py:_execute_worker` |
| ProjectSettingsModal 新字段 UI | ✅ 已实现 | `ProjectSettingsModal.tsx` |
| AI 生成上下文接口 | ✅ 已实现 | `llm.py:generate_context` |
| Rules/Lessons 按 scope 过滤 | ✅ 已实现 | `context.py:33-43` |
| techStack/arch/avoid 按角色过滤 | ❌ 未实现 | ADR-006，Phase 1 计划 |
| Path A 教训捕获弹窗 | ❌ 未实现 | Phase 1 计划 |
| Path B Agent 建议（后端） | ✅ 已实现 | `storage.py:pending_suggestions` |
| Path B Agent 建议（前端 UI） | ❌ 未实现 | Phase 1 计划 |

---

## 四、非功能需求

| 需求 | 来源 | 状态 |
|---|---|---|
| 认证/JWT | PRD NFR-S01 | ❌ 未实现（Phase 2） |
| RBAC 四角色 | PRD NFR-S02 | ❌ 未实现（Phase 4） |
| 多租户隔离 | PRD NFR-S03 | ❌ 未实现（Phase 4） |
| 数据库迁移 | 最佳实践 | ❌ 未实现（Phase 2） |
| 测试框架 | 最佳实践 | ❌ 未实现（Phase 1） |
| 结构化日志 | 最佳实践 | ❌ 未实现 |
| CI/CD | 最佳实践 | ❌ 未实现（Phase 3） |

---

*v1.0 — 2026-04-16*
