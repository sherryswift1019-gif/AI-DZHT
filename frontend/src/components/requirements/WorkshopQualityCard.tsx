import React, { useState } from 'react'
import { CheckCircle2, Eye, Loader2, AlertTriangle, ChevronRight } from 'lucide-react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import type { WorkshopQualityPayload, QualityFinding } from '@/types/project'

// ── 维度进度条 ──

function DimensionBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 90 ? 'bg-green-500' : score >= 70 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[var(--text-2)]">{label}</span>
        <span className="font-mono text-[var(--text-3)]">{score}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[var(--border)]">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
    </div>
  )
}

// ── 单个发现项 ──

function FindingItem({
  finding,
  isActive,
  onResolve,
}: {
  finding: QualityFinding
  isActive: boolean
  onResolve?: (findingId: number, action: string, detail?: string) => void
}) {
  const [showResolve, setShowResolve] = useState(false)
  const [action, setAction] = useState('')
  const [detail, setDetail] = useState('')

  const isBlocking = finding.severity === 'blocking'

  return (
    <div className={`rounded-lg border px-3 py-2 ${
      isBlocking ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5'
    }`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-[12px]">{isBlocking ? '🔴' : '🟡'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-[var(--text-1)]">{finding.title}</p>
          <MarkdownRenderer content={finding.description} className="text-[11px] text-[var(--text-3)]" />
          {finding.suggestion && (
            <div className="mt-1 text-[11px] text-[var(--text-2)]">
              → <MarkdownRenderer content={finding.suggestion} className="inline text-[11px] text-[var(--text-2)]" />
            </div>
          )}
          {finding.affectedSections.length > 0 && (
            <div className="mt-1 flex gap-1">
              {finding.affectedSections.map((s) => (
                <span key={s} className="rounded bg-[var(--bg-panel-2)] px-1.5 py-0.5 text-[9px] text-[var(--text-3)]">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {isActive && showResolve && (
        <div className="mt-2 ml-6 space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {isBlocking ? (
              <>
                <button
                  onClick={() => setAction('fix')}
                  className={`rounded-md border px-2 py-1 text-[10px] transition-colors ${
                    action === 'fix' ? 'border-teal-500/50 bg-teal-500/10 text-teal-300' : 'border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text-2)]'
                  }`}
                >
                  提供补充信息
                </button>
                <button
                  onClick={() => setAction('accept')}
                  className={`rounded-md border px-2 py-1 text-[10px] transition-colors ${
                    action === 'accept' ? 'border-teal-500/50 bg-teal-500/10 text-teal-300' : 'border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text-2)]'
                  }`}
                >
                  接受现状
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setAction('fix'); }}
                  className={`rounded-md border px-2 py-1 text-[10px] transition-colors ${
                    action === 'fix' ? 'border-teal-500/50 bg-teal-500/10 text-teal-300' : 'border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text-2)]'
                  }`}
                >
                  修正
                </button>
                <button
                  onClick={() => { onResolve?.(finding.ruleId, 'skip'); setShowResolve(false) }}
                  className="rounded-md border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
                >
                  忽略
                </button>
              </>
            )}
          </div>
          {action === 'fix' && (
            <div className="space-y-1.5">
              <textarea
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1.5 text-[11px] text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-teal-500/50 focus:outline-none resize-none"
                rows={2}
                placeholder="请补充信息或说明修正内容..."
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
              />
              <button
                onClick={() => { onResolve?.(finding.ruleId, 'fix', detail); setShowResolve(false); setAction(''); setDetail('') }}
                disabled={!detail.trim()}
                className="rounded-lg bg-teal-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-teal-500 disabled:opacity-50 transition-colors"
              >
                提交
              </button>
            </div>
          )}
        </div>
      )}

      {isActive && !showResolve && (
        <button
          onClick={() => setShowResolve(true)}
          className="mt-1.5 ml-6 text-[10px] text-teal-400 hover:text-teal-300 transition-colors"
        >
          处理此项 →
        </button>
      )}
    </div>
  )
}

// ── 主组件 ──

interface WorkshopQualityCardProps {
  quality: WorkshopQualityPayload
  agentName: string
  isActive: boolean
  isSubmitting?: boolean
  onViewPrd?: () => void
  onApprove: () => void
  onResolveFinding?: (findingId: number, action: string, detail?: string) => void
}

export function WorkshopQualityCard({
  quality,
  agentName,
  isActive,
  isSubmitting,
  onViewPrd,
  onApprove,
  onResolveFinding,
}: WorkshopQualityCardProps) {
  const blockingFindings = quality.findings.filter((f) => f.severity === 'blocking')
  const warningFindings = quality.findings.filter((f) => f.severity === 'warning')

  const scoreColor =
    quality.totalScore >= 90 ? 'text-green-400' : quality.totalScore >= 70 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="flex gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-800 to-teal-600 text-[13px]">
        📝
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-[10px] font-semibold text-teal-400">
          {agentName} · PRD 已完成
        </p>

        <div className="rounded-xl rounded-tl-sm border border-teal-500/20 bg-teal-500/5 px-4 py-3 space-y-3">
          {/* 评分卡 */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--text-2)]">质量评分卡</span>
              <span className={`text-[18px] font-bold ${scoreColor}`}>
                {quality.totalScore}<span className="text-[12px] text-[var(--text-3)]">/100</span>
              </span>
            </div>

            {Object.entries(quality.dimensions).map(([label, dim]) => (
              <DimensionBar key={label} label={label} score={dim.score} />
            ))}
          </div>

          {/* 待处理项 */}
          {quality.findings.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-[var(--text-2)]">
                {blockingFindings.length > 0 ? (
                  <><AlertTriangle size={11} className="mr-1 inline text-red-400" />{quality.findings.length} 个待处理项</>
                ) : (
                  <>{quality.findings.length} 个建议项</>
                )}
              </p>
              <div className="space-y-2">
                {blockingFindings.map((f) => (
                  <FindingItem key={f.ruleId} finding={f} isActive={isActive} onResolve={onResolveFinding} />
                ))}
                {warningFindings.map((f) => (
                  <FindingItem key={f.ruleId} finding={f} isActive={isActive} onResolve={onResolveFinding} />
                ))}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          {isActive && (
            <div className="flex items-center gap-2 pt-1">
              {onViewPrd && (
                <button
                  onClick={onViewPrd}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--text-3)] transition-colors"
                >
                  <Eye size={12} />
                  查看完整 PRD
                </button>
              )}
              <button
                onClick={onApprove}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-teal-500 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={12} />
                )}
                {quality.hasBlockingIssues ? '仍然通过' : '通过'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
