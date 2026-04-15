import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash2, Play, Copy, Check, Loader2, AlertTriangle, Pencil, Settings } from 'lucide-react'
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
  const [launchReqId, setLaunchReqId] = useState<string | null>(null)
  const [launchPromptText, setLaunchPromptText] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [launchCopied, setLaunchCopied] = useState(false)
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

  // 点击流程节点时调用 API 获取详情
  useEffect(() => {
    if (!activeNode || !selectedReq) { resetStepDetail(); return }
    fetchStepDetail({
      agentName: activeNode.agentName,
      agentRole: activeNode.role ?? '',
      stepName: activeNode.name,
      status: activeNode.status,
      commands: activeNode.commands ?? '',
      reqTitle: selectedReq.title,
      reqSummary: selectedReq.summary,
    })
  }, [activeNode?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
    const req = requirements.find((r) => r.id === reqId)
    if (!req) return
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    patchMutation.mutate({
      projectId: project.id,
      reqId,
      status: 'running',
      pipeline: req.pipeline.map((step, idx) =>
        idx === 0 ? { ...step, status: 'running' as PipelineStepStatus, updatedAt: now } : step,
      ),
    })
    setLaunchReqId(null)
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

                  {/* Flowchart body */}
                  <div className="flex-1 overflow-auto p-5">
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
              {/* 加载中 */}
              {isDetailLoading && (
                <div className="flex flex-col items-center gap-3 py-10 text-[var(--text-3)]">
                  <Loader2 size={20} className="animate-spin text-[var(--accent)]" />
                  <span className="text-xs">正在分析步骤详情…</span>
                </div>
              )}

              {/* 加载完成 */}
              {!isDetailLoading && stepDetail && (
                <div className="space-y-5">
                  {/* summary */}
                  <p className="text-[12px] leading-relaxed text-[var(--text-2)]">{stepDetail.summary}</p>

                  {/* ── queued: 执行计划 ── */}
                  {stepDetail.plan && (
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">执行计划</p>
                      <p className="text-[12px] leading-relaxed text-[var(--text-2)]">{stepDetail.plan.description}</p>
                      {stepDetail.plan.commandDetails.length > 0 && (
                        <div className="space-y-1.5">
                          {stepDetail.plan.commandDetails.map((cmd, i) => (
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
                        <span className="font-semibold text-[var(--text-2)]">约 {stepDetail.plan.estimatedMinutes} 分钟</span>
                      </div>
                    </div>
                  )}

                  {/* ── running: 执行进度 ── */}
                  {stepDetail.progress && (
                    <div className="space-y-3">
                      {/* 当前命令 */}
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">当前执行</p>
                        <div className="flex items-center gap-2 rounded-xl border border-[rgba(88,166,255,0.3)] bg-[rgba(88,166,255,0.06)] px-3 py-2">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#58a6ff]" />
                          <span className="font-mono text-[12px] font-bold text-[#58a6ff]">{stepDetail.progress.currentCommand}</span>
                          <span className="text-[11px] text-[var(--text-3)]">· 进行中</span>
                          <span className="ml-auto text-[10px] text-[var(--text-3)]">开始于 {stepDetail.progress.startedAt}</span>
                        </div>
                      </div>
                      {/* 日志 */}
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">执行日志</p>
                        <div className="rounded-xl border border-[var(--border)] bg-[#0d1117] px-3 py-2.5 space-y-1 font-mono max-h-[160px] overflow-y-auto">
                          {stepDetail.progress.logLines.map((line, i) => {
                            const isLast = i === stepDetail.progress!.logLines.length - 1
                            return (
                              <div key={i} className="flex items-start gap-2 text-[10px] leading-relaxed">
                                <span className="shrink-0 text-[var(--text-3)]">{line.time}</span>
                                <span className={isLast ? 'text-[#58a6ff]' : 'text-[#8b949e]'}>{line.text}</span>
                                {isLast && <span className="animate-pulse text-[#58a6ff]">▌</span>}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)]">
                        <span>预计剩余</span>
                        <span className="font-semibold text-[#58a6ff]">约 {stepDetail.progress.estimatedRemainingMinutes} 分钟</span>
                      </div>
                    </div>
                  )}

                  {/* ── done: 产出物 ── */}
                  {stepDetail.artifacts && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">产出物</p>
                        {stepDetail.duration && (
                          <span className="rounded-full border border-[rgba(63,185,80,0.3)] bg-[rgba(63,185,80,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[#3fb950]">
                            {stepDetail.duration}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {stepDetail.artifacts.map((art) => (
                          <div key={art.name} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px]">{artifactIcon(art.type)}</span>
                              <span className="text-[12px] font-semibold text-[var(--text-1)]">{art.name}</span>
                              <span className="ml-auto rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text-3)]">{art.type}</span>
                            </div>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-2)]">{art.summary}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── blocked: 阻塞原因 ── */}
                  {stepDetail.blockedReason && (
                    <div className="rounded-xl border border-[rgba(248,81,73,0.3)] bg-[rgba(248,81,73,0.06)] px-4 py-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-[#f85149]">
                        <AlertTriangle size={13} />
                        <span className="text-[12px] font-semibold">阻塞原因</span>
                      </div>
                      <p className="text-[12px] leading-relaxed text-[var(--text-2)]">{stepDetail.blockedReason}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 加载失败时降级到静态内容 */}
              {!isDetailLoading && !stepDetail && (
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

      {/* ── Step 2: 工作流配置 Modal — key 确保每次打开都是全新状态 */}
      <WorkflowConfigModal
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
    step.status === 'done'    ? 'border-[#30363d] bg-[#0d1117]' :
    step.status === 'running' ? 'border-[rgba(88,166,255,0.55)] bg-[rgba(88,166,255,0.06)] shadow-[0_0_12px_rgba(88,166,255,0.18)]' :
    step.status === 'blocked' ? 'border-[rgba(248,81,73,0.55)] bg-[rgba(248,81,73,0.06)]' :
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
    done:    { label: '已完成', cls: 'text-[#3fb950] border-[rgba(63,185,80,0.3)]  bg-[rgba(63,185,80,0.1)]' },
    running: { label: '进行中', cls: 'text-[#58a6ff] border-[rgba(88,166,255,0.3)] bg-[rgba(88,166,255,0.1)]' },
    blocked: { label: '阻塞',   cls: 'text-[#f85149] border-[rgba(248,81,73,0.3)]  bg-[rgba(248,81,73,0.1)]' },
    queued:  { label: '未开始', cls: 'text-[var(--text-3)] border-[var(--border)] bg-transparent' },
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

// defaultPipeline kept for reference — pipeline is now built by WorkflowConfigModal
export function defaultPipeline(): PipelineStep[] {
  return [
    { id: 'new-1', name: '需求拆解', agentName: 'Product Agent', status: 'queued', updatedAt: '--:--' },
    { id: 'new-2', name: '架构评审', agentName: 'Architect Agent', status: 'queued', updatedAt: '--:--' },
    { id: 'new-3', name: '开发实现', agentName: 'Dev Agent', status: 'queued', updatedAt: '--:--' },
    { id: 'new-4', name: '自动化测试', agentName: 'QA Agent', status: 'queued', updatedAt: '--:--' },
  ]
}
