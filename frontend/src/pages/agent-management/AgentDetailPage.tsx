import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Lock, GitFork, Pencil, Trash2, History, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { AgentAvatar } from '@/components/ui/AgentAvatar'
import { useAgentDetail } from '@/hooks/useAgents'
import type { Agent, AgentStatus, AgentSource } from '@/types/agent'

const PROMPT_BLOCK_LABELS = {
  roleDefinition:      '① 角色定义',
  capabilityScope:     '② 能力声明',
  behaviorConstraints: '③ 行为约束',
  outputSpec:          '④ 输出规范',
}

const PHASE_LABELS: Record<string, string> = {
  analysis: '分析', planning: '规划', architecture: '架构',
  implementation: '实现', qa: 'QA',
}

function statusBadgeVariant(s: AgentStatus): 'blue' | 'green' | 'gray' | 'orange' | 'red' {
  return s === 'running' ? 'blue' : s === 'active' ? 'green' : s === 'idle' ? 'gray' : s === 'draft' ? 'orange' : 'red'
}
function sourceBadgeVariant(s: AgentSource): 'gray' | 'blue' | 'purple' {
  return s === 'builtin' ? 'gray' : s === 'custom' ? 'blue' : 'purple'
}

type Tab = 'config' | 'instances' | 'history'

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('config')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const { data: agent, isLoading } = useAgentDetail(id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-[var(--text-2)]">
        加载中…
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-screen text-[var(--text-2)] text-sm">
        Agent 不存在
      </div>
    )
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'config',    label: '配置' },
    { key: 'instances', label: `运行实例 ${agent.runningInstances.length > 0 ? `(${agent.runningInstances.length})` : ''}` },
    { key: 'history',   label: '版本历史' },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-base)]">
      {/* \u2500\u2500 Page Hero Header \u2500\u2500 */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-base)]">
        <div className="max-w-[900px] mx-auto w-full px-6 py-6">
          {/* Identity + actions row */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4 min-w-0">
              <AgentAvatar role={agent.role} name={agent.name} size="lg" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-xl font-bold tracking-tight text-[var(--text-1)]">{agent.name}</h1>
                  {agent.isProtected && (
                    <span title="\u5185\u7f6e Agent\uff0c\u4e0d\u53ef\u5220\u9664" className="text-[11px] text-[var(--text-3)]">\ud83d\udd12 \u5185\u7f6e\u4fdd\u62a4</span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-2)] leading-relaxed line-clamp-2">{agent.description}</p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Badge variant={statusBadgeVariant(agent.status)} pulse={agent.status === 'running'}>
                    {agent.status === 'running' ? '\u8fd0\u884c\u4e2d' : agent.status === 'active' ? '\u5df2\u542f\u7528' : agent.status === 'idle' ? '\u7a7a\u95f2' : agent.status === 'draft' ? '\u8349\u7a3f' : '\u5df2\u505c\u7528'}
                  </Badge>
                  <Badge variant={sourceBadgeVariant(agent.source)}>
                    {agent.source === 'builtin' ? '\u5185\u7f6e' : agent.source === 'custom' ? '\u81ea\u5b9a\u4e49' : 'Fork'}
                  </Badge>
                  <span className="text-[11px] font-mono text-[var(--text-3)] bg-[var(--bg-panel-2)] px-2 py-0.5 rounded-md">{agent.version}</span>
                  <span className="w-px h-3 bg-[var(--border)]" />
                  <span className="text-[11px] text-[var(--text-3)]">\u521b\u5efa\u8005\uff1a{agent.createdBy}</span>
                  <span className="text-[11px] text-[var(--text-3)]">\u66f4\u65b0\u4e8e {new Date(agent.updatedAt).toLocaleDateString('zh-CN')}</span>
                  {agent.forkedFrom && (
                    <span className="text-[11px] text-[var(--purple)] flex items-center gap-1">
                      <GitFork size={10} />
                      Fork \u81ea\uff1a{agent.forkedFrom.agentName} · {agent.forkedFrom.version}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            {!agent.isProtected && (
              <div className="flex shrink-0 items-center gap-2 pt-1">
                <button
                  onClick={() => navigate(`/agents/${agent.id}/edit`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--border-strong)] transition-all"
                >
                  <Pencil size={12} />
                  \u7f16\u8f91
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--border-strong)] transition-all">
                  <GitFork size={12} />
                  Fork
                </button>
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--danger)] border border-[var(--danger-sub)] hover:bg-[var(--danger-sub)] transition-all"
                >
                  <Trash2 size={12} />
                  \u5220\u9664
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto w-full px-6 py-8 flex flex-col gap-6">

        {/* Lock banner */}
        {agent.isLocked && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[var(--warning-sub)] border border-[rgba(255,159,10,0.25)]">
            <Lock size={14} className="text-[var(--orange)] mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--orange)]">
                提示词暂时锁定 — 有 {agent.runningInstances.length} 个实例运行中
              </p>
              <p className="text-xs text-[var(--orange)] opacity-80 mt-0.5">
                正在运行的需求完成后自动解锁。你可以在「运行实例」标签中查看详情或手动停止。
              </p>
            </div>
            <button
              onClick={() => setTab('instances')}
              className="text-[11px] font-semibold text-[var(--orange)] hover:opacity-70 flex-shrink-0"
            >
              查看实例 →
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-[var(--border)]">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-all',
                tab === t.key
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'config' && <ConfigTab agent={agent} />}
        {tab === 'instances' && <InstancesTab agent={agent} />}
        {tab === 'history' && <HistoryTab />}
      </div>

      {/* Delete dialog */}
      {showDeleteDialog && (
        <DeleteDialog
          agentName={agent.name}
          instanceCount={agent.runningInstances.length}
          onCancel={() => setShowDeleteDialog(false)}
          onConfirm={() => { setShowDeleteDialog(false); navigate('/agents') }}
        />
      )}
    </div>
  )
}

// ─── Config Tab ───────────────────────────────────────────────────

function ConfigTab({ agent }: { agent: Agent }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Commands */}
      {agent.commands.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">能力命令</h3>
          <div className="flex flex-col gap-2">
            {(['analysis','planning','architecture','implementation','qa'] as const).map((phase) => {
              const cmds = agent.commands.filter((c) => c.phase === phase)
              if (!cmds.length) return null
              return (
                <div key={phase} className="flex items-start gap-3">
                  <span className="text-[11px] text-[var(--text-3)] w-12 text-right pt-0.5 flex-shrink-0">
                    {PHASE_LABELS[phase]}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {cmds.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-panel-2)] border border-[var(--border)] text-xs">
                        <span className="font-mono font-bold text-[var(--accent)]">{c.code}</span>
                        <span className="text-[var(--text-2)]">{c.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Prompt blocks */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">提示词</h3>
        <div className="flex flex-col gap-3">
          {(Object.keys(PROMPT_BLOCK_LABELS) as Array<keyof typeof PROMPT_BLOCK_LABELS>).map((key) => (
            <div key={key} className="rounded-xl border border-[var(--border)] overflow-hidden">
              <div className="px-4 py-2 bg-[var(--bg-panel-2)] border-b border-[var(--border)]">
                <span className="text-xs font-semibold text-[var(--text-2)]">{PROMPT_BLOCK_LABELS[key]}</span>
              </div>
              <div className="px-4 py-3">
                {agent.promptBlocks[key] ? (
                  <p className="text-sm text-[var(--text-1)] whitespace-pre-wrap leading-relaxed">
                    {agent.promptBlocks[key]}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--text-3)] italic">未配置</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ─── Instances Tab ────────────────────────────────────────────────

function InstancesTab({ agent }: { agent: Agent }) {
  const instances = agent.runningInstances

  if (!instances.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <Zap size={24} className="text-[var(--text-3)]" />
        <p className="text-sm text-[var(--text-2)]">当前没有运行中的实例</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {instances.map((inst) => (
        <div key={inst.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--blue)] opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-[var(--blue)]" />
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--text-1)]">{inst.requirementName}</p>
              <p className="text-[11px] text-[var(--text-3)] font-mono mt-0.5">{inst.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[var(--text-3)]">
              {new Date(inst.startedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
            <button className="text-[11px] font-medium text-[var(--danger)] hover:text-[var(--red)] transition-colors px-2 py-1 rounded-lg hover:bg-[var(--danger-sub)]">
              停止
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── History Tab ──────────────────────────────────────────────────

function HistoryTab() {
  const mockHistory = [
    { v: 'v2', date: '2026-04-10', author: 'Zhangshanshan', note: '增加合规审查要求，优化行为约束块' },
    { v: 'v1', date: '2026-03-10', author: 'Zhangshanshan', note: '初始版本' },
  ]
  return (
    <div className="flex flex-col gap-3">
      {mockHistory.map((h, i) => (
        <div key={h.v} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={cn('size-7 rounded-full flex items-center justify-center text-[11px] font-bold border',
              i === 0 ? 'bg-[var(--accent-sub)] border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--bg-panel-2)] border-[var(--border)] text-[var(--text-3)]'
            )}>
              <History size={12} />
            </div>
            {i < mockHistory.length - 1 && <div className="w-px flex-1 bg-[var(--border)] my-1" />}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-[var(--text-1)]">{h.v}</span>
              {i === 0 && <Badge variant="blue" className="text-[10px]">当前版本</Badge>}
              <span className="text-[11px] text-[var(--text-3)]">{h.date} · {h.author}</span>
            </div>
            <p className="text-sm text-[var(--text-2)]">{h.note}</p>
            {i > 0 && (
              <button className="text-[11px] text-[var(--accent)] hover:opacity-70 mt-1">
                查看此版本 →
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Delete Dialog ────────────────────────────────────────────────

function DeleteDialog({ agentName, instanceCount, onCancel, onConfirm }: {
  agentName: string; instanceCount: number;
  onCancel: () => void; onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[460px] rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-[var(--shadow-lg)] overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--border)]">
          <h3 className="text-base font-bold text-[var(--text-1)]">删除 Agent</h3>
          <p className="text-sm text-[var(--text-2)] mt-1">「{agentName}」将被永久删除，此操作不可恢复</p>
        </div>
        <div className="px-6 py-4 flex flex-col gap-3">
          {instanceCount > 0 ? (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[var(--danger-sub)] border border-[rgba(255,69,58,0.2)]">
              <span className="text-[var(--danger)] text-sm">⚠️</span>
              <p className="text-xs text-[var(--danger)]">
                当前有 {instanceCount} 个运行中实例，删除后这些实例将立即中断。建议先停止所有实例再删除。
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--success-sub)] border border-[rgba(48,209,88,0.2)]">
              <span className="text-sm">✅</span>
              <p className="text-xs text-[var(--success)]">依赖扫描完成 — 无关联运行中工作流，可安全删除</p>
            </div>
          )}
          <p className="text-xs text-[var(--text-3)]">历史执行记录和版本快照将在删除后 30 天内保留，之后永久清除。</p>
        </div>
        <div className="px-6 py-4 flex justify-end gap-2 border-t border-[var(--border)]">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-hover)] transition-all">
            取消
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[var(--danger)] hover:opacity-90 transition-all">
            确认删除
          </button>
        </div>
      </div>
    </div>
  )
}
