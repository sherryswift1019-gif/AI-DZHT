import { GitBranch, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RequirementGitInfo } from '@/types/project'

interface Props {
  gitInfo?: RequirementGitInfo | null
  hasRepository: boolean
}

export function GitStatusStrip({ gitInfo, hasRepository }: Props) {
  if (!hasRepository || !gitInfo) return null

  const { branch, prUrl, prNumber, prState, commitCount, additions, deletions } = gitInfo

  // 无 branch 信息则不渲染
  if (!branch) return null

  // 根据状态决定内容和颜色
  let content: React.ReactNode
  let color: 'blue' | 'green' | 'orange' | 'purple' | 'gray' | 'yellow' | 'red' = 'blue'

  if (prState === 'merged') {
    color = 'purple'
    content = (
      <>
        <span>PR #{prNumber} 已合并到 main</span>
        <span className="text-[10px]">✓</span>
      </>
    )
  } else if (prState === 'approved') {
    color = 'green'
    content = <span>PR #{prNumber} 已批准</span>
  } else if (prState === 'changes_requested') {
    color = 'orange'
    content = <span>PR #{prNumber} 需修改</span>
  } else if (prState === 'closed') {
    color = 'gray'
    content = <span>PR #{prNumber} 已关闭</span>
  } else if (prState === 'open') {
    color = 'green'
    content = <span>PR #{prNumber} 等待审查</span>
  } else if (commitCount > 0) {
    color = 'blue'
    content = (
      <>
        <span className="font-mono">{branch}</span>
        <span className="text-[var(--text-3)]">·</span>
        <span>{commitCount} commits</span>
        {(additions > 0 || deletions > 0) && (
          <>
            <span className="text-[var(--text-3)]">·</span>
            <span className="text-green-400">+{additions}</span>
            <span className="text-red-400">-{deletions}</span>
          </>
        )}
      </>
    )
  } else {
    color = 'blue'
    content = (
      <>
        <span className="font-mono">{branch}</span>
        <span className="text-[var(--text-3)]">·</span>
        <span>已创建</span>
      </>
    )
  }

  const colorMap = {
    blue: 'border-[rgba(88,166,255,0.3)] bg-[rgba(88,166,255,0.06)] text-[#58a6ff]',
    green: 'border-green-500/30 bg-green-500/6 text-green-400',
    orange: 'border-amber-500/30 bg-amber-500/6 text-amber-400',
    purple: 'border-purple-500/30 bg-purple-500/6 text-purple-400',
    gray: 'border-[var(--border)] bg-[var(--bg-panel-2)] text-[var(--text-3)]',
    yellow: 'border-yellow-500/30 bg-yellow-500/6 text-yellow-400',
    red: 'border-red-500/30 bg-red-500/6 text-red-400',
  }

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px]',
      colorMap[color],
    )}>
      <GitBranch size={12} />
      {content}
      {prUrl && (
        <a
          href={prUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-auto flex items-center gap-0.5 opacity-70 hover:opacity-100"
        >
          <ExternalLink size={10} />
        </a>
      )}
    </div>
  )
}
