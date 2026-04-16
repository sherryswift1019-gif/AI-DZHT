---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
lastStep: 12
inputDocuments:
  - "_bmad-output/planning-artifacts/prd-agent-management.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "_bmad-output/planning-artifacts/prototype-design-system.html"
outputFile: "_bmad-output/planning-artifacts/ux-design-agent-management.md"
scope: "Agent 管理模块"
designSystem: "prototype-design-system.html v2"
---

# UX Design Specification — AI-DZHT Agent 管理模块

> **实现状态（2026-04-16）**
>
> | 页面 | 状态 | 说明 |
> |---|---|---|
> | P01 Agent 目录 | ✅ 仅 Mock | `AgentListPage.tsx` + MSW |
> | P02 创建向导 — 基础信息 | ✅ 仅 Mock | `Step1BasicInfo.tsx` |
> | P03 创建向导 — 能力选择 | ✅ 仅 Mock | `Step2Capabilities.tsx` |
> | P04 创建向导 — 提示词 | ✅ 仅 Mock | `Step3Prompt.tsx` |
> | P05 Agent 详情 | ✅ 仅 Mock | `AgentDetailPage.tsx` |
> | P06 上下文配置 | ✅ 已实现 | `ProjectSettingsModal.tsx`（真实后端） |
> | P07 Agent 编辑 | ✅ 仅 Mock | `EditAgentPage.tsx` |
> | P08 命令库 | ✅ 仅 Mock | `CommandLibraryPage.tsx` |
> | P09 版本历史 | ❌ 未实现 | Phase 2 |
> | P10 运行实例管理 | ❌ 未实现 | Phase 2 |
> | P11 共享管理 | ❌ 未实现 | Phase 3-4 |
>
> **注**：RBAC 权限控制延后至 Phase 2。当前所有页面无角色区分。

**Author:** Zhangshanshan
**Date:** 2026-04-13

---

<!-- UX design content will be appended sequentially through collaborative workflow steps -->

---

## 项目理解与设计基础

### 产品定位

AI-DZHT Agent 管理模块是**后台配置型工具**，面向研发团队。核心 UX 原则：信息密度优先、操作效率优先，不追求视觉炫技。

### 目标用户与页面接触矩阵

| 角色 | 主要页面 | 操作权限 |
|------|---------|---------|
| 平台管理员 | 命令库管理 / 全局 Agent 列表 / 审计日志 | 配置 + 治理 |
| 项目负责人 | Agent 目录 / 创建向导 / 详情页 / 项目上下文 | 配置 + 变体创建 |
| 研发成员 | 需求详情内嵌 Agent 视图 / 目录（只读） | 查看 + 反馈 |

### 设计系统规范（prototype-design-system.html v2）

所有原型页面**严格遵循** `prototype-design-system.html` 中定义的 Design Tokens 和组件规范：

#### 主题
- 双主题支持：`[data-theme="dark"]` / `[data-theme="light"]`
- 默认使用暗色主题（`data-theme="dark"`）
- 主题切换通过右上角 Segmented Control 实现

#### 核心 Design Tokens

| 类别 | Token | 用途 |
|------|-------|------|
| 背景层 | `--bg-base` / `--bg-panel` / `--bg-panel-2` / `--bg-panel-3` | 页面层级背景 |
| 边框 | `--border` / `--border-strong` | 分隔与强调 |
| 文字 | `--text-1` / `--text-2` / `--text-3` | 主/次/弱文字 |
| 语义色 | `--accent` (blue) / `--success` / `--warning` / `--danger` / `--purple` | 状态与操作 |
| 语义底色 | `--accent-sub` / `--success-sub` / `--warning-sub` / `--danger-sub` | 轻强调背景 |
| 阴影 | `--shadow-sm` / `--shadow` / `--shadow-lg` | 层级感 |
| 毛玻璃 | `--glass-bg` / `--glass-blur` | 导航栏等悬浮元素 |

#### 可直接复用的组件类

| 组件 | CSS 类 | 说明 |
|------|--------|------|
| **按钮 · 主要** | `.btn.btn-primary` | 创建、保存、确认 |
| **按钮 · 次要** | `.btn.btn-secondary` | 取消、返回 |
| **按钮 · 危险** | `.btn.btn-danger` | 删除、停用（悬停变实色） |
| **按钮 · 成功** | `.btn.btn-success` | 启用、通过 |
| **按钮 · Tint** | `.btn.btn-tint` | 次要操作（Fork、预览） |
| **按钮 · 幽灵** | `.btn.btn-ghost` | 文字链接级操作 |
| **按钮 · 图标** | `.btn.btn-icon` | 工具栏图标按钮 |
| **按钮尺寸** | `.btn-xs` / `.btn-sm` / `.btn-lg` | 表内操作 / 默认 / 主操作 |
| **徽章 · 蓝** | `.badge.b-blue` | 状态：运行中 |
| **徽章 · 绿** | `.badge.b-green` | 状态：已启用 |
| **徽章 · 橙** | `.badge.b-orange` | 状态：警告 / 草稿 |
| **徽章 · 红** | `.badge.b-red` | 状态：停用 / 错误 |
| **徽章 · 紫** | `.badge.b-purple` | 来源：Fork |
| **徽章 · 灰** | `.badge.b-gray` | 状态：空闲 |
| **状态图标** | `.si.si-done/run/wait/err/idle` | 实例状态圆点 |
| **面板** | `.panel` + `.panel-hdr` + `.panel-body` | 内容卡片容器 |
| **卡片** | `.card` + `.card-body` + `.card-blue/green/...` | 数据展示卡片 |
| **列表行** | `.list-row` | 命令库 / Agent 列表行 |
| **Agent 卡片** | `.agent-tile` + `.agent-av` + `.av-product/ux/...` | Agent 目录卡片 |
| **输入框** | `.input-group` + `.input` | 表单输入 |
| **进度条** | `.prog-wrap` + `.prog-track` + `.prog-fill` | 配置进度 |
| **审批卡** | `.approval-card` | 共享申请审批（Phase 3） |

#### Agent 头像渐变（8 个内置角色）

| 角色 | CSS 类 | 渐变色 |
|------|--------|--------|
| Commander | `.av-commander` | indigo → purple |
| 产品经理 | `.av-product` | deep-blue → blue |
| UX 设计 | `.av-ux` | deep-pink → pink |
| 架构师 | `.av-arch` | deep-green → green |
| 开发 | `.av-dev` | teal → cyan |
| 评审 | `.av-review` | deep-orange → orange |
| 测试 | `.av-test` | deep-yellow → yellow |
| 部署 | `.av-deploy` | dark-gray → gray |

#### 关键 UX 约束（来自 PRD NFR）

1. **删除/停用确认弹窗**：必须在弹窗内展示关联工作流影响列表；使用 `.approval-card` 结构，**禁止** `window.confirm`
2. **AI 生成降级**：提示词生成失败时平滑切换手动编辑，展示用户友好引导而非错误码（NFR-UX03）
3. **锁定状态实时性**：编辑区锁定/解锁展示延迟 ≤ 5 秒，使用 `.badge.b-orange` 动画徽章提示（NFR-A04）
4. **权限边界**：研发成员界面不渲染编辑入口（NFR-S02），非隐藏而是不生成 DOM

### 需要设计的页面列表

| # | 页面 | Phase | 关联 FR |
|---|------|-------|---------|
| P01 | Agent 目录页 | 1 | FR13/FR14/FR41 |
| P02 | Agent 创建向导 Step 1 — 基础信息 | 1 | FR06 |
| P03 | Agent 创建向导 Step 2 — 能力选择 | 1 | FR07 |
| P04 | Agent 创建向导 Step 3 — 提示词配置（含降级态） | 1 | FR08/FR09/FR10/FR42 |
| P05 | Agent 详情页 — 配置视图 | 1 | FR14/FR22/FR39 |
| P06 | 项目上下文配置页 | 1 | FR26 |
| P07 | 需求详情内嵌 Agent 视图（研发成员） | 1 | FR37/FR38 |
| P08 | BMAD 命令库管理页 | 1 | FR01/FR02/FR03 |
| P09 | 停用/删除确认弹窗 | 2 | FR20/FR21 |
| P10 | Agent 详情页 — 运行实例标签 | 2 | FR23/FR24/FR25/FR45 |
| P11 | 共享范围设置面板 | 2 | FR31 |

---

## 核心体验定义（Step 3）

**最核心的用户动作：** 项目负责人在 10 分钟内完成"选能力 → AI 生成提示词 → 绑定项目上下文"闭环。

**平台：** Web 桌面端（内部工具），鼠标+键盘主交互，不需要移动端。

**应该毫不费力的动作：**
- 浏览和发现 Agent（目录扫视即得结论）
- AI 生成提示词（点一下，等待，微调）
- 三步向导进度感知（明确知道现在在哪一步）

**决定成败的关键时刻：**
- 首次看到 Agent 目录——8 张卡片清晰、能看懂能力
- Step 3 提示词生成完成——草稿质量决定是否值得信任
- 编辑区锁定提示——用户第一次看到锁定原因能立刻理解

---

## 情感目标（Step 4）

| 时刻 | 期望情感 | 设计关键词 |
|------|---------|----------|
| 首次进入目录 | 「这个我能上手」 | 熟悉感、有据可查 |
| AI 草稿生成完毕 | 「比我想的要好」 | 惊喜、节省时间感 |
| 配置保存成功 | 「我做了一件有价值的事」 | 成就感、可见影响 |
| 看到锁定提示 | 「系统保护了我」 | 安全感、不是被限制 |
| 研发成员查看 Agent 目录 | 「我知道这个 AI 能做什么了」 | 透明感、可预期 |

---

## 视觉基础（Steps 5–8）

**视觉风格来源：** 完全继承 `prototype-design-system.html v2`。
**关键视觉决策：**
- 默认暗色主题（内部工具，长时间使用减少视觉疲劳）
- 信息层级：页面背景 `--bg-base` → 面板 `--bg-panel` → 次级区域 `--bg-panel-2`
- Agent 头像使用 8 个预定义渐变色，强烈的角色识别度
- 状态徽章：运行中（蓝/动画脉冲）/ 启用（绿）/ 停用（灰）/ 草稿（橙）/ Fork（紫）
- 高风险操作（删除/停用）：`.btn-danger`，悬停变实色红，弹窗显示影响列表

---

## 用户旅程映射（Step 10）

### 旅程 1 → P01→P02→P03→P04 流程
目录页 → 点"新建Agent" → 三步向导（Step1基础信息 / Step2能力选择 / Step3提示词）→ 保存 → 回到目录

### 旅程 2 → P07 流程
需求详情页内嵌 Agent 视图（只读）→ 点"反馈问题" → 提交表单 → 通知项目负责人

### 旅程 5 → P05+P09 流程
Agent 详情页 → 编辑区橙色锁定提示 → 查看运行实例列表 → 手动停止实例 → 锁定自动解除

### 旅程 6 → P05（版本历史标签）
Agent 详情页 → 版本历史标签 → 查看变更摘要 → 运行实例记录

---

## 组件策略（Step 11）

### 复用自 Design System（零自定义）
`.agent-tile` / `.badge` / `.btn` / `.panel` / `.input` / `.list-row` / `.approval-card` / `.prog-wrap`

### 本模块新增自定义组件

| 组件名 | 用途 | 设计说明 |
|--------|------|---------|
| **能力标签组** `.cap-tags` | 展示 Agent 拥有的命令能力 | 小 badge 横排，`b-blue` 色，超出折叠为"+N" |
| **三步进度条** `.wizard-steps` | 创建向导进度指示 | 步骤圆点+连线，当前步填色，已完成打勾 |
| **四块提示词编辑器** `.prompt-blocks` | 四块结构化提示词容器 | 每块有标题 + 独立编辑区 + "AI 优化"按钮 |
| **AI 生成状态** `.ai-gen-state` | 生成中/完成/降级三态 | 生成中：spinner；完成：绿色打勾；降级：橙色提示+引导手动编辑 |
| **运行中锁定横幅** `.lock-banner` | 编辑区顶部锁定提示 | 橙色背景，显示锁定原因+影响实例数，不阻断页面其余内容 |
| **来源标注** `.source-tag` | Agent 卡片来源标识 | "内置"(灰) / "自定义"(蓝) / "Fork"(紫) |
| **依赖扫描结果** `.dep-scan` | 停用/删除前影响列表 | 面板内列出关联工作流，支持"查看"跳转 |

---

## UX 一致性模式（Step 12）

### 按钮层级规则
| 操作类型 | 按钮样式 | 位置 |
|---------|---------|------|
| 主要创建/保存 | `.btn-primary` | 表单底部右侧 / 页面顶部右侧 |
| 取消/返回 | `.btn-secondary` | 确认按钮左侧 |
| 次要操作（Fork/预览） | `.btn-tint` | 卡片 hover 工具栏 |
| 破坏性操作（删除/停用） | `.btn-danger`（弹窗内） | 确认弹窗内，二次确认后激活 |

### 状态反馈模式
| 场景 | 反馈方式 |
|------|---------|
| 保存成功 | 顶部 Toast（绿色，3 秒消失）|
| 表单验证失败 | 字段 inline 红色提示文字 |
| AI 生成中 | 按钮内 spinner + 禁用状态 |
| AI 降级 | 橙色 `.highlight-block` 横幅 + 手动编辑引导按钮 |
| 操作受限（锁定/无权限） | `.lock-banner` 或 tooltip，不弹 alert |

### 删除/停用确认弹窗规范
使用 `.approval-card` 结构，弹窗内必须包含：
1. 操作说明标题（"停用此 Agent"）
2. 依赖扫描结果（`.dep-scan` 影响列表，若无关联工作流显示"安全，无关联工作流"）
3. 不可恢复警示（删除时）
4. 操作按钮行：`.btn-secondary`（取消）+ `.btn-danger`（确认停用/删除）
