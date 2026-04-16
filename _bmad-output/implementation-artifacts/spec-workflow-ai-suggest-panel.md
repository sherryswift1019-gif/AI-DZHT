---
title: 'WorkflowConfigModal AI 工作流建议面板（MVP）'
type: 'feature'
created: '2026-04-14'
status: 'superseded'
baseline_commit: 'NO_VCS'
context:
  - '_bmad-output/project-context.md'
---

> **状态：已被超越（2026-04-16）**
> 本 spec 描述的是 MVP 方案（复制 Prompt → 粘贴到外部工具）。实际实现已超越此方案：
> - 后端 `POST /api/v1/workflow/suggest` 端点直接调用 LLM 生成结构化推荐
> - 前端 `useWorkflowSuggest.ts` hook 集成真实 API 调用
> - 返回 `{ recommendedTemplateId, reasoning, suggestedAgentRoles, confidence, warnings }`
> 
> 本文档保留作为设计演进记录。

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `WorkflowConfigModal` 打开时只能依靠用户手动选择模板，没有任何基于需求内容和项目上下文的建议，用户无从判断选哪个模板。

**Approach:** 在 Modal 内新增「AI 分析建议」折叠面板，自动构建包含项目上下文 + 需求标题/描述的 Prompt，提供「复制 Prompt」按钮，用户可一键粘贴到 Claude/Copilot 获取建议后回来手动选择。

## Boundaries & Constraints

**Always:**
- 所有样式只使用 CSS 变量令牌（`var(--bg-*)`、`var(--text-*)`、`var(--border)` 等），不硬编码颜色
- 新增类型使用 `import type`（`verbatimModuleSyntax: true`）
- `buildWorkflowSuggestPrompt` 必须是纯函数，无副作用
- 复制功能使用 `navigator.clipboard.writeText`，复制成功后按钮文字短暂切换为「已复制 ✓」（1.5 秒后恢复）
- 原有模板选择 + 命令配置功能保持不变

**Ask First:**
- 如果 `navigator.clipboard` 不可用（非 HTTPS 环境报错），是否需要 fallback 到创建临时 `<textarea>` + `execCommand`？

**Never:**
- 不添加任何网络请求（无 LLM API 调用，这是 MVP 阶段）
- 不引入新 npm 依赖
- AI 面板不自动选择或修改模板（只建议，用户仍需手动操作）
- 不使用 `window.confirm`

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 正常打开 | `reqTitle`、`reqSummary`、`projectContext` 均有值 | AI 面板展开，Prompt 完整包含三部分内容，复制按钮可用 | — |
| 无描述 | `reqSummary` 为空字符串 | Prompt 中显示 `（无描述）`，复制按钮正常可用 | — |
| 复制成功 | 用户点击复制按钮 | 按钮文字变为「已复制 ✓」，1.5秒后恢复「复制 Prompt」 | — |
| 复制失败 | `navigator.clipboard.writeText` reject | 按钮文字变为「复制失败，请手动复制」，3秒后恢复 | catch 错误，不抛出 |
| 页面折叠 | 用户点击面板标题 | AI 面板折叠/展开切换 | — |

</frozen-after-approval>

## Code Map

- `src/lib/buildWorkflowPrompt.ts` -- 新增，纯函数 `buildWorkflowSuggestPrompt`
- `src/components/requirements/WorkflowConfigModal.tsx` -- 新增 `reqSummary` + `projectContext` props，新增 AI 面板 UI
- `src/pages/project-management/ProjectDetailPage.tsx` -- 向 WorkflowConfigModal 透传 `reqSummary` 和 `projectContext`
- `src/types/project.ts` -- 只读参考，`ProjectContext` 类型已存在，无需改动

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/buildWorkflowPrompt.ts` -- 新建，导出 `buildWorkflowSuggestPrompt(reqTitle, reqSummary, projectContext)` 纯函数，返回完整 Prompt 字符串（含项目行业/技术栈/约定 + 需求标题/描述 + 4个模板说明）
- [x] `src/components/requirements/WorkflowConfigModal.tsx` -- 新增 `reqSummary: string` 和 `projectContext: ProjectContext` 到 `WorkflowConfigModalProps`；在 Header 下方、Body 上方新增可折叠 AI 建议面板（含 Prompt 文本区域 + 复制按钮 + 折叠状态）；新增 `copied` state 控制按钮文字
- [x] `src/pages/project-management/ProjectDetailPage.tsx` -- 在 `<WorkflowConfigModal>` 调用处新增 `reqSummary={pendingForm?.summary ?? ''}` 和 `projectContext={project.context}` 两个 props

**Acceptance Criteria:**
- Given 用户填写需求标题和描述后点击「下一步：配置工作流」，when WorkflowConfigModal 打开，then AI 建议面板自动可见，内容包含项目行业、技术栈和需求信息
- Given AI 面板可见，when 用户点击「复制 Prompt」，then 剪贴板内容为完整 Prompt，按钮文字切换为「已复制 ✓」
- Given `pnpm build`，when 执行，then 零 TypeScript 错误，零 ESLint 错误
- Given 原有模板选择和命令配置功能，when 新增 AI 面板后，then 功能完全不受影响

## Design Notes

**AI 面板位置：** Modal `<div className="flex min-h-0 flex-1 overflow-hidden">` 内，紧贴 Body 顶部（左右两栏上方），一条横向通栏。默认展开，标题行可点击折叠。

**Prompt 内容结构示例：**
```
请基于以下项目上下文分析需求，建议最合适的 Agent 工作流配置。

## 项目上下文
- 行业：SaaS / 企业软件
- 技术栈：React, TypeScript, Node.js, PostgreSQL
- 团队约定：
  - PRD 变更必须走版本评审
  - 所有流水线步骤必须可追踪状态

## 待分析需求
- 标题：支持需求创建后配置流水线
- 描述：需求创建后在详情页支持配置 Agent 流水线

## 可选工作流模板
...（4个模板说明）
```

**复制按钮 state 机器：** `'idle' | 'copied' | 'error'`，避免 boolean 无法表达三态。

## Verification

**Commands:**
- `cd frontend && pnpm build` -- expected: `✓ built in` 无编译错误
