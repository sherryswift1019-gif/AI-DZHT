import React from 'react'
import { cn } from '@/lib/utils'
import type { PipelineStep, PipelineStepStatus, Requirement, StoryStatus } from '@/types/project'

// ── Status styling ────────────────────────────────────────────────────────

const STATUS_CHIP_CLS: Record<string, string> = {
  done:                      'border-[#30363d] bg-[#0d1117]',
  running:                   'border-[rgba(88,166,255,0.55)] bg-[rgba(88,166,255,0.06)] shadow-[0_0_8px_rgba(88,166,255,0.15)]',
  blocked:                   'border-[rgba(248,81,73,0.55)] bg-[rgba(248,81,73,0.06)]',
  pending_approval:          'border-[rgba(255,159,10,0.55)] bg-[rgba(255,159,10,0.06)] shadow-[0_0_8px_rgba(255,159,10,0.12)]',
  pending_advisory_approval: 'border-[rgba(255,214,10,0.5)] bg-[rgba(255,214,10,0.05)]',
  pending_input:             'border-[rgba(88,166,255,0.55)] bg-[rgba(88,166,255,0.06)]',
  queued:                    'border-[#21262d] bg-[#0d1117] opacity-50',
}

const STATUS_DOT_CLS: Record<string, string> = {
  done:                      'bg-[#3fb950]',
  running:                   'bg-[#58a6ff] animate-pulse',
  blocked:                   'bg-[#f85149]',
  pending_approval:          'bg-[#ff9f0a] animate-pulse',
  pending_advisory_approval: 'bg-[#ffd60a] animate-pulse',
  pending_input:             'bg-[#58a6ff] animate-pulse',
  queued:                    'bg-[#484f58]',
}

const SCAN_COLOR: Record<string, string> = {
  running:                   '#58a6ff',
  pending_approval:          '#ff9f0a',
  pending_advisory_approval: '#ffd60a',
  pending_input:             '#58a6ff',
}

// ── StepChip ──────────────────────────────────────────────────────────────

function StepChip({
  step,
  isActive,
  compact,
  onClick,
}: {
  step: PipelineStep
  isActive: boolean
  compact?: boolean
  onClick: () => void
}) {
  const cls = STATUS_CHIP_CLS[step.status] ?? STATUS_CHIP_CLS.queued
  const dotCls = STATUS_DOT_CLS[step.status] ?? STATUS_DOT_CLS.queued
  const scanColor = SCAN_COLOR[step.status]
  const w = compact ? 'w-[88px]' : 'w-[108px]'

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex shrink-0 flex-col rounded-lg border-[1.5px] text-left transition-all hover:brightness-110 active:scale-[0.97]',
        compact ? 'px-2 py-1.5' : 'px-2.5 py-2',
        w,
        cls,
        isActive && 'ring-2 ring-[#58a6ff] ring-offset-1 ring-offset-[var(--bg-base)]',
      )}
    >
      {scanColor && (
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden rounded-t-lg"
          style={{ background: `linear-gradient(90deg, transparent, ${scanColor}, transparent)`, animation: 'flow-scan 2s ease-in-out infinite' }}
        />
      )}
      <div className="flex items-center gap-1.5">
        <span className={cn('h-[6px] w-[6px] shrink-0 rounded-full', dotCls)} />
        <span className={cn('font-bold leading-none text-[var(--text-1)]', compact ? 'text-[10px]' : 'text-[11px]')}>
          {step.agentName}
        </span>
      </div>
      <span className={cn('mt-1 truncate leading-none text-[var(--text-3)]', compact ? 'text-[8px]' : 'text-[9px]')}>
        {step.name}
      </span>
    </button>
  )
}

// ── Connector Arrow ───────────────────────────────────────────────────────

function ChipArrow({ done = false }: { done?: boolean }) {
  return (
    <div className="flex shrink-0 items-center px-0.5">
      <div className={cn('h-px w-4', done ? 'bg-[#3fb950]' : 'bg-[#30363d]')} />
      <div className={cn(
        'border-y-[3px] border-l-[5px] border-y-transparent',
        done ? 'border-l-[#3fb950]' : 'border-l-[#30363d]',
      )} />
    </div>
  )
}

// ── StoryStatus badge ─────────────────────────────────────────────────────

function StoryStatusDot({ status }: { status: StoryStatus }) {
  const cls =
    status === 'done'    ? 'bg-[#3fb950]' :
    status === 'running' ? 'bg-[#58a6ff] animate-pulse' :
    status === 'blocked' ? 'bg-[#f85149]' :
                           'bg-[#484f58]'
  return <span className={cn('inline-block h-[5px] w-[5px] rounded-full', cls)} />
}

// ── Main Component ────────────────────────────────────────────────────────

interface PipelineTopBarProps {
  requirement: Requirement
  activeNodeId: string | null
  onStepClick: (step: PipelineStep) => void
}

export function PipelineTopBar({ requirement, activeNodeId, onStepClick }: PipelineTopBarProps) {
  const { pipeline, stories } = requirement

  if (pipeline.length === 0 && stories.length === 0) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3">
        <span className="text-[13px]">✦</span>
        <span className="text-[11px] text-[var(--text-3)]">流水线待配置</span>
      </div>
    )
  }

  return (
    <div className="shrink-0 border-b border-[var(--border)] bg-[var(--bg-panel)]">
      {/* ── Main pipeline track ── */}
      <div className="overflow-x-auto px-4 py-3">
        <div className="flex min-w-max items-center">
          {pipeline.map((step, idx) => (
            <React.Fragment key={step.id}>
              <StepChip
                step={step}
                isActive={activeNodeId === step.id}
                onClick={() => onStepClick(step)}
              />
              {idx < pipeline.length - 1 && <ChipArrow done={step.status === 'done'} />}
            </React.Fragment>
          ))}
        </div>

        {/* ── Story branches ── */}
        {stories.length > 0 && (
          <div className="mt-2 border-t border-[#21262d] pt-2">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                Story · {stories.length} 并行
              </span>
              <div className="h-px flex-1 bg-[#21262d]" />
            </div>
            <div className="flex flex-col gap-1.5">
              {stories.slice(0, 4).map((story) => (
                <div key={story.id} className="flex items-center gap-2">
                  <div className="flex w-[72px] shrink-0 items-center gap-1 overflow-hidden">
                    <StoryStatusDot status={story.status} />
                    <span className="truncate font-mono text-[9px] font-semibold text-[#58a6ff]">{story.code}</span>
                  </div>
                  <div className="flex min-w-max items-center">
                    {story.pipeline.map((step, idx) => (
                      <React.Fragment key={step.id}>
                        <StepChip
                          step={step}
                          isActive={activeNodeId === step.id}
                          compact
                          onClick={() => onStepClick(step)}
                        />
                        {idx < story.pipeline.length - 1 && <ChipArrow done={step.status === 'done'} />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
              {stories.length > 4 && (
                <span className="ml-[72px] text-[9px] text-[var(--text-3)]">
                  +{stories.length - 4} 更多 story...
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
