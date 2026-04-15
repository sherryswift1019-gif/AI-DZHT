---
title: '需求创建 + Agent 工作流配置 Popup'
type: 'feature'
created: '2026-04-14'
status: 'done'
baseline_commit: 'NO_VCS'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 新建需求时使用固定的 `defaultPipeline()`，用户无法根据需求类型（大需求全流程 vs 快速开发 vs Bug修复）灵活选择 Agent 工作流，也无法配置单个 Agent 的命令能力子集（如分析师只用 BP + DP）。

**Approach:** 将单步创建 Modal 改为两步流程：Step 1 填写基本信息（现有表单），Step 2 打开 `WorkflowConfigModal` 配置 Agent 工作流（内置模板选择 + 自定义节点开关 + 每节点命令能力子集配置），确认后以所配置的 pipeline 创建需求。

## Boundaries & Constraints

**Always:**
- 设计系统严格遵循 `prototype-design-system.html v2` 的 CSS tokens 和组件类
- 保持向后兼容：存量 `PipelineStep` 记录中 `enabledCommands / agentRole` 为 undefined 时，UI 等同于"全部启用"
- 删除确认使用现有 Modal（不改 deleteTarget 逻辑）
- 代码路径统一中文注释风格（与现有文件一致）
- 模板和命令定义使用静态常量，不引入新 store

**Ask First:**
- 是否需要拖拽排序（dnd-kit）？如需，暂停引入并确认
- Per-agent 命令子集数据是否需要持久化到 mock API？

**Never:**
- 不引入第三方拖拽库；自定义顺序通过 ↑↓ 按钮实现（或暂时仅支持模板选择 + 节点开关）
- 不修改已运行/已完成需求的 pipeline
- 不改动 `RequirementAgentView.tsx`（只读视图页，不受影响）

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 选择内置模板 | 点击"全流程"模板卡片 | 右侧 Agent 节点列表更新为该模板的步骤，全部默认勾选 | — |
| 切换 Custom 后去勾 Agent | 进入自定义模式，取消勾选某 Agent | 该 Agent 步骤从 preview 中移除 | 最少保留 1 个 Agent（否则禁用确认按钮）|
| 展开命令配置 | 点击 Agent 行的"配置能力"按钮 | 展示该角色的全部命令 code 列表，默认全选 | — |
| 全部命令取消勾选 | 某 Agent 的所有命令都取消 | 保留该命令列表（enabledCommands 为 `[]`） | — |
| 需求标题为空 | Step 1 表单 title 为空，点击"下一步" | 按钮禁用，不进入 Step 2 | — |
| 确认创建 | Step 2 点击"确认创建" | 关闭 Modal，需求列表新增该需求，pipeline 含配置的 steps，切換 selectedReqId 至新需求 | — |

</frozen-after-approval>

## Code Map

- `frontend/src/types/project.ts` -- PipelineStep 增加 `agentRole?: AgentRole` 和 `enabledCommands?: string[]`
- `frontend/src/components/requirements/WorkflowConfigModal.tsx` -- 新建：Step 2 的工作流配置 Modal；含模板定义常量、节点列表、命令子集配置
- `frontend/src/pages/project-management/ProjectDetailPage.tsx` -- 两步流程状态管理；Step 1 提交后打开 WorkflowConfigModal；`defaultPipeline()` 保留（作为 Custom 基础）
- `frontend/src/mocks/data/bmadAgentDefs.ts` -- 只读，作为命令能力数据源（agentRole→commands 映射）

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/types/project.ts` -- 在 `PipelineStep` 接口末尾添加 `agentRole?: AgentRole` 和 `enabledCommands?: string[]` 两个可选字段；同时从 `./agent` 导入 `AgentRole` 类型
- [x] `frontend/src/components/requirements/WorkflowConfigModal.tsx` -- 创建新文件；内含：① `WORKFLOW_TEMPLATES` 常量（全流程/快速开发/Bug修复三个模板，每个模板定义 steps 数组含 name/agentRole/agentName/defaultEnabledCommands）；② `AGENT_COMMANDS` 映射（agentRole → commandCodes，数据来自 bmadAgentDefs）；③ `WorkflowConfigModal` 组件，props: `{ open, reqTitle, onClose, onConfirm(pipeline: PipelineStep[]) }`；④ 内部状态：activeTemplate('full'|'quick'|'bugfix'|'custom')、steps（可编辑的步骤列表含 enabled/enabledCommands）、expandedStep(string|null)；⑤ 模板卡片区（4 张）+ 步骤预览列表区（右侧），步骤行支持 checkbox 开关 + "配置能力"折叠展开命令多选；⑥ 底部确认/取消按钮；⑦ 设计系统 tokens 与组件类与现有代码一致
- [x] `frontend/src/pages/project-management/ProjectDetailPage.tsx` -- 新增 state: `workflowOpen: boolean`（控制 WorkflowConfigModal 显示）+ `pendingForm`（暂存 Step1 表单数据待 Step2 确认后用）；将"创建并配置流水线"按钮 onClick 改为：校验标题非空后，set `workflowOpen=true` 并 set `pendingForm=form`，同时关闭 openCreate；`createRequirement` 函数改为接收 `(formData, pipeline: PipelineStep[])` 参数；render WorkflowConfigModal，onConfirm 回调调用 createRequirement 并关闭 workflowOpen；import WorkflowConfigModal

**Acceptance Criteria:**
- Given 需求创建 Modal 已打开且标题已填写，when 点击"创建并配置流水线"，then Step 1 Modal 关闭，Step2 WorkflowConfigModal 打开，标题显示在 Modal 顶部
- Given WorkflowConfigModal 打开，when 点击"全流程"模板卡，then 右侧步骤列表更新为分析师→UX→架构师→Dev→QA 5个节点
- Given 已选择模板，when 取消勾选某 Agent 步骤的 checkbox，then 该步骤在列表中显示为禁用（灰色），确认后 pipeline 不含该步骤
- Given 某步骤的"配置能力"被展开，when 取消勾选某条命令 code，then 确认后 pipeline 该步骤的 enabledCommands 仅含勾选项
- Given 所有步骤均被取消勾选（enabled=false），when 查看底部确认按钮，then 按钮为 disabled 状态
- Given 点击 WorkflowConfigModal 的"确认创建"，then 需求列表新增一条记录，其 pipeline 与配置一致，selectedReqId 自动切换到新需求

## Design Notes

**WorkflowConfigModal 布局**（~600px wide modal）:
```
[Modal Header] 配置 Agent 工作流 · <reqTitle>
---
[Left 200px] 模板选择区（4 个模板卡，含 icon/name/desc）
[Right flex-1] 步骤配置区
  - 每行: Checkbox + Avatar + AgentName + StepName + [配置能力 ↓]
  - 展开后: 命令 code 多选 checkboxes（横排 tag 形式）
[Footer] [取消] [确认创建（disabled if 0 steps enabled）]
```

**WORKFLOW_TEMPLATES** 数据（静态常量，无需 API）:
- `full`: 全流程（大需求）— 分析师(analyst)→UX(ux)→架构师(architect)→Dev(dev)→QA(qa)
- `quick`: 快速开发 — 快速开发专家(quickdev)→QA(qa)
- `bugfix`: Bug 修复 — Dev(dev)→QA(qa)
- `custom`: 自定义（展示全部 9 个 Agent 角色，用户勾选）

## Suggested Review Order

**Two-step creation flow (entry point)**

- Step 1→2 handoff: pendingForm stores form, workflowOpen triggers modal
  [`ProjectDetailPage.tsx:95`](../../frontend/src/pages/project-management/ProjectDetailPage.tsx#L95)

- createRequirement redesigned: accepts pipeline from modal, closes modal on success
  [`ProjectDetailPage.tsx:97`](../../frontend/src/pages/project-management/ProjectDetailPage.tsx#L97)

- Step 1 button logic: disabled guard + closure into Step 2
  [`ProjectDetailPage.tsx:689`](../../frontend/src/pages/project-management/ProjectDetailPage.tsx#L689)

- WorkflowConfigModal wired with key= for guaranteed state reset on reopen
  [`ProjectDetailPage.tsx:760`](../../frontend/src/pages/project-management/ProjectDetailPage.tsx#L760)

**WorkflowConfigModal — template selection**

- WORKFLOW_TEMPLATES: 4 built-in templates with steps + agentRole
  [`WorkflowConfigModal.tsx:45`](../../frontend/src/components/requirements/WorkflowConfigModal.tsx#L45)

- selectTemplate: replaces steps array; collapses any expanded command panel
  [`WorkflowConfigModal.tsx:136`](../../frontend/src/components/requirements/WorkflowConfigModal.tsx#L136)

**WorkflowConfigModal — per-node capability configuration**

- AGENT_COMMANDS: static role→commands map (source of truth for command subsets)
  [`WorkflowConfigModal.tsx:9`](../../frontend/src/components/requirements/WorkflowConfigModal.tsx#L9)

- toggleStep: flips enabled + clears expandedStep if that step was open (patch)
  [`WorkflowConfigModal.tsx:144`](../../frontend/src/components/requirements/WorkflowConfigModal.tsx#L144)

- toggleCommand: immutably updates enabledCommands for a specific step
  [`WorkflowConfigModal.tsx:153`](../../frontend/src/components/requirements/WorkflowConfigModal.tsx#L153)

- handleConfirm: timestamp-prefixed IDs prevent collisions; emits PipelineStep[]
  [`WorkflowConfigModal.tsx:166`](../../frontend/src/components/requirements/WorkflowConfigModal.tsx#L166)

**Type schema change**

- PipelineStep extended with agentRole? and enabledCommands? (optional, backward-compat)
  [`project.ts:43`](../../frontend/src/types/project.ts#L43)


**Commands:**
- `cd /Users/zhangshanshan/AI-DZHT/frontend && pnpm build` -- expected: Build succeeded with no errors
