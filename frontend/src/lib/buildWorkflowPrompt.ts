import type { ProjectContext } from '@/types/project'

export function buildWorkflowSuggestPrompt(
  reqTitle: string,
  reqSummary: string,
  projectContext: ProjectContext,
): string {
  const title = reqTitle.trim() || '（未填写标题）'
  const summary = reqSummary.trim() || '（无描述）'
  const truncatedTitle = title.length > 200 ? title.slice(0, 200) + '…' : title
  const truncatedSummary = summary.length > 500 ? summary.slice(0, 500) + '…' : summary

  return `请基于以下项目上下文分析需求，建议最合适的 Agent 工作流配置。

## 项目上下文
- 行业：${projectContext.industry}
- 技术栈：${projectContext.techStack.map((t) => typeof t === 'string' ? t : t.name).join(', ')}
- 团队规范：
${(projectContext.rules ?? []).map((r) => `  - ${typeof r === 'string' ? r : r.text}`).join('\n')}

## 待分析需求
- 标题：${truncatedTitle}
- 描述：${truncatedSummary}

## 可选 Agent 工作流模板
- **全流程**（适合大需求）：需求分析(Mary) → UX设计(Sally) → 架构设计(Winston) → 开发实现(Amelia) → 自动化测试(Quinn)
- **快速开发**（适合小需求/功能迭代）：快速开发(Barry) → 自动化测试(Quinn)
- **Bug 修复**（适合缺陷修复）：开发修复(Amelia) → 回归测试(Quinn)
- **自定义**：手动选择所需 Agent 节点

请给出：
1. 推荐模板（全流程 / 快速开发 / Bug修复 / 自定义）及原因（1-2句）
2. 建议重点关注的 Agent 步骤
3. 该需求的主要技术风险点（若有）`.trim()
}
