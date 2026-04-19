# Submit for Review (SR) Workflow

**Goal:** Generate a structured PR with real quality verification, optional cross-review, and human approval gate. Ensure the reviewer can understand the full scope of changes in 30 seconds.

**Your Role:** You are finalizing code for human review. Your job is to be **brutally honest** about quality — never fabricate passing results.

---

## STEP 1: Scope Analysis

Collect change information:

```bash
git diff --stat HEAD~1..HEAD    # or appropriate range
git diff --name-status HEAD~1..HEAD
```

Classify the change into one of three tiers:

| Tier | Criteria | PR Format |
|------|----------|-----------|
| **轻量 (Light)** | <5 files AND <50 lines changed | 简版 PR（摘要 + 文件列表 + 质量信号） |
| **标准 (Standard)** | 5–15 files OR 50–200 lines | 完整六段 PR |
| **大型 (Large)** | >15 files OR >200 lines | 完整六段 PR + 架构影响 + 分批合并建议 |

**Output:** Announce the detected tier to the user before proceeding.

---

## STEP 2: Tool-Based Quality Verification

Run **real commands** and capture **actual output**. Adapt commands to the project's toolchain.

| 检查项 | 命令示例 | 必须 |
|--------|---------|------|
| 类型检查 | `npx tsc --noEmit` | TS 项目必须 |
| Lint | `npx eslint . --ext .ts,.tsx` 或项目 lint 命令 | 已配置则必须 |
| 单元测试 | `npx vitest run` 或项目 test 命令 | 必须 |
| 构建 | `npm run build` 或项目 build 命令 | 已配置则必须 |

### 结果记录规则

- 命令**实际执行通过** → `✅ 工具验证通过` + 摘要输出
- 命令**执行失败** → `❌ 工具验证失败` + 完整错误信息 → **HALT: 修复后重新执行本步骤**
- 命令**无法执行**（项目未配置） → `⬜ 未配置` + 说明原因
- **严禁**：未执行命令却标注 ✅。宁可标 ⬜ 也不能造假。

---

## STEP 3: AI Self-Assessment

对工具无法覆盖的维度进行 AI 自检。**所有 AI 自检项使用 🔍 标签，与工具验证的 ✅ 严格区分。**

| 维度 | 检查方法 | 标签 |
|------|---------|------|
| 安全 (OWASP) | 审查所有用户输入处理、SQL 查询、HTML 输出、命令拼接 | 🔍 AI 自检 |
| 架构合规 | 对比 project-context.md 中定义的分层规则和模式 | 🔍 AI 自检 |
| 并发安全 | 审查共享状态访问、数据库写操作的锁/幂等设计 | 🔍 AI 自检 |
| 错误处理 | 验证系统边界的错误处理覆盖 | 🔍 AI 自检 |
| 向后兼容 | API 接口变更是否 breaking（如有） | 🔍 AI 自检 |

### 自检规则

- 发现问题 → `🔍 ⚠️ 存在风险` + 具体描述 + 修复建议
- 未发现问题 → `🔍 未发现风险`（注意：这不等于"没有风险"，仅表示 AI 未检出）
- **严禁**：将 AI 自检结果标注为 ✅。审批人必须能一眼区分哪些是机器验证、哪些是 AI 判断。

---

## STEP 4: Cross-Review

### 优先方案：Quinn 交叉审查

如果项目中有 Quinn (QA Agent) 可用：
- 调用 Quinn 对变更执行 CR（代码审查）
- 将 Quinn 的发现纳入 PR 的"审查发现"部分
- 标注为 `👁️ 交叉审查（Quinn）`

### 备选方案：对抗性自审

如果 Quinn 不可用，执行**显式对抗性自审**：

> **对抗性指令**：假设这段代码中至少存在一个 bug、一个安全隐患、一个边界遗漏。你的任务是找出来。不要轻易说"没问题"——如果你找不到问题，说明你还没找够。

- 标注为 `🔍 对抗性自审`
- 记录所有发现，即使是低优先级的

---

## STEP 5: Generate PR Description

根据 STEP 1 判定的 Tier 选择对应模板。

### 轻量 Tier 模板

```markdown
## 变更摘要
{一句话说清改了什么、为什么改}

## 变更文件
| 文件 | 操作 | 说明 |
|------|------|------|
| `path/file.ts` | 新增/修改/删除 | 一句话说明 |

## 质量信号
| 检查项 | 结果 | 详情 |
|--------|------|------|
| 单元测试 | ✅ 工具验证 | 23/23 passed |
| 类型检查 | ✅ 工具验证 | 0 errors |
| 安全审查 | 🔍 AI 自检 | 未发现风险 |
```

### 标准 Tier 模板

```markdown
## 变更摘要
{一句话说清改了什么、为什么改}

## 文件变更分类

### 新增文件（N 个）
| 文件 | 说明 | 审阅优先级 |
|------|------|-----------|
| `path/file.ts` | 说明 | 🟢 低 / 🟡 中 / 🔴 高 |

### 修改文件（N 个）
| 文件 | 变更行数 | 说明 | 审阅优先级 |
|------|---------|------|-----------|
| `path/file.ts` | +15 -3 | 说明 | 🔴 高 |

### 删除文件（N 个）
| 文件 | 删除原因 |
|------|---------|

## 建议阅读顺序

<!-- 变更间存在线性依赖时：按依赖顺序排列 -->
<!-- 变更间存在图状依赖时：按模块分组 -->

**分组 A — {模块/功能名}**（先看这组，理解核心变更）
1. `file-a1.ts` — 数据模型变更
2. `file-a2.ts` — 业务逻辑

**分组 B — {模块/功能名}**（联动修改，看完 A 后一目了然）
3. `file-b1.ts` — 适配层调整

## 关键技术决策
| 决策点 | 选择 | 替代方案 | 选择原因 |
|--------|------|---------|---------|

## 质量信号

### 🔧 工具验证（机器执行，结果可信）
| 检查项 | 结果 | 详情 |
|--------|------|------|
| 单元测试 | ✅ / ❌ | 实际输出摘要 |
| 类型检查 | ✅ / ❌ | 实际输出摘要 |
| Lint | ✅ / ❌ / ⬜ 未配置 | 实际输出摘要 |
| 构建 | ✅ / ❌ / ⬜ 未配置 | 实际输出摘要 |

### 🔍 AI 自检（AI 判断，仅供参考）
| 维度 | 结果 | 说明 |
|------|------|------|
| OWASP 安全 | 🔍 未发现风险 / 🔍 ⚠️ 存在风险 | 具体说明 |
| 架构合规 | 🔍 | 说明 |
| 并发安全 | 🔍 | 说明 |
| 向后兼容 | 🔍 | 说明（如涉及 API 变更） |

### 👁️ 审查发现（交叉审查 / 对抗性自审）
{Quinn 的发现或对抗性自审的发现列表}

## 风险评估与回滚方案
- **影响范围**: {哪些模块/功能受影响}
- **潜在风险**: {具体风险点}
- **回滚步骤**: {具体回滚操作}
- **渐进发布建议**: {是否建议 feature flag / canary / 灰度}（仅高风险变更需要）
```

### 大型 Tier 模板

使用标准模板的全部内容，额外增加以下两部分：

```markdown
## 架构影响分析
- **涉及的架构层**: {展示层/业务层/数据层/基础设施层}
- **跨模块依赖变更**: {是否引入新的模块间依赖}
- **数据模型变更**: {是否涉及 Schema 变更，是否有迁移脚本}

## 分批合并建议
本次变更较大（{N} 个文件，{M} 行变更），建议按以下顺序分批审阅和合并：
1. **Batch 1**: {文件列表} — {这批做什么}
2. **Batch 2**: {文件列表} — {这批做什么}
（如果无法合理拆分，说明原因）
```

---

## STEP 6: Create PR and Wait for Human

1. 使用 `gh pr create` 或项目约定的方式创建 PR
2. 向用户展示 PR 链接
3. **STOP — 等待人工审批**
4. 明确告知用户：*"PR 已创建，请审阅。通过后我将合并；如有修改意见请回复。"*

---

## STEP 7: Handle Review Feedback (审阅修订循环)

**当人工审批打回时：**

1. **读取** 所有审阅意见和评论
2. **逐条回应**：
   - 同意 → 修改代码 + 回复"已修复"
   - 不同意 → 回复具体原因，请求讨论
3. **重新执行** STEP 2（工具验证）确保修改没有引入新问题
4. **更新** PR 描述中受影响的部分
5. **请求** 重新审阅

**修订轮次上限：3 轮**

如果 3 轮修订后仍未通过：
- 汇总所有未解决的分歧
- 建议**升级给人工**直接接管代码修改
- 不再自动修订，避免无限循环

---

## GUARD RAILS

- **绝不**在未执行实际命令的情况下标注 ✅
- **绝不**跳过工具验证步骤直接生成 PR
- **绝不**在人工审批前合并代码
- **绝不**超过 3 轮修订（升级给人工）
- 如果项目没有配置测试/lint 等工具，在 PR 中明确标注 `⬜ 未配置`，不要假装检查过了
