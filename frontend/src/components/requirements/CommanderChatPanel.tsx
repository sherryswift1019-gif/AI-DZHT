import React, { useEffect, useRef, useState } from 'react'
import { Loader2, CheckCircle2, AlertTriangle, Play, Sparkles, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CommanderEvent, Requirement, PipelineStep } from '@/types/project'
import type { AgentRole } from '@/types/agent'
import { AgentAvatar } from '@/components/ui/AgentAvatar'
import { useCommanderEvents, useCommanderStart, useSubmitUserInput } from '@/hooks/useCommanderEvents'

// ── Agent name → role 映射 ──────────────────────────────────────────────────

const AGENT_ROLE_MAP: Record<string, AgentRole> = {
  Mary: 'analyst',
  John: 'pm',
  Sally: 'ux',
  Winston: 'architect',
  Bob: 'sm',
  Amelia: 'dev',
  Quinn: 'qa',
  Barry: 'quickdev',
  Paige: 'techwriter',
  Lena: 'reqLead',
}

// ── 进度日志解析 ────────────────────────────────────────────────────────────

function parseProgressTag(content: string): { tag: string; message: string } {
  const match = content.match(/^\[([^\]]+)\]\s*(.*)/)
  if (match) return { tag: match[1], message: match[2] }
  return { tag: '', message: content }
}

const PROGRESS_ICONS: Record<string, string> = {
  'exec': '\u26A1', 'done': '\u2705',
  'review:adversarial': '\uD83D\uDD0D', 'review:edge-case': '\uD83C\uDFAF', 'review:structural': '\uD83D\uDCD0',
  'findings': '\uD83D\uDCCB', 'revise': '\u270F\uFE0F', 'pass': '\u2705',
  'knowledge': '\uD83E\uDDE0', 'knowledge:done': '\uD83D\uDCD6',
  'output': '\u2713', 'draft': '\uD83D\uDCDD',
  'interview': '\uD83D\uDCAC', 'interview:done': '\u2705',
}

function getProgressIcon(tag: string): string {
  if (PROGRESS_ICONS[tag]) return PROGRESS_ICONS[tag]
  if (tag.startsWith('exec:')) return '\u26A1'
  if (tag.startsWith('done:')) return '\u2705'
  if (tag.startsWith('review:')) return '\uD83D\uDD0D'
  return '\u25B8'
}

// ── Props ───────────────────────────────────────────────────────────────────

interface CommanderChatPanelProps {
  projectId: string
  requirement: Requirement
  onApproveStep: (reqId: string, stepId: string) => void
  onDismissAdvisory: (step: PipelineStep) => void
  onViewArtifact?: (stepId: string, artifact: { name: string; type: string; summary: string }) => void
  isApproving?: boolean
}

// ── Component ───────────────────────────────────────────────────────────────

export function CommanderChatPanel({
  projectId,
  requirement,
  onApproveStep,
  onDismissAdvisory,
  onViewArtifact,
  isApproving,
}: CommanderChatPanelProps) {
  const { events } = useCommanderEvents(projectId, requirement)
  const commanderStart = useCommanderStart()
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAutoScroll = useRef(true)

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (el && isAutoScroll.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [events.length])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    isAutoScroll.current = atBottom
  }

  const handleStart = () => {
    commanderStart.mutate({ projectId, reqId: requirement.id })
  }

  // 当前是否有步骤在 pending
  const pendingStep = requirement.pipeline.find(
    (s) => s.status === 'pending_approval' || s.status === 'pending_advisory_approval',
  )

  // 当前是否有步骤在等待用户输入
  const pendingInputStep = requirement.pipeline.find(
    (s) => s.status === 'pending_input',
  )

  const submitInput = useSubmitUserInput()
  const [inputText, setInputText] = useState('')

  const handleSubmitInput = () => {
    if (!pendingInputStep || !inputText.trim()) return
    submitInput.mutate({
      projectId,
      reqId: requirement.id,
      stepId: pendingInputStep.id,
      text: inputText.trim(),
    })
    setInputText('')
  }

  const handleSkipInput = () => {
    if (!pendingInputStep) return
    submitInput.mutate({
      projectId,
      reqId: requirement.id,
      stepId: pendingInputStep.id,
      text: '',
      skip: true,
    })
  }

  const isQueued = requirement.status === 'queued' && requirement.pipeline.length > 0

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--border)] px-4 py-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-900 to-purple-600">
          <Sparkles size={14} className="text-purple-200" />
        </div>
        <span className="text-[12px] font-bold text-[var(--text-1)]">指挥官</span>
        <StatusIndicator status={requirement.status} />
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-3 p-3"
      >
        {/* 合成的问候消息（queued 且无 DB 事件时） */}
        {isQueued && events.length === 0 && (
          <GreetingMessage requirement={requirement} />
        )}

        {/* DB 事件渲染 */}
        {events.map((evt, idx) => (
          <EventMessage
            key={evt.id}
            event={evt}
            isLast={idx === events.length - 1}
            pendingStep={pendingStep}
            requirement={requirement}
            onApproveStep={onApproveStep}
            onDismissAdvisory={onDismissAdvisory}
            onViewArtifact={onViewArtifact}
            isApproving={isApproving}
          />
        ))}

        {/* 执行中时显示 thinking 指示器 */}
        {requirement.status === 'running' && !pendingStep && !pendingInputStep && (
          <div className="flex items-center gap-2 px-2 py-1">
            <Loader2 size={12} className="animate-spin text-purple-400" />
            <span className="text-[10px] text-[var(--text-3)]">指挥官工作中...</span>
          </div>
        )}
      </div>

      {/* Bottom area */}
      <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
        {isQueued ? (
          <button
            onClick={handleStart}
            disabled={commanderStart.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {commanderStart.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
            开始工作
          </button>
        ) : pendingInputStep ? (
          <div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-[12px] text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus:outline-none"
                placeholder="回复 Agent..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmitInput()}
                disabled={submitInput.isPending}
              />
              <button
                disabled={!inputText.trim() || submitInput.isPending}
                onClick={handleSubmitInput}
                className="flex items-center justify-center rounded-lg bg-[var(--accent)] px-3 py-2 text-white hover:opacity-90 disabled:opacity-40"
              >
                {submitInput.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
            <button
              className="mt-1.5 text-[10px] text-[var(--text-3)] hover:text-[var(--text-2)] hover:underline"
              onClick={handleSkipInput}
              disabled={submitInput.isPending}
            >
              跳过，直接开始执行
            </button>
          </div>
        ) : requirement.status === 'done' ? (
          <div className="flex items-center justify-center gap-2 text-[11px] text-[var(--success)]">
            <CheckCircle2 size={14} />
            流水线已完成
          </div>
        ) : requirement.status === 'blocked' ? (
          <div className="flex items-center justify-center gap-2 text-[11px] text-[var(--danger)]">
            <AlertTriangle size={14} />
            流水线已阻塞
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-[10px] text-[var(--text-3)]">
            <Loader2 size={12} className="animate-spin" />
            执行中 · {requirement.pipeline.filter((s) => s.status === 'done').length}/{requirement.pipeline.length} 步完成
          </div>
        )}
      </div>
    </div>
  )
}

// ── 子组件 ──────────────────────────────────────────────────────────────────

function StatusIndicator({ status }: { status: string }) {
  if (status === 'running')
    return <span className="ml-auto flex items-center gap-1 text-[10px] text-[#58a6ff]"><span className="h-1.5 w-1.5 rounded-full bg-[#58a6ff] animate-pulse" />执行中</span>
  if (status === 'done')
    return <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--success)]"><CheckCircle2 size={10} />已完成</span>
  if (status === 'blocked')
    return <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--danger)]"><AlertTriangle size={10} />阻塞</span>
  return <span className="ml-auto text-[10px] text-[var(--text-3)]">待启动</span>
}

function GreetingMessage({ requirement }: { requirement: Requirement }) {
  const stepNames = requirement.pipeline.map((s) => s.name).join('、')
  return (
    <div className="flex gap-2.5">
      <CommanderAvatar />
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-[10px] font-semibold text-purple-400">指挥官</p>
        <div className="rounded-xl rounded-tl-sm bg-[rgba(147,51,234,0.08)] border border-[rgba(147,51,234,0.15)] px-3 py-2.5">
          <p className="text-[12px] leading-relaxed text-[var(--text-1)]">
            需求「{requirement.title}」已就绪，流水线配置了 {requirement.pipeline.length} 个步骤（{stepNames}）。
          </p>
          <p className="mt-1.5 text-[12px] text-[var(--text-2)]">
            是否立即开始工作？
          </p>
        </div>
      </div>
    </div>
  )
}

function CommanderAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-900 to-purple-600 text-[13px]">
      <Sparkles size={13} className="text-purple-200" />
    </div>
  )
}

function EventMessage({
  event,
  isLast,
  pendingStep,
  requirement,
  onApproveStep,
  onDismissAdvisory,
  onViewArtifact,
  isApproving,
}: {
  event: CommanderEvent
  isLast: boolean
  pendingStep: PipelineStep | undefined
  requirement: Requirement
  onApproveStep: (reqId: string, stepId: string) => void
  onDismissAdvisory: (step: PipelineStep) => void
  onViewArtifact?: (stepId: string, artifact: { name: string; type: string; summary: string }) => void
  isApproving?: boolean
}) {
  const { eventType, role, agentName, content, metadata } = event

  // ── User messages (右对齐) ──
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="rounded-xl rounded-tr-sm bg-[rgba(10,132,255,0.12)] border border-[rgba(10,132,255,0.2)] px-3 py-2 max-w-[85%]">
          <p className="text-[12px] text-[var(--text-1)]">{content}</p>
        </div>
      </div>
    )
  }

  // ── System messages (居中) ──
  if (role === 'system') {
    const isComplete = eventType === 'pipeline_complete'
    return (
      <div className="flex items-center justify-center gap-1.5 py-2">
        {isComplete ? (
          <CheckCircle2 size={12} className="text-[var(--success)]" />
        ) : (
          <AlertTriangle size={12} className="text-[var(--danger)]" />
        )}
        <span className={cn(
          'text-[11px] font-medium',
          isComplete ? 'text-[var(--success)]' : 'text-[var(--danger)]',
        )}>
          {content}
        </span>
      </div>
    )
  }

  // ── Commander messages ──
  if (role === 'commander') {
    const isThinking = eventType === 'commander_thinking'
    const isThinkingActive = isThinking && isLast && requirement.status === 'running'
    const isApprovalReq = eventType === 'approval_request'
    const approvalType = metadata?.type as string | undefined
    const stepId = metadata?.step_id as string | undefined
    const approvalArtifacts = (metadata?.artifacts ?? []) as Array<{ name: string; type: string; summary: string }>

    // 判断这个 approval_request 是否仍然 active（步骤仍在 pending）
    const isApprovalActive = isApprovalReq && pendingStep && stepId === pendingStep.id

    return (
      <div className="flex gap-2.5">
        <CommanderAvatar />
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-[10px] font-semibold text-purple-400">指挥官</p>
          <div className={cn(
            'rounded-xl rounded-tl-sm border px-3 py-2.5',
            isApprovalReq
              ? 'bg-[rgba(255,159,10,0.06)] border-[rgba(255,159,10,0.2)]'
              : 'bg-[rgba(147,51,234,0.08)] border-[rgba(147,51,234,0.15)]',
          )}>
            <p className={cn(
              'text-[12px] leading-relaxed whitespace-pre-line',
              isThinkingActive ? 'text-[var(--text-2)] italic' : 'text-[var(--text-1)]',
            )}>
              {isThinkingActive && <Loader2 size={10} className="mr-1 inline animate-spin text-purple-400" />}
              {content}
            </p>

            {/* 审批时展示产出物列表 */}
            {isApprovalReq && approvalArtifacts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {approvalArtifacts.map((art) => (
                  <button
                    key={art.name}
                    onClick={() => onViewArtifact?.(stepId!, art)}
                    className="inline-flex items-center gap-1 rounded-md bg-[rgba(255,159,10,0.08)] border border-[rgba(255,159,10,0.15)] px-2 py-1 text-[10px] text-[var(--text-2)] hover:bg-[rgba(255,159,10,0.15)] hover:text-[var(--text-1)] cursor-pointer transition-colors"
                  >
                    📎 {art.name}
                  </button>
                ))}
              </div>
            )}

            {/* Approval action buttons */}
            {isApprovalActive && (
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={() => onApproveStep(requirement.id, stepId!)}
                  disabled={isApproving}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {isApproving && <Loader2 size={10} className="animate-spin" />}
                  批准并继续
                </button>
                {approvalType === 'advisory' && (
                  <button
                    onClick={() => onDismissAdvisory(pendingStep!)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-2)] hover:text-[var(--text-1)]"
                  >
                    无需审批
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Agent messages ──
  if (role === 'agent') {
    const agentRole = AGENT_ROLE_MAP[agentName]
    const isWorking = eventType === 'agent_working'
    const isWorkingActive = isWorking && isLast && requirement.status === 'running'
    const isDone = eventType === 'agent_done'
    const artifacts = (metadata?.artifacts ?? []) as Array<{ name: string; type: string; summary: string }>
    const agentStepId = metadata?.step_id as string | undefined

    // 解析进度 tag
    const { tag, message: displayMsg } = isWorking ? parseProgressTag(content) : { tag: '', message: content }
    const icon = tag ? getProgressIcon(tag) : ''

    return (
      <div className="flex gap-2.5">
        {agentRole ? (
          <AgentAvatar role={agentRole} size="sm" className="!size-7 !rounded-lg !text-[13px]" />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gray-800 to-gray-600 text-[13px]">
            🤖
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-[10px] font-semibold text-[var(--text-2)]">{agentName}</p>
          <div className="rounded-xl rounded-tl-sm bg-[var(--bg-panel-2)] border border-[var(--border)] px-3 py-2.5">
            <p className="text-[12px] leading-relaxed text-[var(--text-1)]">
              {isWorkingActive && <Loader2 size={10} className="mr-1 inline animate-spin text-[var(--accent)]" />}
              {icon && <span className="mr-1">{icon}</span>}
              {displayMsg}
            </p>
            {/* 产出物展示 */}
            {isDone && artifacts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {artifacts.map((art) => (
                  <button
                    key={art.name}
                    onClick={() => agentStepId && onViewArtifact?.(agentStepId, art)}
                    className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-panel-3)] px-2 py-0.5 text-[10px] text-[var(--text-2)] hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-1)] cursor-pointer transition-colors"
                  >
                    📎 {art.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
