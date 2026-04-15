import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, SlidersHorizontal, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { AgentCard } from '@/components/agent-management/AgentCard'
import { CreateAgentModal } from '@/components/agent-management/CreateAgentModal'
import { mockAgents } from '@/mocks/data/agents'
import type { AgentStatus, AgentSource } from '@/types/agent'

type FilterStatus = AgentStatus | 'all'
type FilterSource = AgentSource | 'all'

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'all',      label: '全部' },
  { value: 'running',  label: '运行中' },
  { value: 'active',   label: '已启用' },
  { value: 'idle',     label: '空闲' },
  { value: 'draft',    label: '草稿' },
  { value: 'disabled', label: '已停用' },
]

export function AgentListPage() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [sourceFilter, setSourceFilter] = useState<FilterSource>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const filtered = useMemo(() => {
    return mockAgents.filter(agent => {
      const matchKeyword =
        !keyword ||
        agent.name.toLowerCase().includes(keyword.toLowerCase()) ||
        agent.description.toLowerCase().includes(keyword.toLowerCase()) ||
        agent.commands.some(c => c.code.toLowerCase().includes(keyword.toLowerCase()))

      const matchStatus = statusFilter === 'all' || agent.status === statusFilter
      const matchSource = sourceFilter === 'all' || agent.source === sourceFilter

      return matchKeyword && matchStatus && matchSource
    })
  }, [keyword, statusFilter, sourceFilter])

  const runningCount = mockAgents.filter(a => a.status === 'running').length
  const builtinCount = mockAgents.filter(a => a.source === 'builtin').length
  const customCount  = mockAgents.filter(a => a.source !== 'builtin').length

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-base)]">
      <main className="max-w-[1200px] mx-auto w-full px-6 py-8 flex flex-col gap-8">
        {/* Page Title + Stats */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)] mb-1">Agent 管理</p>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-1)]">Agent 模板库</h1>
            <p className="text-sm text-[var(--text-2)] mt-1">管理团队的 AI Agent 能力配置与提示词模板</p>
          </div>
          <div className="flex items-end gap-4">
            <Stat label="运行中" value={runningCount} variant="blue" />
            <Stat label="内置" value={builtinCount} variant="gray" />
            <Stat label="自定义" value={customCount} variant="purple" />
            <div className="ml-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-all h-9"
              >
                <Plus size={13} />
                新建 Agent
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3">
          {/* Search + action buttons */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
              <input
                type="text"
                placeholder="搜索 Agent 名称、描述或能力代码（如 BP、CA）…"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                className={cn(
                  'w-full h-9 pl-9 pr-4 rounded-xl text-sm',
                  'bg-[var(--bg-panel)] border border-[var(--border)]',
                  'text-[var(--text-1)] placeholder:text-[var(--text-3)]',
                  'focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]',
                  'transition-colors',
                )}
              />
            </div>
            <button
              onClick={() => navigate('/commands')}
              className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--text-2)] bg-[var(--bg-panel)] border border-[var(--border)] hover:text-[var(--text-1)] transition-colors h-9"
            >
              <BookOpen size={13} />
              命令库
            </button>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <SlidersHorizontal size={12} className="text-[var(--text-3)]" />
              <span className="text-[11px] text-[var(--text-3)] font-medium mr-1">状态</span>
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                    statusFilter === f.value
                      ? 'bg-[var(--accent-sub)] text-[var(--accent)] border border-[rgba(10,132,255,0.25)]'
                      : 'text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-hover)]',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="w-px h-4 bg-[var(--border)]" />

            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[var(--text-3)] font-medium mr-1">来源</span>
              {([
                { value: 'all',     label: '全部' },
                { value: 'builtin', label: '内置' },
                { value: 'custom',  label: '自定义' },
                { value: 'fork',    label: 'Fork' },
              ] as { value: FilterSource; label: string }[]).map(f => (
                <button
                  key={f.value}
                  onClick={() => setSourceFilter(f.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                    sourceFilter === f.value
                      ? 'bg-[var(--accent-sub)] text-[var(--accent)] border border-[rgba(10,132,255,0.25)]'
                      : 'text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-hover)]',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Builtin Agents Section */}
        {(sourceFilter === 'all' || sourceFilter === 'builtin') && (
          <section className="flex flex-col gap-4">
            <SectionHeader
              title="内置 Agent"
              subtitle="平台预置 8 大研发角色，不可删除"
              count={filtered.filter(a => a.source === 'builtin').length}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered
                .filter(a => a.source === 'builtin')
                .map(agent => (
                  <AgentCard key={agent.id} agent={agent} onClick={() => navigate(`/agents/${agent.id}`)} />
                ))}
            </div>
          </section>
        )}

        {/* Custom Agents Section */}
        {(sourceFilter === 'all' || sourceFilter === 'custom' || sourceFilter === 'fork') && (
          <section className="flex flex-col gap-4">
            <SectionHeader
              title="自定义 Agent"
              subtitle="团队创建的 Agent 变体与 Fork"
              count={filtered.filter(a => a.source !== 'builtin').length}
            />
            {filtered.filter(a => a.source !== 'builtin').length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered
                  .filter(a => a.source !== 'builtin')
                  .map(agent => (
                    <AgentCard key={agent.id} agent={agent} onClick={() => navigate(`/agents/${agent.id}`)} />
                  ))}
              </div>
            ) : (
              <EmptyCustom onNew={() => setShowCreateModal(true)} />
            )}
          </section>
        )}

        {/* Empty state for search */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-4xl mb-4">🔍</span>
            <p className="text-sm font-medium text-[var(--text-1)]">未找到匹配的 Agent</p>
            <p className="text-xs text-[var(--text-2)] mt-1">尝试调整搜索关键词或过滤条件</p>
          </div>
        )}
      </main>

      <CreateAgentModal open={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────

function Stat({ label, value, variant }: { label: string; value: number; variant: 'blue' | 'gray' | 'purple' }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-xl font-bold tabular-nums text-[var(--text-1)]">{value}</span>
      <Badge variant={variant} className="text-[10px]">{label}</Badge>
    </div>
  )
}

function SectionHeader({ title, subtitle, count }: { title: string; subtitle: string; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--text-1)]">{title}</h2>
          <span className="text-[11px] font-mono text-[var(--text-3)] bg-[var(--bg-panel-2)] px-1.5 py-0.5 rounded-md">
            {count}
          </span>
        </div>
        <p className="text-xs text-[var(--text-2)] mt-0.5">{subtitle}</p>
      </div>
    </div>
  )
}

function EmptyCustom({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 border border-dashed border-[var(--border)] rounded-2xl text-center gap-3">
      <span className="text-3xl">✨</span>
      <div>
        <p className="text-sm font-medium text-[var(--text-1)]">还没有自定义 Agent</p>
        <p className="text-xs text-[var(--text-2)] mt-1">
          基于内置 Agent 创建变体，或从零开始配置一个专属 Agent
        </p>
      </div>
      <button
        onClick={onNew}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-all mt-1"
      >
        <Plus size={12} />
        新建 Agent
      </button>
    </div>
  )
}
