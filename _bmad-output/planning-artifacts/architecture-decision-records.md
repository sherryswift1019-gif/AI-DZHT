---
title: "架构决策记录（ADR）— AI-DZHT"
status: "current"
created: "2026-04-16"
updated: "2026-04-16"
---

# 架构决策记录（ADR）

> 记录 AI-DZHT 项目中的关键架构决策、背景和后果。每个 ADR 不可变——修正通过新增 ADR 覆盖旧决策。

---

## ADR-001: SQLite 作为主数据库

**状态**：已采纳（2026-04-14）

**背景**：AI-DZHT 当前阶段为内部工具，单人/小团队开发，优先开发速度和部署简易性。不需要多实例部署或高并发写入。

**决策**：使用 SQLite 作为主数据库，通过 SQLAlchemy Core（非 ORM）访问。复杂字段（pipeline, context, stories）存储为 JSON Text 列。数据库文件位于 `backend/data.db`。

**原因**：
- 零配置，无需安装独立数据库服务
- 单文件部署，便于开发和备份
- SQLAlchemy Core 提供 SQL 表达层，未来迁移到 PostgreSQL 时改动最小

**后果**：
- 不支持并发写入——多个 Commander 同时执行可能触发 `database is locked`
- 无内置迁移机制——schema 变更需手动处理（使用 `CREATE TABLE IF NOT EXISTS`）
- JSON 列无法做高效查询（如按 context.rules.scope 过滤）

**未来演进**：当需要多用户并发或正式部署时，迁移到 PostgreSQL + Alembic。SQLAlchemy Core 层的 SQL 表达式可直接复用。

---

## ADR-002: 无认证无授权

**状态**：已采纳（2026-04-14）

**背景**：PRD 定义了四角色 RBAC（组织管理员/平台管理员/项目负责人/研发成员）和多租户模型。但当前为单人开发阶段，认证系统的开发成本高于收益。

**决策**：所有 API 端点公开访问，无 JWT/会话管理/中间件。不存在用户模型或角色校验。

**原因**：
- 当前仅 localhost 开发使用，无外部暴露
- 认证/RBAC 是横切关注点，晚期添加比早期添加更高效（一次性全覆盖）
- 优先实现核心业务逻辑（Commander 引擎、上下文系统）

**后果**：
- 任何人可访问所有端点（创建/删除项目、修改 LLM 配置、批准审批）
- 无法区分操作者身份，审计日志无意义
- 不能对外部署

**未来演进**：Phase 2 添加认证（JWT + 用户模型），Phase 4 实现完整 RBAC + 多租户。API 路由层加 `Depends(current_user)` 中间件。

---

## ADR-003: 多 Provider LLM 抽象

**状态**：已采纳（2026-04-15）

**背景**：团队需要在 Anthropic Claude 和 OpenAI/GitHub Models 之间灵活切换——成本、可用性、能力各有差异。

**决策**：在 `llm.py` 中实现 Provider 无关的统一接口：
- `_chat(messages, ...)` — 普通聊天补全
- `_stream_chat(messages, ...)` — 流式聊天
- `chat_with_tools(messages, tools, ...)` — 工具调用（Commander 使用）

配置存储在数据库 `llm_config` 表（singleton），运行时通过 `_load_config()` 读取 provider/model/token。

**原因**：
- GitHub Models 免费额度适合开发/测试
- Anthropic Claude 在复杂推理和中文表现更优
- 运行时切换避免了重新部署

**后果**：
- 每个 LLM 函数需要维护两套 Provider 实现（格式转换、错误处理）
- Tool calling 格式不同（OpenAI `tool_calls` vs Anthropic `tool_use` blocks），需要双向适配
- 全平台共用一个配置——不支持按项目/Agent 选择不同模型

**已知问题**：`_chat_with_tools_anthropic` 直接创建 `AsyncAnthropic(api_key=...)` 而非使用 `_make_anthropic_client(cfg)`，OAuth token 模式可能失败。需修复以保持一致性。

---

## ADR-004: Commander 基于 Tool Calling 的引擎

**状态**：已采纳（2026-04-15）

**背景**：需求执行需要按流水线顺序调度多个 Worker Agent，并在关键节点暂停等待人工审批。最初考虑过有限状态机和规则引擎，最终选择 LLM + function calling。

**决策**：Commander 是一个维持多轮对话的 LLM，通过 5 个工具函数驱动流水线：
1. `invoke_agent(step_id)` — 执行 Worker
2. `request_approval(step_id, summary)` — 强制审批暂停
3. `request_advisory_approval(step_id, concern)` — 建议性审批
4. `complete_pipeline()` — 标记完成
5. `block_pipeline(reason)` — 标记阻塞

对话历史在审批暂停时持久化到 `commander_state` 表，批准后从断点恢复。

**原因**：
- LLM 天然理解流水线语义（"先做需求分析，再做设计"），无需硬编码状态转换
- Function calling 提供结构化输出，避免正则解析 LLM 文本
- 暂停/恢复通过保存对话历史实现，无需复杂的状态机持久化

**后果**：
- 对话历史无上限增长——长流水线可能超出 context window
- LLM 调用成本：每个决策点（选择下一个工具）都消耗 token
- 错误恢复有限——异常直接标记 blocked，无重试机制
- Commander 的决策不确定——相同输入可能产生不同的工具调用顺序

**缓解措施**：
- 并发锁（`_pipeline_locks`）防止同一需求重复执行
- 错误兜底（`_mark_current_running_step_blocked`）确保不会静默失败

---

## ADR-005: MSW Mock 与真实后端共存

**状态**：已采纳（2026-04-14）→ 部分迁移中

**背景**：项目前端先行开发，Agent 管理 UI 在后端 API 就绪前使用 MSW mock 数据。随着后端逐步完善，需要混合模式。

**决策**：
- **真实后端**（通过 Vite proxy → FastAPI :8000）：项目、需求、LLM 配置、工作流、步骤、产出物
- **MSW Mock**（仅 dev 模式）：Agent 列表/详情、BMAD 命令库
- MSW 配置 `onUnhandledRequest: 'bypass'`，未匹配请求透传到真实后端

**原因**：
- Agent 管理后端尚未实现，前端 UI 需要数据驱动开发
- 项目/需求等核心功能已有真实后端，mock 反而会掩盖真实问题
- 用户明确拒绝全 mock 方案（"我需要真实的对接"）

**后果**：
- 开发时需要同时启动前端和后端
- MSW handler 和 Vite proxy 可能存在路径冲突（同一端点两边都注册）
- 从 mock 迁移到真实 API 需要逐个替换 handler

**未来演进**：Phase 1 实现 Agent 管理后端后，移除所有 MSW mock，改为纯真实 API。

---

## ADR-006: 上下文注入简化模式

**状态**：已采纳（2026-04-15），计划 Phase 1 升级

**背景**：设计文档（`design-context-accumulation.md`）定义了精确的注入矩阵——不同 Agent 看到不同字段（如 Mary 不看 techStack）。实现时选择了简化方案。

**决策**：当前实现中：
- `rules` 和 `lessons` **按 Agent scope 过滤**（与设计文档一致）
- `techStack`、`archSummary`、`avoid`、`domainModel` **全量注入所有 Agent**（偏离设计文档）

**原因**：
- 简化首次实现，确保所有 Agent 至少能看到完整上下文
- scope 过滤 rules/lessons 已验证可行，后续扩展到其他字段工程量小
- 当前 token 预算充足（~300-500 token），全量注入不会造成问题

**后果**：
- PM 类 Agent（Mary/John/Bob）会看到不需要的 techStack 信息
- 轻微 token 浪费
- 与设计文档不一致，可能导致新开发者困惑

**未来演进**：Phase 1 对齐设计文档的注入矩阵，在 `assemble_context()` 中按 Agent 角色条件注入 techStack/arch/avoid/domain 字段。

---

*v1.0 — 2026-04-16*
