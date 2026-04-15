import { cn } from '@/lib/utils'
import { AgentAvatar } from '@/components/ui/AgentAvatar'
import { bmadAgentDefs } from '@/mocks/data/bmadAgentDefs'
import type { Agent, AgentStatus, AgentSource, AgentRole } from '@/types/agent'

interface AgentCardProps {
  agent: Agent
  onClick?: () => void
}

// ─── 阶段映射 ─────────────────────────────────────────────────────────

const roleToPhaseLabel: Record<AgentRole, string> = {
  analyst:    '分析',
  pm:         '规划',
  ux:         '规划',
  architect:  '架构',
  sm:         '实现',
  dev:        '实现',
  qa:         '实现',
  quickdev:   '实现',
  techwriter: '通用',
}

const roleToPhaseColor: Record<AgentRole, string> = {
  analyst:    'bg-[var(--accent)]',
  pm:         'bg-purple-500',
  ux:         'bg-pink-500',
  architect:  'bg-orange-500',
  sm:         'bg-teal-500',
  dev:        'bg-cyan-500',
  qa:         'bg-yellow-500',
  quickdev:   'bg-green-500',
  techwriter: 'bg-slate-500',
}

// ─── 状态 Badge ───────────────────────────────────────────────────────

function StatusDot({ status }: { status: AgentStatus }) {
  const config: Record<AgentStatus, { color: string; label: string; pulse?: boolean }> = {
    running:  { color: 'bg-[var(--accent)]',   label: '运行中', pulse: true },
    active:   { color: 'bg-[var(--success)]',  label: '已启用' },
    idle:     { color: 'bg-[var(--text-3)]',   label: '空闲' },
    draft:    { color: 'bg-[var(--orange)]',   label: '草稿' },
    disabled: { color: 'bg-[var(--danger)]',   label: '已停用' },
  }
  const { color, label, pulse } = config[status]
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn(
        'size-1.5 rounded-full flex-shrink-0',
        color,
        pulse && 'animate-pulse',
      )} />
      <span className={cn(
        'text-[11px] font-medium',
        status === 'running'  && 'text-[var(--accent)]',
        status === 'active'   && 'text-[var(--success)]',
        status === 'idle'     && 'text-[var(--text-3)]',
        status === 'draft'    && 'text-[var(--orange)]',
        status === 'disabled' && 'text-[var(--danger)]',
      )}>
        {label}
      </span>
    </div>
  )
}

function SourceTag({ source }: { source: AgentSource }) {
  const config: Record<AgentSource, { label: string; cls: string }> = {
    builtin: { label: '内置', cls: 'text-[var(--text-3)] bg-[var(--bg-panel-2)]' },
    custom:  { label: '自定义', cls: 'text-[var(--accent)] bg-[var(--accent-sub)]' },
    fork:    { label: 'Fork', cls: 'text-purple-400 bg-purple-950/40' },
  }
  const { label, cls } = config[source]
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', cls)}>
      {label}
    </span>
  )
}

// ─── AgentCard ────────────────────────────────────────────────────────

export function AgentCard({ agent, onClick }: AgentCardProps) {
  const def = bmadAgentDefs.find(d => d.id === agent.role)
  const personaTitle = def?.personaTitle ?? '自定义 Agent'
  const phaseLabel   = roleToPhaseLabel[agent.role]
  const accentColor  = roleToPhaseColor[agent.role]

  const allCodes     = agent.commands.map(c => c.code)
  const visibleCodes = allCodes.slice(0, 6)
  const hiddenCount  = allCodes.length - visibleCodes.length

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex flex-col rounded-2xl border cursor-pointer overflow-hidden',
        'bg-[var(--bg-panel)] border-[var(--border)]',
        'hover:border-[var(--border-strong)] hover:shadow-[var(--shadow)]',
        'transition-all duration-200',
      )}
    >
      {/* Phase accent line */}
      <div className={cn('h-0.5 w-full', accentColor, 'opacity-80')} />

      <div className="flex flex-col gap-3.5 p-4">
        {/* Header: avatar + name + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <AgentAvatar role={agent.role} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-[var(--text-1)] truncate leading-tight">
                  {agent.name}
                </span>
                {agent.isProtected && (
                  <span className="text-[10px] text-[var(--text-3)] flex-shrink-0">🔒</span>
                )}
              </div>
              <span className="text-[11px] text-[var(--text-3)] leading-tight">{personaTitle}</span>
            </div>
          </div>
          <StatusDot status={agent.status} />
        </div>

        {/* Description */}
        <p className="text-xs text-[var(--text-2)] leading-relaxed line-clamp-2 min-h-[2.5rem]">
          {agent.description}
        </p>

        {/* Command chips */}
        {allCodes.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {visibleCodes.map(code => (
              <span
                key={code}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--accent-sub)] text-[var(--accent)] border border-[rgba(10,132,255,0.15)]"
              >
                {code}
              </span>
            ))}
            {hiddenCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--text-3)] bg-[var(--bg-panel-2)]">
                +{hiddenCount}
              </span>
            )}
          </div>
        ) : (
          <div className="text-[11px] text-[var(--text-3)] italic">暂无绑定命令</div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border)]">
          <div className="flex items-center gap-1.5">
            <SourceTag source={agent.source} />
            <span className="text-[10px] text-[var(--text-3)]">{phaseLabel}</span>
          </div>
          <span className="text-[11px] text-[var(--text-3)] font-mono">{agent.version}</span>
        </div>
      </div>

      {/* Running instances badge */}
      {agent.runningInstances.length > 0 && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-sub)] border border-[rgba(10,132,255,0.25)]">
          <span className="size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-[10px] font-medium text-[var(--accent)]">
            {agent.runningInstances.length}
          </span>
        </div>
      )}
    </div>
  )
}
