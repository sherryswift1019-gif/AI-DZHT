---
project_name: 'AI-DZHT'
user_name: 'Zhangshanshan'
date: '2026-04-14'
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
---

# Project Context for AI Agents

_AI-DZHT 研发工厂平台：面向研发团队的全流程 AI 协作平台，支撑需求到上线的自动化执行。_
_本文件记录 AI Agent 实现代码时必须遵循的关键规则——聚焦于容易遗漏的非显而易见细节。_

---

## 技术栈与版本

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

**项目根**：`frontend/`（所有前端代码在此目录下）

---

## TypeScript 规则（关键）

- **`verbatimModuleSyntax: true`** — 所有仅用于类型的导入必须使用 `import type`，否则编译报错
  ```ts
  // ✅ 正确
  import type { Requirement } from '@/types/project'
  import { useState } from 'react'
  
  // ❌ 错误 — 会导致 build 失败
  import { Requirement } from '@/types/project'
  ```
- **`noUnusedLocals: true` + `noUnusedParameters: true`** — 未使用的变量/参数会报错，不能用 `_` 前缀绕过必须真正删除
- **`moduleResolution: "bundler"`** — 使用 Vite bundler 模式，不需要写扩展名
- **路径别名**：`@/` → `src/`，始终使用 `@/` 而非相对路径（`vite.config.ts` + `tsconfig.app.json` 均已配置）

---

## React 模式

### 组件结构

- 所有组件使用**命名导出**（`export function Foo`），不使用默认导出（页面组件除外，`App.tsx` 默认导出）
- 页面组件文件名格式：`XxxPage.tsx`（PascalCase + `Page` 后缀）
- 普通组件文件名：`XxxComponent.tsx`（PascalCase）
- 组件目录：功能模块化 — `src/components/<feature>/`，`src/pages/<feature>/`

### Hooks 规则

- ESLint 强制 `eslint-plugin-react-hooks`，必须遵循 hooks 调用规则
- 无 `src/hooks/` 自定义 hooks（当前为空），如需提取请创建 `useXxx.ts` 文件
- `useMemo`/`useCallback` 用于性能敏感计算，不要过度使用

---

## 状态管理分层

```
服务端 / 异步数据    → TanStack React Query (useQuery / useMutation)
跨页面持久 UI 状态   → Zustand store (src/stores/xxxStore.ts)
组件局部状态         → React useState / useReducer
```

- **当前 Zustand store**：仅 `agentWizardStore.ts`（Agent 创建向导多步骤状态）
- ⚠️ **不要**将服务端数据放入 Zustand；不要将仅在单个组件内使用的状态放入 Zustand
- 当前项目 **无真实 API**，所有数据通过 MSW + mock data 提供（见下）

---

## Mock 数据 / API 模拟

- **所有 API 请求**通过 MSW 拦截，注册在 `src/mocks/handlers.ts`
- **Mock 数据文件**：`src/mocks/data/agents.ts`、`src/mocks/data/projects.ts`、`src/mocks/data/bmadAgentDefs.ts`
- 无真实后端，**不要**添加真实 `fetch` 调用而不配套 MSW handler
- 新增 API 请求时，同步在 `handlers.ts` 中注册对应 handler，并在 `src/mocks/data/` 下补充 mock 数据
- 项目数据（`mockProjects`, `mockRequirements`, `mockMembers`）当前直接用 `useState` 初始化，**不经过** React Query

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

### 主题设置

- 默认暗色主题，根 `<div>` 已设置 `data-theme="dark"`（在 `App.tsx`）
- CSS 变量定义在 `src/index.css`，覆盖了 `[data-theme="dark"]` 和 `[data-theme="light"]`
- **不要**在组件中直接切换主题，所有令牌通过 CSS 变量自动映射

### Tailwind + cn()

- 使用 Tailwind 工具类配合 CSS 变量，例如：`className="bg-[var(--bg-panel)] text-[var(--text-1)]"`
- 条件类名**始终**使用 `cn()` 工具函数（`import { cn } from '@/lib/utils'`）
- Tailwind v4 通过 `@theme inline` 在 `index.css` 中定义，**不使用** `tailwind.config.js`

---

## 删除确认 UX（强制规范）

- **禁止**使用 `window.confirm()` 进行删除确认
- **必须**使用应用内 Modal（Radix UI `@radix-ui/react-dialog` 或项目内自定义 Dialog）
- 所有删除操作的确认 UX 在全项目保持统一风格
- 参考实现：`ProjectDetailPage.tsx` 中的 `deleteTarget` state + Dialog 模式

---

## 路由结构

```
/                       → 重定向到 /projects
/projects               → ProjectListPage（含 AppShell）
/projects/:id           → ProjectDetailPage（含 AppShell）
/agents                 → AgentListPage（含 AppShell）
/agents/:id             → AgentDetailPage（含 AppShell）
/agents/new             → CreateAgentPage（全屏，不含导航栏）
/agents/:id/edit        → EditAgentPage（全屏，不含导航栏）
/commands               → CommandLibraryPage（含 AppShell）
```

- **全屏页面**（向导类）：直接作为顶层 `<Route>` 不嵌套在 `AppShell` 内
- **含导航页面**：嵌套在 `<Route element={<AppShell />}>` 内

---

## 文件与目录命名约定

| 类型 | 命名规则 | 示例 |
|---|---|---|
| React 组件 | PascalCase.tsx | `WorkflowConfigModal.tsx` |
| 页面组件 | PascalCase + Page.tsx | `ProjectDetailPage.tsx` |
| Zustand store | camelCase + Store.ts | `agentWizardStore.ts` |
| 类型定义 | camelCase.ts | `project.ts`, `agent.ts` |
| Mock 数据 | camelCase.ts | `projects.ts`, `agents.ts` |
| 工具函数 | camelCase.ts | `utils.ts` |
| 目录名 | kebab-case | `agent-management/`, `project-management/` |

---

## 核心领域类型（速查）

位置：`src/types/project.ts`、`src/types/agent.ts`

```
Project         — 项目，含 context(industry/techStack/conventions)
Requirement     — 需求，含 pipeline(PipelineStep[]) + stories(Story[])
PipelineStep    — 流水线步骤，含 agentRole + enabledCommands
Story           — 子 Story，含独立 pipeline
AgentRole       — 'analyst'|'pm'|'ux'|'architect'|'sm'|'dev'|'qa'|'quickdev'|'techwriter'
Agent           — Agent 模板，含 promptBlocks(4块结构)
Command         — BMAD 命令，含 code/phase/isProtected
```

---

## 当前测试状态

- **无测试框架配置**（无 vitest/jest）
- 测试验证目前通过 `pnpm build`（TypeScript 类型检查）+ 手动测试
- 如需添加测试，使用 Vitest（与 Vite 生态一致）

---

## 常用命令

```bash
cd frontend
pnpm dev       # 启动开发服务器
pnpm build     # 类型检查 + 构建产物
pnpm lint      # ESLint 检查
pnpm preview   # 预览构建产物
```
