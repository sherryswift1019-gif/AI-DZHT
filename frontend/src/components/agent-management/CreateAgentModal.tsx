import { useEffect } from 'react'
import { X } from 'lucide-react'
import { WizardShell } from './WizardShell'
import { Step1BasicInfo } from '@/pages/agent-management/wizard/Step1BasicInfo'
import { Step2Capabilities } from '@/pages/agent-management/wizard/Step2Capabilities'
import { Step3Prompt } from '@/pages/agent-management/wizard/Step3Prompt'
import { useWizardStore } from '@/stores/agentWizardStore'

interface CreateAgentModalProps {
  open: boolean
  onClose: () => void
}

export function CreateAgentModal({ open, onClose }: CreateAgentModalProps) {
  const { step, reset } = useWizardStore()

  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative flex w-full max-w-[860px] flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] shadow-[var(--shadow-lg)]"
        style={{ maxHeight: '88vh' }}
      >
        {/* Modal header */}
        <div className="flex shrink-0 items-center justify-between rounded-t-2xl border-b border-[var(--border)] bg-[var(--bg-panel)] px-6 py-3.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[var(--text-1)]">新建 Agent</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-2)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-1)]"
          >
            <X size={15} />
          </button>
        </div>

        {/* Wizard content (step indicator + scrollable body) */}
        <WizardShell step={step} onClose={onClose} mode="modal">
          {step === 1 && <Step1BasicInfo />}
          {step === 2 && <Step2Capabilities />}
          {step === 3 && <Step3Prompt onFinish={onClose} />}
        </WizardShell>
      </div>
    </div>
  )
}
