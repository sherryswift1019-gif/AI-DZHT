import { cn } from '@/lib/utils'
import { useWizardStore } from '@/stores/agentWizardStore'
import { mockCommands } from '@/mocks/data/agents'
import type { CommandPhase } from '@/types/agent'
import { ArrowLeft, ArrowRight } from 'lucide-react'

const PHASES: { value: CommandPhase; label: string; emoji: string; desc: string }[] = [
  { value: 'analysis',       label: '分析',   emoji: '🔬', desc: '领域/市场/技术调研' },
  { value: 'planning',       label: '规划',   emoji: '📋', desc: 'PRD·产品简报·UX 设计' },
  { value: 'architecture',   label: '架构',   emoji: '🏗',  desc: '技术架构·上下文生成' },
  { value: 'implementation', label: '实现',   emoji: '💻', desc: 'Story·Sprint·代码' },
  { value: 'qa',             label: 'QA',    emoji: '🧪', desc: '测试·评审·验证' },
]

export function Step2Capabilities() {
  const { selectedCommands, toggleCommand, setStep } = useWizardStore()
  const selectedIds = new Set(selectedCommands.map((c) => c.id))

  const commandsByPhase = PHASES.map((phase) => ({
    ...phase,
    commands: mockCommands.filter((c) => c.phase === phase.value),
  }))

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[var(--text-1)]">能力选择</h2>
        <p className="text-sm text-[var(--text-2)] mt-1">
          勾选这个 Agent 需要具备的 BMAD 命令能力，下一步将自动生成对应提示词草稿
        </p>
      </div>

      {/* Selected count */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent-sub)] border border-[rgba(10,132,255,0.2)]">
        <span className="text-sm font-semibold text-[var(--accent)]">
          已选 {selectedCommands.length} 个能力
        </span>
        {selectedCommands.length > 0 && (
          <>
            <span className="text-[var(--accent)] opacity-40">·</span>
            <div className="flex flex-wrap gap-1">
              {selectedCommands.map((c) => (
                <span
                  key={c.id}
                  className="text-[11px] font-mono font-medium text-[var(--accent)] bg-[rgba(10,132,255,0.1)] px-1.5 py-0.5 rounded"
                >
                  {c.code}
                </span>
              ))}
            </div>
          </>
        )}
        {selectedCommands.length === 0 && (
          <span className="text-xs text-[var(--accent)] opacity-60">可以不选，直接手写提示词</span>
        )}
      </div>

      {/* Commands by phase */}
      <div className="flex flex-col gap-5">
        {commandsByPhase.map((phase) => (
          <div key={phase.value} className="flex flex-col gap-2">
            {/* Phase header */}
            <div className="flex items-center gap-2">
              <span className="text-base">{phase.emoji}</span>
              <span className="text-xs font-semibold text-[var(--text-1)]">{phase.label}</span>
              <span className="text-xs text-[var(--text-3)]">— {phase.desc}</span>
            </div>

            {/* Commands */}
            <div className="grid grid-cols-2 gap-2 pl-6">
              {phase.commands.map((cmd) => {
                const isSelected = selectedIds.has(cmd.id)
                return (
                  <button
                    key={cmd.id}
                    onClick={() => toggleCommand(cmd)}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent-sub)]'
                        : 'border-[var(--border)] bg-[var(--bg-panel)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]',
                    )}
                  >
                    {/* Checkbox */}
                    <div
                      className={cn(
                        'flex-shrink-0 mt-0.5 size-4 rounded flex items-center justify-center border transition-all',
                        isSelected
                          ? 'bg-[var(--accent)] border-[var(--accent)]'
                          : 'bg-transparent border-[var(--border-strong)]',
                      )}
                    >
                      {isSelected && <span className="text-[9px] text-white font-bold">✓</span>}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[var(--accent)]">{cmd.code}</span>
                        <span className="text-xs font-medium text-[var(--text-1)]">{cmd.name}</span>
                      </div>
                      <div className="text-[11px] text-[var(--text-2)] mt-0.5 leading-snug">
                        {cmd.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setStep(1)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-hover)] transition-all"
        >
          <ArrowLeft size={14} />
          上一步
        </button>
        <button
          onClick={() => setStep(3)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-all"
        >
          下一步：配置提示词
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
