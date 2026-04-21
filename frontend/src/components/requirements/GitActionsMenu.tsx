import { useState } from 'react'
import { MoreVertical, RotateCcw, GitPullRequest, ExternalLink, RefreshCw } from 'lucide-react'
import type { RequirementGitInfo } from '@/types/project'

interface Props {
  projectId: string
  reqId: string
  gitInfo?: RequirementGitInfo | null
  hasRepository: boolean
  onRefreshStatus?: () => void
}

export function GitActionsMenu({ projectId, reqId, gitInfo, hasRepository, onRefreshStatus }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  if (!hasRepository || !gitInfo?.branch) return null

  const handleAction = async (action: 'retry-push' | 'create-pr' | 'refresh-status') => {
    setLoading(action)
    try {
      if (action === 'retry-push') {
        await fetch(`/api/v1/projects/${projectId}/requirements/${reqId}/git/retry-push`, {
          method: 'POST',
        })
      } else if (action === 'create-pr') {
        await fetch(`/api/v1/projects/${projectId}/requirements/${reqId}/git/create-pr`, {
          method: 'POST',
        })
      } else if (action === 'refresh-status') {
        await fetch(`/api/v1/projects/${projectId}/requirements/${reqId}/git/pr-status`)
        onRefreshStatus?.()
      }
    } finally {
      setLoading(null)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-3)] hover:text-[var(--text-1)] hover:border-[var(--accent)]"
      >
        <MoreVertical size={14} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] py-1 shadow-lg">
            <button
              onClick={() => handleAction('retry-push')}
              disabled={loading === 'retry-push'}
              className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-[var(--text-2)] hover:bg-[var(--bg-panel-2)] disabled:opacity-50"
            >
              <RotateCcw size={12} />
              重试推送
            </button>

            {!gitInfo.prNumber && (
              <button
                onClick={() => handleAction('create-pr')}
                disabled={loading === 'create-pr'}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-[var(--text-2)] hover:bg-[var(--bg-panel-2)] disabled:opacity-50"
              >
                <GitPullRequest size={12} />
                创建 PR
              </button>
            )}

            {gitInfo.prUrl && (
              <a
                href={gitInfo.prUrl}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-[var(--text-2)] hover:bg-[var(--bg-panel-2)]"
                onClick={() => setOpen(false)}
              >
                <ExternalLink size={12} />
                查看 PR
              </a>
            )}

            {gitInfo.prNumber && (
              <button
                onClick={() => handleAction('refresh-status')}
                disabled={loading === 'refresh-status'}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-[var(--text-2)] hover:bg-[var(--bg-panel-2)] disabled:opacity-50"
              >
                <RefreshCw size={12} />
                刷新状态
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
