import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash2, Loader2, AlertTriangle, Pencil, Settings, FileText, X, GitBranch } from 'lucide-react'
import { ProjectSettingsModal } from '@/components/project/ProjectSettingsModal'
import { CommanderChatPanel } from '@/components/requirements/CommanderChatPanel'
import { WorkshopPanel } from '@/components/requirements/WorkshopPanel'
import { PipelineTopBar } from '@/components/requirements/PipelineTopBar'
import { GitStatusStrip } from '@/components/requirements/GitStatusStrip'
import { GitActionsMenu } from '@/components/requirements/GitActionsMenu'
import { ArtifactSidebar } from '@/components/requirements/ArtifactSidebar'
import { Badge } from '@/components/ui/Badge'
import { LogStream } from '@/components/ui/LogStream'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { WorkflowConfigModal } from '@/components/requirements/WorkflowConfigModal'
import { TEAM_MEMBERS } from '@/types/project'
import { cn } from '@/lib/utils'
import { computeStatCounts } from '@/lib/computeStatCounts'
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
import type {
  PipelineStep,
  PipelineStepStatus,
  Requirement,
  RequirementPriority,
  RequirementStatus,
  StoryStatus,
  StepArtifact,
  StepDetailResponse,
  ReviewPolicy,
} from '@/types/project'
import { DEFAULT_REVIEW_POLICY } from '@/types/project'
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dismissModalStep, setDismissModalStep] = useState<PipelineStep | null>(null)
  const [dismissForm, setDismissForm] = useState({ lessonTitle: '', correctApproach: '', background: '', promoteToRule: false })
  // log streaming is handled inside <LogStream> component
  const [artifactSidebarOpen, setArtifactSidebarOpen] = useState(false)
  const [viewingArtifact, setViewingArtifact] = useState<{ step: PipelineStep; art: StepArtifact } | null>(null)
  const [artifactContent, setArtifactContent] = useState<{ content: string; format: string } | null>(null)
  const [isArtifactLoading, setIsArtifactLoading] = useState(false)
  const [form, setForm] = useState<NewReqForm>({
    title: '',
    summary: '',
    priority: 'P1',
    assigneeId: project?.memberIds[0] ?? TEAM_MEMBERS[0]?.id ?? '',
  })

  useEffect(() => {
    if (!project) return
    setForm((prev) => {
      if (prev.assigneeId && project.memberIds.includes(prev.assigneeId)) return prev
      return {
        ...prev,
        assigneeId: project.memberIds[0] ?? TEAM_MEMBERS[0]?.id ?? '',
      }
    })
  }, [project])

  // 数据加载后自动选中第一条
  useEffect(() => {
    if (requirements.length > 0 && !selectedReqId) {
      setSelectedReqId(requirements[0].id)
    }
  }, [requirements, selectedReqId])

  // 互斥分类：每条需求仅归入一个桶，求和 === requirements.length
  const statCounts = useMemo(() => computeStatCounts(requirements), [requirements])

  const {
    queued: queuedCount,
    running: runningCount,
    pendingApproval: pendingApprovalCount,
    pendingInput: pendingInputCount,
    blocked: blockedCount,
    done: doneCount,
  } = statCounts

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

    // done 步骤且有真实产出物（来自 Commander 流水线执行）→ 直接使用，不调 LLM
    if (activeNode.status === 'done' && activeNode.artifacts && activeNode.artifacts.length > 0) {
      setStableDetail({
        status: 'done',
        summary: `${activeNode.agentName} 已完成「${activeNode.name}」`,
        artifacts: activeNode.artifacts.map((a) => ({
          name: a.name,
          type: a.type as StepArtifact['type'],
          summary: a.summary,
        })),
      })
    } else {
      // 其他状态：调 LLM 获取步骤详情
      fetchStepDetail({
        agentName: activeNode.agentName,
        agentRole: activeNode.role ?? '',
        stepName: activeNode.name,
        status: activeNode.status,
        commands: activeNode.commands ?? '',
        reqTitle: selectedReq.title,
        reqSummary: selectedReq.summary,
      })
    }

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

  const [artifactRetryKey, setArtifactRetryKey] = useState(0)

  useEffect(() => {
    if (!viewingArtifact || !selectedReq) { setArtifactContent(null); return }
    let cancelled = false
    setArtifactContent(null)
    setIsArtifactLoading(true)
    const payload = {
      agentName: viewingArtifact.step.agentName,
      agentRole: viewingArtifact.step.role ?? '',
      artifactName: viewingArtifact.art.name,
      artifactType: viewingArtifact.art.type,
      stepName: viewingArtifact.step.name,
      reqTitle: selectedReq.title,
      reqSummary: selectedReq.summary,
      reqId: selectedReq.id,
      stepId: viewingArtifact.step.id,
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 30000)
    fetch('/api/v1/artifacts/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (!cancelled && data?.content) {
          setArtifactContent(data)
          setIsArtifactLoading(false)
        } else if (!cancelled) {
          setArtifactContent(null)
          setIsArtifactLoading(false)
        }
      })
      .catch(() => { if (!cancelled) { setArtifactContent(null); setIsArtifactLoading(false) } })
    return () => { cancelled = true; clearTimeout(timer); ctrl.abort() }
  }, [viewingArtifact, artifactRetryKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setArtifactSidebarOpen(false)
  }, [selectedReqId])

  // PR 状态轮询：open / changes_requested 时 30s 刷新
  useEffect(() => {
    if (!project?.id || !selectedReq?.id) return
    const prState = selectedReq.gitInfo?.prState
    if (!prState || prState === 'approved' || prState === 'merged' || prState === 'closed') return

    let cancelled = false
    const poll = () => {
      if (cancelled) return
      fetch(`/api/v1/projects/${project.id}/requirements/${selectedReq.id}/git/pr-status`)
        .catch(() => {})
    }
    const timer = setInterval(poll, 30_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [project?.id, selectedReq?.id, selectedReq?.gitInfo?.prState])

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
            assigneeId: project.memberIds[0] ?? TEAM_MEMBERS[0]?.id ?? '',
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
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg-base)]">
      {/* ── Page Hero Header ── */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-base)]">
        <div className="mx-auto w-full max-w-[1600px] px-6 py-6">
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
              {/* 介入组 — 暖色背景 */}
              <div
                className="flex items-center gap-3 rounded-lg px-3 py-1.5"
                style={{ backgroundColor: 'var(--attention-surface)' }}
              >
                <StatChip label="待审批" value={pendingApprovalCount} color="var(--warning)" />
                <StatChip label="阻塞" value={blockedCount} color="var(--danger)" />
                <StatChip label="待输入" value={pendingInputCount} color="var(--amber)" />
              </div>

              {/* 分隔线 */}
              <div className="h-6 w-px bg-[var(--border)]" />

              {/* 进度组 */}
              <div className="flex items-center gap-3">
                <StatChip label="执行中" value={runningCount} color="var(--blue)" />
                <StatChip label="待执行" value={queuedCount} color="var(--text-3)" />
                <StatChip label="已完成" value={doneCount} color="var(--success)" />
              </div>

              {/* 总数 */}
              <span className="text-xs tabular-nums text-[var(--text-3)]">
                共 {requirements.length}
              </span>
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
          hasRunningRequirements={requirements.some((r) => r.status === 'running')}
        />
      )}

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-6 py-6 min-h-0">
        {true && (
          <section className="flex flex-1 gap-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] min-h-0">
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
              <div className="min-h-0 flex-1 overflow-y-auto space-y-1.5 p-2">
                {filteredReqs.length === 0 && (
                  <p className="py-6 text-center text-[12px] text-[var(--text-3)]">暂无需求</p>
                )}
                {filteredReqs.map((req) => {
                  const isBlocked = req.status === 'blocked'
                  const isSelected = req.id === selectedReqId
                  const activeStep =
                    req.pipeline.find((s) => s.status === 'running' || s.status === 'blocked') ??
                    req.stories.flatMap((st) => st.pipeline).find((s) => s.status === 'running' || s.status === 'blocked')
                  const pendingApprovalStep = req.pipeline.find(
                    (s) => s.status === 'pending_approval' || s.status === 'pending_advisory_approval',
                  )
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
                            pendingApprovalStep ? 'text-[#ff9f0a]'
                              : isBlocked ? 'text-[#f85149]'
                              : 'text-[var(--text-3)]',
                          )}
                        >
                          {pendingApprovalStep
                            ? `🟠 ${pendingApprovalStep.agentName} 待审批`
                            : activeStep
                              ? `${activeStep.agentName} ${isBlocked ? '⚠ 阻塞' : '执行中'}`
                              : req.status === 'done'
                                ? '✓ 已完成'
                                : '待启动'}
                        </span>
                        <span className="text-[var(--text-3)]">{pendingApprovalStep?.updatedAt ?? activeStep?.updatedAt ?? '--'}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Right: main content area ── */}
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
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
                            {selectedReq.pipeline.some((s) => s.status !== 'queued') && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-[rgba(88,166,255,0.25)] bg-[rgba(88,166,255,0.08)] px-1.5 py-0.5 font-mono text-[10px] text-[#58a6ff]">
                                <GitBranch size={10} />
                                req/{selectedReq.code}
                              </span>
                            )}
                          </div>
                          <h3 className="mt-1.5 text-[13px] font-semibold leading-snug text-[var(--text-1)]">{selectedReq.title}</h3>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--text-2)]">{selectedReq.summary}</p>
                        </div>
                        {/* Action buttons */}
                        <div className="mt-0.5 flex shrink-0 items-center gap-1">
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
                          <GitActionsMenu
                            projectId={project.id}
                            reqId={selectedReq.id}
                            gitInfo={selectedReq.gitInfo}
                            hasRepository={!!project.settings?.repository}
                          />
                        </div>
                      </div>
                  </div>

                  {/* Pipeline top bar */}
                  <PipelineTopBar
                    requirement={selectedReq}
                    activeNodeId={activeNode?.id ?? null}
                    onStepClick={(step) => setActiveNode(activeNode?.id === step.id ? null : step)}
                  />

                  {/* Git status strip */}
                  <div className="px-4 py-1">
                    <GitStatusStrip
                      gitInfo={selectedReq.gitInfo}
                      hasRepository={!!project.settings?.repository}
                    />
                  </div>

                  {/* Chat area + artifact sidebar */}
                  <div className="relative min-h-0 flex-1 overflow-hidden">
                    {selectedReq.pipeline.some(s =>
                      typeof s.status === 'string' && s.status.startsWith('workshop_')
                    ) ? (
                      <WorkshopPanel
                        projectId={project.id}
                        requirement={selectedReq}
                        onViewArtifact={(stepId, art) => {
                          const step = selectedReq.pipeline.find((s) => s.id === stepId)
                          if (step) {
                            setViewingArtifact({ step, art: { name: art.name, type: art.type as StepArtifact['type'], summary: art.summary } })
                          }
                        }}
                      />
                    ) : (
                      <CommanderChatPanel
                        projectId={project.id}
                        requirement={selectedReq}
                        onApproveStep={handleApproveStep}
                        onDismissAdvisory={(step) => {
                          setDismissForm({ lessonTitle: '', correctApproach: '', background: '', promoteToRule: false })
                          setDismissModalStep(step)
                        }}
                        onViewArtifact={(stepId, art) => {
                          const step = selectedReq.pipeline.find((s) => s.id === stepId)
                          if (step) {
                            setViewingArtifact({ step, art: { name: art.name, type: art.type as StepArtifact['type'], summary: art.summary } })
                          }
                        }}
                        isApproving={approveStepMutation.isPending}
                      />
                    )}
                    <ArtifactSidebar
                      open={artifactSidebarOpen}
                      onToggle={() => setArtifactSidebarOpen((prev) => !prev)}
                      requirement={selectedReq}
                      onViewArtifact={(step, art) => setViewingArtifact({ step, art })}
                    />
                  </div>
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

            {/* ── 审查策略 编辑 ── */}
            {selectedReq && (() => {
              const policy: ReviewPolicy = activeNode.reviewPolicy ?? { ...DEFAULT_REVIEW_POLICY }
              const ITEMS: { key: keyof ReviewPolicy; label: string }[] = [
                { key: 'stepPause',   label: '命令间暂停' },
                { key: 'adversarial', label: '对抗性审查' },
                { key: 'edgeCase',    label: '边界用例审查' },
                { key: 'structural',  label: '结构完整性审查' },
              ]
              const handleToggle = (key: keyof ReviewPolicy) => {
                const updated = { ...policy, [key]: !policy[key] }
                const newPipeline = selectedReq.pipeline.map((s) =>
                  s.id === activeNode.id ? { ...s, reviewPolicy: updated } : s,
                )
                patchMutation.mutate({ projectId: project.id, reqId: selectedReq.id, pipeline: newPipeline })
              }
              return (
                <div className="shrink-0 border-t border-[var(--border)] px-5 py-3">
                  <p className="mb-2 text-[10px] font-semibold text-[var(--text-3)]">审查策略</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ITEMS.map(({ key, label }) => {
                      const on = policy[key]
                      return (
                        <button
                          key={key}
                          onClick={() => handleToggle(key)}
                          className={cn(
                            'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all',
                            on
                              ? 'border-[rgba(52,199,89,0.5)] bg-[rgba(52,199,89,0.1)] text-[#3fb950]'
                              : 'border-[var(--border)] bg-[var(--bg-panel-3)] text-[var(--text-2)] hover:border-[rgba(52,199,89,0.3)] hover:text-[var(--text-1)]',
                          )}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
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
                      const m = TEAM_MEMBERS.find((x) => x.id === memberId)
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
                      const m = TEAM_MEMBERS.find((x) => x.id === mid)
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
                <MarkdownRenderer content={artifactContent.content} />
              )}
              {!isArtifactLoading && !artifactContent && (
                <div className="flex flex-col items-center gap-3 py-10 text-[var(--text-3)]">
                  <FileText size={24} strokeWidth={1.5} />
                  <span className="text-xs">内容加载失败</span>
                  <button
                    onClick={() => setArtifactRetryKey((k) => k + 1)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--accent)] transition-colors"
                  >
                    重试
                  </button>
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

function memberName(memberId: string) {
  return TEAM_MEMBERS.find((m) => m.id === memberId)?.name ?? memberId
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[48px]">
      <span className="text-xl font-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[10px] text-[var(--text-3)]">{label}</span>
    </div>
  )
}



// defaultPipeline kept for reference — pipeline is now built by WorkflowConfigModal
export function defaultPipeline(): PipelineStep[] {
  return [
    { id: 'new-1', name: '需求拆解', agentName: 'Product Agent', status: 'queued', updatedAt: '--:--' },
    { id: 'new-2', name: '架构评审', agentName: 'Architect Agent', status: 'queued', updatedAt: '--:--' },
    { id: 'new-3', name: '开发实现', agentName: 'Dev Agent', status: 'queued', updatedAt: '--:--' },
    { id: 'new-4', name: '自动化测试', agentName: 'QA Agent', status: 'queued', updatedAt: '--:--' },
  ]
}
