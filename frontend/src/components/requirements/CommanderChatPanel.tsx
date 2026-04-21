import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, CheckCircle2, AlertTriangle, Play, Sparkles, Send, Terminal, GitBranch, Info, StopCircle, RotateCcw, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CommanderEvent, Requirement, PipelineStep } from '@/types/project'
import type { AgentRole } from '@/types/agent'
import { AgentAvatar } from '@/components/ui/AgentAvatar'
import { SPINNER_FRAMES } from '@/components/ui/LogStream'
import { StepTerminalModal } from './StepTerminalModal'
import { useCommanderEvents, useCommanderStart, useSubmitUserInput, useAbortPipeline, useRestartPipeline, useResumePipeline, useContinueStep } from '@/hooks/useCommanderEvents'

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

// ── 事件分组（将连续的 agent_working 合并为终端块） ────────────────────────

type RenderItem =
  | { type: 'single'; event: CommanderEvent }
  | { type: 'terminal-group'; stepId: string; agentName: string; events: CommanderEvent[] }

function groupEvents(events: CommanderEvent[]): RenderItem[] {
  const items: RenderItem[] = []
  let i = 0
  while (i < events.length) {
    const evt = events[i]
    if (evt.eventType === 'agent_working' && evt.metadata?.step_id) {
      const stepId = evt.metadata.step_id as string
      const agentName = evt.agentName
      const group: CommanderEvent[] = [evt]
      while (
        i + 1 < events.length &&
        events[i + 1].eventType === 'agent_working' &&
        (events[i + 1].metadata?.step_id as string) === stepId
      ) {
        i++
        group.push(events[i])
      }
      // Only group if there are 2+ agent_working events
      if (group.length >= 2) {
        items.push({ type: 'terminal-group', stepId, agentName, events: group })
      } else {
        items.push({ type: 'single', event: group[0] })
      }
    } else {
      items.push({ type: 'single', event: evt })
    }
    i++
  }
  return items
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
  const [terminalModal, setTerminalModal] = useState<{
    open: boolean; agentName: string; stepName: string; events: CommanderEvent[]
  }>({ open: false, agentName: '', stepName: '', events: [] })

  // 过滤 + 分组
  const filteredEvents = useMemo(
    () => events.filter((evt) => evt.eventType !== 'interview_question' && evt.eventType !== 'interview_answer'),
    [events],
  )
  const renderItems = useMemo(() => groupEvents(filteredEvents), [filteredEvents])

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

  // ── 中止 / 重启 / 恢复 / 继续 ──
  const abortPipeline = useAbortPipeline()
  const restartPipeline = useRestartPipeline()
  const resumePipeline = useResumePipeline()
  const continueStep = useContinueStep()
  const [feedbackText, setFeedbackText] = useState('')
  const [showAbortConfirm, setShowAbortConfirm] = useState(false)

  // 检测最新事件是否为 step_paused
  const lastEvent = events.length > 0 ? events[events.length - 1] : null
  const isPaused = lastEvent?.eventType === 'step_paused'
  const pausedStepId = isPaused ? (lastEvent?.metadata?.step_id as string) : null

  const handleAbort = () => {
    abortPipeline.mutate({ projectId, reqId: requirement.id })
    setShowAbortConfirm(false)
  }
  const handleRestart = () => {
    restartPipeline.mutate({ projectId, reqId: requirement.id })
  }
  const handleResume = () => {
    resumePipeline.mutate({ projectId, reqId: requirement.id })
  }
  const handleContinue = () => {
    if (!pausedStepId) return
    continueStep.mutate({ projectId, reqId: requirement.id, stepId: pausedStepId, feedback: feedbackText.trim() })
    setFeedbackText('')
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
        className="min-h-0 flex-1 overflow-y-auto p-3"
      >
        <div className="mx-auto max-w-[720px] space-y-3">
        {isQueued && events.length === 0 && (
          <GreetingMessage requirement={requirement} />
        )}

        {/* DB 事件渲染（过滤 interview_* + 分组 agent_working 为终端块） */}
        {renderItems.map((item, idx) => {
          if (item.type === 'terminal-group') {
            const stepMeta = requirement.pipeline.find((s) => s.id === item.stepId)
            return (
              <TerminalBlock
                key={`tg-${item.stepId}-${item.events[0].id}`}
                agentName={item.agentName}
                stepName={stepMeta?.name || item.stepId}
                events={item.events}
                isLast={idx === renderItems.length - 1}
                isRunning={requirement.status === 'running'}
                onOpenFullLog={() => setTerminalModal({
                  open: true,
                  agentName: item.agentName,
                  stepName: stepMeta?.name || item.stepId,
                  events: item.events,
                })}
              />
            )
          }
          const lastSingleIdx = renderItems.length - 1
          return (
            <EventMessage
              key={item.event.id}
              event={item.event}
              isLast={idx === lastSingleIdx}
              pendingStep={pendingStep}
              pendingInputStep={pendingInputStep}
              requirement={requirement}
              onApproveStep={onApproveStep}
              onDismissAdvisory={onDismissAdvisory}
              onViewArtifact={onViewArtifact}
              isApproving={isApproving}
              isSubmitting={submitInput.isPending}
            />
          )
        })}

        {/* 执行中时显示 thinking 指示器 */}
        {requirement.status === 'running' && !pendingStep && !pendingInputStep && (
          <div className="flex items-center gap-2 px-2 py-1">
            <Loader2 size={12} className="animate-spin text-purple-400" />
            <span className="text-[10px] text-[var(--text-3)]">
              指挥官工作中...
            </span>
          </div>
        )}
        </div>
      </div>

      {/* Bottom area */}
      <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
        <div className="mx-auto max-w-[720px]">
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
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2 text-[11px] text-[var(--success)]">
              <CheckCircle2 size={14} />
              流水线已完成
            </div>
            <button
              onClick={handleRestart}
              disabled={restartPipeline.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-2)] hover:border-orange-500 hover:text-orange-400 transition-colors disabled:opacity-50"
            >
              {restartPipeline.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              重新开始
            </button>
          </div>
        ) : requirement.status === 'blocked' ? (
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2 text-[11px] text-[var(--danger)]">
              <AlertTriangle size={14} />
              流水线已阻塞
            </div>
            <button
              onClick={handleRestart}
              disabled={restartPipeline.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-orange-500/50 bg-orange-500/10 px-3 py-1.5 text-[11px] font-semibold text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
            >
              {restartPipeline.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              重新开始
            </button>
            <button
              onClick={handleResume}
              disabled={resumePipeline.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-[#3fb950]/50 bg-[#3fb950]/10 px-3 py-1.5 text-[11px] font-semibold text-[#3fb950] hover:bg-[#3fb950]/20 transition-colors disabled:opacity-50"
            >
              {resumePipeline.isPending ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
              继续执行
            </button>
          </div>
        ) : isPaused ? (
          <div className="space-y-2">
            {/* 醒目的暂停提示横幅 */}
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2">
              <span className="text-[14px]">⏸</span>
              <div className="flex-1">
                <p className="text-[11px] font-bold text-amber-300">等待您确认继续</p>
                <p className="text-[10px] text-[var(--text-3)]">
                  当前命令已完成 · 可在下方输入反馈（如「直接执行 CB」）或直接点击继续
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-[12px] text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-amber-500/50 focus:outline-none"
                placeholder="可选：输入反馈或跳转指令，如「直接执行 CB」..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleContinue()}
              />
              <button
                onClick={handleContinue}
                disabled={continueStep.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-[12px] font-bold text-white hover:bg-amber-400 disabled:opacity-50 transition-colors"
              >
                {continueStep.isPending ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                继续
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowAbortConfirm(true)}
                className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300"
              >
                <StopCircle size={10} />
                中止
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-3)]">
              <Loader2 size={12} className="animate-spin" />
              执行中 · {requirement.pipeline.filter((s) => s.status === 'done').length}/{requirement.pipeline.length} 步完成
            </div>
            <button
              onClick={() => setShowAbortConfirm(true)}
              disabled={abortPipeline.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/50 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {abortPipeline.isPending ? <Loader2 size={10} className="animate-spin" /> : <StopCircle size={10} />}
              中止
            </button>
          </div>
        )}
        </div>
      </div>

      {/* 中止确认对话框 */}
      {showAbortConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-5 shadow-xl">
            <p className="text-[13px] font-semibold text-[var(--text-1)]">确认中止流水线？</p>
            <p className="mt-1.5 text-[11px] text-[var(--text-3)]">正在运行的步骤将被终止，可稍后重新开始或从断点继续。</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowAbortConfirm(false)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--text-2)] hover:bg-[var(--bg-panel-2)]"
              >
                取消
              </button>
              <button
                onClick={handleAbort}
                disabled={abortPipeline.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {abortPipeline.isPending ? <Loader2 size={12} className="animate-spin" /> : <StopCircle size={12} />}
                确认中止
              </button>
            </div>
          </div>
        </div>
      )}
      <StepTerminalModal
        open={terminalModal.open}
        onClose={() => setTerminalModal((prev) => ({ ...prev, open: false }))}
        agentName={terminalModal.agentName}
        stepName={terminalModal.stepName}
        events={terminalModal.events}
      />
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
  pendingInputStep,
  requirement,
  onApproveStep,
  onDismissAdvisory,
  onViewArtifact,
  isApproving,
  isSubmitting,
}: {
  event: CommanderEvent
  isLast: boolean
  pendingStep: PipelineStep | undefined
  pendingInputStep: PipelineStep | undefined
  requirement: Requirement
  onApproveStep: (reqId: string, stepId: string) => void
  onDismissAdvisory: (step: PipelineStep) => void
  onViewArtifact?: (stepId: string, artifact: { name: string; type: string; summary: string }) => void
  isApproving?: boolean
  isSubmitting?: boolean
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
    const branch = metadata?.branch as string | undefined

    // 分支创建/推送事件 — 突出展示
    if (branch) {
      return (
        <div className="flex items-center justify-center gap-2 py-2">
          <div className="flex items-center gap-1.5 rounded-full border border-[rgba(88,166,255,0.3)] bg-[rgba(88,166,255,0.08)] px-3 py-1">
            <GitBranch size={12} className="text-[#58a6ff]" />
            <span className="font-mono text-[11px] font-semibold text-[#58a6ff]">{branch}</span>
          </div>
          <span className="text-[10px] text-[var(--text-3)]">{content.includes('推送') ? '已推送' : '已创建'}</span>
        </div>
      )
    }

    // Git 错误事件 — 红色可操作卡片
    if (eventType === 'git_error') {
      const errorAction = metadata?.action as string | undefined
      return (
        <div className="flex items-center justify-center py-2">
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-2">
            <AlertTriangle size={14} className="shrink-0 text-red-400" />
            <span className="text-[11px] text-red-300">{content}</span>
            {errorAction === 'check_settings' && (
              <button
                className="ml-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-300 hover:bg-red-500/20 transition-colors"
                onClick={() => {/* TODO: open project settings */}}
              >
                打开设置
              </button>
            )}
          </div>
        </div>
      )
    }

    // Git PR 创建/关联事件 — 绿色/蓝色胶囊
    if (eventType === 'git_pr_created' || eventType === 'git_pr_linked') {
      const prUrl = metadata?.pr_url as string | undefined
      const prNumber = metadata?.pr_number as number | undefined
      const isNew = eventType === 'git_pr_created'
      return (
        <div className="flex items-center justify-center gap-2 py-2">
          <div className={cn(
            'flex items-center gap-1.5 rounded-full border px-3 py-1',
            isNew
              ? 'border-green-500/30 bg-green-500/8'
              : 'border-[rgba(88,166,255,0.3)] bg-[rgba(88,166,255,0.08)]',
          )}>
            <GitBranch size={12} className={isNew ? 'text-green-400' : 'text-[#58a6ff]'} />
            <span className={cn('text-[11px] font-semibold', isNew ? 'text-green-400' : 'text-[#58a6ff]')}>
              PR #{prNumber}
            </span>
          </div>
          <span className="text-[10px] text-[var(--text-3)]">
            {isNew ? '已创建' : '已关联'}
          </span>
          {prUrl && (
            <a href={prUrl} target="_blank" rel="noreferrer"
              className="text-[10px] text-[var(--accent)] hover:underline">
              查看 →
            </a>
          )}
        </div>
      )
    }

    // Git 审查事件
    if (eventType === 'git_review_started') {
      return (
        <div className="flex items-center justify-center gap-2 py-2">
          <Loader2 size={12} className="animate-spin text-[#58a6ff]" />
          <span className="text-[11px] text-[var(--text-3)]">{content}</span>
        </div>
      )
    }
    if (eventType === 'git_review_done') {
      const verdict = metadata?.verdict as string | undefined
      const findingsCount = metadata?.findings_count as number | undefined
      const verdictColor = verdict === 'pass' ? 'text-green-400' : verdict === 'needs_attention' ? 'text-amber-400' : 'text-red-400'
      const verdictIcon = verdict === 'pass' ? '✅' : verdict === 'needs_attention' ? '⚠️' : '🚫'
      return (
        <div className="flex items-center justify-center gap-2 py-2">
          <div className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-1.5',
            verdict === 'pass' ? 'border-green-500/30 bg-green-500/8' :
            verdict === 'needs_attention' ? 'border-amber-500/30 bg-amber-500/8' :
            'border-red-500/30 bg-red-500/8',
          )}>
            <span className="text-[13px]">{verdictIcon}</span>
            <span className={cn('text-[11px] font-medium', verdictColor)}>{content}</span>
            {(findingsCount ?? 0) > 0 && (
              <span className="text-[10px] text-[var(--text-3)]">({findingsCount} 项发现)</span>
            )}
          </div>
        </div>
      )
    }

    // pipeline_complete — 总结卡片（含 Git 摘要）
    if (isComplete) {
      const gitMeta = metadata?.git as { branch?: string; commitCount?: number; additions?: number; deletions?: number; prUrl?: string; prNumber?: number } | null
      return (
        <div className="flex items-center justify-center py-2">
          <div className="rounded-xl border border-green-500/20 bg-green-500/6 px-4 py-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle2 size={14} className="text-green-400" />
              <span className="text-[12px] font-semibold text-green-400">流水线执行完成</span>
            </div>
            <div className="flex items-center justify-center gap-3 text-[11px] text-[var(--text-3)]">
              {metadata?.steps_done && <span>{metadata.steps_done as number} 步完成</span>}
              {(metadata?.artifacts_count as number) > 0 && <span>{metadata.artifacts_count as number} 个产出物</span>}
            </div>
            {gitMeta?.branch && (
              <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-[#58a6ff]">
                <GitBranch size={11} />
                <span className="font-mono">{gitMeta.branch}</span>
                {gitMeta.commitCount && gitMeta.commitCount > 0 && (
                  <span className="text-[var(--text-3)]">{gitMeta.commitCount} commits · <span className="text-green-400">+{gitMeta.additions ?? 0}</span> <span className="text-red-400">-{gitMeta.deletions ?? 0}</span></span>
                )}
                {gitMeta.prUrl && (
                  <a href={gitMeta.prUrl} target="_blank" rel="noreferrer"
                    className="text-[var(--accent)] hover:underline">
                    PR #{gitMeta.prNumber}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-center justify-center gap-1.5 py-2">
        <Info size={12} className="text-[var(--text-3)]" />
        <span className="text-[11px] font-medium text-[var(--text-3)]">
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
                  {approvalType === 'artifact_review' ? '确认并继续' : '批准并继续'}
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
    const isPausedCard = eventType === 'step_paused'
    const artifacts = (metadata?.artifacts ?? []) as Array<{ name: string; type: string; summary: string }>
    const agentStepId = metadata?.step_id as string | undefined

    // ── 命令级暂停卡片（醒目展示）──
    if (isPausedCard) {
      const nextCmdName = metadata?.next_cmd_name as string | undefined
      return (
        <div className="flex gap-2.5">
          {agentRole ? (
            <AgentAvatar role={agentRole} size="sm" className="!size-7 !rounded-lg !text-[13px]" />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gray-800 to-gray-600 text-[13px]">🤖</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-[10px] font-semibold text-[var(--text-2)]">{agentName}</p>
            <div className="rounded-xl rounded-tl-sm border-2 border-amber-500/30 bg-amber-500/6 px-3 py-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-[16px]">⏸</span>
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-amber-300">等待您确认继续</p>
                  <p className="mt-0.5 text-[12px] text-[var(--text-1)]">{content}</p>
                  {nextCmdName && (
                    <p className="mt-1.5 text-[11px] text-[var(--text-3)]">
                      ▸ 下一步：<span className="font-semibold text-[var(--text-2)]">{nextCmdName}</span>
                      　·　可在下方输入「直接执行 XX」跳过中间步骤
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

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
            {/* Git commit 标记 */}
            {isDone && (metadata?.commit as string) && (
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--text-3)]">
                <GitBranch size={10} />
                <span className="font-mono">{(metadata.commit as string).slice(0, 7)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}

// ── TerminalBlock（内嵌终端块，显示最后 4 行 + spinner）──────────────────────

function TerminalBlock({
  agentName,
  stepName,
  events,
  isLast,
  isRunning,
  onOpenFullLog,
}: {
  agentName: string
  stepName: string
  events: CommanderEvent[]
  isLast: boolean
  isRunning: boolean
  onOpenFullLog: () => void
}) {
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const isActive = isLast && isRunning

  useEffect(() => {
    if (!isActive) return
    const id = setInterval(() => setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length), 80)
    return () => clearInterval(id)
  }, [isActive])

  const agentRole = AGENT_ROLE_MAP[agentName]
  const visibleLines = events.slice(-4)

  return (
    <div className="flex gap-2.5">
      {agentRole ? (
        <AgentAvatar role={agentRole} size="sm" className="!size-7 !rounded-lg !text-[13px]" />
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gray-800 to-gray-600 text-[13px]">
          <Terminal size={13} className="text-gray-300" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-[10px] font-semibold text-[var(--text-2)]">
          {agentName} <span className="font-normal text-[var(--text-3)]">- {stepName}</span>
        </p>
        <div className="rounded-xl rounded-tl-sm border border-[#30363d] bg-[#0d1117] px-3 py-2">
          {visibleLines.map((evt) => {
            const { tag, message } = parseProgressTag(evt.content)
            const icon = tag ? getProgressIcon(tag) : ''
            return (
              <div key={evt.id} className="flex items-start gap-1.5 py-[2px] font-mono text-[10px]">
                <span className="shrink-0 text-[#6e7681]">{icon || '>'}</span>
                {tag && <span className="shrink-0 text-[#58a6ff] font-bold">{tag}</span>}
                {tag && <span className="text-[#3d444d]">-</span>}
                <span className="text-[#8b949e] break-words min-w-0">{message}</span>
              </div>
            )
          })}
          {isActive && (
            <div className="flex items-center gap-1.5 py-[2px] font-mono text-[10px] text-[#58a6ff]">
              <span>{SPINNER_FRAMES[spinnerFrame]}</span>
              <span>working...</span>
            </div>
          )}
          {events.length > 4 && (
            <div className="mt-1 text-center">
              <span className="text-[9px] text-[#6e7681]">... {events.length - 4} 条更早日志</span>
            </div>
          )}
          <button
            onClick={onOpenFullLog}
            className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md border border-[#21262d] bg-[#161b22] py-1 text-[10px] text-[#58a6ff] hover:bg-[#1c2128] transition-colors"
          >
            <Terminal size={10} />
            查看完整日志（{events.length} 条）
          </button>
        </div>
      </div>
    </div>
  )
}
