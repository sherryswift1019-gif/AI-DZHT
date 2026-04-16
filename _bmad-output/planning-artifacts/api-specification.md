---
title: "API 规格文档 — AI-DZHT"
status: "current"
created: "2026-04-16"
updated: "2026-04-16"
aligned_with: "代码实现 (2026-04-16)"
---

# AI-DZHT API 规格文档

> 基础路径：`http://localhost:8000`
> 前端通过 Vite proxy (`/api/v1/*`) 转发到后端。
> 无认证——所有端点公开访问。

---

## 一、健康检查

### `GET /health`
**响应**：`200` `{ "status": "ok" }`

---

## 二、项目管理

### `GET /api/v1/projects`
列出所有项目（按创建时间排序）。

**响应**：`200` `ProjectOut[]`

### `POST /api/v1/projects`
创建项目。自动生成 id（`proj-{timestamp}`）和 code（`PRJ-{initials}`）。

**请求体**：`ProjectCreateRequest`
```json
{
  "name": "智能交付工厂",           // 必填
  "description": "...",             // 可选
  "ownerId": "u1",                  // 必填
  "memberIds": ["u1", "u2"],        // 可选，owner 自动加入
  "status": "planning",             // 默认 "planning"
  "color": "#0A84FF",               // 默认 "#0A84FF"
  "context": { ... },               // ProjectContext，默认空
  "settings": { ... },              // ProjectSettings，可选
  "startDate": "2026-01-10",        // 可选
  "endDate": "2026-05-31",          // 可选
  "budget": 1240                    // 可选
}
```
**响应**：`201` `ProjectOut`

### `GET /api/v1/projects/{project_id}`
**响应**：`200` `ProjectOut` | `404`

### `PATCH /api/v1/projects/{project_id}`
部分更新项目。所有字段可选。

**请求体**：`ProjectPatchRequest`（任意 ProjectOut 字段的子集）
**响应**：`200` `ProjectOut` | `404`

### `DELETE /api/v1/projects/{project_id}`
删除项目。级联删除关联需求 + 序号。
**响应**：`204` | `404`

---

## 三、AI 生成上下文

### `POST /api/v1/projects/generate-context`
根据项目名称/描述，AI 生成四层上下文。

**请求体**：`GenerateContextRequest`
```json
{
  "name": "智能交付工厂",           // 必填
  "description": "...",             // 可选
  "repository": "https://...",      // 可选
  "existingContext": { ... }        // 可选，已有上下文
}
```
**响应**：`200` `GenerateContextResponse`
```json
{
  "goal": "AI 驱动的研发流水线编排平台",
  "targetUsers": "B 端 PM 和研发负责人",
  "industry": "SaaS / 企业软件",
  "techStack": [{ "name": "React", "version": "19", "notes": "..." }],
  "archSummary": "SPA → REST /api/v1/* → SQLite",
  "avoid": [{ "item": "window.confirm()", "useInstead": "Radix UI Dialog", "reason": "..." }],
  "rules": [{ "scope": "dev", "text": "...", "source": "human" }]
}
```

---

## 四、上下文建议（Path B）

### `GET /api/v1/projects/{project_id}/pending-suggestions`
列出待确认的 Agent 上下文建议。

**响应**：`200`
```json
[{
  "id": "uuid",
  "projectId": "proj-1",
  "reqId": "req-1",
  "stepId": "s4",
  "agentName": "Winston",
  "suggestion": { "type": "rule", "scope": "architect", "text": "..." },
  "createdAt": 1713200000
}]
```

### `POST /api/v1/projects/{project_id}/pending-suggestions/{suggestion_id}/confirm`
确认建议。写入 `project.context`（rule 或 lesson），source 升级为 `'human'`。

**请求体**：`ConfirmSuggestionRequest`
```json
{ "promoteToRule": false }
```
**响应**：`200` `{ "status": "confirmed" }` | `404`

### `POST /api/v1/projects/{project_id}/pending-suggestions/{suggestion_id}/reject`
拒绝建议。删除记录。

**响应**：`200` `{ "status": "rejected" }` | `404`

---

## 五、需求管理

### `GET /api/v1/projects/{project_id}/requirements`
列出项目需求（按创建时间排序）。
**响应**：`200` `RequirementOut[]` | `404`（项目不存在）

### `POST /api/v1/projects/{project_id}/requirements`
创建需求。自动生成 id（`req-{timestamp}`）和 code（`REQ-{seq}`）。

**请求体**：`RequirementCreateRequest`
```json
{
  "title": "需求创建后可配置流水线",  // 必填
  "summary": "...",                  // 可选
  "priority": "P0",                  // 默认 "P1"
  "assigneeId": "u2",               // 必填
  "pipeline": [                      // PipelineStepModel[]
    {
      "id": "s1",
      "name": "商业分析",
      "agentName": "Mary",
      "role": "战略商业分析师",
      "commands": "BP→CB→DP",
      "status": "queued",
      "requiresApproval": false
    }
  ]
}
```
**响应**：`201` `RequirementOut` | `404`

### `GET /api/v1/projects/{project_id}/requirements/{req_id}`
**响应**：`200` `RequirementOut` | `404`

### `PATCH /api/v1/projects/{project_id}/requirements/{req_id}`
更新需求。**当 `status` 设为 `"running"` 时，触发 Commander 后台任务。**

**请求体**：`RequirementPatchRequest`（任意字段可选）
**响应**：`200` `RequirementOut` | `404`

### `DELETE /api/v1/projects/{project_id}/requirements/{req_id}`
**响应**：`204` | `404`

---

## 六、审批流

### `POST /api/v1/projects/{pid}/requirements/{rid}/approve-step/{step_id}`
批准强制审批或建议性审批。恢复 Commander 继续执行。

**前置条件**：步骤 status 为 `pending_approval` 或 `pending_advisory_approval`
**响应**：`200` `RequirementOut` | `400`（步骤非等待审批状态）| `404`

### `POST /api/v1/projects/{pid}/requirements/{rid}/dismiss-advisory/{step_id}`
驳回建议性审批。可选录入教训（Path A 沉淀）。

**前置条件**：步骤 status 为 `pending_advisory_approval`
**请求体**：`DismissAdvisoryRequest`
```json
{
  "lessonTitle": "状态机转换要加原子锁",    // 可选
  "correctApproach": "用数据库事务包裹",     // 可选
  "background": "并发请求导致状态不一致",    // 可选
  "scope": "dev",                            // 可选 RuleScope
  "promoteToRule": false                     // 是否固化为规则
}
```
**响应**：`200` `RequirementOut` | `400` | `404`

---

## 七、工作流与步骤

### `POST /api/v1/workflow/suggest`
根据需求标题/描述 + 项目上下文，AI 推荐工作流模板。

**请求体**：`WorkflowSuggestRequest`
```json
{
  "projectContext": { ... },     // ProjectContext
  "reqTitle": "需求标题",
  "reqSummary": "需求描述"
}
```
**响应**：`200` `WorkflowSuggestResponse`
```json
{
  "recommendedTemplateId": "full",
  "reasoning": "该需求涉及...",
  "suggestedAgentRoles": ["analyst", "pm", "ux", "architect", "sm", "dev", "qa"],
  "confidence": "high",
  "warnings": []
}
```

### `POST /api/v1/steps/detail`
获取步骤执行详情。响应内容根据步骤 status 不同而变化。

**请求体**：`StepDetailRequest`
```json
{
  "agentName": "Mary",
  "agentRole": "战略商业分析师",
  "stepName": "商业分析",
  "status": "done",              // queued | running | done | blocked
  "commands": "BP→CB→DP",
  "reqTitle": "需求标题",
  "reqSummary": "需求描述"
}
```
**响应**：`200` `StepDetailResponse`

### `GET /api/v1/steps/stream`
SSE 流式步骤日志。

**查询参数**：`agentName`, `agentRole`, `stepName`, `commands`, `reqTitle`, `reqSummary`
**响应**：`text/event-stream`
```
data: {"time": "14:30", "text": "[init] 正在初始化分析环境..."}
data: {"time": "14:30", "text": "[tool:search] 检索相关市场数据..."}
...
data: [DONE]
```

### `POST /api/v1/artifacts/content`
获取产出物内容。优先从 DB（artifacts 表）查询，未找到则调用 LLM 生成。

**请求体**：`ArtifactContentRequest`
```json
{
  "agentName": "Mary",
  "agentRole": "战略商业分析师",
  "artifactName": "商业分析报告",
  "artifactType": "document",
  "stepName": "商业分析",
  "reqTitle": "需求标题",
  "reqSummary": "需求描述",
  "reqId": "req-1",              // 可选，有则查 DB
  "stepId": "s1"                 // 可选
}
```
**响应**：`200` `{ "content": "...", "format": "markdown" | "code" }`

---

## 八、LLM 配置

### `GET /api/v1/llm-config/models`
Provider 和模型目录。

**响应**：`200` `LLMProviderInfo[]`
```json
[{
  "id": "github",
  "name": "GitHub Models (OpenAI)",
  "authType": "api_key",
  "authLabel": "GitHub Token",
  "authHint": "使用 GitHub Personal Access Token",
  "defaultBaseUrl": "https://models.inference.ai.azure.com",
  "models": [
    { "id": "gpt-4o", "name": "GPT-4o", "description": "..." },
    { "id": "gpt-4o-mini", "name": "GPT-4o Mini", "description": "..." }
  ]
}, {
  "id": "anthropic",
  "name": "Anthropic Claude",
  "authType": "oauth_token",
  "models": [
    { "id": "claude-opus-4-6", "name": "Claude Opus 4.6", "description": "..." },
    { "id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6", "description": "..." },
    { "id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5", "description": "..." }
  ]
}]
```

### `GET /api/v1/llm-config`
获取当前配置。
**响应**：`200` `LLMConfigOut`
```json
{
  "provider": "github",
  "model": "gpt-4o",
  "authType": "api_key",
  "hasToken": true,
  "baseUrl": "https://models.inference.ai.azure.com"
}
```

### `PUT /api/v1/llm-config`
更新配置。

**请求体**：`LLMConfigUpdateRequest`
```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-6",
  "authType": "oauth_token",     // 可选
  "token": "sk-ant-...",         // 可选，不传则保留旧值
  "baseUrl": null                // 可选
}
```
**响应**：`200` `LLMConfigOut`

### `POST /api/v1/llm-config/test`
测试 LLM 连接。

**请求体**：`LLMConfigUpdateRequest`（同上）
**响应**：`200` `LLMTestResponse`
```json
{
  "success": true,
  "message": "连接成功 — claude-sonnet-4-6",
  "model": "claude-sonnet-4-6"
}
```

---

## 九、核心数据类型速查

### ProjectContext（四层上下文）
```typescript
{
  goal: string                // 项目目标
  targetUsers: string         // 目标用户
  industry: string            // 行业
  techStack: TechItem[]       // [{name, version?, notes?}]
  archSummary: string         // 架构摘要
  avoid: AvoidItem[]          // [{item, reason?, useInstead?}]
  rules: Rule[]               // [{scope, text, source, lessonId?}]
  domainModel: string         // Arrow Notation 领域模型
  lessons: ContextLesson[]    // [{id, date, title, background, correctApproach, promotedToRule, scope?}]
}
```

### PipelineStepModel
```typescript
{
  id: string                   // 步骤 ID
  name: string                 // "商业分析"
  agentName: string            // "Mary"
  role?: string                // "战略商业分析师"
  commands?: string            // "BP→CB→DP"
  status: string               // queued | running | done | blocked | pending_approval | pending_advisory_approval
  updatedAt: string            // "14:30" | "--:--"
  requiresApproval?: boolean   // 是否强制审批
  advisoryConcern?: string     // 建议性审批的顾虑说明
}
```

---

*v1.0 — 2026-04-16*
