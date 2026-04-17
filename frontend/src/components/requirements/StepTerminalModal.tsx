import { X } from 'lucide-react'
import { useScrollLock } from '@/hooks/useScrollLock'
import { LogStream } from '@/components/ui/LogStream'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import type { CommanderEvent } from '@/types/project'

interface StepTerminalModalProps {
  open: boolean
  onClose: () => void
  agentName: string
  stepName: string
  events: CommanderEvent[]
}

export function StepTerminalModal({ open, onClose, agentName, stepName, events }: StepTerminalModalProps) {
  useScrollLock(open)
  if (!open) return null

  const logLines = events.map((evt) => ({ text: evt.content }))

  // Extract content_preview from done:* events
  const previews = events
    .filter((evt) => {
      const phase = (evt.metadata?.phase as string) || ''
      return phase.startsWith('done:') && evt.metadata?.content_preview
    })
    .map((evt) => ({
      name: evt.content.replace(/^\[[^\]]+\]\s*/, ''),
      preview: evt.metadata!.content_preview as string,
    }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/70 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative flex w-full max-w-[800px] flex-col rounded-2xl border border-[#30363d] bg-[#0d1117] shadow-2xl"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#21262d] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#3fb950]" />
            <span className="text-[12px] font-bold text-[#e6edf3]">{agentName}</span>
            <span className="text-[11px] text-[#6e7681]">- {stepName}</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#6e7681] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3]"
          >
            <X size={15} />
          </button>
        </div>

        {/* Log stream */}
        <div className="flex-1 overflow-y-auto p-4">
          <LogStream lines={logLines} maxHeight="none" />
        </div>

        {/* Artifact previews */}
        {previews.length > 0 && (
          <div className="shrink-0 border-t border-[#21262d] px-5 py-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#6e7681]">产出物预览</p>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {previews.map((p, i) => (
                <details key={i} className="group rounded-lg border border-[#21262d] bg-[#161b22]">
                  <summary className="cursor-pointer px-3 py-2 text-[11px] text-[#e6edf3] hover:bg-[#1c2128]">
                    {p.name}
                  </summary>
                  <MarkdownRenderer content={p.preview} className="px-3 py-2 text-[11px] leading-relaxed" />
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
