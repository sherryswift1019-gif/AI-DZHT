import React from 'react'
import { Package, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PipelineStep, Requirement, StepArtifact } from '@/types/project'

// ── Helpers (duplicated from ProjectDetailPage to keep sidebar self-contained) ──

function artifactIcon(type: string) {
  if (type === 'code')     return '💻'
  if (type === 'design')   return '🎨'
  if (type === 'report')   return '📊'
  if (type === 'plan')     return '📋'
  if (type === 'test')     return '🧪'
  return '📄'
}

function stageIcon(name: string) {
  if (name.includes('需求')) return '📄'
  if (name.includes('架构')) return '🏗️'
  if (name.includes('开发')) return '⚙️'
  if (name.includes('测试')) return '🧪'
  return '🤖'
}

const AGENT_ARTIFACTS_MAP: Record<string, Array<{ name: string; type: StepArtifact['type'] }>> = {
  Lena:    [{ name: '头脑风暴报告', type: 'report' }, { name: '市场研究报告', type: 'report' }, { name: '行业深研报告', type: 'report' }, { name: '产品简报', type: 'document' }, { name: '产品需求文档（PRD）', type: 'document' }],
  Mary:    [{ name: '商业简报', type: 'report' }, { name: '竞品分析报告', type: 'report' }, { name: '项目背景文档', type: 'document' }],
  John:    [{ name: '产品需求文档（PRD）', type: 'document' }, { name: '产品愿景说明', type: 'document' }, { name: 'Epic 列表', type: 'plan' }],
  Sally:   [{ name: 'UI/UX 设计文档', type: 'design' }],
  Winston: [{ name: '架构设计文档', type: 'document' }],
  Bob:     [{ name: 'Sprint 计划', type: 'plan' }, { name: 'User Story 列表', type: 'plan' }],
  Amelia:  [{ name: '功能代码实现', type: 'code' }],
  Quinn:   [{ name: '自动化测试报告', type: 'test' }, { name: '代码评审报告', type: 'report' }],
  Barry:   [{ name: '快速开发产物', type: 'code' }],
  Paige:   [{ name: '技术文档', type: 'document' }],
}

// ── Status badge ──────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const cls =
    status === 'done'    ? 'bg-[#3fb950]' :
    status === 'running' ? 'bg-[#58a6ff] animate-pulse' :
    status === 'blocked' ? 'bg-[#f85149]' :
                           'bg-[#484f58]'
  return <span className={cn('inline-block h-[5px] w-[5px] rounded-full', cls)} />
}

// ── Props ─────────────────────────────────────────────────────────────────

interface ArtifactSidebarProps {
  open: boolean
  onToggle: () => void
  requirement: Requirement
  onViewArtifact: (step: PipelineStep, art: { name: string; type: StepArtifact['type']; summary: string }) => void
}

// ── Component ─────────────────────────────────────────────────────────────

export function ArtifactSidebar({ open, onToggle, requirement, onViewArtifact }: ArtifactSidebarProps) {
  const allSteps = [
    ...requirement.pipeline,
    ...requirement.stories.flatMap((s) => s.pipeline),
  ].filter((s) => s.status === 'done')

  const artifactCount = allSteps.reduce((acc, step) => {
    const arts = (step.artifacts && step.artifacts.length > 0)
      ? step.artifacts
      : (AGENT_ARTIFACTS_MAP[step.agentName] ?? [])
    return acc + arts.length
  }, 0)

  return (
    <>
      {/* ── Toggle button (always visible) ── */}
      <button
        onClick={onToggle}
        className={cn(
          'absolute right-3 top-3 z-30 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all',
          open
            ? 'border-[var(--accent)] bg-[var(--accent-sub)] text-[var(--accent)]'
            : 'border-[var(--border)] bg-[var(--bg-panel-2)] text-[var(--text-2)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
        )}
      >
        <Package size={13} />
        <span>产出物</span>
        {artifactCount > 0 && (
          <span className="rounded-full bg-[var(--accent-sub)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--accent)]">
            {artifactCount}
          </span>
        )}
      </button>

      {/* ── Backdrop ── */}
      {open && (
        <div
          className="absolute inset-0 z-30 bg-black/20"
          onClick={onToggle}
        />
      )}

      {/* ── Sidebar panel ── */}
      <div
        className={cn(
          'absolute right-0 top-0 z-40 flex h-full w-[340px] flex-col border-l border-[var(--border)] bg-[var(--bg-panel)] transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Package size={14} className="text-[var(--accent)]" />
            <span className="text-[12px] font-semibold text-[var(--text-1)]">产出物</span>
            <span className="rounded-full bg-[var(--bg-panel-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-2)]">
              {artifactCount}
            </span>
          </div>
          <button
            onClick={onToggle}
            className="rounded p-1 text-[var(--text-3)] hover:text-[var(--text-1)]"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {allSteps.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-[var(--text-3)]">
              <Package size={24} strokeWidth={1.5} />
              <p className="text-[11px]">暂无产出物</p>
              <p className="text-[10px]">Agent 完成步骤后将在此显示</p>
            </div>
          ) : (
            allSteps.map((step) => {
              const arts = (step.artifacts && step.artifacts.length > 0)
                ? step.artifacts.map((a) => ({ name: a.name, type: a.type as StepArtifact['type'], summary: a.summary }))
                : (AGENT_ARTIFACTS_MAP[step.agentName] ?? []).map((a) => ({ ...a, summary: '' }))
              if (arts.length === 0) return null
              return (
                <div key={step.id}>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className="text-[12px]">{stageIcon(step.name)}</span>
                    <span className="text-[11px] font-semibold text-[var(--text-1)]">{step.agentName}</span>
                    {step.role && <span className="text-[9px] text-[var(--text-3)]">{step.role}</span>}
                    <StatusDot status={step.status} />
                  </div>
                  <div className="space-y-1 pl-4">
                    {arts.map((art) => (
                      <button
                        key={art.name}
                        onClick={() => onViewArtifact(step, art)}
                        className="flex w-full items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-2.5 py-2 text-left transition-colors hover:border-[var(--accent)]"
                      >
                        <span className="text-[12px]">{artifactIcon(art.type)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-semibold text-[var(--text-1)]">{art.name}</p>
                          <p className="text-[9px] text-[var(--text-3)]">{art.type}</p>
                        </div>
                        <FileText size={11} className="shrink-0 text-[var(--text-3)]" />
                      </button>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
