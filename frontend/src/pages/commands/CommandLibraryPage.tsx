import { useState, useMemo } from 'react'
import {
  Search, Shield, ChevronDown, ChevronRight, Plus, Pencil,
  Trash2, X, Check, ArrowRight, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { mockCommands } from '@/mocks/data/agents'
import { bmadAgentDefs } from '@/mocks/data/bmadAgentDefs'
import type { Command, CommandPhase } from '@/types/agent'

const PHASE_LABELS: Record<CommandPhase, string> = {
  analysis: '分析', planning: '规划', architecture: '架构',
  implementation: '实现', qa: 'QA', utility: '通用工具',
}

// 新增命令弹窗用
const PHASES: { value: CommandPhase; label: string; emoji: string }[] = [
  { value: 'analysis',       label: '分析',    emoji: '🔬' },
  { value: 'planning',       label: '规划',    emoji: '📋' },
  { value: 'architecture',   label: '架构',    emoji: '🏗️' },
  { value: 'implementation', label: '实现',    emoji: '💻' },
  { value: 'qa',             label: 'QA',     emoji: '🧪' },
  { value: 'utility',        label: '通用工具', emoji: '🛠️' },
]

type DialogMode = { type: 'add'; phase?: CommandPhase } | { type: 'edit'; cmd: Command } | null

// ─── 根据 code 在 commands 列表中找到命令名称 ─────────────────────────
function findCmdName(commands: Command[], code: string): string {
  return commands.find((c) => c.code === code)?.name ?? code
}

// ─── 主页面 ──────────────────────────────────────────────────────────

export function CommandLibraryPage() {
  const [commands, setCommands] = useState<Command[]>(mockCommands)
  const [keyword, setKeyword] = useState('')
  const [dialog, setDialog] = useState<DialogMode>(null)
  const [deleteTarget, setDeleteTarget] = useState<Command | null>(null)

  const filtered = useMemo(() => {
    if (!keyword) return commands
    const kw = keyword.toLowerCase()
    return commands.filter(
      (c) =>
        c.code.toLowerCase().includes(kw) ||
        c.name.includes(keyword) ||
        c.description.includes(keyword) ||
        (c.detail ?? '').includes(keyword),
    )
  }, [commands, keyword])

  const handleSave = (data: Omit<Command, 'id' | 'isProtected'>) => {
    if (dialog?.type === 'edit') {
      setCommands((prev) => prev.map((c) => (c.id === dialog.cmd.id ? { ...c, ...data } : c)))
    } else {
      setCommands((prev) => [
        ...prev,
        { ...data, id: `custom-${Date.now()}`, isProtected: false },
      ])
    }
    setDialog(null)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    setCommands((prev) => prev.filter((c) => c.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const toggleEnabled = (id: string) =>
    setCommands((prev) => prev.map((c) => (c.id === id ? { ...c, isEnabled: !c.isEnabled } : c)))

  const total = commands.length
  const customCount = commands.filter((c) => !c.isProtected).length

  return (
    <div className="flex flex-col min-h-screen">
      {/* Page Hero Header */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-base)]">
        <div className="max-w-[960px] mx-auto w-full px-6 py-6">
          {/* Identity row */}
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)] mb-1">命令库</p>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-1)]">BMAD 命令库</h1>
              <p className="text-sm text-[var(--text-2)] mt-1">
                命令是 Agent 能力的原子单元，每个命令对应一个具体的研发工作流。
                <span className="text-[var(--orange)] ml-1">🔒 受保护命令</span>为内置命令，不可删除；自定义命令可完整编辑。
              </p>
            </div>
            <div className="flex shrink-0 items-end gap-4">
              <div className="flex flex-col items-end">
                <span className="text-xl font-bold tabular-nums text-[var(--text-1)]">{total}</span>
                <span className="text-[10px] text-[var(--text-3)]">全部命令</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xl font-bold tabular-nums text-[var(--text-1)]">{customCount}</span>
                <span className="text-[10px] text-[var(--text-3)]">自定义</span>
              </div>
              <button
                onClick={() => setDialog({ type: 'add' })}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-all h-9 ml-2"
              >
                <Plus size={13} />
                新增命令
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[960px] mx-auto w-full px-6 py-8 flex flex-col gap-6">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            type="text"
            placeholder="搜索命令代码、名称、描述或说明…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className={cn(
              'w-full h-9 pl-9 pr-4 rounded-xl text-sm',
              'bg-[var(--bg-panel)] border border-[var(--border)]',
              'text-[var(--text-1)] placeholder:text-[var(--text-3)]',
              'focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-sub)]',
            )}
          />
        </div>

        {/* Content */}
        {keyword ? (
          // ── 搜索结果 ──────────────────────────────────────────────
          <div className="flex flex-col gap-2">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-sm text-[var(--text-3)]">未找到匹配命令</div>
            ) : (
              <>
                <p className="text-xs text-[var(--text-3)]">找到 {filtered.length} 个命令</p>
                {filtered.map((cmd) => (
                  <SearchResultRow
                    key={cmd.id}
                    cmd={cmd}
                    allCommands={commands}
                    onEdit={() => setDialog({ type: 'edit', cmd })}
                    onDelete={() => setDeleteTarget(cmd)}
                    onToggle={() => toggleEnabled(cmd.id)}
                  />
                ))}
              </>
            )}
          </div>
        ) : (
          // ── Agent 视角 ────────────────────────────────────────────
          <AgentView
            commands={commands}
            allCommands={commands}
            onEdit={(cmd) => setDialog({ type: 'edit', cmd })}
            onDelete={(cmd) => setDeleteTarget(cmd)}
            onToggle={toggleEnabled}
          />
        )}
      </main>

      {dialog && (
        <CommandDialog mode={dialog} onSave={handleSave} onClose={() => setDialog(null)} />
      )}
      {deleteTarget && (
        <DeleteDialog
          cmd={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

// ─── Agent 视角 ───────────────────────────────────────────────────────

function AgentView({
  commands, allCommands, onEdit, onDelete, onToggle,
}: {
  commands: Command[]
  allCommands: Command[]
  onEdit: (cmd: Command) => void
  onDelete: (cmd: Command) => void
  onToggle: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // 每个 agent section 的命令
  const agentSections = bmadAgentDefs.map((agent) => ({
    agent,
    cmds: agent.commandCodes
      .map((code) => commands.find((c) => c.code === code))
      .filter(Boolean) as Command[],
  }))

  // 自定义命令（isProtected: false）
  const customCmds = commands.filter((c) => !c.isProtected)

  return (
    <div className="flex flex-col gap-3">
      {agentSections.map(({ agent, cmds }) => {
        const isCollapsed = collapsed.has(agent.id)
        const phaseBadgeVariant = ({
          analysis: 'blue', planning: 'purple', architecture: 'orange',
          implementation: 'green', utility: 'gray',
        } as const)[agent.phase] ?? 'gray'

        return (
          <div key={agent.id} className="rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] overflow-hidden">
            {/* Agent Header */}
            <button
              onClick={() => toggle(agent.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--bg-hover)] transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl flex-shrink-0">{agent.avatar}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[var(--text-1)]">{agent.personaName}</span>
                    <span className="text-[var(--border-strong)]">·</span>
                    <span className="text-sm text-[var(--text-2)]">{agent.personaTitle}</span>
                    <Badge variant={phaseBadgeVariant} className="text-[10px]">
                      {PHASE_LABELS[agent.phase]}
                    </Badge>
                  </div>
                  <p className="text-xs font-mono text-[var(--text-3)] mt-0.5">{agent.skillName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <span className="text-[11px] font-mono text-[var(--text-3)] bg-[var(--bg-panel-2)] px-2 py-0.5 rounded-md">
                  {cmds.length} 个命令
                </span>
                {isCollapsed
                  ? <ChevronRight size={14} className="text-[var(--text-3)]" />
                  : <ChevronDown size={14} className="text-[var(--text-3)]" />}
              </div>
            </button>

            {/* Expanded content */}
            {!isCollapsed && (
              <div className="border-t border-[var(--border)]">
                {/* Persona description */}
                <div className="px-5 py-3.5 bg-[var(--bg-panel-2)] border-b border-[var(--border)]">
                  <p className="text-xs leading-relaxed text-[var(--text-2)]">{agent.description}</p>
                </div>

                {/* Capability table */}
                {cmds.length === 0 ? (
                  <div className="px-5 py-4 text-xs text-[var(--text-3)] text-center">暂无命令</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)] w-16">代码</th>
                          <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)] w-32">能力</th>
                          <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">说明</th>
                          <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)] w-44">产出物</th>
                          <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)] w-36 pr-5">下一步</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cmds.map((cmd, i) => (
                          <CapabilityRow
                            key={cmd.id}
                            cmd={cmd}
                            allCommands={allCommands}
                            bordered={i < cmds.length - 1}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* 自定义命令 */}
      {customCmds.length > 0 && (
        <CustomCmdsSection
          cmds={customCmds}
          allCommands={allCommands}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggle={onToggle}
        />
      )}
    </div>
  )
}

// ─── 能力表格行（只读，用于 Agent 视角）─────────────────────────────────

function CapabilityRow({
  cmd, allCommands, bordered,
}: {
  cmd: Command
  allCommands: Command[]
  bordered: boolean
}) {
  return (
    <tr className={cn(
      'hover:bg-[var(--bg-hover)] transition-colors',
      bordered && 'border-b border-[var(--border)]',
    )}>
      {/* 代码 */}
      <td className="px-5 py-3">
        <div className="inline-flex items-center justify-center h-6 px-2 rounded-md bg-[var(--accent-sub)] border border-[rgba(10,132,255,0.2)]">
          <span className="text-[11px] font-mono font-bold text-[var(--accent)]">{cmd.code}</span>
        </div>
      </td>
      {/* 能力名 */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-[var(--text-1)]">{cmd.name}</span>
          {cmd.isProtected && (
            <Badge variant="orange" className="text-[10px]">
              <Shield size={9} />受保护
            </Badge>
          )}
          {!cmd.isEnabled && (
            <span className="text-[10px] text-[var(--text-3)] bg-[var(--bg-panel-2)] border border-[var(--border)] px-1.5 py-0.5 rounded">
              停用
            </span>
          )}
        </div>
      </td>
      {/* 说明 */}
      <td className="px-3 py-3">
        <p className="text-[var(--text-2)] leading-relaxed">{cmd.description}</p>
        {cmd.detail && (
          <p className="text-[var(--text-3)] leading-relaxed mt-0.5 text-[11px]">{cmd.detail}</p>
        )}
      </td>
      {/* 产出物 */}
      <td className="px-3 py-3">
        {cmd.outputs ? (
          <div className="flex items-center gap-1.5 text-[var(--text-2)]">
            <FileText size={11} className="flex-shrink-0 text-[var(--text-3)]" />
            <span>{cmd.outputs}</span>
          </div>
        ) : (
          <span className="text-[var(--text-3)]">—</span>
        )}
      </td>
      {/* 下一步 */}
      <td className="px-3 py-3 pr-5">
        {cmd.nextSteps && cmd.nextSteps.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            <ArrowRight size={11} className="text-[var(--text-3)] flex-shrink-0" />
            {cmd.nextSteps.map((code) => (
              <span
                key={code}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--bg-panel-2)] border border-[var(--border)] text-[var(--text-2)]"
                title={findCmdName(allCommands, code)}
              >
                {code}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[var(--text-3)]">—</span>
        )}
      </td>
    </tr>
  )
}

// ─── 自定义命令区块 ───────────────────────────────────────────────────

function CustomCmdsSection({
  cmds, allCommands, onEdit, onDelete, onToggle,
}: {
  cmds: Command[]
  allCommands: Command[]
  onEdit: (cmd: Command) => void
  onDelete: (cmd: Command) => void
  onToggle: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] overflow-hidden">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--bg-hover)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">✨</span>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--text-1)]">自定义命令</span>
              <Badge variant="purple" className="text-[10px]">自定义</Badge>
            </div>
            <p className="text-xs text-[var(--text-3)] mt-0.5">团队创建的命令，可编辑和删除</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[var(--text-3)] bg-[var(--bg-panel-2)] px-2 py-0.5 rounded-md">
            {cmds.length} 个命令
          </span>
          {collapsed ? <ChevronRight size={14} className="text-[var(--text-3)]" /> : <ChevronDown size={14} className="text-[var(--text-3)]" />}
        </div>
      </button>
      {!collapsed && (
        <div className="border-t border-[var(--border)]">
          {cmds.map((cmd, i) => (
            <CommandRow
              key={cmd.id}
              cmd={cmd}
              allCommands={allCommands}
              bordered={i < cmds.length - 1}
              onEdit={() => onEdit(cmd)}
              onDelete={() => onDelete(cmd)}
              onToggle={() => onToggle(cmd.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 阶段视角 ─────────────────────────────────────────────────────────

// ─── 通用命令行（自定义区块 + 搜索结果用）────────────────────────────────

function CommandRow({
  cmd, allCommands, bordered = false, onEdit, onDelete, onToggle,
}: {
  cmd: Command
  allCommands: Command[]
  bordered?: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn(bordered && 'border-b border-[var(--border)]')}>
      {/* 主行 */}
      <div className="flex items-start gap-4 px-5 py-3 hover:bg-[var(--bg-hover)] transition-colors">
        {/* Code chip */}
        <div className="flex-shrink-0 mt-0.5 inline-flex items-center justify-center h-7 px-2.5 rounded-lg bg-[var(--accent-sub)] border border-[rgba(10,132,255,0.2)]">
          <span className="text-[11px] font-mono font-bold text-[var(--accent)]">{cmd.code}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[var(--text-1)]">{cmd.name}</span>
            {cmd.isProtected && (
              <Badge variant="orange" className="text-[10px]">
                <Shield size={9} />受保护
              </Badge>
            )}
          </div>
          <p className="text-xs text-[var(--text-2)] mt-0.5">{cmd.description}</p>

          {/* Outputs + Next steps */}
          {(cmd.outputs || (cmd.nextSteps && cmd.nextSteps.length > 0)) && (
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {cmd.outputs && (
                <div className="flex items-center gap-1 text-[11px] text-[var(--text-3)]">
                  <FileText size={10} />
                  <span>{cmd.outputs}</span>
                </div>
              )}
              {cmd.nextSteps && cmd.nextSteps.length > 0 && (
                <div className="flex items-center gap-1">
                  <ArrowRight size={10} className="text-[var(--text-3)]" />
                  {cmd.nextSteps.map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--bg-panel-2)] border border-[var(--border)] text-[var(--text-2)]"
                      title={findCmdName(allCommands, code)}
                    >
                      {code}
                    </span>
                  ))}
                </div>
              )}
              {cmd.detail && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="text-[11px] text-[var(--accent)] hover:opacity-70 transition-opacity"
                >
                  {expanded ? '收起' : '查看详情'}
                </button>
              )}
            </div>
          )}

          {/* Expanded detail */}
          {expanded && cmd.detail && (
            <p className="text-xs text-[var(--text-2)] mt-2 leading-relaxed bg-[var(--bg-panel-2)] px-3 py-2 rounded-lg border border-[var(--border)]">
              {cmd.detail}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          {cmd.isProtected ? (
            <Badge variant={cmd.isEnabled ? 'green' : 'gray'}>{cmd.isEnabled ? '启用' : '停用'}</Badge>
          ) : (
            <>
              <button
                onClick={onToggle}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-medium border',
                  cmd.isEnabled
                    ? 'text-[var(--success)] bg-[var(--success-sub)] border-[rgba(48,209,88,0.2)]'
                    : 'text-[var(--text-3)] bg-[var(--bg-panel-2)] border-[var(--border)]',
                )}
              >
                {cmd.isEnabled ? '启用中' : '已停用'}
              </button>
              <button
                onClick={onEdit}
                className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-panel-2)] border border-[var(--border)]"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-[var(--danger-sub)] border border-[var(--border)]"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 搜索结果行 ───────────────────────────────────────────────────────

function SearchResultRow({
  cmd, allCommands, onEdit, onDelete, onToggle,
}: {
  cmd: Command
  allCommands: Command[]
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  return (
    <div className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] overflow-hidden">
      <CommandRow
        cmd={cmd}
        allCommands={allCommands}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggle={onToggle}
      />
    </div>
  )
}

// ─── Add / Edit Dialog ────────────────────────────────────────────────

function CommandDialog({
  mode, onSave, onClose,
}: {
  mode: DialogMode & object
  onSave: (data: Omit<Command, 'id' | 'isProtected'>) => void
  onClose: () => void
}) {
  const isEdit = mode.type === 'edit'
  const initial = isEdit ? mode.cmd : null

  const [code, setCode] = useState(initial?.code ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [outputs, setOutputs] = useState(initial?.outputs ?? '')
  const [phase, setPhase] = useState<CommandPhase>(
    initial?.phase ?? ('phase' in mode && mode.phase ? mode.phase : 'analysis'),
  )
  const [isEnabled, setIsEnabled] = useState(initial?.isEnabled ?? true)

  const codeError = code.trim() && !/^[A-Z0-9]{1,6}$/.test(code.trim())
  const canSave = code.trim().length > 0 && name.trim().length > 0 && !codeError

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[500px] rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-[var(--shadow-lg)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h3 className="text-base font-bold text-[var(--text-1)]">
            {isEdit ? '编辑命令' : '新增命令'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-hover)] transition-all">
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Code */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
              命令代码 <span className="text-[var(--danger)]">*</span>
              <span className="normal-case font-normal text-[var(--text-3)] ml-1">1–6 位大写字母或数字</span>
            </label>
            <input
              type="text"
              placeholder="例如：BP、DR、CA"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              className={cn(
                'h-9 px-4 rounded-xl text-sm font-mono w-full',
                'bg-[var(--bg-base)] border',
                codeError ? 'border-[var(--danger)]' : 'border-[var(--border)]',
                'text-[var(--text-1)] placeholder:text-[var(--text-3)]',
                'focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-sub)]',
              )}
            />
            {codeError && <span className="text-xs text-[var(--danger)]">只允许大写字母和数字</span>}
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
              命令名称 <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              placeholder="例如：产品简报、领域研究"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              className={cn(
                'h-9 px-4 rounded-xl text-sm w-full',
                'bg-[var(--bg-base)] border border-[var(--border)]',
                'text-[var(--text-1)] placeholder:text-[var(--text-3)]',
                'focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-sub)]',
              )}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">说明</label>
            <input
              type="text"
              placeholder="简要说明这个命令的职责"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={80}
              className={cn(
                'h-9 px-4 rounded-xl text-sm w-full',
                'bg-[var(--bg-base)] border border-[var(--border)]',
                'text-[var(--text-1)] placeholder:text-[var(--text-3)]',
                'focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-sub)]',
              )}
            />
          </div>

          {/* Outputs */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">产出物</label>
            <input
              type="text"
              placeholder="例如：market-research.md、sprint-plan.md"
              value={outputs}
              onChange={(e) => setOutputs(e.target.value)}
              maxLength={60}
              className={cn(
                'h-9 px-4 rounded-xl text-sm w-full',
                'bg-[var(--bg-base)] border border-[var(--border)]',
                'text-[var(--text-1)] placeholder:text-[var(--text-3)]',
                'focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-sub)]',
              )}
            />
          </div>

          {/* Phase */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
              所属研发阶段 <span className="text-[var(--danger)]">*</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {PHASES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPhase(p.value)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
                    phase === p.value
                      ? 'bg-[var(--accent-sub)] text-[var(--accent)] border-[rgba(10,132,255,0.3)]'
                      : 'bg-[var(--bg-base)] text-[var(--text-2)] border-[var(--border)] hover:border-[var(--border-strong)]',
                  )}
                >
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Enable toggle */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
            <div>
              <p className="text-xs font-medium text-[var(--text-1)]">启用状态</p>
              <p className="text-[11px] text-[var(--text-3)] mt-0.5">停用后该命令不会出现在 Agent 创建向导的选项中</p>
            </div>
            <button
              onClick={() => setIsEnabled(!isEnabled)}
              className={cn(
                'relative w-10 h-6 rounded-full transition-colors flex-shrink-0',
                isEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg-panel-3)]',
              )}
            >
              <span className={cn(
                'absolute top-1 size-4 rounded-full bg-white shadow-sm transition-transform',
                isEnabled ? 'translate-x-5' : 'translate-x-1',
              )} />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-hover)] transition-all"
          >
            取消
          </button>
          <button
            onClick={() => canSave && onSave({ code: code.trim(), name: name.trim(), description: description.trim(), outputs: outputs.trim() || undefined, phase, isEnabled })}
            disabled={!canSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all"
          >
            <Check size={13} />
            {isEdit ? '保存修改' : '新增命令'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Dialog ────────────────────────────────────────────────────

function DeleteDialog({ cmd, onCancel, onConfirm }: {
  cmd: Command; onCancel: () => void; onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[420px] rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-[var(--shadow-lg)] overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--border)]">
          <h3 className="text-base font-bold text-[var(--text-1)]">删除命令</h3>
          <p className="text-sm text-[var(--text-2)] mt-1">
            确认删除命令{' '}
            <span className="font-mono font-bold text-[var(--accent)]">{cmd.code}</span>
            {' '}「{cmd.name}」？
          </p>
        </div>
        <div className="px-6 py-4">
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[var(--warning-sub)] border border-[rgba(255,159,10,0.2)]">
            <span className="text-sm">⚠️</span>
            <p className="text-xs text-[var(--orange)]">
              已使用此命令的 Agent 模板不受影响，但创建新 Agent 时该命令将不再出现。
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--border)]">
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
