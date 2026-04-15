import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash2, Play, Copy, Check, Loader2, AlertTriangle, Pencil, Settings, Package, FileText, X } from 'lucide-react'
import { ProjectSettingsModal } from '@/components/project/ProjectSettingsModal'
import { Badge } from '@/components/ui/Badge'
import { WorkflowConfigModal } from '@/components/requirements/WorkflowConfigModal'
import { mockMembers } from '@/mocks/data/projects'
import { cn } from '@/lib/utils'
import {
  useRequirementList,
  useCreateRequirement,
  usePatchRequirement,
  useDeleteRequirement,
  useApproveStep,
  useDismissAdvisory,
} from '@/hooks/useRequirements'
import { useProjectDetail } from '@/hooks/useProjects'
import { useStepDetail } from '@/hooks/useStepDetail'
import { useArtifactContent } from '@/hooks/useArtifactContent'
import type {
  PipelineStep,
  PipelineStepStatus,
  Requirement,
  RequirementPriority,
  RequirementStatus,
  StoryStatus,
  StepArtifact,
  StepDetailResponse,
} from '@/types/project'
import type { ProjectStatus } from '@/types/project'

type NewReqForm = {
  title: string
  summary: string
  priority: RequirementPriority
  assigneeId: string
}

const PRIORITY_OPTIONS: RequirementPriority[] = ['P0', 'P1', 'P2', 'P3']
const STATUS_LABEL: Record<RequirementStatus, string> = {
  queued: '待执行',
  running: '执行中',
  blocked: '阻塞',
  done: '已完成',
}

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: '进行中',
  planning: '规划中',
  paused: '已暂停',
  done: '已完成',
}
const STATUS_BADGE: Record<ProjectStatus, 'blue' | 'teal' | 'orange' | 'gray'> = {
  active: 'blue',
  planning: 'teal',
  paused: 'orange',
  done: 'gray',
}
const PROJECT_EMOJI: Record<string, string> = {
  'proj-1': '🏭',
  'proj-2': '📊',
}

export function ProjectDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { data: project, isLoading: projectLoading } = useProjectDetail(id ?? '')

  // ── API hooks (必须在条件返回之前调用) ───────────────────────────
  const { data: requirements = [] } = useRequirementList(id ?? '')
  const createMutation = useCreateRequirement()
  const patchMutation = usePatchRequirement()
  const deleteMutation = useDeleteRequirement()
  const approveStepMutation = useApproveStep()
  const dismissAdvisoryMutation = useDismissAdvisory()

  const [openCreate, setOpenCreate] = useState(false)
  const [workflowOpen, setWorkflowOpen] = useState(false)
  const [pendingForm, setPendingForm] = useState<NewReqForm | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Requirement | null>(null)
  const [editTarget, setEditTarget] = useState<Requirement | null>(null)
  const [editForm, setEditForm] = useState<NewReqForm>({ title: '', summary: '', priority: 'P1', assigneeId: '' })
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null)
  const [reqFilter, setReqFilter] = useState<RequirementStatus | 'all'>('all')
  const [activeNode, setActiveNode] = useState<PipelineStep | null>(null)
  const { mutate: fetchStepDetail, data: stepDetail, isPending: isDetailLoading, reset: resetStepDetail } = useStepDetail()
  const [stableDetail, setStableDetail] = useState<StepDetailResponse | undefined>(undefined)
  const [streamLines, setStreamLines] = useState<Array<{ time: string; text: string }>>([])
  const esRef = useRef<EventSource | null>(null)
  const [launchReqId, setLaunchReqId] = useState<string | null>(null)
  const [launchPromptText, setLaunchPromptText] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [launchCopied, setLaunchCopied] = useState(false)
  const [dismissModalStep, setDismissModalStep] = useState<PipelineStep | null>(null)
  const [dismissForm, setDismissForm] = useState({ lessonTitle: '', correctApproach: '', background: '', promoteToRule: false })
  // log streaming is handled inside <LogStream> component
  const [detailTab, setDetailTab] = useState<'flow' | 'artifacts'>('flow')
  const [viewingArtifact, setViewingArtifact] = useState<{ step: PipelineStep; art: StepArtifact } | null>(null)
  const { mutate: fetchArtifactContent, data: artifactContent, isPending: isArtifactLoading, reset: resetArtifactContent } = useArtifactContent()
  const [form, setForm] = useState<NewReqForm>({
    title: '',
    summary: '',
    priority: 'P1',
    assigneeId: project?.memberIds[0] ?? mockMembers[0]?.id ?? '',
  })

  useEffect(() => {
    if (!project) return
    setForm((prev) => {
      if (prev.assigneeId && project.memberIds.includes(prev.assigneeId)) return prev
      return {
        ...prev,
        assigneeId: project.memberIds[0] ?? mockMembers[0]?.id ?? '',
      }
    })
  }, [project])

  // 数据加载后自动选中第一条
  useEffect(() => {
    if (requirements.length > 0 && !selectedReqId) {
      setSelectedReqId(requirements[0].id)
    }
  }, [requirements, selectedReqId])

  const runningCount = requirements.filter((r) => r.status === 'running').length
  const blockedCount = requirements.filter((r) => r.status === 'blocked').length

  const filteredReqs = useMemo(() => {
    if (reqFilter === 'all') return requirements
    return requirements.filter((r) => r.status === reqFilter)
  }, [requirements, reqFilter])

  const selectedReq = requirements.find((r) => r.id === selectedReqId) ?? null

  // stepDetail 非空时同步到 stableDetail（防止 mutation 轮询期间 data 变 undefined 闪烁）
  useEffect(() => {
    if (stepDetail) setStableDetail(stepDetail)
  }, [stepDetail])

  // 点击流程节点时：重置状态 → 获取一次详情 → 若 running 则打开 SSE 流
  useEffect(() => {
    // 关闭上一个 EventSource
    esRef.current?.close()
    esRef.current = null
    setStreamLines([])

    if (!activeNode || !selectedReq) {
      resetStepDetail()
      setStableDetail(undefined)
      return
    }

    setStableDetail(undefined)

    // 获取一次步骤详情（summary / plan / artifacts / blockedReason）
    fetchStepDetail({
      agentName: activeNode.agentName,
      agentRole: activeNode.role ?? '',
      stepName: activeNode.name,
      status: activeNode.status,
      commands: activeNode.commands ?? '',
      reqTitle: selectedReq.title,
      reqSummary: selectedReq.summary,
    })

    // running 状态：打开 SSE 获取真实流式日志
    if (activeNode.status === 'running') {
      const params = new URLSearchParams({
        agentName: activeNode.agentName,
        agentRole: activeNode.role ?? '',
        stepName: activeNode.name,
        commands: activeNode.commands ?? '',
        reqTitle: selectedReq.title,
        reqSummary: selectedReq.summary,
      })
      const es = new EventSource(`/api/v1/steps/stream?${params}`)
      es.onmessage = (e) => {
        if (e.data === '[DONE]') { es.close(); return }
        try {
          const line = JSON.parse(e.data) as { time: string; text: string }
          setStreamLines((prev) => [...prev, line])
        } catch { /* ignore */ }
      }
      es.onerror = () => es.close()
      esRef.current = es
    }
  }, [activeNode?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!viewingArtifact || !selectedReq) { resetArtifactContent(); return }
    fetchArtifactContent({
      agentName: viewingArtifact.step.agentName,
      agentRole: viewingArtifact.step.role ?? '',
      artifactName: viewingArtifact.art.name,
      artifactType: viewingArtifact.art.type,
      stepName: viewingArtifact.step.name,
      reqTitle: selectedReq.title,
      reqSummary: selectedReq.summary,
      reqId: selectedReq.id,
      stepId: viewingArtifact.step.id,
    })
  }, [viewingArtifact]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDetailTab('flow')
  }, [selectedReqId])

  if (projectLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)]">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 text-center">
          <p className="text-sm font-semibold text-[var(--text-1)]">正在加载项目...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)]">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 text-center">
          <p className="text-sm font-semibold text-[var(--text-1)]">项目不存在</p>
          <button
            onClick={() => navigate('/projects')}
            className="mt-3 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white"
          >
            返回项目列表
          </button>
        </div>
      </div>
    )
  }

  const createRequirement = (formData: NewReqForm, pipeline: PipelineStep[]) => {
    if (!formData.title.trim()) return
    createMutation.mutate(
      {
        projectId: project.id,
        title: formData.title.trim(),
        summary: formData.summary.trim() || '暂无描述',
        priority: formData.priority,
        assigneeId: formData.assigneeId,
        pipeline,
      },
      {
        onSuccess: (newReq) => {
          setSelectedReqId(newReq.id)
          setWorkflowOpen(false)
          setPendingForm(null)
          setForm({
            title: '',
            summary: '',
            priority: 'P1',
            assigneeId: project.memberIds[0] ?? mockMembers[0]?.id ?? '',
          })
        },
      },
    )
  }

  const removeRequirement = (targetId: string) => {
    deleteMutation.mutate(
      { projectId: project.id, reqId: targetId },
      {
        onSuccess: () => {
          if (selectedReqId === targetId) setSelectedReqId(null)
          setDeleteTarget(null)
        },
      },
    )
  }

  const startWorkflow = (reqId: string) => {
    patchMutation.mutate({
      projectId: project.id,
      reqId,
      status: 'running',
    })
    setLaunchReqId(null)
  }

  const handleApproveStep = (reqId: string, stepId: string) => {
    approveStepMutation.mutate({ projectId: project.id, reqId, stepId })
  }

  const handleDismissAdvisory = (reqId: string, stepId: string) => {
    const { lessonTitle, correctApproach, background, promoteToRule } = dismissForm
    dismissAdvisoryMutation.mutate(
      { projectId: project.id, reqId, stepId, lessonTitle: lessonTitle || undefined, correctApproach: correctApproach || undefined, background: background || undefined, promoteToRule },
      {
        onSuccess: () => {
          setDismissModalStep(null)
          setDismissForm({ lessonTitle: '', correctApproach: '', background: '', promoteToRule: false })
        },
      },
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-base)]">
      {/* ── Page Hero Header ── */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-base)]">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-6">
          {/* Identity row */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4 min-w-0">
              {/* Color dot + emoji */}
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                style={{ background: `linear-gradient(135deg, ${project.color}, ${project.color}99)` }}
              >
                {PROJECT_EMOJI[project.id] ?? '📁'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-xl font-bold tracking-tight text-[var(--text-1)]">{project.name}</h1>
                  <span className="font-mono text-[11px] text-[var(--text-3)] bg-[var(--bg-panel-2)] px-2 py-0.5 rounded-md">{project.code}</span>
                  <Badge variant={STATUS_BADGE[project.status]}>{PROJECT_STATUS_LABEL[project.status]}</Badge>
                </div>
                <p className="text-sm text-[var(--text-2)] leading-relaxed line-clamp-2">{project.description}</p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-[var(--text-3)]">
                  <span>👤 {memberName(project.ownerId)}</span>
                  <span className="w-px h-3 bg-[var(--border)]" />
                  <span>👥 {project.memberIds.length} 人</span>
                  {project.endDate && (
                    <>
                      <span className="w-px h-3 bg-[var(--border)]" />
                      <span>📅 截止 {project.endDate.slice(5).replace('-', '/')}</span>
                    </>
                  )}
                  {project.context?.industry && (
                    <>
                      <span className="w-px h-3 bg-[var(--border)]" />
                      <span>🏭 {project.context.industry}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: req stats + settings */}
            <div className="flex shrink-0 items-center gap-3">
              <StatChip label="执行中" value={runningCount} color="var(--blue)" />
              <StatChip label="阻塞" value={blockedCount} color="var(--orange)" />
              <StatChip label="总需求" value={requirements.length} color="var(--text-2)" />
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--accent)] transition-colors"
              >
                <Settings size={12} />
                项目设置
              </button>
            </div>
          </div>
        </div>
      </div>

      {settingsOpen && (
        <ProjectSettingsModal
          open={settingsOpen}
          project={project}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-6 py-6">
        {true && (
          <section className="flex gap-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-panel)]" style={{ minHeight: '62vh' }}>
            {/* ── Left: req list ── */}
            <div className="flex w-[268px] shrink-0 flex-col border-r border-[var(--border)]">
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">需求列表</span>
                  <span className="rounded-full bg-[var(--bg-panel-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-2)]">
                    {requirements.length}
                  </span>
                </div>
                <button
                  onClick={() => setOpenCreate(true)}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] text-base font-bold leading-none text-[var(--accent)] hover:border-[var(--accent)]"
                  title="新建需求"
                >
                  +
                </button>
              </div>

              {/* Status filters */}
              <div className="flex shrink-0 flex-wrap gap-1 border-b border-[var(--border)] px-3 py-2">
                {(['all', 'running', 'blocked', 'queued', 'done'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setReqFilter(s)}
                    className={cn(
                      'rounded px-2 py-0.5 text-[11px] border transition-all',
                      reqFilter === s
                        ? 'border-[#1f6feb] bg-[#1f2d3d] text-[#58a6ff]'
                        : 'border-[var(--border)] bg-transparent text-[var(--text-3)] hover:text-[var(--text-1)]',
                    )}
                  >
                    {s === 'all' ? '全部' : STATUS_LABEL[s as RequirementStatus]}
                  </button>
                ))}
              </div>

              {/* Card list */}
              <div className="flex-1 overflow-y-auto space-y-1.5 p-2">
                {filteredReqs.length === 0 && (
                  <p className="py-6 text-center text-[12px] text-[var(--text-3)]">暂无需求</p>
                )}
                {filteredReqs.map((req) => {
                  const isBlocked = req.status === 'blocked'
                  const isSelected = req.id === selectedReqId
                  const activeStep =
                    req.pipeline.find((s) => s.status === 'running' || s.status === 'blocked') ??
                    req.stories.flatMap((st) => st.pipeline).find((s) => s.status === 'running' || s.status === 'blocked')
                  return (
                    <button
                      key={req.id}
                      onClick={() => setSelectedReqId(req.id)}
                      className={cn(
                        'w-full rounded-lg border-[1.5px] p-2.5 text-left transition-all',
                        isSelected
                          ? 'border-[#58a6ff] bg-[var(--bg-panel-2)]'
                          : isBlocked
                            ? 'border-[rgba(248,81,73,0.4)] bg-[#1d1418] hover:bg-[#221920]'
                            : 'border-[var(--border)] bg-[var(--bg-panel-2)] hover:border-[rgba(88,166,255,0.3)] hover:bg-[var(--bg-panel-3)]',
                      )}
                    >
                      {/* code + priority */}
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-mono text-[11px] font-semibold text-[#58a6ff]">#{req.code}</span>
                        <PriorityBadge priority={req.priority} />
                      </div>

                      {/* title */}
                      <p className="mb-2 line-clamp-2 text-[12px] leading-[1.4] text-[var(--text-1)]">{req.title}</p>

                      {/* pipeline dots bar */}
                      <div className="mb-1.5 flex gap-1">
                        {req.pipeline.map((step) => (
                          <div
                            key={step.id}
                            className={cn(
                              'h-1 flex-1 rounded-sm',
                              step.status === 'done'
                                ? 'bg-[#3fb950]'
                                : step.status === 'running'
                                  ? 'animate-pulse bg-[#58a6ff]'
                                  : step.status === 'blocked'
                                    ? 'bg-[#f85149]'
                                    : step.status === 'pending_approval'
                                      ? 'animate-pulse bg-[#ff9f0a]'
                                      : step.status === 'pending_advisory_approval'
                                        ? 'animate-pulse bg-[#ffd60a]'
                                        : 'bg-[#30363d]',
                            )}
                          />
                        ))}
                      </div>

                      {/* meta */}
                      <div className="flex items-center justify-between text-[10px]">
                        <span
                          className={cn(
                            isBlocked ? 'text-[#f85149]' : 'text-[var(--text-3)]',
                          )}
                        >
                          {activeStep
                            ? `${activeStep.agentName} ${isBlocked ? '⚠ 阻塞' : '执行中'}`
                            : req.status === 'done'
                              ? '✓ 已完成'
                              : '待启动'}
                        </span>
                        <span className="text-[var(--text-3)]">{activeStep?.updatedAt ?? '--'}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Right: workflow detail panel ── */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {selectedReq ? (
                <>
                  {/* Compact header */}
                  <div className="shrink-0 border-b border-[var(--border)] px-5 py-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[11px] font-semibold text-[#58a6ff]">#{selectedReq.code}</span>
                            <Badge variant={statusBadge(selectedReq.status)}>{STATUS_LABEL[selectedReq.status]}</Badge>
                            <PriorityBadge priority={selectedReq.priority} />
                          </div>
                          <h3 className="mt-1.5 text-[13px] font-semibold leading-snug text-[var(--text-1)]">{selectedReq.title}</h3>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--text-2)]">{selectedReq.summary}</p>
                          {/* ── Stats bar ── */}
                          {(() => {
                            const total   = selectedReq.stories.length
                            const active  = selectedReq.stories.filter((s) => s.status === 'running' || s.status === 'blocked').length
                            const done    = selectedReq.stories.filter((s) => s.status === 'done').length
                            const tokens  = selectedReq.tokenUsage ?? 0
                            const nextStep =
                              selectedReq.pipeline.find((s) => s.status === 'queued') ??
                              selectedReq.stories.flatMap((st) => st.pipeline).find((s) => s.status === 'queued')
                            return (
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-[var(--text-3)]">
                                <span>STORIES&nbsp;<span className="font-bold text-[var(--text-1)]">{total}</span></span>
                                <span className="select-none text-[var(--border)]">/</span>
                                <span>ACTIVE&nbsp;<span className="font-bold text-[#58a6ff]">{active}</span></span>
                                <span className="select-none text-[var(--border)]">/</span>
                                <span>DONE&nbsp;<span className="font-bold text-[var(--success)]">{done}</span></span>
                                {tokens > 0 && (
                                  <>
                                    <span className="select-none text-[var(--border)]">/</span>
                                    <span>TOKEN&nbsp;<span className="font-bold text-[#58a6ff]">{tokens.toLocaleString()}</span></span>
                                  </>
                                )}
                                {nextStep && (
                                  <>
                                    <span className="select-none text-[var(--border)]">/</span>
                                    <span>NEXT APPROVAL&nbsp;<span className="font-bold text-[var(--warning)]">{nextStep.name}&nbsp;~20min</span></span>
                                  </>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                        {/* ── 操作按钮组 ── */}
                        <div className="mt-0.5 flex shrink-0 items-center gap-1">
                          {selectedReq.status === 'queued' && selectedReq.pipeline.length > 0 && (
                            <button
                              onClick={() => {
                                setLaunchPromptText(buildLaunchPrompt(selectedReq))
                                setLaunchReqId(selectedReq.id)
                              }}
                              className="rounded border border-[rgba(10,132,255,0.3)] bg-[var(--accent-sub)] p-1 text-[var(--accent)]"
                              title="启动流程"
                            >
                              <Play size={12} fill="currentColor" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditForm({
                                title: selectedReq.title,
                                summary: selectedReq.summary,
                                priority: selectedReq.priority,
                                assigneeId: selectedReq.assigneeId,
                              })
                              setEditTarget(selectedReq)
                            }}
                            className="rounded border border-[var(--border)] bg-[var(--bg-panel-2)] p-1 text-[var(--text-2)] hover:text-[var(--accent)]"
                            title="编辑需求"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(selectedReq)}
                            className="rounded border border-[rgba(255,69,58,0.25)] bg-[var(--danger-sub)] p-1 text-[var(--danger)]"
                            title="删除需求"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                  </div>

                  {/* Tab bar */}
                  <div className="shrink-0 flex items-center border-b border-[var(--border)] px-5">
                    {(['flow', 'artifacts'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setDetailTab(tab)}
                        className={cn(
                          'flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-[11px] font-semibold transition-colors',
                          detailTab === tab
                            ? 'border-[var(--accent)] text-[var(--accent)]'
                            : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-1)]',
                        )}
                      >
                        {tab === 'flow' ? '流水线' : '产出物'}
                        {tab === 'artifacts' && (() => {
                          const n = [
                            ...selectedReq.pipeline,
                            ...selectedReq.stories.flatMap((s) => s.pipeline),
                          ].filter((s) => s.status === 'done').length
                          return n > 0 ? (
                            <span className="rounded-full bg-[var(--accent-sub)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--accent)]">
                              {n}
                            </span>
                          ) : null
                        })()}
                      </button>
                    ))}
                  </div>

                  {/* Flowchart body */}
                  {detailTab === 'flow' && (
                  <div className="flex-1 overflow-auto p-5">
                    {/* ── 审批 Banner ── */}
                    {(() => {
                      const pendingApproval = selectedReq.pipeline.find((s) => s.status === 'pending_approval')
                      const pendingAdvisory = selectedReq.pipeline.find((s) => s.status === 'pending_advisory_approval')
                      if (!pendingApproval && !pendingAdvisory) return null
                      const step = (pendingApproval ?? pendingAdvisory)!
                      const isMandatory = step.status === 'pending_approval'
                      return (
                        <div className={cn(
                          'mb-4 rounded-xl border px-4 py-3 space-y-2',
                          isMandatory
                            ? 'border-[rgba(255,159,10,0.4)] bg-[rgba(255,159,10,0.07)]'
                            : 'border-[rgba(255,214,10,0.35)] bg-[rgba(255,214,10,0.05)]',
                        )}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className={cn('text-[12px] font-semibold', isMandatory ? 'text-[#ff9f0a]' : 'text-[#ffd60a]')}>
                                {isMandatory ? '强制审批：需要人工批准后继续' : '建议性审批：指挥官请求确认'}
                              </p>
                              <p className="text-[11px] text-[var(--text-2)] mt-0.5">
                                步骤：{step.agentName} · {step.name}
                              </p>
                              {!isMandatory && step.advisoryConcern && (
                                <p className="text-[11px] text-[var(--text-3)] mt-1">顾虑：{step.advisoryConcern}</p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {!isMandatory && (
                                <button
                                  onClick={() => {
                                    setDismissForm({ lessonTitle: '', correctApproach: '', background: '', promoteToRule: false })
                                    setDismissModalStep(step)
                                  }}
                                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-2)] hover:text-[var(--text-1)]"
                                >
                                  无需审批
                                </button>
                              )}
                              <button
                                onClick={() => handleApproveStep(selectedReq.id, step.id)}
                                disabled={approveStepMutation.isPending}
                                className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                              >
                                {approveStepMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : null}
                                批准并继续
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                    {/* ── Phase 1: req-level sequential nodes ── */}
                    {selectedReq.pipeline.length > 0 && (
                      <>
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">分析规划阶段</p>
                        <div className="flex min-w-max items-stretch">
                          {selectedReq.pipeline.map((step, idx) => (
                            <div key={step.id} className="flex items-center">
                              <FlowNode
                                step={step}
                                isActive={activeNode?.id === step.id}
                                onClick={() => setActiveNode(activeNode?.id === step.id ? null : step)}
                              />
                              {idx < selectedReq.pipeline.length - 1 && (
                                <NodeArrow done={step.status === 'done'} />
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* ── Phase 2: parallel story lanes ── */}
                    {selectedReq.stories.length > 0 && (
                      <>
                        <div className="my-5 flex items-center gap-3">
                          <div className="h-px flex-1 bg-[#21262d]" />
                          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                            Story 拆分 · {selectedReq.stories.length} 个并行
                          </span>
                          <div className="h-px flex-1 bg-[#21262d]" />
                        </div>
                        <div className="flex flex-col gap-5">
                          {selectedReq.stories.map((story) => (
                            <div key={story.id}>
                              <div className="mb-2 flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold text-[#58a6ff]">{story.code}</span>
                                <span className="text-[11px] text-[var(--text-2)]">{story.title}</span>
                                <NodeStatusBadge status={story.status} />
                              </div>
                              <div className="flex min-w-max items-stretch border-l-2 border-[#21262d] pl-4">
                                {story.pipeline.map((step, idx) => (
                                  <div key={step.id} className="flex items-center">
                                    <FlowNode
                                      step={step}
                                      isActive={activeNode?.id === step.id}
                                      onClick={() => setActiveNode(activeNode?.id === step.id ? null : step)}
                                    />
                                    {idx < story.pipeline.length - 1 && (
                                      <NodeArrow done={step.status === 'done'} />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {selectedReq.pipeline.length === 0 && selectedReq.stories.length === 0 && (
                      <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--border)] px-4 py-6">
                        <div className="text-[22px]">✦</div>
                        <div>
                          <p className="text-[12px] font-semibold text-[var(--text-2)]">流水线待启动</p>
                          <p className="text-[11px] text-[var(--text-3)]">需求创建后系统将自动配置 Agent 流水线</p>
                        </div>
                      </div>
                    )}
                  </div>
                  )}

                  {/* 产出物 tab */}
                  {detailTab === 'artifacts' && (
                    <div className="flex-1 overflow-auto p-5 space-y-5">
                      {(() => {
                        const allSteps = [
                          ...selectedReq.pipeline,
                          ...selectedReq.stories.flatMap((s) => s.pipeline),
                        ].filter((s) => s.status === 'done')
                        if (allSteps.length === 0) {
                          return (
                            <div className="flex flex-col items-center gap-3 py-16 text-[var(--text-3)]">
                              <Package size={28} strokeWidth={1.5} />
                              <p className="text-xs">暂无产出物，Agent 完成步骤后将在此显示</p>
                            </div>
                          )
                        }
                        return allSteps.map((step) => {
                          const arts = AGENT_ARTIFACTS_MAP[step.agentName] ?? []
                          if (arts.length === 0) return null
                          return (
                            <div key={step.id}>
                              <div className="mb-2 flex items-center gap-2">
                                <span className="text-[13px]">{stageIcon(step.name)}</span>
                                <span className="text-[11px] font-semibold text-[var(--text-1)]">{step.agentName}</span>
                                {step.role && <span className="text-[10px] text-[var(--text-3)]">{step.role}</span>}
                                <NodeStatusBadge status={step.status} />
                              </div>
                              <div className="space-y-1.5 pl-5">
                                {arts.map((art) => (
                                  <button
                                    key={art.name}
                                    onClick={() => setViewingArtifact({ step, art: { name: art.name, type: art.type, summary: '' } })}
                                    className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2.5 text-left hover:border-[var(--accent)] transition-colors"
                                  >
                                    <span className="text-[13px]">{artifactIcon(art.type)}</span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[12px] font-semibold text-[var(--text-1)]">{art.name}</p>
                                      <p className="text-[10px] text-[var(--text-3)]">{art.type}</p>
                                    </div>
                                    <FileText size={12} className="shrink-0 text-[var(--text-3)]" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-[var(--text-2)]">选择一条需求</p>
                    <p className="mt-1 text-xs text-[var(--text-3)]">点击左侧列表查看 Agent 工作流详情</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}


      </main>

      {/* ── Step detail modal ── */}
      {activeNode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setActiveNode(null)}
        >
          <div
            className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]"
            style={{ maxHeight: '82vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="flex shrink-0 items-start justify-between border-b border-[var(--border)] px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] leading-none">{stageIcon(activeNode.name)}</span>
                  <span className="text-sm font-bold text-[var(--text-1)]">{activeNode.agentName}</span>
                  <NodeStatusBadge status={activeNode.status} />
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--text-3)]">
                  {activeNode.role && `${activeNode.role} · `}{activeNode.name}
                  {activeNode.updatedAt !== '--:--' && (
                    <span className="ml-2 text-[var(--text-3)]">更新于 {activeNode.updatedAt}</span>
                  )}
                </p>
              </div>
              <button onClick={() => setActiveNode(null)} className="text-[18px] leading-none text-[var(--text-3)] hover:text-[var(--text-1)]">×</button>
            </div>

            {/* ── Body ── */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {/* 初次加载中（stableDetail 尚不存在） */}
              {isDetailLoading && !stableDetail && (
                <div className="flex flex-col items-center gap-3 py-10 text-[var(--text-3)]">
                  <Loader2 size={20} className="animate-spin text-[var(--accent)]" />
                  <span className="text-xs">正在分析步骤详情…</span>
                </div>
              )}

              {/* 详情内容（stableDetail 在轮询期间保持稳定，不会闪烁） */}
              {stableDetail && (
                <div className="space-y-5">
                  {/* summary */}
                  <p className="text-[12px] leading-relaxed text-[var(--text-2)]">{stableDetail.summary}</p>

                  {/* ── queued: 执行计划 ── */}
                  {stableDetail.plan && (
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">执行计划</p>
                      <p className="text-[12px] leading-relaxed text-[var(--text-2)]">{stableDetail.plan.description}</p>
                      {stableDetail.plan.commandDetails.length > 0 && (
                        <div className="space-y-1.5">
                          {stableDetail.plan.commandDetails.map((cmd, i) => (
                            <div key={cmd.code} className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2.5">
                              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[var(--bg-panel-3)] font-mono text-[9px] font-bold text-[var(--text-3)]">{i + 1}</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[11px] font-bold text-[#58a6ff]">{cmd.code}</span>
                                  <span className="text-[11px] text-[var(--text-1)]">{cmd.name}</span>
                                </div>
                                <p className="mt-0.5 text-[10px] text-[var(--text-3)]">{cmd.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)]">
                        <span>预计耗时</span>
                        <span className="font-semibold text-[var(--text-2)]">约 {stableDetail.plan.estimatedMinutes} 分钟</span>
                      </div>
                    </div>
                  )}

                  {/* ── running: 实时日志流 ── */}
                  {activeNode.status === 'running' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">执行日志</p>
                        <span className="flex items-center gap-1 rounded-full border border-[rgba(88,166,255,0.3)] bg-[rgba(88,166,255,0.07)] px-2 py-0.5 font-mono text-[9px] font-bold text-[#58a6ff]">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#58a6ff] opacity-60" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#58a6ff]" />
                          </span>
                          LIVE
                        </span>
                      </div>
                      <LogStream lines={streamLines} />
                    </div>
                  )}

                  {/* ── done: 产出物 ── */}
                  {stableDetail.artifacts && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">产出物</p>
                        {stableDetail.duration && (
                          <span className="rounded-full border border-[rgba(63,185,80,0.3)] bg-[rgba(63,185,80,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[#3fb950]">
                            {stableDetail.duration}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {stableDetail.artifacts.map((art) => (
                          <button
                            key={art.name}
                            onClick={() => setViewingArtifact({ step: activeNode!, art })}
                            className="flex w-full flex-col rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2.5 text-left hover:border-[var(--accent)] transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[13px]">{artifactIcon(art.type)}</span>
                              <span className="text-[12px] font-semibold text-[var(--text-1)]">{art.name}</span>
                              <span className="rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text-3)]">{art.type}</span>
                            </div>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-2)]">{art.summary}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── blocked: 阻塞原因 ── */}
                  {stableDetail.blockedReason && (
                    <div className="rounded-xl border border-[rgba(248,81,73,0.3)] bg-[rgba(248,81,73,0.06)] px-4 py-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-[#f85149]">
                        <AlertTriangle size={13} />
                        <span className="text-[12px] font-semibold">阻塞原因</span>
                      </div>
                      <p className="text-[12px] leading-relaxed text-[var(--text-2)]">{stableDetail.blockedReason}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 加载失败时降级到静态内容 */}
              {!isDetailLoading && !stableDetail && (
                <div className="space-y-4">
                  <p className="text-[12px] leading-relaxed text-[var(--text-2)]">{getStepDetail(activeNode).desc}</p>
                  {activeNode.commands && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">执行命令</p>
                      <div className="flex flex-wrap gap-1.5">
                        {activeNode.commands.split('→').map((cmd) => (
                          <span key={cmd} className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 font-mono text-[11px] text-[#58a6ff]">{cmd.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {openCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[560px] rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h3 className="text-sm font-semibold text-[var(--text-1)]">新建需求</h3>
            </div>

            <div className="space-y-3 px-5 py-4">
              <InputField label="需求标题" required>
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 text-sm text-[var(--text-1)]"
                />
              </InputField>

              <InputField label="需求摘要">
                <textarea
                  value={form.summary}
                  onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2 text-sm text-[var(--text-1)]"
                />
              </InputField>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InputField label="优先级">
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as RequirementPriority }))}
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 text-sm text-[var(--text-1)]"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </InputField>

                <InputField label="负责人分配">
                  <select
                    value={form.assigneeId}
                    onChange={(e) => setForm((prev) => ({ ...prev, assigneeId: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 text-sm text-[var(--text-1)]"
                  >
                    {project.memberIds.map((memberId) => {
                      const m = mockMembers.find((x) => x.id === memberId)
                      return (
                        <option key={memberId} value={memberId}>
                          {m?.name ?? memberId}
                        </option>
                      )
                    })}
                  </select>
                </InputField>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
              <button
                onClick={() => setOpenCreate(false)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-2)]"
              >
                取消
              </button>
              <button
                disabled={!form.title.trim()}
                onClick={() => {
                  if (!form.title.trim()) return
                  setPendingForm(form)
                  setOpenCreate(false)
                  setWorkflowOpen(true)
                }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                  form.title.trim()
                    ? 'bg-[var(--accent)] text-white hover:opacity-90'
                    : 'cursor-not-allowed bg-[var(--bg-panel-3)] text-[var(--text-3)]',
                )}
              >
                下一步：配置工作流
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 编辑需求 Modal ── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[560px] rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h3 className="text-sm font-semibold text-[var(--text-1)]">编辑需求</h3>
              <p className="mt-0.5 font-mono text-[11px] text-[var(--text-3)]">{editTarget.code}</p>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-2)]">需求标题</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-2)]">需求描述</label>
                <textarea
                  value={editForm.summary}
                  onChange={(e) => setEditForm((p) => ({ ...p, summary: e.target.value }))}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2 text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-2)]">优先级</label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm((p) => ({ ...p, priority: e.target.value as RequirementPriority }))}
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 text-sm text-[var(--text-1)]"
                  >
                    {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-2)]">负责人</label>
                  <select
                    value={editForm.assigneeId}
                    onChange={(e) => setEditForm((p) => ({ ...p, assigneeId: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 text-sm text-[var(--text-1)]"
                  >
                    {project.memberIds.map((mid) => {
                      const m = mockMembers.find((x) => x.id === mid)
                      return <option key={mid} value={mid}>{m?.name ?? mid}</option>
                    })}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
              <button
                onClick={() => setEditTarget(null)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-2)]"
              >
                取消
              </button>
              <button
                disabled={!editForm.title.trim()}
                onClick={() => {
                  if (!editForm.title.trim()) return
                  patchMutation.mutate(
                    {
                      projectId: project.id,
                      reqId: editTarget.id,
                      title: editForm.title.trim(),
                      summary: editForm.summary.trim(),
                      priority: editForm.priority,
                      assigneeId: editForm.assigneeId,
                    },
                    { onSuccess: () => setEditTarget(null) },
                  )
                }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                  editForm.title.trim()
                    ? 'bg-[var(--accent)] text-white hover:opacity-90'
                    : 'cursor-not-allowed bg-[var(--bg-panel-3)] text-[var(--text-3)]',
                )}
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[560px] rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h3 className="text-sm font-semibold text-[var(--text-1)]">删除需求确认</h3>
              <p className="mt-1 text-xs text-[var(--text-2)]">系统将校验该需求流水线影响后再执行删除</p>
            </div>

            <div className="space-y-3 px-5 py-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-3">
                <p className="text-xs text-[var(--text-2)]">目标需求</p>
                <p className="text-sm font-semibold text-[var(--text-1)]">
                  {deleteTarget.code} · {deleteTarget.title}
                </p>
              </div>

              <div className="rounded-xl border border-[rgba(255,159,10,0.25)] bg-[var(--warning-sub)] p-3 text-xs text-[var(--warning)]">
                影响扫描结果：删除后该需求的流水线执行记录将不可恢复。当前未检测到其他需求依赖该流水线。
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-2)]"
              >
                取消
              </button>
              <button
                onClick={() => removeRequirement(deleteTarget.id)}
                className="rounded-lg border border-[rgba(255,69,58,0.3)] bg-[var(--danger-sub)] px-3 py-1.5 text-xs font-semibold text-[var(--danger)]"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 启动流程 Modal ── */}
      {launchReqId && (() => {
        const req = requirements.find((r) => r.id === launchReqId)
        if (!req) return null
        const firstStep = req.pipeline[0]
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setLaunchReqId(null)}
          >
            <div
              className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-4">
                <div>
                  <p className="text-[11px] text-[var(--text-3)]">准备启动 Agent 工作流</p>
                  <h3 className="mt-0.5 max-w-[380px] truncate text-sm font-semibold text-[var(--text-1)]">
                    {req.title}
                  </h3>
                </div>
                <button
                  onClick={() => setLaunchReqId(null)}
                  className="text-[18px] leading-none text-[var(--text-3)] hover:text-[var(--text-1)]"
                >×</button>
              </div>

              {/* Body */}
              <div className="space-y-4 px-5 py-4">
                {/* 第一个 Agent 信息 */}
                <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-sub)] text-[14px] font-bold text-[var(--accent)]">
                    1
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">第一步 Agent</p>
                    <p className="mt-0.5 text-sm font-bold text-[var(--text-1)]">
                      {firstStep.agentName}
                      {firstStep.role && <span className="ml-1.5 text-xs font-normal text-[var(--text-3)]">· {firstStep.role}</span>}
                    </p>
                    {firstStep.commands && (
                      <p className="mt-1 font-mono text-[10px] text-[#58a6ff]">{firstStep.commands}</p>
                    )}
                  </div>
                </div>

                {/* 启动 Prompt */}
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                    向 Agent 发送以下消息以启动工作
                  </p>
                  <div className="relative rounded-xl border border-[var(--border)] bg-[var(--bg-base)]">
                    <textarea
                      value={launchPromptText}
                      onChange={(e) => setLaunchPromptText(e.target.value)}
                      rows={7}
                      className="w-full resize-y rounded-xl bg-transparent px-4 py-3 font-mono text-[11px] leading-relaxed text-[var(--text-2)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(launchPromptText).then(() => {
                          setLaunchCopied(true)
                          setTimeout(() => setLaunchCopied(false), 2000)
                        })
                      }}
                      className={cn(
                        'absolute right-2 top-2 flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition-all',
                        launchCopied
                          ? 'border-[rgba(52,199,89,0.4)] bg-[var(--success-sub)] text-[var(--success)]'
                          : 'border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-2)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
                      )}
                    >
                      {launchCopied ? <Check size={10} /> : <Copy size={10} />}
                      {launchCopied ? '已复制' : '复制'}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-[var(--text-3)]">
                    复制后，在 Claude Code 中打开对应 Agent 并粘贴发送即可。
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
                <button
                  onClick={() => setLaunchReqId(null)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-2)] hover:text-[var(--text-1)]"
                >
                  取消
                </button>
                <button
                  onClick={() => startWorkflow(launchReqId)}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  <Play size={10} fill="currentColor" />
                  确认启动
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── 产出物内容 Modal ── */}
      {viewingArtifact && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setViewingArtifact(null)}
        >
          <div
            className="flex w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]"
            style={{ maxHeight: '88vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="text-[15px]">{artifactIcon(viewingArtifact.art.type)}</span>
                <div>
                  <p className="text-[13px] font-bold text-[var(--text-1)]">{viewingArtifact.art.name}</p>
                  <p className="text-[10px] text-[var(--text-3)]">
                    {viewingArtifact.step.agentName}
                    {viewingArtifact.step.role && ` · ${viewingArtifact.step.role}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingArtifact(null)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-3)] hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-1)]"
              >
                <X size={14} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {isArtifactLoading && (
                <div className="flex flex-col items-center gap-3 py-10 text-[var(--text-3)]">
                  <Loader2 size={20} className="animate-spin text-[var(--accent)]" />
                  <span className="text-xs">正在生成产出物内容…</span>
                </div>
              )}
              {!isArtifactLoading && artifactContent && (
                <div className="artifact-md">
                  {renderMarkdown(artifactContent.content)}
                </div>
              )}
              {!isArtifactLoading && !artifactContent && (
                <div className="flex flex-col items-center gap-3 py-10 text-[var(--text-3)]">
                  <FileText size={24} strokeWidth={1.5} />
                  <span className="text-xs">内容加载失败，请重试</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 驳回建议性审批 Modal ── */}
      {dismissModalStep && selectedReq && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setDismissModalStep(null)}
        >
          <div
            className="w-full max-w-[480px] rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-4">
              <div>
                <p className="text-[11px] text-[var(--text-3)]">驳回建议性审批</p>
                <h3 className="mt-0.5 text-sm font-semibold text-[var(--text-1)]">
                  {dismissModalStep.agentName} · {dismissModalStep.name}
                </h3>
              </div>
              <button onClick={() => setDismissModalStep(null)} className="text-[18px] text-[var(--text-3)] hover:text-[var(--text-1)]">×</button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <p className="text-[11px] text-[var(--text-3)]">可选：录入教训，帮助指挥官下次做出更好的判断</p>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--text-2)]">教训标题</label>
                <input
                  value={dismissForm.lessonTitle}
                  onChange={(e) => setDismissForm((p) => ({ ...p, lessonTitle: e.target.value }))}
                  placeholder="例：不要对标准 CRUD 请求触发审批"
                  className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 text-xs text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--text-2)]">正确做法</label>
                <textarea
                  value={dismissForm.correctApproach}
                  onChange={(e) => setDismissForm((p) => ({ ...p, correctApproach: e.target.value }))}
                  placeholder="例：常规接口开发无需审批，直接执行即可"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2 text-xs text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={dismissForm.promoteToRule}
                  onChange={(e) => setDismissForm((p) => ({ ...p, promoteToRule: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded accent-[var(--accent)]"
                />
                <span className="text-[11px] text-[var(--text-2)]">固化为规则（指挥官将来严格遵守）</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
              <button
                onClick={() => setDismissModalStep(null)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-2)]"
              >
                取消
              </button>
              <button
                onClick={() => handleDismissAdvisory(selectedReq.id, dismissModalStep.id)}
                disabled={dismissAdvisoryMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {dismissAdvisoryMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : null}
                确认驳回并继续
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: 工作流配置 Modal — key 确保每次打开都是全新状态 */}      <WorkflowConfigModal
        key={pendingForm?.title ?? ''}
        open={workflowOpen}
        reqTitle={pendingForm?.title ?? ''}
        reqSummary={pendingForm?.summary ?? ''}
        projectContext={project.context}
        onClose={() => {
          setWorkflowOpen(false)
          setPendingForm(null)
        }}
        onConfirm={(pipeline) => {
          if (pendingForm) createRequirement(pendingForm, pipeline)
        }}
      />
    </div>
  )
}


function InputField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-[var(--text-2)]">
      {label}
      {required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
      <div className="mt-1">{children}</div>
    </label>
  )
}

// ── Flow node components ───────────────────────────────────────────────────

function FlowNode({ step, isActive, onClick }: { step: PipelineStep; isActive: boolean; onClick: () => void }) {
  const cls =
    step.status === 'done'                     ? 'border-[#30363d] bg-[#0d1117]' :
    step.status === 'running'                  ? 'border-[rgba(88,166,255,0.55)] bg-[rgba(88,166,255,0.06)] shadow-[0_0_12px_rgba(88,166,255,0.18)]' :
    step.status === 'blocked'                  ? 'border-[rgba(248,81,73,0.55)] bg-[rgba(248,81,73,0.06)]' :
    step.status === 'pending_approval'         ? 'border-[rgba(255,159,10,0.55)] bg-[rgba(255,159,10,0.06)] shadow-[0_0_10px_rgba(255,159,10,0.15)]' :
    step.status === 'pending_advisory_approval'? 'border-[rgba(255,214,10,0.5)] bg-[rgba(255,214,10,0.05)]' :
                                                 'border-[#21262d] bg-[#0d1117] opacity-55'
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex w-[148px] shrink-0 flex-col rounded-xl border-[1.5px] p-3 text-left transition-all hover:brightness-110 active:scale-[0.98]',
        cls,
        isActive && 'ring-2 ring-[#58a6ff] ring-offset-1 ring-offset-[var(--bg-base)]',
      )}
    >
      {step.status === 'running' && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-t-xl bg-[linear-gradient(90deg,transparent,#58a6ff,transparent)]" />
      )}
      {step.status === 'pending_approval' && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-t-xl bg-[linear-gradient(90deg,transparent,#ff9f0a,transparent)]" />
      )}
      {step.status === 'pending_advisory_approval' && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-t-xl bg-[linear-gradient(90deg,transparent,#ffd60a,transparent)]" />
      )}
      {/* Agent name + status */}
      <div className="mb-1.5 flex items-start justify-between gap-1">
        <span className="text-[13px] font-bold leading-tight text-[var(--text-1)]">{step.agentName}</span>
        <NodeStatusBadge status={step.status} />
      </div>
      {/* Role */}
      {step.role && (
        <span className="text-[10px] leading-tight text-[var(--text-3)]">{step.role}</span>
      )}
      {/* Commands */}
      {step.commands && (
        <span className="mt-2 font-mono text-[9px] text-[#58a6ff] opacity-80">{step.commands}</span>
      )}
    </button>
  )
}

function NodeArrow({ done = false }: { done?: boolean }) {
  return (
    <div className="flex shrink-0 items-center">
      <div className={cn('h-px w-8', done ? 'bg-[#3fb950]' : 'bg-[#30363d]')} />
      <div className={cn(
        'border-y-[5px] border-l-[7px] border-y-transparent',
        done ? 'border-l-[#3fb950]' : 'border-l-[#30363d]',
      )} />
    </div>
  )
}

function NodeStatusBadge({ status }: { status: PipelineStepStatus | StoryStatus }) {
  const map: Record<string, { label: string; cls: string }> = {
    done:                      { label: '已完成', cls: 'text-[#3fb950] border-[rgba(63,185,80,0.3)]  bg-[rgba(63,185,80,0.1)]' },
    running:                   { label: '进行中', cls: 'text-[#58a6ff] border-[rgba(88,166,255,0.3)] bg-[rgba(88,166,255,0.1)]' },
    blocked:                   { label: '阻塞',   cls: 'text-[#f85149] border-[rgba(248,81,73,0.3)]  bg-[rgba(248,81,73,0.1)]' },
    queued:                    { label: '未开始', cls: 'text-[var(--text-3)] border-[var(--border)] bg-transparent' },
    pending_approval:          { label: '待审批', cls: 'text-[#ff9f0a] border-[rgba(255,159,10,0.35)] bg-[rgba(255,159,10,0.1)]' },
    pending_advisory_approval: { label: '建议审批', cls: 'text-[#ffd60a] border-[rgba(255,214,10,0.3)] bg-[rgba(255,214,10,0.08)]' },
  }
  const { label, cls } = map[status] ?? map['queued']
  return (
    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold leading-none ${cls}`}>
      {label}
    </span>
  )
}

function getStepDetail(step: PipelineStep): { desc: string; outputs: string[] } {
  const details: Record<string, { desc: string; outputs: string[] }> = {
    'Mary':    { desc: '分析行业背景、竞争格局与目标用户需求，生成结构化商业分析报告。', outputs: ['商业简报 (BP)', '竞品分析 (CB)', '项目背景文档 (DP)'] },
    'John':    { desc: '基于商业分析结果创建产品需求文档、产品愿景与 Epic 需求列表。', outputs: ['产品需求文档 (CP)', '产品愿景说明 (VP)', 'Epic 列表 (EP)', '变更评估 (CE)'] },
    'Sally':   { desc: '设计用户交互流程与 UI 原型，输出完整组件规范与设计文档。', outputs: ['UI/UX 设计文档 (CU)'] },
    'Winston': { desc: '设计技术架构方案，评估技术选型，输出系统架构设计文档。', outputs: ['架构设计文档 (CA)'] },
    'Bob':     { desc: '将 Epic 拆分为可执行的 User Story，制定迭代计划与验收标准。', outputs: ['Story 列表 (SP)', '冲刺计划 (CS)', '验收标准 (VS)', 'Story 汇总 (SS)'] },
    'Amelia':  { desc: '根据 Story 规范进行代码开发，完成功能实现并提交代码审查。', outputs: ['功能代码实现 (DS)'] },
    'Quinn':   { desc: '执行代码质量审查与自动化测试，输出测试报告和质量评估。', outputs: ['代码评审报告 (CR)', '自动化测试报告 (QA)'] },
  }
  return details[step.agentName] ?? { desc: '执行当前阶段任务，等待结果输出。', outputs: [] }
}

function PriorityBadge({ priority }: { priority: RequirementPriority }) {
  const map: Record<RequirementPriority, string> = {
    P0: 'border-[rgba(248,81,73,0.35)] bg-[rgba(248,81,73,0.12)] text-[#f85149]',
    P1: 'border-[rgba(248,81,73,0.25)] bg-[rgba(248,81,73,0.08)] text-[#f85149]',
    P2: 'border-[rgba(210,153,34,0.35)] bg-[rgba(210,153,34,0.12)] text-[#d29922]',
    P3: 'border-[rgba(63,185,80,0.3)] bg-[rgba(63,185,80,0.1)] text-[#3fb950]',
  }
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${map[priority]}`}>
      {priority}
    </span>
  )
}

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


function statusBadge(status: RequirementStatus): 'blue' | 'orange' | 'gray' | 'green' {
  if (status === 'running') return 'blue'
  if (status === 'blocked') return 'orange'
  if (status === 'done') return 'green'
  return 'gray'
}

function buildLaunchPrompt(req: Requirement): string {
  const firstStep = req.pipeline[0]
  if (!firstStep) return ''
  const cmds = firstStep.enabledCommands?.join(' → ') ?? firstStep.commands ?? ''
  const cmdLine = cmds ? `\n请按顺序执行以下命令：${cmds}` : ''
  return `你好，我需要你扮演 ${firstStep.agentName}${firstStep.role ? `（${firstStep.role}）` : ''} 来处理以下需求。

需求标题：${req.title}
需求摘要：${req.summary}
${cmdLine}

请从第一个命令开始，分析需求背景，并告知我你的分析结果与下一步计划。`
}

function memberName(memberId: string) {
  return mockMembers.find((m) => m.id === memberId)?.name ?? memberId
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[48px]">
      <span className="text-xl font-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[10px] text-[var(--text-3)]">{label}</span>
    </div>
  )
}

const AGENT_ARTIFACTS_MAP: Record<string, Array<{ name: string; type: StepArtifact['type'] }>> = {
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

function renderMarkdown(md: string): React.ReactNode {
  const lines = md.split('\n')
  const nodes: React.ReactNode[] = []
  lines.forEach((line, i) => {
    if (line.startsWith('### ')) {
      nodes.push(<h3 key={i} className="mt-4 mb-1.5 text-[13px] font-bold text-[var(--text-1)]">{line.slice(4)}</h3>)
    } else if (line.startsWith('## ')) {
      nodes.push(<h2 key={i} className="mt-5 mb-2 text-[14px] font-bold text-[var(--text-1)]">{line.slice(3)}</h2>)
    } else if (line.startsWith('# ')) {
      nodes.push(<h1 key={i} className="mt-6 mb-2 text-[15px] font-bold text-[var(--text-1)]">{line.slice(2)}</h1>)
    } else if (line.startsWith('---')) {
      nodes.push(<hr key={i} className="my-3 border-[var(--border)]" />)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      nodes.push(<li key={i} className="ml-4 list-disc text-[12px] text-[var(--text-2)]">{line.slice(2)}</li>)
    } else if (line.trim() === '') {
      nodes.push(<div key={i} className="h-2" />)
    } else {
      nodes.push(<p key={i} className="text-[12px] leading-relaxed text-[var(--text-2)]">{line}</p>)
    }
  })
  return <>{nodes}</>
}


// ── LogStream (Claude 终端风格：结构化行块 + spinner + 可展开 tool result) ─────

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const LOG_TAG_COLOR: Record<string, string> = {
  init:     '#6e7681',
  analysis: '#79c0ff',
  writing:  '#79c0ff',
  planning: '#a5d6ff',
  design:   '#79c0ff',
  code:     '#79c0ff',
  review:   '#8b949e',
  decision: '#e3b341',
  output:   '#3fb950',
}

type LogGroup = {
  id: number
  tag: string
  content: string
  detail?: string
  isOutput: boolean
  isFix: boolean
}

function buildLogGroups(lines: Array<{ time: string; text: string }>): LogGroup[] {
  const groups: LogGroup[] = []
  let id = 0
  for (const line of lines) {
    const text = line.text
    const m = text.match(/^\[([^\]]+)\]\s*(.*)$/)
    if (!m) {
      groups.push({ id: id++, tag: '', content: text, isOutput: text.includes('✓'), isFix: false })
      continue
    }
    const [, tag, content] = m
    if (tag === 'result') {
      const last = groups[groups.length - 1]
      if (last?.tag.startsWith('tool:')) { last.detail = content; continue }
    }
    groups.push({
      id: id++, tag, content,
      isOutput: tag === 'output',
      isFix: tag === 'fix' || tag === 'debug',
    })
  }
  return groups
}

const LogStream = React.memo(function LogStream({
  lines,
}: {
  lines: Array<{ time: string; text: string }>
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [spinnerFrame, setSpinnerFrame] = React.useState(0)
  const [expandedIds, setExpandedIds]   = React.useState<Set<number>>(new Set())

  // Spinner 帧动画（80ms/帧）
  React.useEffect(() => {
    const id = setInterval(() => setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length), 80)
    return () => clearInterval(id)
  }, [])

  // 新行出现时自动滚到底部
  React.useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  const groups = buildLogGroups(lines)

  const toggle = (gid: number) =>
    setExpandedIds((prev) => { const s = new Set(prev); s.has(gid) ? s.delete(gid) : s.add(gid); return s })

  return (
    <div
      ref={containerRef}
      className="rounded-xl border border-[var(--border)] bg-[#0d1117] px-3 py-2.5 font-mono h-[260px] overflow-y-auto"
    >
      {groups.length === 0 ? (
        <div className="flex items-center gap-1.5 py-1 text-[10px] text-[#3d444d]">
          <span className="animate-pulse text-[#58a6ff]">▌</span>
          <span>connecting...</span>
        </div>
      ) : (
        <div>
          {groups.map((g, idx) => {
            const isLast    = idx === groups.length - 1
            const isRunning = isLast && !g.isOutput
            const isTool    = g.tag.startsWith('tool:')
            const toolName  = isTool ? g.tag.slice(5) : null
            const hasDetail = isTool && !!g.detail
            const isExpanded = expandedIds.has(g.id)

            const tagColor = g.isFix ? '#f0883e'
              : g.isOutput ? '#3fb950'
              : isTool ? '#79c0ff'
              : LOG_TAG_COLOR[g.tag] ?? '#6e7681'

            const titleColor = isRunning ? '#e6edf3'
              : g.isOutput ? '#3fb950'
              : g.isFix ? '#f0883e'
              : '#6e7681'

            const statusIcon = isRunning
              ? <span style={{ color: '#58a6ff' }}>{SPINNER_FRAMES[spinnerFrame]}</span>
              : g.isOutput
              ? <span style={{ color: '#3fb950' }}>✓</span>
              : <span style={{ color: '#3d444d' }}>✓</span>

            return (
              <div key={g.id} className="py-[3px]">
                {/* 主行 */}
                <div
                  className={`flex items-start gap-1.5 text-[11px] leading-relaxed select-none ${hasDetail ? 'cursor-pointer hover:bg-[rgba(255,255,255,0.03)] rounded px-0.5' : ''}`}
                  onClick={hasDetail ? () => toggle(g.id) : undefined}
                >
                  {/* 状态图标 */}
                  <span className="w-3.5 shrink-0 text-[12px]">{statusIcon}</span>

                  {/* Tag 标签 */}
                  {g.tag && (
                    <span className="shrink-0 w-[72px] text-[10px] font-bold truncate" style={{ color: tagColor }}>
                      {toolName ?? g.tag}
                    </span>
                  )}

                  {/* 分隔符 */}
                  {g.tag && <span className="shrink-0 text-[#3d444d]">·</span>}

                  {/* 内容 */}
                  <span className="flex-1 min-w-0 break-words" style={{ color: titleColor }}>
                    {g.content}
                    {isRunning && <span className="ml-0.5 text-[#58a6ff]">▌</span>}
                  </span>

                  {/* 展开箭头 */}
                  {hasDetail && (
                    <span className="shrink-0 text-[9px] text-[#3d444d] ml-1">
                      {isExpanded ? '▴' : '▾'}
                    </span>
                  )}
                </div>

                {/* Tool result 展开内容 */}
                {hasDetail && isExpanded && (
                  <div className="ml-5 mt-0.5 mb-1 pl-2.5 border-l-2 border-[#21262d] text-[10px] leading-relaxed" style={{ color: '#6e7681' }}>
                    {g.detail}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

// defaultPipeline kept for reference — pipeline is now built by WorkflowConfigModal
export function defaultPipeline(): PipelineStep[] {
  return [
    { id: 'new-1', name: '需求拆解', agentName: 'Product Agent', status: 'queued', updatedAt: '--:--' },
    { id: 'new-2', name: '架构评审', agentName: 'Architect Agent', status: 'queued', updatedAt: '--:--' },
    { id: 'new-3', name: '开发实现', agentName: 'Dev Agent', status: 'queued', updatedAt: '--:--' },
    { id: 'new-4', name: '自动化测试', agentName: 'QA Agent', status: 'queued', updatedAt: '--:--' },
  ]
}
