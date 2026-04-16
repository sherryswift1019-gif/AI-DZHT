---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - "_bmad-output/planning-artifacts/product-brief-AI-DZHT.md"
  - "_bmad-output/planning-artifacts/prototype-dashboard.html"
  - "_bmad-output/planning-artifacts/prototype-agent-management.html"
  - "_bmad-output/planning-artifacts/prototype-project-management.html"
  - "_bmad-output/planning-artifacts/prototype-requirement-detail.html"
  - "_bmad-output/planning-artifacts/prototype-design-system.html"
  - "_bmad-output/planning-artifacts/prototype-agent-characters.html"
---

# UX Design Specification AI-DZHT

> **实现状态（2026-04-16）**
>
> | 页面 | 状态 | 说明 |
> |---|---|---|
> | 项目列表 `/projects` | ✅ 已实现 | 搜索/筛选/创建/设置 |
> | 项目详情 `/projects/:id` | ✅ 已实现 | 需求管理 + 流水线可视化 + 审批 |
> | Agent 列表 `/agents` | ✅ 仅 Mock | MSW mock 数据 |
> | Agent 详情 `/agents/:id` | ✅ 仅 Mock | 配置/实例/历史 tab |
> | Agent 编辑 `/agents/:id/edit` | ✅ 仅 Mock | 全屏编辑 |
> | Agent 创建向导 | ✅ 仅 Mock | 3 步 Modal 向导 |
> | 命令库 `/commands` | ✅ 仅 Mock | 按阶段分组 |
> | LLM 设置 `/settings` | ✅ 已实现 | 双 Provider 配置 + 测试 |
> | 可观测大盘 | ❌ 未实现 | 计划 Phase 2 |
>
> **Agent 角色**：9 个（Mary/John/Sally/Winston/Bob/Amelia/Quinn/Barry/Paige），非产品简报中的 7 个。
> **Commander**：当前为后端 tool-calling 引擎（`workflow_engine.py`），非对话式 UI。前端通过流水线状态和审批按钮交互。

**Author:** Zhangshanshan
**Date:** 2026-04-13

---

<!-- UX design content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

### Project Vision

AI-DZHT 是面向研发团队的 AI 研发流水线指挥台。核心价值主张是**可控感**而非速度——让研发过程第一次真正可见、可管理、可衡量。系统基于 BMAD Method 敏捷开发方法论，通过 8 个专职 Agent 覆盖从需求分析到部署上线的完整研发生命周期。

### Target Users

**研发团队负责人（主要用户）**
需要 AI 研发投入有清晰 ROI 感知，在不 micromanage 的情况下保障交付质量。成功信号：一张大盘看清所有需求状态，能量化每分钱的 AI 投入产出。

**研发工程师（日常用户）**
不再需要重复解释上下文，只处理少数关键审批节点。成功信号：跑通一个需求只需处理几个审批，其余全部自动。

**产品经理（轻度用户）**
提交需求，在大盘跟踪进展，不再频繁拉会对齐。成功信号：需求进去，看着它在大盘里一步步走向上线。

### Key Design Challenges

1. **信息密度 vs. 认知负载**：大盘需同时呈现多 Agent 状态、token 消耗、输出质量，如何让用户扫一眼就判断"一切正常 / 需要我介入"
2. **审批节点的决策质量**：人工介入时刻用户需在几秒内理解"发生了什么、Agent 建议什么、我需要决定什么"——信息太少盲目决策，信息太多直接放行
3. **多角色信息需求差异**：同一系统服务三类用户，三种信息优先级，不做三套 UI
4. **异步流水线的存在感**：Agent 执行可能持续数分钟到数小时，如何让用户感知"系统在认真工作"

### Design Opportunities

1. **指挥官 Agent 作为唯一对话入口**：用户只和指挥官说话，其余 Agent 在后台运转，可做成真正的"指令中心"体验
2. **ROI 可视化语言**：将 token 消耗、时间、错误率转化成研发负责人能向上汇报的语言
3. **审批体验极简化**：关键节点审批如果做得够好，可以成为产品核心体验亮点而非流程瓶颈

---

## Agent Architecture

AI-DZHT 基于 BMAD Method 确认 8 个专职 Agent，由指挥官统一调度：

| Agent | 覆盖 BMAD 技能 | 职责定位 |
|---|---|---|
| **指挥官 Agent** | SP, SS, ER, CC, GPC, CE, CS | 全局调度·工作规划·人工节点·Backlog 管理 |
| **产品 Agent** | BP, DR, MR, TR, CB, CP, EP | 需求分析·PRD 生命周期 |
| **UX Agent** | CU | 交互设计·UX 规格 |
| **架构 Agent** | CA | 技术架构·设计决策 |
| **研发 Agent** | DS（可并行多实例） | Story 实现·单测 |
| **审查 Agent** | VP, IR, VS, CR, AR, ECH | 每阶段出口质量门 |
| **测试 Agent** | QA | 自动化测试执行 |
| **部署 Agent** | CI/CD 集成 | 发布·环境管理 |

**指挥官工作流逻辑：**
CE（一次性建立 Backlog）→ SP（每 Sprint 排序）→ CS（每 Story 生成上下文卡片）→ SS（随时查看进度）→ ER（每 Epic 复盘）

---

## Core UX Decisions

### 1. Commander 交互模型

- **范围**：全局 Commander + 上下文切换（方案C）——一个入口，可跨项目跨需求回答问题，也可聚焦到具体需求
- **切换机制**：混合模式——点击侧边栏切换需求，Commander 自动确认当前上下文
- **指令形态**：对话优先，复杂配置时弹出可视化辅助（就地编辑，无模态弹窗）

### 2. 流水线配置时机

两个时机都支持：
- **提交时**：上传 PRD → Commander 解析 → 对话式配置流水线
- **运行时**：随时对 Commander 说"暂停 / 插入审批节点 / 调整阶段"

### 3. PRD 上传后的流水线提议（方向3）

Commander 对话先行给出摘要，下方展开**全宽内联方案卡**：
- 结构化展示各阶段（节点 + 类型 + 预计时长）
- 点击"自定义"进入就地编辑模式（方案卡直接变为可编辑，无需跳转）
- 编辑完成后 Commander 自然语言复述变更并确认启动
- 整个流程在同一页面内完成

### 4. 流水线卡片生命周期

方案卡确认后不消失，贯穿需求全生命周期：
- **配置态**：可编辑，展示各阶段结构
- **执行态**：实时更新，显示当前阶段、进度、token 消耗
- **审批态**：高亮等待节点，内嵌审批操作

### 5. 需求详情页布局（方案3）

点击某个需求进入详情页，主区域展示完整流水线状态，Commander 作为右侧固定侧边栏随时可对话：

```
┌─────────────────────────────────────┬────────────┐
│  需求详情                            │ Commander  │
│  Pipeline（横向阶段流）              │  对话区    │
│  当前阶段 Agent 工作台               │  指令输入  │
│  底部标签：产出 / 审批 / Token       │            │
└─────────────────────────────────────┴────────────┘
```

### 6. Agent 可视化风格（已更新至科技感全息风格）

- **风格**：扁平科技感（Flat Vector + Cyber Hologram）
- **颜色身份**：每个 Agent 独立颜色（指挥官紫·产品蓝·UX粉·架构绿·研发青·审查橙·测试黄·部署白）
- **工作状态**：几何头盔 + 全息护目镜脉冲 + 双臂打字动画 + 浮现全息工作屏
- **完成状态**：漂浮动画 + 庆祝姿势 + 亮色粒子
- **并行支持**：同一需求下多个 Story 可同时显示多个研发 Agent 工作实例

---

## Core User Experience

### Defining Experience

AI-DZHT 的核心体验节奏是 **"打开即知状态，看到即可决策"**。

用户每天最高频的行为是查看进度 + 处理审批，而非提交新需求。产品的第一屏必须直接回答"现在哪里需要我"，而不是展示所有信息让用户自己筛选。

### Platform Strategy

- **主平台**：Web 浏览器，桌面端优先
- **输入方式**：键鼠为主，审批操作兼容移动端
- **无需离线功能**：依赖实时 Agent 执行状态
- **角色视图**：登录角色自动判断，系统匹配对应默认视图，用户无需手动切换

### Role-Based Dashboard Views

同一套系统，三种角色默认视图，均支持向下钻取：

**研发中心总监 / PM（项目级，~20个并行项目）**
```
⚑ 需要你处理 (N)          ← 始终置顶，项目级审批
─────────────────────────
项目总览
电商重构   ████████░░  8需求  ⟳6  ⚑1
用户系统   ██████░░░░  5需求  ⟳4  ⚑0
...（折叠，点击钻取至需求级）
```

**研发团队负责人（需求级，3-8个项目）**
```
⚑ 需要你处理 (N)          ← 需求级审批节点
─────────────────────────
项目需求列表
用户认证模块  [开发中]  ████████░░  75%
支付流程重构  [架构中]  ████░░░░░░  40%
...（点击钻取至 Pipeline 详情）
```

**研发工程师（Story 级，2-3个项目）**
```
我的任务                   ← Story 级状态
  Story B-042  ⟳ Agent 工作中
  Story C-043  待开始
─────────────────────────
项目整体进度（折叠）
```

### Effortless Interactions

**零摩擦交互1：查看需求卡在哪**
无需点进详情页。大盘层级直接可读：当前阶段 + 等待类型（Agent执行中 / 等待审批 / 出错）。颜色 + 图标 + 极简文字三重编码，扫一眼即懂。

**零摩擦交互2：向指挥官发指令**
Commander 输入框在任意页面持久可见，无需导航切换。指挥官自动识别当前角色和上下文——PM 发指令得到项目级回答，工程师发指令得到 Story 级回答。

### Critical Success Moments

**时刻1：首次打开大盘**
角色视图自动匹配，"需要处理的事"置顶显示，其余自动折叠。用户感受到：系统知道我是谁，知道我该看什么。

**时刻2：第一次审批**
审批界面给出完整决策上下文（Agent 做了什么、产出是什么、建议是什么、风险是什么），用户在 30 秒内做出有底气的判断。可信度从这一刻建立。

**时刻3：第一个需求跑完全流程**
大盘状态变为"已完成"，可回溯每个阶段的产出和耗时。ROI 从抽象变具体。

### Experience Principles

1. **状态永远显而易见**：用户不需要"寻找"——系统主动按角色呈现最相关的信息
2. **审批必须有底气**：每个人工节点提供足够决策依据，30 秒内可做出有信心的判断
3. **指挥官随时待命**：Commander 输入永远可达，上下文自动感知角色和当前页面
4. **层级钻取，不强迫全览**：默认视图克制，用户按需深入，不被不相关信息淹没
5. **自动推进是默认，介入是例外**：视觉重心永远在"需要你处理的事"上

---

## Desired Emotional Response

### Primary Emotional Goals

AI-DZHT 追求三层递进的情绪体验：

**第一层：信任感**（"我可以放心把这个交给它"）
这是产品存在的前提。用户必须相信 Agent 的判断足够可靠，才会真正放手让系统自动推进。信任不是一次性建立的，而是通过每次透明的执行过程、每次准确的阶段产出、每次有底气的审批体验逐渐积累的。

**第二层：掌控感**（"我掌控全局"）
放手不等于失控。用户随时知道每个需求在哪个阶段、每个 Agent 在做什么、下一个需要自己介入的节点是什么。掌控感来自透明度和随时可干预的能力，而非频繁操作。

**第三层：效能感**（"AI 真的在帮我干活"）
当信任和掌控都建立后，用户开始感受到真实的效能提升——时间省了、token 消耗可量化、需求完成速度加快。效能感让用户从"愿意用"变成"离不开"。

### Emotional Journey Mapping

| 场景 | 期望情绪 | 设计支撑 |
|---|---|---|
| 首次打开大盘 | 好奇 → 快速建立信心 | 角色视图自动匹配，状态一目了然 |
| 日常查看进度 | 安心 + 掌控 | "需要你处理"清单简洁，其余折叠 |
| 处理审批节点 | 有底气 + 信任 | 完整决策上下文，30秒内可判断 |
| Agent 出错 / 卡住 | 清晰 + 不慌 | 明确告知出了什么、影响什么、下一步怎么做 |
| 需求跑完全流程 | 满足 + 成就 | 可回溯每个阶段产出，ROI 可见 |
| 再次使用 | 习惯 + 依赖 | 历史数据积累，系统越来越懂业务 |

### Micro-Emotions

| 追求 | 避免 | 设计决策 |
|---|---|---|
| 信任 | 不信任·不敢放手 | Agent 行为全程可见，决策可追溯 |
| 掌控 | 焦虑·不知道在干什么 | 状态永远有明确值，无"不知道"中间态 |
| 清晰 | 疲惫·信息过载 | 角色视图克制，默认折叠非关键信息 |
| 底气 | 盲目·走过场式审批 | 每个审批节点配套完整上下文 |

### Design Implications

**信任感 → 设计选择：**
- Agent 工作状态实时可见（活动动画 + token 计数）
- 每个阶段产出可查阅，决策链可追溯
- 审批界面给出 Agent 的判断依据，而不只是"通过/拒绝"按钮

**掌控感 → 设计选择：**
- 流水线随时可暂停/调整，Commander 随时响应干预指令
- 清晰的层级钻取（知道自己在哪层，随时可以上浮）
- "需要你处理"清单是真实控制点，不是走过场

**效能感 → 设计选择：**
- 时间 + token 消耗统计，量化 AI 工作量
- 历史对比数据（"这个需求比上次同类快了 30%"）
- 需求完成后的完整回溯视图

**出错时的清晰感 → 设计选择：**
- 错误信息用业务语言，不是技术报错
- 明确标注影响范围（哪些后续阶段受影响）
- 给出明确的下一步行动选项（重试 / 人工介入 / 修改参数）
- Commander 主动推送错误摘要，而不是等用户发现

### Emotional Design Principles

1. **透明即信任**：Agent 的每一个行动都可见、可解释——看得见才敢相信
2. **克制即掌控**：不用频繁操作才叫掌控，大盘默认只展示"需要你处理的"
3. **出错不等于失控**：错误是正常的，关键是用户知道出了什么、下一步怎么走
4. **量化即效能**：把 AI 的工作翻译成用户能感受和汇报的语言（时间、token、速度）

---

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**GitHub** — 开发者工作流的 UX 标杆

- **PR Review 模型**：把"给你足够信息做决定"做到极致。diff + CI 状态 + reviewer 意见 + 一个决策按钮，上下文完整，操作极简
- **Actions 流水线**：Job/Step 状态可视化清晰，✓ ● ✗ 三符号系统全球开发者秒懂
- **Notification Triage**：按 Review requested / Mentioned / Assigned 分层，不同优先级不同入口
- **整体原则**：深度可达，表面克制——默认视图只露关键信息

**VS Code** — 复杂工具的界面清晰度典范

- **Command Palette**：Cmd+Shift+P 随时呼出，输入意图即可，无需记忆菜单路径
- **Status Bar**：底部持久状态条，关键信息始终可见但不干扰主工作区
- **Problems 面板**：跨文件聚合错误/警告，一处查看所有问题
- **克制原则**：复杂功能隐藏直到需要，默认界面保持干净

### Transferable UX Patterns

**直接采用：**
- GitHub 的 ✓ ● ✗ 状态符号系统 → Agent 状态视觉语言
- GitHub PR Review 的上下文布局 → AI-DZHT 审批节点界面
- VS Code Command Palette 的"随时可达"理念 → Commander 输入框设计
- VS Code Problems 面板的聚合哲学 → "需要你处理"清单设计

**改造后采用：**
- GitHub Actions 流水线节点图 → 加入 Agent 角色可视化和动态状态
- VS Code Status Bar → 改造成角色感知的持久状态条（当前需求 / 活跃 Agent / 待审批数）
- GitHub Notification Triage → 结合角色视图，按层级和紧急度分流

### Anti-Patterns to Avoid

| 反模式 | 参照 | 规避原因 |
|---|---|---|
| 全字段同时暴露 | Jira | 信息密度过高，用户不知道看哪里 |
| 错误埋在日志海 | Jenkins | 出错时定位成本极高，破坏"清晰不慌"的情绪目标 |
| 通知权重均等 | Slack | 所有提醒同等重要 = 所有提醒都被忽略 |
| 导航层级过深 | GitLab | 超过 3 次点击才到达目标，与零摩擦原则冲突 |

### Design Inspiration Strategy

**采用：**
- GitHub 的状态符号系统（✓ ● ✗）——通用、无需解释
- GitHub PR Review 的决策上下文结构——审批节点的黄金标准
- VS Code 的 Command Palette 心智模型——Commander 始终可达

**改造：**
- GitHub Actions 流水线图 → 加入 Agent 角色动画，从"步骤图"升级为"工作台"
- VS Code Status Bar → 角色感知版本，PM 看项目级健康，工程师看 Story 级进度

**避免：**
- Jira 式信息密度——与"克制即掌控"原则冲突
- Jenkins 式错误提示——与"出错不失控"的情绪目标冲突
- 超过 3 层的导航深度——与零摩擦交互原则冲突

---

## Design System Foundation

### 选型决策

**Shadcn/ui + Tailwind CSS + 自定义扩展**

基础层采用 Shadcn/ui 组件库（基于 Radix UI 原语），样式层采用 Tailwind CSS 工具类，在此之上扩展专属的 AI-DZHT 视觉语言。

**选型理由：**
- **Shadcn/ui**：组件代码完全可控，不依赖黑盒 npm 包；Radix UI 原语保证无障碍交互（键盘导航、焦点管理）
- **Tailwind CSS**：设计 Token 天然集成于 `tailwind.config.js`；Dark mode 一等公民支持
- **自定义扩展层**：Pipeline Node、Agent Character、Approval Card 等业务组件完全自定义

### 双主题策略

**Apple System Color 哲学：** 亮色 / 暗色双主题，每个颜色在两种模式下独立调优——不是简单地翻转明暗，而是保证情感一致性的前提下各自最优。

**暗色 Token：**
```css
--bg-base:   #000000;    /* 最底层，纯黑 */
--bg-panel:  #1C1C1E;    /* 卡片、面板 */
--bg-p2:     #2C2C2E;    /* 次级容器 */
--bg-p3:     #3A3A3C;    /* hover、tag */
--border:    rgba(255,255,255,0.09);
--text-1:    #FFFFFF;
--text-2:    #AEAEB2;
--text-3:    #48484A;
```

**亮色 Token：**
```css
--bg-base:   #F5F5F7;
--bg-panel:  #FFFFFF;
--bg-p2:     #F5F5F7;
--border:    rgba(0,0,0,0.08);
--text-1:    #1D1D1F;
--text-2:    #6E6E73;
--text-3:    #AEAEB2;
```

**系统语义色（暗色 / 亮色）：**

| 语义 | 暗色 | 亮色 | 用途 |
|---|---|---|---|
| Accent / Action | `#0A84FF` | `#007AFF` | 主操作、链接 |
| Success | `#30D158` | `#34C759` | 完成、通过 |
| Warning | `#FF9F0A` | `#FF9500` | 运行中、审批等待 |
| Danger | `#FF453A` | `#FF3B30` | 错误、终止 |
| Commander | `#5E5CE6→#BF5AF2` | same | 指挥官专属渐变 |

### Agent 颜色身份系统

每个 Agent 拥有固定的颜色身份，在所有 UI 组件（边框、高亮、徽章、角色图形）中保持一致：

| Agent | 主色（暗色） | 主色（亮色） |
|---|---|---|
| 指挥官 | `#BF5AF2`（紫） | `#AF52DE` |
| 产品 Agent | `#0A84FF`（蓝） | `#007AFF` |
| UX Agent | `#FF375F`（玫红） | `#FF2D55` |
| 架构 Agent | `#30D158`（绿） | `#34C759` |
| 研发 Agent | `#64D2FF`（青） | `#32ADE6` |
| 审查 Agent | `#FF9F0A`（橙） | `#FF9500` |
| 测试 Agent | `#FFD60A`（黄） | `#FFCC00` |
| 部署 Agent | `#98989D`（灰） | `#8E8E93` |

### 三层组件策略

1. **直接使用 Shadcn/ui**：Button、Input、Badge、Dialog、Tabs、Dropdown — 仅覆盖 Token 颜色
2. **深度改造**：Card（加 border-color 语义编码）、Status Badge（加动画 pulse）、Progress（多段式变体）
3. **完全自定义**：Pipeline Node、Agent Character、Approval Card、Commander Input

### 毛玻璃（Glass Morphism）

用于需要层次感的浮层：顶部导航栏、Commander 侧边面板、Tooltip、底部详情弹出。

```css
backdrop-filter: blur(24px) saturate(180%);  /* 亮色 */
backdrop-filter: blur(24px) saturate(160%);  /* 暗色 */
```

**参考实现：** `_bmad-output/planning-artifacts/prototype-design-system.html`

---

## Agent 角色视觉规范

### 设计方向

**拟人化同事风格**：每个 Agent 是一个有个性的 AI 同事，而非抽象图标或科技感机器人。风格参照游戏中的角色立绘——扁平矢量、有明确职业特征、可读性强。用户与 Agent 互动时应感受到"在和真实的团队成员协作"。

### 各 Agent 角色设定

| Agent | 外观特征 | 标志性道具 | 性格表达 |
|---|---|---|---|
| **指挥官** | 军事制服 + 金肩章 + 头戴耳麦 | 全息指令面板 + 指挥手势 | 自信、权威、向前看 |
| **产品 Agent** | 商务蓝衬衫 + 圆框眼镜 | 线框原型 Pad + 思考泡泡 | 专注、分析、善于倾听 |
| **架构 Agent** | 工程绿夹克 + 白色安全帽 | 蓝图卷轴 + 高举讲解 | 沉稳、资深、方案导向 |
| **研发 Agent** | 青色帽衫 + 头戴耳机 | 键盘打字 + 咖啡杯 | 专注投入、有点社恐 |
| **UX Agent** | 玫红创意装 + 发髻 + 发夹 | 触控笔 + 色彩盘 | 热情、创意、注重细节 |
| **审查 Agent** | 橙色督察外套 + 单片眼镜 | 放大镜 + 审查清单 | 严谨、不苟言笑、公正 |
| **测试 Agent** | 黄色安全背心 + 防护目镜 | 测试管 + 追踪 Bug | 警觉、细心、爱找问题 |
| **部署 Agent** | 深灰 Ops 夹克 + 火箭徽章 | 扳手 + 服务器机架 | 可靠、行动派、使命必达 |

### 工作状态动画

| 状态 | 动画行为 | 视觉呈现 |
|---|---|---|
| **空闲** | 缓慢上下漂浮（bob，3.5s） | 正常亮度，无特效 |
| **工作中** | 双臂打字交替摆动（0.48s loop）+ 呼吸光晕 | Agent 颜色边框脉冲发光 |
| **已完成** | 浮起动作（float，2s）+ 举臂庆祝 | 星形粒子散射 |

**用户交互：**
- 单击：循环切换 空闲 → 工作中 → 已完成 状态
- 双击：展开底部详情面板（职责介绍 + 技能列表）
- 空格键（大盘层）：全员进入工作状态

**参考实现：** `_bmad-output/planning-artifacts/prototype-agent-characters.html`

---

## Pipeline 流水线组件规范

### 视觉结构

**横向阶段流**：各阶段节点横向排列，连接箭头承载动态粒子效果，整体传递"数据在流动、Agent 在工作"的感知。

### 节点状态

| 状态 | 边框 | 背景 | 动画 |
|---|---|---|---|
| **已完成（done）** | `--success` 绿色实线 | 绿色半透明底 | 无额外动画 |
| **活跃（active）** | `--accent` 蓝色实线 | 蓝色半透明底 | 扫描线从上到下 + 外框呼吸发光 |
| **审批等待** | `--warning` 橙色实线 | 橙色半透明底 | 橙色外框呼吸发光 |
| **待开始（pending）** | 默认边框 | 默认背景 | 50% 透明度 |
| **并行（parallel）** | `--purple` 紫色 | 紫色半透明底 | 底部小圆点数量 = 并行实例数 |

### 连接线动效

- **已完成路径**：绿色实线 + 双粒子交错流动
- **进行中路径**：绿色→蓝色渐变线 + 双粒子
- **未到达路径**：暗色虚线，无粒子

**粒子规格：** 直径 6px，颜色 `--accent`，发光阴影 `0 0 8px var(--accent)`，从左到右 1.6s 线性动画，两粒子错开 0.8s

### 阶段内容

每个节点展示：图标（emoji）+ 阶段名（大写标签） + 状态文字 + 顶部颜色光条 + 活跃时扫描线

当前活跃阶段下方展开**阶段详情栏**：Agent 信息 + 并行 Story 列表 + 实时 Token 计数

**参考实现：** `_bmad-output/planning-artifacts/prototype-design-system.html`（§7 Pipeline 区块）

---

## Defining Core Experience

### 定义性体验

AI-DZHT 的定义性体验是：**"提交需求，指挥官问你三个问题，流水线启动，你只需要在几个关键节点做决定"**。

类比：如果说 Tinder 是"向右滑匹配"，AI-DZHT 是"告诉指挥官你要做什么，然后看着它被完成"。

### 用户心智模型

用户将 AI-DZHT 类比为**"有一支随时在线的研发团队"**：

- **PM / 总监**：我是客户，指挥官是项目经理，我只需要提需求和做关键决策
- **团队负责人**：指挥官是我的助理，帮我追踪所有进度，出问题了第一时间告诉我
- **工程师**：Agent 是我的 Pair Partner，帮我做重复性工作，我只做最需要人类判断的部分

**心智错误点（需要设计规避）：**
- 担心 Agent 做错了没人知道 → 解决：每步产出可见、审批节点强制人工确认
- 不知道现在系统在干什么 → 解决：实时动画 + 状态永远有值，不存在"不知道"中间态
- 审批时没底气 → 解决：Approval Card 提供完整决策上下文，30 秒内可做判断

### 核心交互机制

**发起（Initiation）**
用户向 Commander 输入框说明需求或上传 PRD，支持自然语言。Commander 输入框在任意页面持久可达（`⌘K` 呼出）。

**交互（Interaction）**
Commander 解析后给出流水线配置提议，就地展开全宽方案卡（无需跳转）。用户可直接确认或点击自定义进入编辑模式。编辑完成后 Commander 用自然语言复述变更并请求确认。

**反馈（Feedback）**
流水线卡片贯穿需求全生命周期，实时更新当前阶段、Token 消耗、Agent 状态。Agent 角色动画提供情感化的工作感知——看到小人在打字，用户知道"他们在干活"。

**审批节点（Critical Moment）**
系统主动推送"需要你处理"，Approval Card 展示完整上下文：Agent 做了什么 / 产出是什么 / 风险是什么 / 指挥官建议 / 操作按钮。目标：30 秒内有底气决策。

**完成（Completion）**
需求状态变为"已完成"，可回溯每个阶段的产出、时长、Token 消耗。ROI 从抽象变具体。

### 新 vs. 已有 UX 模式

| 维度 | 已有模式（直接采用） | 创新模式（需引导） |
|---|---|---|
| 审批决策 | GitHub PR Review 结构 | Approval Card 内置指挥官建议 |
| 状态符号 | GitHub ✓ ● ✗ 系统 | — |
| 指令输入 | VS Code Command Palette | 上下文感知（自动识别当前需求） |
| 流水线图 | GitHub Actions 节点图 | Agent 角色动画 + 粒子流动 |
| 多实例并行 | — | 同一需求多个研发 Agent 同时工作可视 |

---

## Visual Design Foundation

### Color System

**策略：Apple System Color 哲学**

不使用固定 Hex 色板，而是采用**自适应语义色**——每种颜色在亮色 / 暗色下独立调优，确保对比度和情感一致性。

**背景层级（4 层）：**

| Token | 暗色 | 亮色 | 用途 |
|---|---|---|---|
| `--bg-base` | `#000000` | `#F5F5F7` | 页面底层背景 |
| `--bg-panel` | `#1C1C1E` | `#FFFFFF` | 卡片、面板 |
| `--bg-p2` | `#2C2C2E` | `#F5F5F7` | 次级容器、标签 |
| `--bg-p3` | `#3A3A3C` | `#E8E8ED` | hover 态、tag 背景 |

**边框与文字（经无障碍审查）：**

| Token | 暗色 | 亮色 | 对比度（暗色 on panel） |
|---|---|---|---|
| `--border` | `rgba(255,255,255,0.09)` | `rgba(0,0,0,0.08)` | — |
| `--border-strong` | `rgba(255,255,255,0.18)` | `rgba(0,0,0,0.18)` | — |
| `--text-1`（主文字） | `#FFFFFF` | `#1D1D1F` | 16.7:1 ✓ AAA |
| `--text-2`（次要） | `#AEAEB2` | `#6E6E73` | 4.3:1 ✓ AA |
| `--text-3`（分隔线/装饰） | `#636366` | `#AEAEB2` | 3.1:1（仅用于非文字场景） |

> ⚠️ **约束**：`--text-3` 仅用于纯装饰性元素（分隔线、图标描边、禁用 tag），**禁止用于任何文字内容**。最小字号文字（Caption 11px、Eyebrow 11px）必须使用 `--text-2` 或更高。

**语义色（双模式校准）：**

| 语义 | 暗色 | 亮色 | 用途场景 |
|---|---|---|---|
| Accent | `#0A84FF` | `#007AFF` | 主操作按钮、选中态、链接 |
| Success | `#30D158` | `#34C759` | 完成态、通过审批 |
| Warning | `#FF9F0A` | `#FF9500` | 运行中、等待审批、提醒 |
| Danger | `#FF453A` | `#FF3B30` | 错误、终止、拒绝 |
| Commander | `#5E5CE6 → #BF5AF2` | 同上 | 指挥官专属渐变 |

> ⚠️ **Commander 渐变使用约束**：渐变仅用于图形元素（Avatar、Button 背景、Top Bar 光条），**禁止用于文字色或边框色**，以防亮色模式下对比度失效。

**同屏颜色数量限制：**

| 视图层级 | Agent 颜色规则 |
|---|---|
| 大盘视图（项目级 / 需求级） | Agent 颜色**降级为灰色**，仅用语义色（蓝/绿/橙/红）传达状态 |
| 需求详情页 | 激活**当前活跃 Agent 的颜色**（最多同时 1–2 种） |
| Agent 角色展示页 | 全色显示，场景单纯，不产生认知冲突 |

原则：**同一视图最多同时出现 5 种有语义的颜色**，超出部分降级为中性灰。

---

### Typography System

**字体栈：**
```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
             "Segoe UI", "PingFang SC", "Helvetica Neue", Arial, sans-serif;
```

优先系统字体；Windows 用 Segoe UI（比 Arial 更接近 SF Pro 的字重节奏）；中文回退 PingFang SC。无需额外加载，渲染性能最优。

**等宽字体（Token / 数字 / 代码）：**
```css
font-family: "SF Mono", "Segoe UI Mono", Menlo, Consolas, monospace;
```

**字型比例：**

| 级别 | 尺寸 | 字重 | 字间距 | 最小颜色要求 | 用途 |
|---|---|---|---|---|---|
| Display | 34px | 800 | -0.8px | `--text-1` | 页面主标题 |
| Title 1 | 28px | 700 | -0.6px | `--text-1` | 模块标题 |
| Title 2 | 22px | 700 | -0.4px | `--text-1` | 需求名称、卡片标题 |
| Headline | 17px | 600 | -0.2px | `--text-1` | 面板标题、重要标签 |
| Body | 15px | 400 | 0 | `--text-1` | 主体内容、描述 |
| Footnote | 13px | 400 | 0 | `--text-2` | 次要信息、时间戳 |
| Caption | 11px | 600 | +0.8px | **`--text-2`（最低）** | 分类标签（全大写），禁用 `--text-3` |
| Mono | 13px | 400 | 0 | `--text-2` | Token 数字、代码、路径 |

**中文优化：** 行高统一 1.6；`text-rendering: optimizeLegibility` 全局开启；`-webkit-font-smoothing: antialiased`。

---

### Spacing & Layout Foundation

**基础单位：4px 网格**

```
4px  — 最小间隙（icon 内边距、tag 内边距）
8px  — 相关元素间距（label → input 间距）
12px — 同组元素（行内标签列表）
16px — 组件标准内边距
20px — 卡片内边距
24px — 面板内边距
28px — 大型面板内边距
32px — 区域间距
48px — 页面 section 间距
```

**圆角（锁定值，不浮动）：**

| 场景 | 圆角 |
|---|---|
| 小元素（tag、kbd、badge、状态点容器） | 5px |
| 按钮、输入框、小卡片 | 10px |
| 标准卡片、面板 | 14px |
| 大型容器、模态、Agent 卡 | 20px |
| 圆形（头像、状态圆点） | 50% |

**页面布局：**
- 最大内容宽度：1100px，水平居中
- 页面侧边距：36–40px
- Commander 侧边栏：固定宽 320px，右侧 sticky
- 顶部导航：高度 52px，fixed，毛玻璃材质

**阴影系统（统一用 CSS 变量，避免 Tailwind dark: 爆炸）：**

```css
/* 在 :root 和 [data-theme] 中分别定义 */
[data-theme="dark"] {
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.5);
  --shadow:    0 4px 16px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.3);
  --shadow-lg: 0 12px 40px rgba(0,0,0,0.65), 0 3px 10px rgba(0,0,0,0.4);
}
[data-theme="light"] {
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.04);
  --shadow:    0 2px 10px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05);
  --shadow-lg: 0 8px 30px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);
}
/* 使用时 */
box-shadow: var(--shadow-sm);
```

---

### Accessibility Considerations

1. **颜色不单独传达信息**：状态始终有颜色 + 图标 + 文字三重编码（✓ ● ✗ + 颜色 + 文字标签）
2. **键盘完全可操作**：所有交互组件支持 Tab / Enter / Space / Esc，焦点环清晰（`outline: 3px solid var(--accent)`）
3. **动画可关闭**：
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.001ms !important;
       transition-duration: 0.15s !important;
     }
     /* 流动粒子、扫描线、Agent 角色动画 → 替换为 opacity 淡入淡出 */
   }
   ```
4. **主题跟随系统**：默认读取 `prefers-color-scheme`，用户手动覆盖后持久化到 localStorage
5. **最小触摸目标**：所有可点击元素最小 44×44px（iOS HIG 标准）
6. **小字号对比度合规**：Caption（11px）/ Footnote（13px）最低使用 `--text-2`，确保 ≥4.3:1
7. **中文字体回退链完整**：`PingFang SC` 覆盖 macOS/iOS，`Microsoft YaHei` 作为 Windows 中文后备可酌情添加
