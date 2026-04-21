# 审批标准化设计 — 统一审批模型 + 多渠道对接

## Context

AI-DZHT 流水线中有三种审批机制：强制审批（mandatory）、建议性审批（advisory）、命令级暂停（step_pause）。三者的数据结构、UI 交互、操作选项、知识沉淀能力各不相同，导致用户体验割裂，也无法对接钉钉等外部渠道。

本设计将三种审批统一为标准化模型，解决以下问题：

1. **信息不自包含** — 审批卡片缺少决策上下文（做了什么、影响什么、关注什么）
2. **操作不对称** — 强制审批只能批准不能打回，批准无留痕
3. **无主动通知** — 用户不在页面就不知道有审批，响应延迟大
4. **无法外接** — 没有事件总线，钉钉/飞书等渠道无法接入

### 设计原则

1. **审批请求自包含** — 一条审批消息包含足够信息，任何渠道都能独立渲染和操作
2. **渠道无关** — 后端只产出结构化 `ApprovalPayload`，Web/钉钉/飞书各自映射
3. **渐进增强** — 默认一行可决策，展开看详情；简单审批秒过，复杂审批有深度
4. **向前兼容** — 新增字段全部 Optional + default，老数据不受影响
5. **命令暂停保持独立** — step_pause 仅做 UI 风格对齐，不改后端模型（执行层级和状态机制完全不同）

---

## 现状分析

### 三种审批机制对比

| 维度 | 强制审批 (mandatory) | 建议性审批 (advisory) | 命令级暂停 (step_pause) |
|------|---------------------|----------------------|------------------------|
| 触发位置 | `workflow_engine.py:499` | `workflow_engine.py:532` | `llm.py:1862` |
| 状态码 | `pending_approval` | `pending_advisory_approval` | 无（内存 Event） |
| 展示信息 | agent + 产出物列表 + 一句话 | 一个 concern 字段 | "XX 已完成，确认后继续 YY" |
| 用户操作 | 只能"批准" | "批准"或"无需审批" | 输入框手动输入 |
| 拒绝能力 | 无 | 仅 dismiss（非真正拒绝） | 无 |
| 备注/留痕 | 无 | dismiss 时可录教训 | 可输入反馈 |
| 知识沉淀 | 不支持 | 支持 lesson + rule | 不支持 |
| API 端点 | `approve-step/{step_id}` | `dismiss-advisory/{step_id}` | `continue-step/{step_id}` |

### 核心问题

1. **发现审批靠轮询** — 3 秒轮询 + 无浏览器通知，用户离开页面就不知道
2. **批准零信息** — `approve_step` POST body 为空，无 comment，审计链断裂
3. **强制审批无拒绝路径** — 不满意只能中止整个流水线
4. **trustLevel 不可见** — Worker 内部审查结论（verified/reviewed/needs_review）未展示在审批卡片
5. **review_findings 被清理** — `llm.py:2055-2059` 清理了 `_validation_issues`，审批时已丢失

---

## 数据模型设计

### ApprovalPayload — 审批请求（后端产出，渠道消费）

```python
class ApprovalPayload(BaseModel):
    """一条审批请求的完整信息，任何渠道都能独立渲染"""

    # ── 身份标识 ──
    approval_id: str                          # 全局唯一 ID，用于幂等
    project_id: str
    project_name: str                         # "AI-DZHT"
    requirement_id: str
    requirement_title: str                    # "用户登录模块"
    step_id: str
    step_name: str                            # "架构设计"
    agent_name: str                           # "Winston"

    # ── 审批类型 ──
    approval_type: Literal["mandatory", "advisory"]

    # ── 做了什么（一看就懂） ──
    summary: str                              # 一句话摘要，如"完成系统架构设计，产出架构文档和技术选型"
    artifacts_summary: list[str]              # ["architecture.md: 微服务架构方案", "tech-stack.md: 技术选型"]
    duration_seconds: int | None = None       # 执行耗时

    # ── 质量信号（内部审查结论） ──
    trust_level: Literal[
        "verified",       # 全部审查通过
        "reviewed",       # 审查通过但有轻微问题
        "needs_review",   # 自动修订失败，需人工审查
    ] = "verified"
    review_brief: str | None = None           # "对抗性审查通过；边界审查发现1个警告"
    review_findings: list[ReviewFinding] = [] # 详细发现（展开时显示）

    # ── 建议审查关注点 ──
    review_focus: list[str] = []              # ["技术选型是否符合团队栈", "降级方案是否需要补充"]
    concern: str | None = None                # advisory 特有的顾虑说明

    # ── 上下文 ──
    next_step_name: str | None = None         # "测试策略 (QA Quinn)"
    pipeline_progress: str | None = None      # "3/7 步完成"

    # ── 操作定义（声明式） ──
    actions: list[ApprovalAction]             # 可用操作列表
    detail_url: str                           # Web 详情页链接
    callback_url: str                         # 审批回调地址

    # ── 时间 ──
    created_at: str                           # ISO 时间戳
    expires_at: str | None = None             # 超时时间（可选）


class ReviewFinding(BaseModel):
    severity: Literal["info", "warning", "error"]
    category: str                             # adversarial / edge-case / structural
    message: str


class ApprovalAction(BaseModel):
    action: Literal["approve", "reject", "dismiss"]
    label: str                                # "批准并继续" / "打回重做" / "跳过"
    style: Literal["primary", "danger", "secondary"]
    requires_comment: bool = False            # 是否必须填写备注
```

### ApprovalDecision — 审批响应（渠道产出，后端消费）

```python
class ApprovalDecision(BaseModel):
    """所有渠道的审批操作统一用这个结构"""
    approval_id: str                          # 关联请求，做幂等校验
    action: Literal["approve", "reject", "dismiss"]
    comment: str | None = None                # 备注（approve 可选，reject 必填）
    operator: str | None = None               # 操作人标识（钉钉 userId / Web 无）

    # 教训沉淀（所有类型都支持，不再限制只有 advisory）
    lesson_title: str | None = None
    correct_approach: str | None = None
    promote_to_rule: bool = False
    scope: str | None = None
```

### 各审批类型的 actions 定义

```python
MANDATORY_ACTIONS = [
    ApprovalAction(action="approve", label="批准并继续", style="primary", requires_comment=False),
    ApprovalAction(action="reject",  label="打回重做",   style="danger",  requires_comment=True),
]

ADVISORY_ACTIONS = [
    ApprovalAction(action="approve", label="批准并继续", style="primary", requires_comment=False),
    ApprovalAction(action="dismiss", label="跳过",       style="secondary", requires_comment=False),
]

# needs_review 时增加警示
NEEDS_REVIEW_ACTIONS = [
    ApprovalAction(action="approve", label="确认并继续", style="primary", requires_comment=True),  # 强制备注
    ApprovalAction(action="reject",  label="打回重做",   style="danger",  requires_comment=True),
]
```

---

## 架构设计

### 审批事件总线

```
Worker 完成
    ↓
workflow_engine._emit_approval(...)
    ↓
┌──────────────────────────────────┐
│  ApprovalPayload (结构化数据)     │
├──────────────────────────────────┤
│  ① write_db()     — 现有逻辑     │  save_commander_event + approval 表
│  ② push_web()     — 新增         │  SSE → 浏览器通知
│  ③ push_dingtalk() — 新增        │  钉钉 webhook → 互动卡片
│  ④ push_*()        — 可扩展      │  飞书 / 企微 / 邮件
└──────────────────────────────────┘
    ↓
用户在任意渠道操作
    ↓
POST /api/v1/approvals/{approval_id}/decision  (统一回调)
    ↓
ApprovalDecision 校验 + 幂等
    ↓
Commander 恢复 / 重试
```

### 关键改造点

#### 1. 后端：保留审查详情（不再清理）

**文件**：`llm.py:2055-2059`

当前清理逻辑在审批触发之前执行，导致 review_findings 丢失。

改造：将审查结论保存到 step 级别字段，不再随 artifact 内部字段清理。

```python
# 审查完成后、清理之前，汇总审查结论到 step 级别
step_review = {
    "trustLevel": _aggregate_trust(artifacts),
    "reviewBrief": _build_review_brief(artifacts),
    "reviewFindings": [
        {"severity": ..., "category": rid, "message": ...}
        for art in artifacts
        for finding in art.get("_review_findings", [])
    ],
}
# 保存到 step（在 _execute_worker 返回前写入）
_update_step(req_id, step_id, extra=step_review)

# 然后正常清理 artifact 内部字段
for art in artifacts:
    art.pop("_cmd_code", None)
    art.pop("_validation_issues", None)
    art.pop("_needs_manual_review", None)
```

#### 2. 后端：统一审批生成函数

**文件**：`workflow_engine.py` — 替代行 499-544 三处散落的审批逻辑

```python
def _build_approval_payload(
    req: dict, step: dict, approval_type: str, concern: str | None = None
) -> ApprovalPayload:
    """从 step 数据构建标准化审批请求"""
    project = get_project(req["projectId"])
    artifacts = step.get("artifacts", [])
    pipeline = req["pipeline"]
    done_count = sum(1 for s in pipeline if s["status"] == "done")
    step_idx = next((i for i, s in enumerate(pipeline) if s["id"] == step["id"]), 0)
    next_step = pipeline[step_idx + 1] if step_idx + 1 < len(pipeline) else None

    # trust_level 和 findings 来自 step 级别（阶段 2 审查后保存）
    trust = step.get("trustLevel", "verified")
    actions = NEEDS_REVIEW_ACTIONS if trust == "needs_review" else (
        ADVISORY_ACTIONS if approval_type == "advisory" else MANDATORY_ACTIONS
    )

    return ApprovalPayload(
        approval_id=f"apr-{step['id']}-{int(time.time())}",
        project_id=req["projectId"],
        project_name=project.get("name", ""),
        requirement_id=req["id"],
        requirement_title=req["title"],
        step_id=step["id"],
        step_name=step["name"],
        agent_name=step["agentName"],
        approval_type=approval_type,
        summary=_build_summary(step),
        artifacts_summary=[
            f"{a['name']}: {a.get('summary', '')}" for a in artifacts
        ],
        trust_level=trust,
        review_brief=step.get("reviewBrief"),
        review_findings=step.get("reviewFindings", []),
        review_focus=step.get("reviewFocus", []),
        concern=concern,
        next_step_name=f"{next_step['name']} ({next_step['agentName']})" if next_step else None,
        pipeline_progress=f"{done_count}/{len(pipeline)} 步完成",
        actions=actions,
        detail_url=f"/projects/{req['projectId']}/requirements/{req['id']}?step={step['id']}",
        callback_url=f"/api/v1/approvals/apr-{step['id']}-{int(time.time())}/decision",
        created_at=datetime.now().isoformat(),
    )


def _emit_approval(req_id: str, payload: ApprovalPayload):
    """事件总线：分发审批到各渠道"""
    # ① 写 DB（兼容现有 commander event 机制）
    save_commander_event(
        req_id, "approval_request", "commander", "Commander",
        payload.summary,
        payload.model_dump(),
    )
    # ② 推送到已注册的渠道
    for handler in _approval_handlers:
        try:
            handler(payload)
        except Exception as e:
            logger.warning(f"Approval handler failed: {e}")
```

#### 3. 后端：统一审批回调 API

**新端点**：合并 `approve-step` 和 `dismiss-advisory`

```
POST /api/v1/approvals/{approval_id}/decision
Body: ApprovalDecision
```

```python
@router.post("/approvals/{approval_id}/decision")
def handle_approval_decision(
    approval_id: str,
    body: ApprovalDecision,
    background_tasks: BackgroundTasks,
):
    """统一审批回调 — Web / 钉钉 / 飞书共用"""

    # 幂等校验：同一 approval_id 不重复处理
    if _is_already_decided(approval_id):
        return {"status": "already_decided"}

    # 签名验证（钉钉等外部渠道必须带签名）
    # _verify_signature(request, body)

    # 查找对应的 step
    req, step = _find_step_by_approval(approval_id)

    if body.action == "approve":
        step["status"] = "done"
        tool_content = {
            "approved": True,
            "step_id": step["id"],
            "comment": body.comment,
            "artifacts": step.get("artifacts", []),
        }
    elif body.action == "reject":
        step["status"] = "queued"  # 打回 → 重新排队
        tool_content = {
            "approved": False,
            "step_id": step["id"],
            "rejection_reason": body.comment,  # reject 必填 comment
        }
    elif body.action == "dismiss":
        step["status"] = "done"
        tool_content = {
            "approved": True,
            "advisory_dismissed": True,
            "step_id": step["id"],
            "feedback": body.comment or "",
        }

    # 教训沉淀（所有类型都支持）
    if body.lesson_title and body.correct_approach:
        _save_lesson(req["projectId"], body)

    # 记录审批决定（审计）
    _save_decision_record(approval_id, body)

    save_requirement(req["id"], req)
    background_tasks.add_task(run_commander, req["id"], req["projectId"], tool_content)
    return {"status": "ok"}
```

原有的 `approve-step` 和 `dismiss-advisory` 端点保留但标记 deprecated，内部转发到新 API。

#### 4. Commander 驳回协议

打回能力需要 Commander 知道如何处理 `approved: false`。

在 `_build_commander_system` 中增加协议说明：

```
## 审批驳回处理

当收到 invoke_agent 返回 `approved: false` 时：
1. 读取 `rejection_reason` 理解人工的不满意点
2. 重新调用 invoke_agent 执行同一步骤，将 rejection_reason 作为额外指令传入
3. 同一步骤最多重试 2 次，超过后标记 blocked 并报告给用户
4. 绝不跳过被打回的步骤继续执行下一步
```

---

## 前端改造

### 统一审批卡片（渐进展开）

**默认视图（一行决策）**：

```
┌─────────────────────────────────────────────────────────────┐
│ 🟠 需要审批  Winston · 架构设计  ✅已验证  3/7步  耗时2m34s │
│                                                             │
│  完成系统架构设计，产出架构文档和技术选型方案                    │
│  📎 architecture.md  📎 tech-stack.md                       │
│                                                             │
│  [批准并继续]  [打回重做]  [▾ 展开详情]                       │
└─────────────────────────────────────────────────────────────┘
```

**展开视图（点击"展开详情"后）**：

```
│  ─── 内部审查 ───────────────────────────────────────────── │
│  对抗性审查通过，无安全隐患                                    │
│  ⚠️ 边界用例：高并发场景缺少降级方案                          │
│                                                             │
│  ─── 建议关注 ───────────────────────────────────────────── │
│  • 技术选型是否符合团队栈                                     │
│  • 降级方案是否需要补充                                       │
│                                                             │
│  ─── 批准后 ─────────────────────────────────────────────── │
│  → 测试策略 (QA Quinn)                                      │
│                                                             │
│  [批准并继续]  [打回重做]  [批准 + 备注...]  [▴ 收起]        │
```

### 命令级暂停卡片（仅 UI 对齐）

当前命令暂停没有按钮，用户需在输入框手动输入。改为：

```
┌─────────────────────────────────────────────────────────────┐
│ 🔵 命令确认  Amelia · 「代码生成」已完成                      │
│                                                             │
│  ▸ 下一步：单元测试生成                                       │
│                                                             │
│  [继续执行]  [跳过此命令]  [输入反馈...]                      │
└─────────────────────────────────────────────────────────────┘
```

后端不改，按钮点击后仍调用 `continue-step` API。

### 浏览器通知

审批到达时触发 `Notification API`，用户不在页面也能收到：

```typescript
// 在 useCommanderEvents 中，检测到新的 approval_request 事件时
if (Notification.permission === 'granted') {
  new Notification(`${payload.agent_name} · ${payload.step_name}`, {
    body: payload.summary,
    icon: '/favicon.ico',
    tag: payload.approval_id,  // 同一审批不重复通知
  })
}
```

---

## 钉钉对接方案

### 架构

```
AI-DZHT 后端                        钉钉
─────────────                    ─────────
_emit_approval()
      │
      ├── write_db()
      ├── push_web()
      └── push_dingtalk() ──────→  webhook (互动卡片)
                                       │
                                  用户在钉钉操作
                                       │
POST /api/v1/approvals/{id}/decision ←─┘  (回调)
```

### 钉钉互动卡片模板

```json
{
  "cardTemplateId": "approval_standard",
  "cardData": {
    "title": "{project_name} · {requirement_title}",
    "type_label": "🟠 需要审批",
    "agent_step": "{agent_name} 完成了「{step_name}」",
    "summary": "{summary}",
    "artifacts": "{artifacts_summary 逗号拼接}",
    "trust_badge": "✅ 已验证 | ⚠️ 需审查",
    "progress": "{pipeline_progress}",
    "detail_link": "{detail_url}",
    "actions": [
      {"label": "批准", "action_url": "{callback_url}?action=approve"},
      {"label": "打回", "action_url": "{callback_url}?action=reject"},
      {"label": "查看详情", "url": "{detail_url}"}
    ]
  }
}
```

### 钉钉适配器

```python
# backend/app/integrations/dingtalk.py

class DingTalkApprovalHandler:
    """钉钉审批推送适配器"""

    def __init__(self, webhook_url: str, secret: str):
        self.webhook_url = webhook_url
        self.secret = secret

    def __call__(self, payload: ApprovalPayload):
        card = self._build_card(payload)
        self._send(card)

    def _build_card(self, p: ApprovalPayload) -> dict:
        trust_badge = {
            "verified": "✅ 已验证",
            "reviewed": "⚠️ 已审查",
            "needs_review": "🔴 需人工审查",
        }[p.trust_level]

        return {
            "msgtype": "interactive",
            "interactive": {
                "title": f"{p.project_name} · {p.requirement_title}",
                "markdown": {
                    "text": (
                        f"**{p.agent_name}** 完成了「{p.step_name}」\n\n"
                        f"{p.summary}\n\n"
                        f"产出：{'、'.join(p.artifacts_summary)}\n\n"
                        f"内部审查：{trust_badge}\n\n"
                        f"进度：{p.pipeline_progress}"
                    ),
                },
                "btns": [
                    {"title": a.label, "actionURL": f"{p.callback_url}?action={a.action}"}
                    for a in p.actions
                ] + [
                    {"title": "查看详情", "actionURL": p.detail_url}
                ],
            },
        }
```

### 回调签名验证

```python
def _verify_dingtalk_signature(request: Request):
    """钉钉回调签名验证"""
    timestamp = request.headers.get("timestamp")
    sign = request.headers.get("sign")
    expected = hmac_sha256(secret, f"{timestamp}\n{secret}")
    if sign != expected:
        raise HTTPException(status_code=403, detail="Invalid signature")
```

---

## PipelineStepModel 扩展

```python
class PipelineStepModel(BaseModel):
    # ... 现有字段不变 ...

    # ── 新增：审批相关 ──
    approvalId: str | None = None               # 当前审批请求 ID（幂等用）
    trustLevel: str | None = None               # verified / reviewed / needs_review
    reviewBrief: str | None = None              # 审查结论一句话
    reviewFindings: list[dict] | None = None    # 审查详细发现
    reviewFocus: list[str] | None = None        # 建议关注点
    executionSummary: str | None = None         # 执行摘要（从 artifacts summary 拼接，不额外调 LLM）
    decisionRecord: dict | None = None          # 审批决定记录（谁、什么时间、什么决定、备注）
```

所有新字段为 `Optional + None default`，老数据完全兼容。

---

## 实施计划

### Phase 1：数据基础 + UI 统一（Web 端体验提升）

| 任务 | 文件 | 改动量 | 风险 |
|------|------|--------|------|
| PipelineStepModel 新增字段 | `models.py` | 小 | 低 |
| 审查阶段保留 findings 到 step | `llm.py` | 小 | 低 |
| `_build_approval_payload` 统一生成 | `workflow_engine.py` | 中 | 低 |
| 统一审批卡片（渐进展开） | `CommanderChatPanel.tsx` | 中 | 低 |
| 命令暂停增加按钮 | `CommanderChatPanel.tsx` | 小 | 低 |
| 浏览器 Notification | `useCommanderEvents.ts` | 小 | 低 |

### Phase 2：统一 API + 打回能力

| 任务 | 文件 | 改动量 | 风险 |
|------|------|--------|------|
| `ApprovalDecision` 模型 | `models.py` | 小 | 低 |
| 统一回调端点 + 幂等 | `routers/requirements.py` 或新建 `routers/approvals.py` | 中 | 中 |
| Commander 驳回协议 + 重试上限 | `workflow_engine.py` (system prompt) | 中 | **高** |
| 所有审批类型支持教训沉淀 | `routers/approvals.py` | 小 | 低 |
| 原 API deprecated 兼容层 | `routers/requirements.py` | 小 | 低 |

> ⚠️ Commander 驳回协议是风险最高的改动 — Commander 是 LLM 驱动，行为变更需要充分测试。建议：先在 1 个 Agent 上灰度（如 architect），观察 Commander 对 `approved: false` 的响应是否符合预期，再全量推开。

### Phase 3：多渠道对接

| 任务 | 文件 | 改动量 | 风险 |
|------|------|--------|------|
| 审批事件总线框架 | `workflow_engine.py` | 中 | 低 |
| 钉钉适配器 | 新建 `integrations/dingtalk.py` | 中 | 低 |
| 回调签名验证 | `routers/approvals.py` | 小 | 低 |
| 项目设置中配置钉钉 webhook | `ProjectSettingsModal.tsx` + `models.py` | 小 | 低 |
| SSE 替代轮询（可选） | `routers/requirements.py` + `useCommanderEvents.ts` | 大 | 中 |

### Phase 4：高级功能（按需）

- 审批超时自动提醒（钉钉 @人）
- 审批统计看板（平均响应时间、通过率）
- 批量审批（多个 pending 步骤一键全部通过）
- 影响范围分析（`ImpactInfo`，需额外 LLM 调用，ROI 待验证）

---

## 兼容性与迁移

1. **数据库**：`commander_events` 表的 `metadata_json` 字段为 JSON，新增字段自然兼容
2. **PipelineStepModel**：全部 Optional + None，Pydantic 反序列化老数据不报错
3. **前端**：新卡片组件检测 `approval_id` 字段存在时用新渲染，否则 fallback 到旧渲染
4. **原 API**：`approve-step` 和 `dismiss-advisory` 保留，内部转发到新端点
5. **Commander**：驳回协议仅在 system prompt 中增加段落，不改工具定义
