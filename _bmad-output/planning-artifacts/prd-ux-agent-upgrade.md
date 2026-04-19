---
type: prd
status: draft-v4
author: Zhangshanshan
date: 2026-04-17
review-v1: 2026-04-17（UX 专业视角 review，已修复 10 处问题）
review-v2: 2026-04-17（使用者视角 review，已修复 U1-U5 五个体验断点）
review-v3: 2026-04-17（对抗性审查，已修复 T1-T5 token 效率、C1-C4 上下文沉淀、A1-A3 可用性共 9 个问题）
inputDocuments:
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "分析来源：/Users/zhangshanshan/Documents/GitHub/gstack/design-review/SKILL.md"
  - "分析来源：/Users/zhangshanshan/Documents/GitHub/gstack/design-html/SKILL.md"
  - "分析来源：/Users/zhangshanshan/Documents/GitHub/gstack/design-consultation/SKILL.md"
  - "分析来源：/Users/zhangshanshan/Documents/GitHub/gstack/plan-design-review/SKILL.md"
  - "分析来源：/Users/zhangshanshan/AI-DZHT/.claude/skills/bmad-agent-ux-designer/SKILL.md"
  - "分析来源：/Users/zhangshanshan/AI-DZHT/.claude/skills/bmad-create-ux-design/**"
---

# PRD — UX Designer Agent（Sally）能力升级 v4

## 执行摘要

Sally 是 AI-DZHT 平台内置的 UX 设计师 Agent，当前**仅有一项能力**：从零创建 UX 设计规范（`bmad-create-ux-design`，13 步工作流）。

对比行业主流 UX 设计师工作实际，Sally 存在五个结构性缺口：

1. **只能"创"，不能"审"**：真实 UX 工作 40%+ 时间在审查、改善现有设计
2. **只输出文字规范，无可视化产出**：无法生成用户可即时预览的 HTML 页面
3. **无信息架构能力**：Sitemap 和导航结构是 UX 骨架，但 Sally 完全没有对应工作流
4. **无开发交付规范**：Sally 和研发 Agent 之间缺乏正式的 Handoff 协议，设计意图无法准确传递
5. **对 AI 产品 UX 无专项指导**：AI-DZHT 涉及流式输出、Agent 状态可视化等特殊场景

本 PRD 定义 Sally 的**六项新增能力**，并对现有 `CU` 工作流核心步骤进行增强。

---

## 现状分析

### 当前能力菜单

| 代码 | 描述 | 技能 |
|------|------|------|
| CU | 从零创建完整 UX 设计规范 | `bmad-create-ux-design`（13 步） |

### `bmad-create-ux-design` 当前步骤评价

| 步骤 | 内容 | 评价 |
|------|------|------|
| Step 1–2 | 初始化 + 项目发现 | ✅ 完整 |
| Step 3 | 核心体验定义 | ✅ 完整 |
| Step 4 | 情感响应设计 | ✅ 完整 |
| Step 5 | 灵感参考收集 | ✅ 完整 |
| Step 6 | 设计系统选型 | ⚠️ 浅：仅选库，无美学方向决策 |
| Step 7 | 交互机制定义 | ✅ 完整 |
| Step 8 | 视觉基础（颜色/字体/间距） | ✅ 完整 |
| Step 9 | 设计方向（HTML mockup） | ⚠️ 浅：仅文字描述，无可交互产出 |
| Step 10 | 用户旅程流（Mermaid 图） | ✅ 完整 |
| Step 11 | 组件策略 | ✅ 完整 |
| Step 12 | UX 一致性模式 | ⚠️ 缺微文案规范章节 |
| Step 13 | 响应式 + 无障碍 | ✅ 完整 |
| Step 14 | 完成 | ⚠️ 缺 Handoff 交接步骤 |

### 行业能力缺口（对齐版）

> ⚠️ **v1 修复说明**：原版缺口分析与新增能力之间存在不对齐——信息架构（🔴 严重）和用户研究规划已列为缺口，但 4 个新增能力中均无覆盖。v2 已补全。

| 行业标准 UX 能力 | Sally 现状 | 缺口等级 | v2 覆盖 |
|---|---|---|---|
| UX Audit / 设计审查 | ❌ 完全没有 | 🔴 严重 | ✅ RE |
| 信息架构（IA / Sitemap） | ❌ 无独立能力 | 🔴 严重 | ✅ IA（新增）|
| 可视化 HTML 预览生成 | ❌ 仅文字规范 | 🔴 严重 | ✅ HG |
| 开发交付规范（Handoff） | ❌ 完全没有 | 🟠 重要 | ✅ HD（新增）|
| AI/Agent 交互 UX 专项 | ❌ 无专项指导 | 🟠 重要 | ✅ 横切 + CU 增强 |
| 内容策略 / Microcopy | ❌ 只能审查不能生成 | 🟠 重要 | ✅ RE/CU 增强 |
| 设计方向美学决策 | ⚠️ 过于简单 | 🟠 重要 | ✅ DS |
| 计划设计评审 | ❌ 无 | 🟠 重要 | ✅ PR |
| 竞品 UX 分析 | ❌ 无 | 🟡 一般 | ⚠️ DS 内含轻量版 |
| 可用性测试规划 | ❌ 无 | 🟡 一般 | ⚠️ P2 待定 |

---

## 需求目标

### 核心目标

1. **让 Sally 能"架构"**：新增信息架构能力，产出 Sitemap 和导航结构，作为设计的骨架
2. **让 Sally 能"审"**：新增设计审计能力，对现有界面做结构化评估，输出问题清单
3. **让 Sally 能"看"**：新增 HTML 预览生成能力，基于规范直接生成可交互页面
4. **让 Sally 能"交付"**：新增开发 Handoff 能力，明确 UX 与研发的协作接口
5. **让 Sally 能"查"**：新增计划设计评审，在实现前对 PRD/架构做 UX 视角评审
6. **让 Sally 更"深"**：升级设计系统步骤，引入美学方向决策框架

### 成功指标

> ⚠️ **v1 修复说明**：原版指标全为功能性指标，无面向结果的质量指标。v2 补充了 3 个结果指标。

| 维度 | 指标 | 当前 | 目标 |
|---|---|---|---|
| **功能覆盖** | Agent 能力菜单项数 | 1 | 7 |
| **功能覆盖** | 工作流产出类型 | 仅 .md | .md + .html + Handoff 文档 |
| **功能覆盖** | 设计审计覆盖维度 | 0 | 10 类 80+ 项 |
| **质量结果** | RE 审计发现的高优问题，下次版本修复率 | — | ≥ 80% |
| **质量结果** | 经过 PR 评审的 PRD，实现阶段 UX 返工次数 | — | ≤ 1 次/需求 |
| **质量结果** | HG 生成后用户需要精修的平均轮次 | — | ≤ 3 轮 |
| **协作效率** | Sally → 研发 Agent 交付后，实现理解偏差次数 | — | ≤ 1 次/需求 |

---

## Sally 在 BMAD 体系中的协作协议

> ⚠️ **v1 修复说明**：原版完全缺失此章节。Sally 是 BMAD 流水线中的一环，必须定义上下游接口。

### 上游输入（Sally 从谁那里接收什么）

| 来源 Agent | 交付物 | Sally 使用方式 |
|---|---|---|
| John（产品 PM） | PRD 文档（`prd-*.md`） | CU Step 2 / PR 评审的核心输入 |
| John（产品 PM） | 产品简报（`product-brief-*.md`） | CU Step 2 发现阶段读取 |
| Winston（架构师） | 系统架构文档（`system-architecture.md`） | PR Pass 5 设计系统对齐检查 |
| Winston（架构师） | 技术约束列表 | CU Step 3 平台策略决策输入 |

### 下游输出（Sally 向谁交付什么）

| 接收 Agent | Sally 交付物 | 格式 | 触发条件 |
|---|---|---|---|
| Winston（架构师） | UX 约束清单（组件边界、布局约束、性能要求） | 追加至 `ux-design-specification.md` | CU 完成后 |
| Amelia（研发 Agent） | 开发 Handoff 文档 | `ux-handoff-{feature}.md` | HD 能力执行后 |
| Amelia（研发 Agent） | HTML 参考原型 | `ux-{screen}-preview.html` | HG 能力执行后 |
| Quinn（测试 Agent） | UX 验收标准 | 追加至 Handoff 文档 | HD 能力执行后 |

### Sally 的 UX QA 角色（实现后验收）

> 当前缺失，规划为 **P2** 能力扩展（依赖 HD 能力先完成）：
> - Amelia 实现完成后，Sally 对照 `ux-design-specification.md` 和 Handoff 文档做 UX 验收
> - 输出：验收通过 / 问题清单（需返工的 UX 偏差）
> - 接入点：在研发 Story 完成节点后触发

---

## 新增能力详细需求

---

### 能力 IA — Information Architecture（信息架构）

> ⚠️ **v1 修复说明**：原版在缺口分析中标为🔴严重，但未对应任何能力。本章节为补充。

**定位**：UX 设计的骨架层。在视觉设计开始前，先确定"内容放在哪里、如何组织、如何导航"。

**触发场景**：
- 新产品从零构建，需要规划页面结构
- 产品功能大幅扩展，现有导航需要重构
- 用户反馈"找不到"某功能时做 IA 优化

**工作流（4 步）**：

**Step IA-1：内容清单（Content Inventory）**
列出所有需要在产品中呈现的内容和功能，不评判归属，只做穷举：
- 从 PRD 中提取所有功能模块
- 从用户旅程中提取所有页面接触点
- 输出：完整内容清单（功能 + 数据 + 操作）

**Step IA-2：内容分组（Card Sorting 模拟）**
对内容清单做逻辑分组，方法：
- 按用户心智模型分组（用户会在哪里找这个？）
- 按操作频率分组（高频 vs 低频）
- 按用户角色分组（哪些内容只对特定角色有意义）
- 输出：分组结果 + 分组理由

**Step IA-3：导航结构设计**
基于分组结果设计导航层级，规则：
- 最多 3 层深度（超过 3 次点击即为设计失败）
- 全局导航 / 局部导航 / 上下文导航 明确区分
- 每个页面必须回答：我在哪里？我可以去哪里？
- 输出：Mermaid 树状 Sitemap + 导航类型标注

**Step IA-4：页面层级命名规范**
定义所有页面/功能区的正式名称：
- 避免技术名词（用业务语言）
- 与 PRD 术语保持一致
- 中英文对照（用于代码路由命名）
- 输出：页面名称表（显示名/路由名/描述）

**产出物**：
- Sitemap（Mermaid 树状图，追加至 UX 规范文档 **Part 2**）
- 导航结构决策文档（追加至 **Part 2**）
- 页面名称表（追加至 **Part 2**）

**与其他能力的关系**：
- 应在 CU Step 3（核心体验定义）之后、Step 7（交互机制）之前执行
- 为 PR Pass 1（信息架构评审）提供对比基准
- 为 HD（Handoff）提供页面路由信息

---

### 能力 RE — UX Audit（设计审计）

**来源**：吸收自 GStack `design-review` 技能（88KB 工作流）

**触发场景**：
- 用户说"帮我审查一下现有设计"
- 新功能上线前的 UX 质量门
- 实现完成后的 UX 验收（接 Amelia 交付）

**⚠️ 当前版本输入限制**（v1 修复补充）：
> 由于缺少浏览器截图工具（GStack browse binary 不可用），本版本 RE 能力**无法自动分析线上运行页面截图**。当前支持的输入形式：
> - 已有 HTML 文件（最高质量）
> - UX 规范文档（`ux-design-specification.md`）
> - 用户文字描述的界面（质量取决于描述精度）
>
> 未来版本支持截图分析的前提：集成浏览器截图能力或用户手动提供截图路径。

**工作流（5 步）**：

**Step RE-1：输入检测与范围确认**
- 接受输入：现有 UX 规范文档 / HTML 文件路径 / 文字描述
- 明确告知用户当前输入类型的审计质量上限
- 读取 `ux-design-specification.md`（如存在）作为设计意图参照
- 读取 `DESIGN.md`（如存在）作为设计系统参照

**Step RE-2：第一印象评估（Trunk Test）**

用 6 个问题快速评估导航和可读性：
1. 这是什么网站/产品？
2. 当前在哪个页面？
3. 页面的主要功能区有哪些？
4. 用户可以在此页面做什么？
5. 如何从这里前往其他主要区域？
6. 有搜索功能吗？

**Step RE-3：10 类系统化审计**

> **异常驱动输出原则（T2 修复）**：80+ 检查项中，通过的项**静默跳过，不输出**。只有发现问题的项才产生输出。最终以统计行汇总：「通过 X/80+ 项，发现问题 Y 项（🔴 n, 🟠 n, 🟡 n）」。禁止逐项列出所有检查结果。

问题输出格式（每行）：
```
[类别] | RE-{H/M/L}{n}: {问题描述} | 影响: {用户/场景} | 建议: {具体改法}
```

| 类别 | 检查项数 | 重点 |
|---|---|---|
| 视觉层级与构图 | 8 | 信息优先级是否通过视觉权重正确传达 |
| 排版系统 | 15 | 字体使用数量、行高、对比度、层级一致性 |
| 颜色与对比度 | 10 | 语义色一致性、WCAG AA 合规（4.5:1 正文） |
| 间距与布局 | 12 | 4px 网格对齐、组件内边距一致性 |
| 交互状态覆盖 | 10 | hover/focus/loading/empty/error/success 状态 |
| 响应式设计 | 8 | 375/768/1024/1440px 四断点适配 |
| 动画与过渡 | 6 | 时长、缓动、reduced-motion 支持 |
| 内容与微文案 | 8 | 错误提示是否业务语言、空状态文案是否有效 |
| AI 滑坡检测 | 10 | 见下方 AI 滑坡黑名单 |
| 性能即设计 | 6 | 加载状态、骨架屏、超时处理 |

**AI 滑坡黑名单（10 项）**：
1. 紫色/靛蓝渐变作为默认配色
2. 3 列特征网格（最典型的 AI 生成布局）
3. 彩色圆圈中的图标
4. 居中一切，无视觉层级
5. 统一圆角气泡边框
6. 装饰性浮动斑点、波浪 SVG
7. 表情符号作为设计元素
8. 卡片左侧彩色边框装饰
9. 通用英雄文案（"开启您的旅程"类）
10. Cookie 切割的 Section 节奏

**Step RE-4：评分与问题分类**
- 双维度评分：**设计质量分（A-F）** + **AI 滑坡风险分（0-10）**
- 问题按影响分级：🔴 高（阻断用户流）/ 🟠 中（影响体验）/ 🟡 低（优化建议）
- 每个问题附：问题描述 + 影响用户 + 改进建议

**Step RE-5：改进建议输出（含微文案）**
- 生成结构化审计报告（追加至 `ux-design-specification.md`）
- 高优先级问题的具体修改建议（前 3 个）
- **微文案专项**：针对内容与微文案类别发现的问题，输出改进后的具体文案（不只是说"有问题"，而是给出修改稿）：
  - 错误提示改写示例
  - 空状态文案建议
  - 确认/危险操作措辞建议
- 建议后续步骤（可接 HG 验证修改效果）

**结构化问题清单文件**（U3 修复）：

> RE Step RE-5 必须额外生成一个轻量 ID 化问题文件，供 HG 精修循环交叉引用。

```markdown
<!-- 文件路径: _bmad-output/planning-artifacts/ux-audit-{YYYYMMDD}.md -->

## RE 审计问题清单 — {日期}

### 高优先级（需 HG 修复）
- [ ] RE-H1: {问题简述} | 影响: {用户/场景} | 建议: {具体改法}
- [ ] RE-H2: {问题简述} | 影响: {用户/场景} | 建议: {具体改法}
- [ ] RE-H3: {问题简述} | 影响: {用户/场景} | 建议: {具体改法}

### 中优先级
- [ ] RE-M1: {问题简述}
- [ ] RE-M2: {问题简述}

### 低优先级
- [ ] RE-L1: {问题简述}

## 审计元数据
- 输入类型: {HTML文件 / UX规范文档 / 文字描述}
- 总问题数: {n}
- 设计质量分: {A-F}
- AI滑坡风险分: {0-10}
```

**产出物**：
- 审计报告（追加至 UX 规范文档 **Part 4: 审计记录**）
- `_bmad-output/planning-artifacts/ux-audit-{YYYYMMDD}.md`（**结构化问题 ID 文件，供 HG 交叉引用**）

---

### 能力 HG — HTML Generator（交互 HTML 生成）

**来源**：吸收自 GStack `design-html` 技能，核心引擎为 `@chenglou/pretext`

**产出物定位说明**（v1 修复补充）：
> HG 产出的是**高保真 HTML 参考原型**，不是低保真线框图。两者有明确区分：
> - **Lo-fi 线框图**：探索布局结构，黑白灰，无视觉风格，用于早期方向讨论（当前 Sally 不支持）
> - **HG 产出**：基于确定的 UX 规范生成视觉还原度高的交互页面，用于用户确认效果、向研发交付参考
>
> 建议使用时机：CU 工作流完成后，或 RE 审计后验证修改效果。不适合作为"探索"工具。

**触发场景**：
- UX 规范完成后，用户想确认视觉效果
- RE 审计修改后，验证改动是否符合预期
- 向研发 Agent 或利益相关者展示设计意图

**核心技术**：
- **Pretext 文字布局引擎**（`@chenglou/pretext@0.0.5`，npm 公开包）

**技术风险与缓解**（v1 修复补充）：

| 风险 | 缓解措施 |
|---|---|
| `0.0.5` API 不稳定，可能 breaking change | 版本锁定；优先使用本地 vendor 文件，不用 CDN |
| `esm.sh` CDN 不可用 | 回退：使用本地 vendor 文件 `/gstack/design-html/vendor/pretext.js` |
| vendor 文件未复制到项目 | HG Step 1 自动检测，缺失时提示用户执行复制步骤 |

**工作流（5 步）**：

**Step HG-1：输入检测与模式路由**
- 检测 Pretext vendor 文件是否存在（优先本地，回退 CDN）
- 检测输入：`ux-design-specification.md` / `DESIGN.md` / 对话描述
- 检测前端框架（`package.json`）
- 输出：模式确认摘要（规范驱动 / 设计系统驱动 / 对话驱动）

**Step HG-2：设计 Token 提取**
提取：颜色 Token、字体系统、间距尺度、圆角、阴影

生成"实现规格摘要"供用户确认。

**Step HG-3：Pretext 模式路由**

| 界面类型 | Pretext API | 适用场景 |
|---|---|---|
| 落地页 / Dashboard | `prepare()` + `layout()` | 需求列表、项目大盘 |
| 卡片/网格 | `prepare()` + `layout()` | Agent 列表、需求看板 |
| 聊天 / 对话界面 | `prepareWithSegments()` + `walkLineRanges()` | Commander 对话区 |
| 内容密集文档 | `prepareWithSegments()` + `layoutNextLine()` | PRD 详情 |

**Step HG-4：生成自包含 HTML**

必须包含：
- Pretext 引擎（本地 vendor 优先，CDN 备用）
- CSS 自定义属性（直接从规范 Token 生成）
- `document.fonts.ready` 门控（首次 `prepare()` 前等待字体）
- 语义化 HTML5 结构
- `ResizeObserver` 驱动动态重排
- `contenteditable` + `MutationObserver` 重计算
- `prefers-color-scheme` 暗色/亮色自适应
- `prefers-reduced-motion` 支持
- 所有可点击元素最小 44×44px
- 真实内容（从规范提取，禁用 lorem ipsum）

严禁（AI 滑坡黑名单）：
- 紫色/蓝色渐变默认配色、3 列特征网格、装饰斑点/波浪、通用 CTA 文案

**Step HG-5：预览 + 精修循环（含收敛标准）**

> ⚠️ **v1 修复说明**：原版缺乏精修收敛标准。v2 增加 RE 对照验证步骤。
> ⚠️ **v2 修复说明**（U3）：精修循环现在读取 `ux-audit-{YYYYMMDD}.md` 中的结构化问题 ID，实现精确对照标记。

启动本地预览服务器后，**先检测是否存在 RE 审计文件**：
```
IF ux-audit-*.md 存在:
  → 加载高优先级问题列表（RE-H1, RE-H2...）
  → 告知用户：「检测到 {n} 个 RE 高优问题，本次精修将追踪修复进度」
ELSE:
  → 进入自由精修模式（无 RE 对照）
```

进入精修循环：

> **局部编辑原则（T4 修复）**：精修循环中，Sally 在内存中维护"HTML 结构摘要"（关键 CSS 变量列表 + 主要 DOM 层级，约 50 行），每次用 Edit 工具精准修改目标行，不重读全文。仅当用户要求"全面检查布局"时，才重新读取 HTML 文件。

```
LOOP:
  1. 用户查看浏览器预览
  2. 用户给反馈 → Edit 工具外科手术式修改（定位具体行，不重读全文）
  3. 简述修改内容（2-3 行）+ 若修改涉及设计决策（颜色/尺寸/圆角变化）→
     同步追加至 DESIGN.md 决策日志一行（C2 修复）
  4. 若修改对应 RE-H 系列问题 ID
     → 标记该 ID 为 ✅（同步更新 ux-audit-*.md 中的 [ ]→[x]）
  5. 显示当前进度：「RE 高优 {已修复}/{总数}」
  6. 重复，最多 10 轮

精修结束条件（任一满足）：
  A. 用户说"完成"/"好了"/"满意"
  B. 所有 RE-H 高优问题已全部标记 ✅
  C. 达到 10 轮上限，询问是否继续

精修结束时必须输出"修复确认清单"：
  ✅ 已修复的高优问题列表（RE-H 系列 ID）
  ⚠️ 仍未修复的中/低优问题列表（供用户决策是否继续）
```

**产出物**：
- `{planning_artifacts}/ux-{screen-name}-preview.html`（自包含）
- 修复确认清单（对照 RE 审计结果）
- 可选：`DESIGN.md`（从 HTML 提取设计 Token）

---

### 能力 HD — Handoff（开发交付规范）

> ⚠️ **v1 修复说明**：原版完全缺失此能力。Sally 工作的终点是研发可以开始实现，必须有正式交付物。

**定位**：UX 设计的最后一公里。将设计意图精确翻译为研发 Agent 可执行的规格，是 Sally → Amelia 的正式接口。

**触发场景**：
- CU + HG 完成后，准备进入开发阶段
- 某个功能模块即将开始 Story 实现

**工作流（4 步）**：

**Step HD-1：范围确认**
- 确认此次 Handoff 覆盖的功能范围（页面/组件/流程）
- 读取对应的 UX 规范、HG 原型文件
- 生成 Handoff 文档框架

**Step HD-2：组件状态规格**

> **三层精度选择（A1 修复）**：原版要求每个组件定义全部 8 状态，N 组件 × 8 状态在实践中不可执行。HD 启动时先确认精度级别：
>
> ```
> Sally 询问：「本次 Handoff 的状态精度：
>   A. 核心三态（默认 + error + loading）— 适合 Sprint 初期快速交付
>   B. 标准六态（+ hover + focus + disabled）— 推荐，覆盖 90% 场景
>   C. 完整八态（+ active/pressed + empty）— 适合最终交付 / 关键核心组件」
> ```
>
> 选 A 或 B 时，Sally 优先处理"关键组件"（用户最高频接触的 3-5 个），其余组件只做核心三态。

为每个需要实现的组件，完整定义所选精度的状态：

```
组件：[组件名]（精度：[A/B/C]）
├── 默认状态：[视觉描述 + 尺寸 + 颜色 Token]
├── error 状态：[错误色 + 错误提示位置]
├── loading 状态：[骨架屏 or 旋转图标 or 禁用]
│
│（标准六态以上追加）
├── hover 状态：[变化描述]
├── focus 状态：[焦点样式，outline 规格]
├── disabled 状态：[透明度/颜色变化]
│
│（完整八态追加）
├── active/pressed 状态：[变化描述]
└── empty 状态：[空状态文案 + 插图建议]
```

**Step HD-3：交互行为注释**
为每个交互节点定义精确行为：

```
交互：[操作名称]
├── 触发方式：[点击/键盘/手势]
├── 响应时间：[<100ms 即时 / 100-300ms 快 / >300ms 需 loading]
├── 动画规格：[duration: Xms, easing: ease-out, property: transform]
├── 成功反馈：[Toast / inline / 状态变化]
├── 失败反馈：[错误提示位置 + 文案]
└── 边界情况：[输入过长 / 网络超时 / 并发冲突]
```

**Step HD-4：UX 验收标准**
定义研发完成后 Sally 做 UX 验收的判断标准：

```
验收项 | 测试方法 | 通过标准
视觉还原 | 对比 HG 原型 | 主要元素位置/颜色/尺寸误差 < 2px
交互响应 | 手动测试 | 100ms 内有反馈（至少 loading 状态）
键盘可达 | Tab 键遍历 | 所有可交互元素可聚焦，焦点环可见
颜色对比 | DevTools 检查 | 正文 ≥ 4.5:1，大字 ≥ 3:1
触摸目标 | 检查 CSS 尺寸 | 最小 44×44px
空状态 | 清空数据测试 | 有引导文案，不是白屏
错误状态 | 网络断开测试 | 有错误提示，不是崩溃
```

**产出物**：
- `_bmad-output/planning-artifacts/ux-handoff-{feature}.md`（组件状态规格 + 交互注释 + 验收标准）
- 供 Amelia（研发 Agent）直接读取使用

---

### 能力 PR — Plan Design Review（计划设计评审）

**来源**：吸收自 GStack `plan-design-review`（7-Pass 框架）

**触发场景**：
- PRD 完成后、实现前
- 架构文档完成后
- Sprint 规划前确认 UX 无遗漏

**工作流（7 Pass）**：

**Step PR-0：评审范围评估**
- 读取 PRD / 架构文档 / UX 规范 / 产品简报
- **文档浓缩（T3 修复）**：从所有输入文档中提取 UX 相关片段，生成 100-200 行的"评审工作摘要"，7-Pass 均基于此摘要运行，避免每 Pass 重读全文：
  ```
  评审工作摘要包含：
  - 功能模块列表（来自 PRD）
  - 技术约束摘要（来自架构文档）
  - 设计 Token 核心变量（来自 UX 规范）
  - 已知用户角色和核心旅程（来自任意文档）
  ```
- 评估总体 UX 完整度（0-10 分）
- **STOP** 等待用户确认

| Pass | 维度 | 核心问题 |
|---|---|---|
| Pass 1 | 信息架构 | 用户第一眼/第二眼分别看到什么？Trunk Test 能否通过？Sitemap 是否已定义？|
| Pass 2 | 交互状态覆盖 | loading/empty/error/success/partial 状态是否全定义？|
| Pass 3 | 用户旅程与情感弧 | 用户在每步的情绪预期？关键成功时刻是否被设计支撑？|
| Pass 4 | AI 滑坡风险 | 是否存在 10 条 AI 滑坡黑名单中的任一项？设计是否"有意图"？|
| Pass 5 | 设计系统对齐 | 提案与 DESIGN.md / UX 规范的一致性？偏差是有意为之还是疏漏？|
| Pass 6 | 响应式与无障碍 | 移动端布局是否定义？WCAG AA 是否承诺？触摸目标大小？|
| Pass 7 | 未决设计决策 | 哪些决策在规范中模糊，会在实现时产生分歧？|

**评分方法**：每个 Pass 给 0-10 分，说明"什么使它成为 10 分"，再列出需要解决的问题。

**每个 Pass 的标准输出模板**（U4 修复）：

> ⚠️ **v2 修复说明**：原版 7-Pass 只定义了 Pass 名称和核心问题，未定义输出格式，导致执行质量不稳定。

```
## Pass X — [维度名]

**评分**: X / 10
**10 分标准**: [具体说明什么情况下该 Pass 达到满分]
**当前状态**: [1-2 句描述]

**发现的问题**:
- 🔴 [问题 ID: PR-X-H1] [问题描述] → 建议：[具体可执行的改法]
- 🟠 [问题 ID: PR-X-M1] [问题描述] → 建议：[具体可执行的改法]
- 🟡 [问题 ID: PR-X-L1] [问题描述] → 建议：[具体可执行的改法]

**未决决策**: （若有）
- 决策点：[描述] | 影响：[实现时会如何分歧] | 建议：[推荐解法]
```

**评审摘要格式**：

```
## UX Design Review 评审摘要
| Pass | 维度 | 评分 | 高优问题数 |
|---|---|---|---|
| Pass 1 | 信息架构 | X/10 | n |
| ... | ... | ... | ... |
| **总体 UX 就绪度** | | **X/10** | **n 个高优待解决** |

结论阈值（S5 修复）：
  ≥ 8.0 分且 高优问题 = 0 → 通过，可进入实现
  6.0-7.9 分 或 高优问题 ≤ 2 → 需修改后重审（明确哪些问题需先解决）
  < 6.0 分 或 高优问题 ≥ 3 → 阻塞实现（必须解决后重跑 PR）
```

**产出物**：
- 评审报告（追加至 PRD 文档 `## UX Design Review` 章节，同时追加至 UX 规范文档 **Part 5: 评审记录**）
- 未决决策清单（追加至 **Part 6: 设计决策日志**）
- 评审摘要（各 Pass 分数 + 总体 UX 就绪度 + 结论）

---

### 能力 DS — Design System（设计系统深度创建）

**来源**：吸收自 GStack `design-consultation`

**触发场景**：
- 项目启动，需建立完整设计语言
- 现有设计系统混乱需重新梳理

**工作流（3 步）**：

**Step DS-1：产品上下文确认**
确认：产品类型、目标受众、竞争对手、希望传达的品牌感知

**Step DS-2：美学方向提案**
从 10 种方向中选择并组合，提出 SAFE/RISK 分解：

| 方向 | 特征 | 适合场景 |
|---|---|---|
| 极简主义 | 空白优先，极少装饰 | 生产力工具、专业软件 |
| 最大化 | 颜色丰富、信息密集 | 游戏、创意平台 |
| 复古未来 | 80 年代科幻美学 | 开发者工具 |
| 奢华 | 克制高对比、精工细作 | 高端产品、企业服务 |
| 顽皮 | 圆润、鲜艳、有趣 | 消费者产品、教育 |
| 编辑风 | 排版主导、内容优先 | 媒体、文档 |
| 野蛮主义 | 故意粗粝、反传统 | 艺术项目、差异化 |
| 艺术装饰 | 几何装饰、精致线条 | 高端品牌 |
| 有机 | 流线、自然材质感 | 健康、生活方式 |
| 工业 | 金属感、功能导向 | 制造业、基础设施 |

**Step DS-3：完整 DESIGN.md 输出**

```markdown
## 美学方向与决策理由
## 排版系统（字族 / 字号比例 / 行高 / 字体黑名单）
## 颜色系统（主色 / 语义色 / 暗色亮色双 Token）
## 间距系统（4px 基础单位 / 标准序列）
## 圆角系统
## 阴影系统
## 动画系统（时长 / 缓动 / reduced-motion）
## 决策日志（每个决策的原因，防止未来被随意覆盖）
```

**产出物**：`DESIGN.md`（项目根目录）+ 可选设计系统预览 HTML

---

## CU 工作流现有步骤增强

### 子能力触发协议（U2 修复）

> 所有从 CU 主流程内触发子能力（IA / HG / HD）时，遵循统一的**暂停-执行-返回**协议，防止上下文丢失。

```
触发时：
  1. CU 在当前步骤暂停，记录断点（"暂停于 CU Step N"）
  2. 告知用户：「进入 [子能力名]，完成后自动返回 CU Step N+1」
  3. 完整执行子能力工作流
  4. 子能力产出追加至 ux-design-specification.md 对应章节
  5. 告知用户：「[子能力名] 完成，返回 CU，继续 Step N+1」
  6. 继续 CU 主流程

注意：
  - 子能力中途如需确认，正常 STOP。返回后 CU 不重复已完成步骤。
  - 若用户在子能力期间改变主意（跳出子能力），CU 从断点重新提示。
```

### Step 1 增强：PRD 快速导入（A2 修复）
- 现状：Step 1-2 手动问答式初始化，即使已有 PRD 也重复询问
- 增强：Step 1 开始时先检测 `prd-*.md` 是否存在：
  ```
  IF prd-*.md 存在:
    → 自动读取，提取：用户角色、核心目标、功能模块列表、技术约束
    → 展示提取摘要，询问「以上信息是否正确？确认后跳至 Step 3」
    → 跳过 Step 2（发现），节省 1 轮完整对话
  ELSE:
    → 正常执行 Step 2 发现问卷
  ```

### Step 2.5 新增：信息架构（插入发现之后）
- 现状：Step 2（发现）完成后直接进 Step 3（核心体验）
- 增强：Step 2 完成后询问"是否同步执行信息架构规划？"，是→触发 IA 能力，产出追加至规范文档 **Part 2**

### Step 6 增强：设计系统选型 → 美学方向决策
- 现状：仅询问"用哪个组件库"
- 增强：先做美学方向决策（引用 DS 简化版 10 方向库）→ SAFE/RISK 分解 → 字体黑名单检查 → 完整 Token 决策

### Step 9 增强：设计方向 → 可接 HG 产出 HTML
- 现状：生成文字描述的设计方向
- 增强：文字描述完成后询问"是否生成可交互 HTML 预览？"→是→触发 HG

### Step 12 增强：UX 一致性模式 → 补充微文案规范
- 现状：只有交互模式规范
- 增强：新增"微文案规范"章节，定义：
  - 错误提示写法原则（业务语言 + 给出下一步）
  - 空状态文案模板（说明原因 + 引导行动）
  - 操作确认措辞规范（危险操作必须说明后果）
  - loading 文案（说明在做什么，不只是"加载中…"）

> ⚠️ **v2 修复说明**：原版 CU 只支持从零创建（NEW 模式），不支持在现有设计基础上扩展新功能。

**CU 激活时首先判断模式**：

```
Sally 询问：
「当前项目是：
  A. 全新设计（从零开始 UX 规范）→ NEW 模式（完整 13 步）
  B. 在现有设计基础上扩展新功能 → EXTEND 模式（仅增量步骤）」
```

**EXTEND 模式工作流**：

| 步骤 | 操作 |
|---|---|
| E-1 | 读取现有 `ux-design-specification.md` + `DESIGN.md` |
| E-2 | 确认新功能范围（功能名称、涉及页面/流程） |
| E-3 | 检查设计系统一致性（新功能是否复用现有组件？需要新组件？） |
| E-4 | 仅做增量决策：新交互机制 / 新组件 / 新用户旅程段 |
| E-5 | 更新 UX 规范文档（追加，不覆盖） |
| E-6 | 可选：触发 HG 生成新功能的 HTML 预览 |
| E-7 | 可选：触发 HD 生成 Handoff |

**EXTEND vs NEW 的 Step 对照**：

| CU Step | NEW 模式 | EXTEND 模式 |
|---|---|---|
| Step 1-2 | 完整初始化 + 发现 | 跳过，直接读现有规范 |
| Step 3-5 | 核心体验 + 情感 + 灵感 | 可选，仅新功能的用户情感分析 |
| Step 6 | 设计系统选型 | 跳过，已有系统；仅检查一致性 |
| Step 7-8 | 交互 + 视觉基础 | 跳过，复用现有定义 |
| Step 9 | 设计方向 | 仅新界面/新组件 |
| Step 10-11 | 用户旅程 + 组件策略 | 仅新流程段 |
| Step 12-14 | 一致性模式 + 响应式 + 完成 | 一致性检查（新 vs 现有），完成 |

### CU 双模式：NEW vs EXTEND（U5 修复）

### Step 14 增强：完成 → 自检 → 触发 Handoff（A3 修复）
- 现状：仅输出完成摘要
- 增强：
  1. **Step 14 自检**（在触发 HD 之前）：
     ```
     检查项：
     1. 颜色 Token：是否唯一定义，无重复或冲突
     2. 字体系统：正文字体是否只有 1 种（检查字体黑名单）
     3. 交互状态：核心组件（≥5个高频组件）是否都定义了 error + loading 状态
     4. AI 专项：流式输出、Human-in-the-loop 场景是否有对应的设计决策

     输出：
     ✅ 一致性检查通过 → 继续询问是否生成 HD
     ⚠️ 发现 N 处矛盾 → 列出问题，询问「修复后继续 / 忽略继续」
     ```
  2. 自检通过后：询问"是否生成开发 Handoff 文档？" → 是→触发 HD 能力

---

## AI 产品专项 UX 模式（横切关注点）

当检测到产品是 AI/Agent 类型时，**按工作流步骤按需激活**，而非全量加载（T5 修复）：

| 激活步骤 | 激活的 AI 专项场景 |
|---|---|
| CU Step 3（核心体验） | 渐进信任建立 |
| CU Step 7（交互机制） | 流式输出、Human-in-the-loop |
| CU Step 9（设计方向） | Agent 状态可见性、不确定性处理 |
| CU Step 11（组件策略） | 并行实例、历史与可追溯 |
| RE Step RE-3（审计） | 错误与失败、Agent 状态可见性 |
| HD Step HD-3（交互注释） | 流式输出、错误与失败 |

**各场景设计要点（按需引用）**：

| 场景 | UX 设计要点 |
|---|---|
| **流式输出** | 打字机效果 vs 段落逐渐显示；流式过程中是否可打断；中断后如何恢复 |
| **Agent 状态可见性** | 活动动画 + 文字描述 + Token 计数三重编码 |
| **不确定性处理** | AI 置信度低时如何告知；模糊结果的视觉语言 |
| **Human-in-the-loop** | 审批节点决策上下文（30 秒内可判断原则）；建议 vs 决定的视觉区分 |
| **错误与失败** | 业务语言描述（不是技术报错）；影响范围标注；下一步行动选项 |
| **并行实例** | 多 Agent 实例的空间组织；颜色编码一致性；进度相互独立显示 |
| **历史与可追溯** | 每步产出可查阅；决策链完整；ROI 可量化展示 |
| **渐进信任建立** | 初期更多可见性→建立习惯后可折叠→给予用户控制权 |

---

## Token 效率与上下文沉淀机制

> 本章定义 Sally 在实现时必须遵守的**运行时效率约束**，防止上下文窗口浪费和跨会话知识丢失。

### Token 效率设计原则

#### 原则 T1：规范文档分层读取（最高优先级）

**问题**：`ux-design-specification.md` 随项目推进可达 800-1500 行，多个能力反复全量读取成本极高。

**规则**：Sally 激活时**只读 `ux-status.md`（<50行）和 `ux-spec-index.md`（<150行）**。仅当能力执行需要特定章节内容时，才精准读取对应行范围。

**Bootstrap 场景（S4 修复）**：首次运行时 `ux-status.md` 和 `ux-spec-index.md` 不存在，Sally 自动初始化：
```
IF ux-status.md 不存在:
  → 创建 ux-status.md（空白模板，当前阶段 = 全部待启动）
  → 创建 ux-spec-index.md（空白模板，行号索引为空）
  → 告知用户：「这是此项目首次使用 Sally，已初始化设计状态文件」
  → 进入场景路由

IF ux-status.md 存在:
  → 读取后展示当前阶段摘要
  → 询问「继续 [进行中的能力] 还是开始新任务？」
```

```
读取策略优先级：
  1. ux-status.md（项目状态，永远最先读）
  2. ux-spec-index.md（规范索引，包含章节行号）
  3. 按行范围精准读取规范的具体章节
  4. 全量读取（仅在 RE 全面审计或 CU 首次创建时允许）
```

#### 原则 T2：RE 异常驱动输出

已在 RE Step RE-3 中定义，此处补充**禁止行为**：
- ❌ 禁止输出"此项检查通过"的条目
- ❌ 禁止重复描述检查项的定义（只输出问题，不输出"我在检查什么"）
- ❌ 禁止在问题描述前加长篇说明性段落

#### 原则 T3：PR 文档浓缩

已在 PR Step PR-0 中定义。补充：浓缩摘要在 PR 会话开始时生成一次，之后 7 个 Pass 均引用此摘要，不再重新读取源文档。

#### 原则 T4：HG 精修局部编辑

已在 HG Step HG-5 中定义。补充：
```
Sally 维护的 HTML 结构摘要格式（50行以内）：
  CSS 变量区：--bg-base, --accent, --text-primary... （关键变量，约 20 行）
  DOM 层级：#app > .sidebar | .main > .header | .content | .footer（约 10 行）
  组件清单：Button, Card, Badge... 及其 className（约 20 行）
```

#### 原则 T5：AI 专项按步骤激活

已在上方 AI 专项章节的步骤映射表中定义。

---

### 上下文沉淀机制

#### 核心文件：`ux-status.md`（C1 修复）

**作用**：项目设计状态的单一事实来源。Sally 每次激活时首先读取（<50行，始终保持精简）。每个能力完成后**自动更新**。

**标准模板**：

```markdown
# UX 设计状态

## 当前阶段
- 已完成: [能力代码（日期）, ...]
- 进行中: [能力代码（开始日期）]
- 待启动: [能力代码, ...]

## 关键文件索引
- UX 规范: {路径}（Part 1-3 = 规范主体 L1-{n}；Part 4+ = 审计/评审追加）
- HTML 原型: {路径列表}
- 最近 RE 审计: {路径}（{n} 个高优待修复）
- Handoff 文档: {路径 或 "待生成"}
- 设计索引: ux-spec-index.md

## 设计决策摘要（最近 5 条，旧条目定期归档至 Part 6）
- {日期} [{能力}]: {决策} — 原因: {为什么}
```

#### 核心文件：`ux-spec-index.md`（C1/T1 修复）

**作用**：规范文档的轻量索引，避免全量读取。Sally 从索引找到目标章节的行范围后，精准读取。

**标准模板**：

```markdown
# UX 规范索引

## 设计 Token 快查（核心变量）
--bg-base: #000000 | --bg-panel: #1C1C1E | --accent: #0A84FF
--success: #30D158 | --warning: #FF9F0A | --danger: #FF453A
字体: SF Pro Display / Inter | 基础单位: 4px

## 章节行号索引
| 章节 | 起始行 | 结束行 |
|---|---|---|
| Part 1: 设计基础 | 1 | {n} |
| Part 2: 信息架构 | {n} | {n} |
| Part 3: 组件与模式 | {n} | {n} |
| Part 4: 审计记录 | {n} | {n} |
| Part 5: 评审记录 | {n} | {n} |
| Part 6: 设计决策日志 | {n} | 末行 |

## 组件清单（名称 → 所在行）
Button: L{n} | Card: L{n} | Badge: L{n} | ...
```

Sally 在每次追加内容到规范文档后，**必须同步更新 `ux-spec-index.md` 的行号**。

#### 规范文档强制分区（C3 修复）

`ux-design-specification.md` 必须维持以下 6 分区结构，任何能力追加内容时必须写入对应分区，**禁止无序追加**：

```
## Part 1: 设计基础（CU 产出，轻易不变动）
  核心体验定义 / 设计系统选型 / 交互机制 / 视觉 Token 完整定义

## Part 2: 信息架构（IA 产出）
  Sitemap / 导航结构决策 / 页面名称表

## Part 3: 组件与模式（CU Step 11/12 + HD 产出）
  组件策略 / UX 一致性模式 / 微文案规范

## Part 4: 审计记录（RE 追加，每次审计一个子章节，含日期）
  格式: ### RE 审计 {YYYY-MM-DD}

## Part 5: 评审记录（PR 追加，每次评审一个子章节，含日期）
  格式: ### PR 评审 {YYYY-MM-DD}

## Part 6: 设计决策日志（所有能力共同追加）
  格式: {日期} [{能力}] {决策} — 原因: {为什么} — 被拒选项: {什么被否定}
```

> **"被拒选项"是必填字段（C4 修复）**：防止同样被否定的方案在未来被反复提出，是决策日志最核心的价值。

#### HG 精修偏好回写（C2 修复）

已在 HG Step HG-5 的精修循环中定义（每次涉及设计决策的修改同步写入 Part 6 决策日志）。补充：

```
触发回写的修改类型：
  ✅ 颜色 Token 变化（如调整 --accent 值）
  ✅ 尺寸 / 间距变化（如 padding 从 16px 改 24px）
  ✅ 圆角 / 阴影变化
  ✅ 字体大小 / 字重变化
  ✅ 布局结构变化（如从两栏改单栏）

不需要回写的修改：
  ❌ 内容文字改动（非设计决策）
  ❌ 修复 CSS bug（如 z-index 冲突）
```

---

## 场景路由指南（U1 修复）

> ⚠️ **v2 修复说明**：原版激活时直接展示 7 个能力菜单，用户不知道从哪里进入。Sally 激活后必须先做场景路由，再展示相关能力。

**Sally 激活时的第一个问题**：

```
「您好！在开始之前，请告诉我您现在处于哪个阶段：

  1. 新项目，从零开始 UX 设计
  2. 在现有设计基础上添加新功能
  3. 审查并改善现有界面设计
  4. 评审 PRD 或架构文档的 UX 可行性
  5. 单独建立或重构设计系统
  6. 准备向研发移交设计规格
  7. 查看完整能力菜单（自主选择）」
```

**各场景推荐路径**：

| 场景 | 推荐路径 | 关键产出 |
|---|---|---|
| 1. 新项目从零 | DS（可选）→ CU NEW 模式（含 IA 插入）→ HG → HD | 完整 UX 规范 + HTML 原型 + Handoff 文档 |
| 2. 现有设计扩展新功能 | CU EXTEND 模式 → HG（仅新界面）→ HD | 增量 UX 规范更新 + 新功能原型 |
| 3. 审查改善现有设计 | RE → HG（验证修改）→ HD（如需交付） | 审计报告 + 修复后 HTML 原型 |
| 4. 评审 PRD/架构 | PR（7-Pass）| UX 评审报告 + 未决决策清单 |
| 5. 建立设计系统 | DS → 可选 CU Step 6 增强 | DESIGN.md + 可选设计预览 HTML |
| 6. 研发交付准备 | HD（读取现有规范 + HG 原型）| Handoff 文档 + 验收标准 |
| 7. 自主选择 | 展示完整能力菜单 | — |

**Sally 根据用户选择，仅展示该场景的相关能力，并说明推荐的执行顺序。**

---

## 升级后 Sally 能力菜单

```markdown
## Capabilities

| Code | Description                                   | Skill / Workflow              |
|------|-----------------------------------------------|-------------------------------|
| CU   | 从零创建完整 UX 设计规范（13步协作流）          | bmad-create-ux-design         |
| IA   | 信息架构：Sitemap + 导航结构设计                | bmad-ux-ia（新建）            |
| RE   | 审计现有设计（10类检查 + AI滑坡检测）           | bmad-ux-audit（新建）         |
| HG   | 生成可交互 HTML 预览（Pretext 布局引擎）        | bmad-ux-html-gen（新建）      |
| HD   | 开发 Handoff：组件规格 + 交互注释 + 验收标准    | bmad-ux-handoff（新建）       |
| PR   | 7-Pass 计划设计评审（PRD/架构 UX 对齐）        | bmad-ux-plan-review（新建）   |
| DS   | 深度设计系统创建（美学方向 + DESIGN.md）        | bmad-ux-design-system（新建） |
```

---

## 实现优先级

### P0 — 立即实现

| 能力/机制 | 理由 |
|---|---|
| **`ux-status.md` + `ux-spec-index.md` 基础设施** | 所有能力依赖，必须随第一个能力同步实现；包含 bootstrap 初始化逻辑 |
| **HG（HTML 生成）** | 技术已验证，demo 已运行，立竿见影 |
| **RE（UX 审计）** | 填补最大缺口，可立即审查现有 AI-DZHT 界面 |
| **IA（信息架构）** | 原缺口分析🔴严重，CU 工作流的骨架层，不能缺 |

### P1 — 次轮实现

| 能力 | 理由 |
|---|---|
| **HD（Handoff）** | Sally → Amelia 协作的关键接口，没有它设计意图传递靠猜 |
| **PR（计划评审）** | PRD 和架构文档已有多个，立即可用 |
| **CU Step 6/9/12/14 增强** | 修改现有文件，工作量小，显著提升输出质量 |

### P2 — 补充实现

| 能力 | 理由 |
|---|---|
| **DS（设计系统）** | 现有 UX 规范已有设计系统内容；先增强 Step 6，DS 独立能力稍后 |
| **AI 专项 UX 模式结构化** | 当前作为横切关注点附录有效，结构化为独立步骤投入产出比待评估 |
| **UX QA 验收能力** | Sally 对照 Handoff 验收实现，需先完成 HD 才有基础 |

---

## 技术依赖

| 依赖 | 类型 | 状态 | 风险 | 缓解 |
|---|---|---|---|---|
| `@chenglou/pretext@0.0.5` | npm 公开包 | ✅ 已验证 | API 不稳定（0.x） | 版本锁定 + vendor 优先 |
| pretext.js vendor（30KB） | 本地文件 | ✅ 可复制 | 无 | 复制到 skills 目录 |
| `esm.sh` CDN | 网络依赖 | ✅ 正常 | 可能不可用 | vendor 本地文件作回退 |
| Python 3 HTTP server | 系统工具 | ✅ macOS 内置 | 无 | — |
| GStack design-review 框架 | 方法论参考 | ✅ 已研究 | 无 | 纯方法论，不依赖二进制 |
| GStack design binary（`$D`） | GStack 私有 | ❌ 不引入 | — | 视觉 mockup 跳过 |
| GStack browse binary（`$B`） | GStack 私有 | ❌ 不引入 | — | 截图验证用 `open` 替代 |

---

## 文件实现清单

### 运行时维护文件（Sally 自动维护，无需手动创建）

```
_bmad-output/planning-artifacts/
  ux-status.md                  # 项目状态（<50行，Sally 每次能力完成后更新）
  ux-spec-index.md              # 规范文档索引（<150行，追加内容后自动更新行号）
  ux-audit-{YYYYMMDD}.md        # RE 审计结构化问题 ID 文件（按日期生成）
```

### 新建文件

```
.claude/skills/bmad-ux-ia/
  SKILL.md
  steps/
    step-01-inventory.md       # 内容清单
    step-02-grouping.md        # 内容分组
    step-03-navigation.md      # 导航结构设计
    step-04-naming.md          # 页面层级命名

.claude/skills/bmad-ux-audit/
  SKILL.md
  steps/
    step-01-input.md
    step-02-trunk-test.md
    step-03-audit.md
    step-04-score.md
    step-05-report.md          # 含微文案改写输出

.claude/skills/bmad-ux-html-gen/
  SKILL.md
  vendor/
    pretext.js                 # 从 GStack 复制
  steps/
    step-01-detect.md
    step-02-tokens.md
    step-03-pretext-route.md
    step-04-generate.md
    step-05-refine.md          # 含收敛标准和修复确认清单

.claude/skills/bmad-ux-handoff/
  SKILL.md
  steps/
    step-01-scope.md
    step-02-component-states.md
    step-03-interaction-spec.md
    step-04-acceptance.md

.claude/skills/bmad-ux-plan-review/
  SKILL.md
  steps/
    step-00-scope.md
    step-pass1-ia.md
    step-pass2-states.md
    step-pass3-journey.md
    step-pass4-ai-slop.md
    step-pass5-design-sys.md
    step-pass6-a11y.md
    step-pass7-gaps.md
    step-report.md

.claude/skills/bmad-ux-design-system/
  SKILL.md
  steps/
    step-01-context.md
    step-02-direction.md
    step-03-design-md.md
```

### 修改文件

```
.claude/skills/bmad-agent-ux-designer/SKILL.md
  → 新增 IA / RE / HG / HD / PR / DS 六项能力
  → 更新激活流程：先读 ux-status.md（bootstrap 场景处理）→ 场景路由提问

.claude/skills/bmad-create-ux-design/steps/step-01-init.md
  → 新增 PRD 快速导入逻辑（检测 prd-*.md，自动提取并跳过 Step 2）

.claude/skills/bmad-create-ux-design/steps/step-02-discovery.md
  → 结束时询问是否触发 IA 能力

.claude/skills/bmad-create-ux-design/steps/step-06-design-system.md
  → 扩充美学方向、SAFE/RISK、字体黑名单

.claude/skills/bmad-create-ux-design/steps/step-09-design-directions.md
  → 完成后询问是否触发 HG

.claude/skills/bmad-create-ux-design/steps/step-12-ux-patterns.md
  → 新增微文案规范章节

.claude/skills/bmad-create-ux-design/steps/step-14-complete.md
  → 增加一致性自检步骤，自检通过后询问是否触发 HD
```

---

## 参考资源

| 资源 | 路径 | 用途 |
|---|---|---|
| GStack design-review | `/Users/zhangshanshan/Documents/GitHub/gstack/design-review/SKILL.md` | RE 参考 |
| GStack design-html | `/Users/zhangshanshan/Documents/GitHub/gstack/design-html/SKILL.md` | HG 参考 |
| GStack design-consultation | `/Users/zhangshanshan/Documents/GitHub/gstack/design-consultation/SKILL.md` | DS 参考 |
| GStack plan-design-review | `/Users/zhangshanshan/Documents/GitHub/gstack/plan-design-review/SKILL.md` | PR 参考 |
| Pretext vendor | `/Users/zhangshanshan/Documents/GitHub/gstack/design-html/vendor/pretext.js` | HG 依赖 |
| 已验证 Demo | `/tmp/ai-dzht-preview.html` | HG 效果参考 |
| 现有 UX 规范 | `_bmad-output/planning-artifacts/ux-design-specification.md` | 主要输入文档 |
