import { useState, useMemo } from 'react'
import { MessageSquare, ChevronDown, ChevronUp, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { AgentAvatar } from '@/components/ui/AgentAvatar'
import { useAgentList } from '@/hooks/useAgents'

const PHASE_LABELS: Record<string, string> = {
  analysis: '分析', planning: '规划', architecture: '架构', implementation: '实现', qa: 'QA',
}

export function RequirementAgentView() {
  const { data: agents = [] } = useAgentList()
  // 当前需求关联的 Agent（产品经理、UX、架构师）
  const REQUIREMENT_AGENTS = useMemo(() => agents.slice(1, 4), [agents])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [feedbackAgent, setFeedbackAgent] = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [submitted, setSubmitted] = useState<string[]>([])

  const handleSubmitFeedback = (agentId: string) => {
    if (!feedbackText.trim()) return
    setSubmitted((prev) => [...prev, agentId])
    setFeedbackAgent(null)
    setFeedbackText('')
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-40 h-13 flex items-center justify-between px-6 bg-[var(--glass-bg)] backdrop-blur-[24px] border-b border-[var(--border)]">
        <div>
          <span className="text-sm font-semibold text-[var(--text-1)]">需求 Agent 视图</span>
          <span className="text-xs text-[var(--text-3)] ml-2">（研发成员 · 只读）</span>
        </div>
        <Badge variant="blue" pulse>会员体系重构 · 进行中</Badge>
      </header>

      <main className="max-w-[800px] mx-auto w-full px-6 py-8 flex flex-col gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)] mb-1">当前需求</p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-1)]">会员体系重构</h1>
          <p className="text-sm text-[var(--text-2)] mt-1">本需求关联了 {REQUIREMENT_AGENTS.length} 个 Agent，以下是它们的能力边界说明</p>
        </div>

        {/* Read-only notice */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-panel-2)] border border-[var(--border)] text-xs text-[var(--text-3)]">
          <span>👁</span>
          你的角色为「研发成员」，此页面为只读视图。如发现 Agent 行为异常，可通过下方「反馈问题」按钮通知项目负责人。
        </div>

        {/* Agent cards */}
        <div className="flex flex-col gap-3">
          {REQUIREMENT_AGENTS.map((agent) => {
            const isExpanded = expanded === agent.id
            const hasSubmitted = submitted.includes(agent.id)
            const isFeedbackOpen = feedbackAgent === agent.id

            return (
              <div
                key={agent.id}
                className="rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] overflow-hidden"
              >
                {/* Card header */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <AgentAvatar role={agent.role} name={agent.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text-1)]">{agent.name}</span>
                      <Badge variant={agent.status === 'running' ? 'blue' : agent.status === 'active' ? 'green' : 'gray'} pulse={agent.status === 'running'}>
                        {agent.status === 'running' ? '运行中' : '空闲'}
                      </Badge>
                    </div>
                    <p className="text-xs text-[var(--text-2)] mt-0.5 line-clamp-1">{agent.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasSubmitted ? (
                      <span className="flex items-center gap-1 text-[11px] text-[var(--success)]">
                        <Check size={11} />反馈已提交
                      </span>
                    ) : (
                      <button
                        onClick={() => { setFeedbackAgent(isFeedbackOpen ? null : agent.id); setFeedbackText('') }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[var(--text-2)] border border-[var(--border)] hover:text-[var(--text-1)] hover:border-[var(--border-strong)] transition-all"
                      >
                        <MessageSquare size={11} />
                        反馈问题
                      </button>
                    )}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : agent.id)}
                      className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-hover)] transition-all"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Feedback input */}
                {isFeedbackOpen && (
                  <div className="px-5 pb-4 border-t border-[var(--border)]">
                    <div className="mt-3 flex flex-col gap-2">
                      <p className="text-xs text-[var(--text-2)]">
                        描述 Agent 行为异常的具体情况，将通知项目负责人处理
                      </p>
                      <textarea
                        autoFocus
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="例如：行为规范 ③ 未覆盖内联样式限制，生成的组件仍使用了 style 属性…"
                        rows={3}
                        className={cn(
                          'w-full px-3 py-2.5 rounded-xl text-sm resize-none',
                          'bg-[var(--bg-base)] border border-[var(--border)]',
                          'text-[var(--text-1)] placeholder:text-[var(--text-3)]',
                          'focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-sub)]',
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setFeedbackAgent(null); setFeedbackText('') }}
                          className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
                        >
                          <X size={12} className="inline mr-1" />取消
                        </button>
                        <button
                          onClick={() => handleSubmitFeedback(agent.id)}
                          disabled={!feedbackText.trim()}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-white disabled:opacity-40 hover:opacity-90 transition-all"
                        >
                          提交反馈
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Expanded: capability detail */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-[var(--border)] flex flex-col gap-4 mt-1 pt-4">
                    {/* Commands */}
                    {agent.commands.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)] mb-2">能力命令</p>
                        <div className="flex flex-wrap gap-1.5">
                          {agent.commands.map((c) => (
                            <span key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-panel-2)] border border-[var(--border)] text-xs">
                              <span className="font-mono font-bold text-[var(--accent)]">{c.code}</span>
                              <span className="text-[var(--text-2)]">{c.name}</span>
                              <span className="text-[var(--text-3)]">·</span>
                              <span className="text-[var(--text-3)]">{PHASE_LABELS[c.phase]}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prompt preview */}
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)] mb-2">角色定义</p>
                      <p className="text-sm text-[var(--text-2)] leading-relaxed bg-[var(--bg-panel-2)] px-3 py-2.5 rounded-xl border border-[var(--border)]">
                        {agent.promptBlocks.roleDefinition || '未配置'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)] mb-2">能力边界</p>
                      <p className="text-sm text-[var(--text-2)] leading-relaxed bg-[var(--bg-panel-2)] px-3 py-2.5 rounded-xl border border-[var(--border)]">
                        {agent.promptBlocks.capabilityScope || '未配置'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
