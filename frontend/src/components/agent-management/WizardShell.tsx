import { cn } from '@/lib/utils'
import type { WizardStep } from '@/stores/agentWizardStore'

const STEPS = [
  { n: 1 as WizardStep, label: '基础信息' },
  { n: 2 as WizardStep, label: '能力选择' },
  { n: 3 as WizardStep, label: '提示词配置' },
]

interface WizardShellProps {
  step: WizardStep
  children: React.ReactNode
  onClose?: () => void
  title?: string
  mode?: 'page' | 'modal'
}

function StepIndicator({ step }: { step: WizardStep }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center justify-center size-6 rounded-full text-xs font-bold transition-all',
                step === s.n
                  ? 'bg-[var(--accent)] text-white'
                  : step > s.n
                    ? 'bg-[var(--success)] text-white'
                    : 'bg-[var(--bg-panel-2)] text-[var(--text-3)] border border-[var(--border)]',
              )}
            >
              {step > s.n ? '✓' : s.n}
            </div>
            <span
              className={cn(
                'text-xs font-medium transition-colors',
                step === s.n ? 'text-[var(--text-1)]' : 'text-[var(--text-3)]',
              )}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                'h-px w-12 mx-3 transition-colors',
                step > s.n ? 'bg-[var(--success)]' : 'bg-[var(--border)]',
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export function WizardShell({ step, children, onClose, title = '新建 Agent', mode = 'page' }: WizardShellProps) {
  if (mode === 'modal') {
    return (
      <>
        {/* Step indicator */}
        <div className="shrink-0 border-b border-[var(--border)] bg-[var(--bg-panel-2)] px-8 py-3">
          <StepIndicator step={step} />
        </div>
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          {children}
        </div>
      </>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-base)]">
      {/* Header */}
      <header className="sticky top-0 z-50 h-13 flex items-center justify-between px-8 bg-[var(--glass-bg)] backdrop-blur-[24px] border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[var(--text-1)] tracking-tight">AI-DZHT</span>
          <span className="text-[var(--border-strong)]">/</span>
          <span className="text-sm text-[var(--text-2)]">Agent 管理</span>
          <span className="text-[var(--border-strong)]">/</span>
          <span className="text-sm font-medium text-[var(--text-1)]">{title}</span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors px-2 py-1 rounded-lg hover:bg-[var(--bg-hover)]"
        >
          取消
        </button>
      </header>

      {/* Step indicator */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-panel)]">
        <div className="max-w-[720px] mx-auto px-8 py-4">
          <StepIndicator step={step} />
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-[720px] mx-auto w-full px-8 py-10">
        {children}
      </main>
    </div>
  )
}
