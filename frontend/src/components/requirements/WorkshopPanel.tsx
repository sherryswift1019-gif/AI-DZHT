import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, StopCircle, CheckCircle2, Send, Eye } from 'lucide-react'
import { AgentAvatar } from '@/components/ui/AgentAvatar'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { useCommanderEvents, useSubmitUserInput, useAbortPipeline } from '@/hooks/useCommanderEvents'
import type { Requirement, CommanderEvent } from '@/types/project'

// ── 显示的事件类型 ──
const LENA_EVENT_TYPES = new Set([
  'workshop_message',
  'workshop_generating',
  'workshop_prd_ready',
  'workshop_final_delivery',
  // 兼容旧事件
  'workshop_briefing',
  'workshop_domain_question',
  'workshop_domain_confirm',
  'workshop_quality_report',
])

const USER_EVENT_TYPES = new Set([
  'workshop_user_response',
  // 兼容旧事件
  'workshop_briefing_response',
  'workshop_domain_response',
  'workshop_domain_confirm_ack',
  'workshop_issue_resolve',
])

// ── Props ──
interface WorkshopPanelProps {
  projectId: string
  requirement: Requirement
  onViewArtifact?: (stepId: string, artifact: { name: string; type: string; summary: string }) => void
}

export function WorkshopPanel({ projectId, requirement, onViewArtifact }: WorkshopPanelProps) {
  const { events } = useCommanderEvents(projectId, requirement)
  const submitInput = useSubmitUserInput()
  const abortPipeline = useAbortPipeline()
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAutoScroll = useRef(true)
  const [showAbortConfirm, setShowAbortConfirm] = useState(false)
  const [inputText, setInputText] = useState('')

  // 当前 workshop 步骤
  const workshopStep = requirement.pipeline.find(s =>
    s.status?.startsWith('workshop_'),
  )

  // 过滤事件
  const chatEvents = useMemo(
    () => events.filter(e =>
      LENA_EVENT_TYPES.has(e.eventType) || USER_EVENT_TYPES.has(e.eventType),
    ),
    [events],
  )

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (el && isAutoScroll.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [chatEvents.length])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    isAutoScroll.current = atBottom
  }

  const stepStatus = workshopStep?.status
  const isSubmitting = submitInput.isPending
  const isPrdReview = stepStatus === 'workshop_prd_review' || stepStatus === 'workshop_quality_review'

  // ── 交互处理 ──
  const handleSend = () => {
    if (!workshopStep || !inputText.trim()) return
    submitInput.mutate({
      projectId, reqId: requirement.id, stepId: workshopStep.id,
      text: inputText.trim(),
    })
    setInputText('')
  }

  const handleApprove = () => {
    if (!workshopStep) return
    submitInput.mutate({
      projectId, reqId: requirement.id, stepId: workshopStep.id,
      text: '__approve__',
    })
  }

  const handleAbort = () => {
    abortPipeline.mutate({ projectId, reqId: requirement.id })
    setShowAbortConfirm(false)
  }

  // 最新 PRD 信息
  const latestPrdEvent = useMemo(() => {
    for (let i = chatEvents.length - 1; i >= 0; i--) {
      if (chatEvents[i].eventType === 'workshop_prd_ready' || chatEvents[i].eventType === 'workshop_quality_report') {
        return chatEvents[i]
      }
    }
    return undefined
  }, [chatEvents])

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-2">
        <div className="flex items-center gap-2.5">
          <AgentAvatar role="reqLead" size="sm" />
          <div>
            <span className="text-[12px] font-bold text-[var(--text-1)]">
              {workshopStep?.agentName ?? 'Lena'}
            </span>
            <span className="ml-1.5 text-[10px] text-[var(--text-3)]">需求总监</span>
          </div>
        </div>
        {isPrdReview && (
          <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-teal-400">
            PRD 审阅
          </span>
        )}
      </div>

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
      >
        <div className="mx-auto max-w-[720px] space-y-3">
          {chatEvents.map((event) => {
            // 用户消息 → 右对齐
            if (USER_EVENT_TYPES.has(event.eventType)) {
              const text = event.content
              if (!text || text === '__confirm__' || text === '__approve__' || text === '(用户操作)') return null
              return (
                <div key={event.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-xl rounded-tr-sm bg-[rgba(10,132,255,0.12)] border border-[rgba(10,132,255,0.2)] px-3 py-2">
                    <p className="text-[12px] text-[var(--text-1)] whitespace-pre-line">{text}</p>
                  </div>
                </div>
              )
            }

            // 生成中 → spinner
            if (event.eventType === 'workshop_generating') {
              return (
                <div key={event.id} className="flex items-center gap-2 py-2">
                  <Loader2 size={14} className="animate-spin text-teal-400" />
                  <span className="text-[12px] text-teal-400">{event.content}</span>
                </div>
              )
            }

            // 最终交付
            if (event.eventType === 'workshop_final_delivery') {
              return (
                <div key={event.id} className="flex items-center justify-center py-3">
                  <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <CheckCircle2 size={14} className="text-teal-400" />
                      <span className="text-[12px] font-semibold text-teal-400">PRD 已交付</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-3)]">{event.content}</p>
                  </div>
                </div>
              )
            }

            // PRD 就绪通知
            if (event.eventType === 'workshop_prd_ready') {
              const quality = event.metadata?.quality as Record<string, unknown> | undefined
              const score = quality?.totalScore as number | undefined
              return (
                <div key={event.id} className="space-y-2">
                  <LenaMessage event={event} />
                  {score !== undefined && (
                    <div className="ml-9 flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2">
                      <span className="text-[11px] text-[var(--text-3)]">质量评分</span>
                      <span className={`text-[16px] font-bold ${score >= 90 ? 'text-green-400' : score >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                        {score}<span className="text-[11px] text-[var(--text-3)]">/100</span>
                      </span>
                    </div>
                  )}
                </div>
              )
            }

            // 旧的 quality_report 兼容
            if (event.eventType === 'workshop_quality_report') {
              return (
                <div key={event.id} className="flex items-center gap-2 py-2">
                  <CheckCircle2 size={14} className="text-teal-400" />
                  <span className="text-[12px] text-teal-400">质量审查完成</span>
                </div>
              )
            }

            // Lena 消息 → markdown
            return <LenaMessage key={event.id} event={event} />
          })}

          {/* 等待 AI 响应的 spinner */}
          {workshopStep && chatEvents.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 size={16} className="animate-spin text-teal-400" />
              <span className="text-[12px] text-teal-400">Lena 正在分析需求...</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom input area — 始终显示（generating 时禁用） ── */}
      {workshopStep && stepStatus !== 'workshop_generating' && (
        <div className="shrink-0 border-t border-[var(--border)] px-4 py-2.5">
          <div className="mx-auto max-w-[720px]">
            <div className="flex items-end gap-2">
              <textarea
                className="min-h-[36px] max-h-[120px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-[12px] text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-teal-500/50 focus:outline-none resize-none"
                rows={1}
                placeholder={isPrdReview ? '输入修改意见，或点击"通过"审批...' : '回复 Lena...'}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && inputText.trim()) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                disabled={isSubmitting}
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleSend}
                  disabled={isSubmitting || !inputText.trim()}
                  className="flex h-[36px] items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-[11px] font-semibold text-white hover:bg-teal-500 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  发送
                </button>
                {isPrdReview && (
                  <>
                    {onViewArtifact && workshopStep && latestPrdEvent && (
                      <button
                        onClick={() => {
                          const artName = latestPrdEvent.metadata?.artifactName as string || 'PRD'
                          onViewArtifact(workshopStep.id, { name: artName, type: 'document', summary: 'PRD' })
                        }}
                        className="flex h-[36px] items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 text-[11px] font-semibold text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
                      >
                        <Eye size={12} />
                        查看
                      </button>
                    )}
                    <button
                      onClick={handleApprove}
                      disabled={isSubmitting}
                      className="flex h-[36px] items-center gap-1.5 rounded-lg bg-green-600 px-3 text-[11px] font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
                    >
                      {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      通过
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowAbortConfirm(true)}
                  disabled={abortPipeline.isPending}
                  className="flex h-[36px] items-center gap-1 rounded-lg border border-red-500/30 px-2 text-[10px] text-red-400 hover:bg-red-500/10 transition-colors"
                  title="中止"
                >
                  <StopCircle size={11} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 生成中提示 */}
      {stepStatus === 'workshop_generating' && (
        <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
          <div className="mx-auto max-w-[720px] flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px] text-teal-400">
              <Loader2 size={14} className="animate-spin" />
              Lena 正在生成 PRD...
            </div>
            <button
              onClick={() => setShowAbortConfirm(true)}
              className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300"
            >
              <StopCircle size={10} /> 中止
            </button>
          </div>
        </div>
      )}

      {/* 中止确认 */}
      {showAbortConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-5 shadow-xl">
            <p className="text-[13px] font-semibold text-[var(--text-1)]">确认中止？</p>
            <p className="mt-1.5 text-[11px] text-[var(--text-3)]">当前进度将终止，可稍后重新开始。</p>
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
    </div>
  )
}

// ── Lena 消息气泡 ──

function LenaMessage({ event }: { event: CommanderEvent }) {
  const { content } = event

  // 短进度消息 → 行内 spinner
  if (content.length < 30 && !content.includes('#') && !content.includes('*') && !content.includes('-')) {
    return (
      <div className="flex items-center gap-2 py-1">
        <Loader2 size={12} className="animate-spin text-teal-400" />
        <span className="text-[11px] text-teal-400">{content}</span>
      </div>
    )
  }

  return (
    <div className="flex gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-800 to-teal-600 text-[13px]">
        📝
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5">
          <span className="text-[10px] font-semibold text-teal-400">Lena</span>
        </div>
        <div className="rounded-xl rounded-tl-sm border border-teal-500/20 bg-teal-500/5 px-4 py-3">
          <MarkdownRenderer content={content} className="text-[12px] leading-relaxed text-[var(--text-1)]" />
        </div>
      </div>
    </div>
  )
}
