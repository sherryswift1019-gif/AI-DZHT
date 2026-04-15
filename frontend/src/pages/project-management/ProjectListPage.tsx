import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { mockMembers } from '@/mocks/data/projects'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { Project, ProjectStatus } from '@/types/project'
import {
  useCreateProject,
  useDeleteProject,
  usePatchProject,
  useProjectList,
  useProjectRequirementStats,
} from '@/hooks/useProjects'

type ProjectForm = {
  name: string
  description: string
  ownerId: string
  startDate: string
  endDate: string
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
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

export function ProjectListPage() {
  const navigate = useNavigate()
  const { data: projects = [], isLoading, isError } = useProjectList()
  const createMutation = useCreateProject()
  const patchMutation = usePatchProject()
  const deleteMutation = useDeleteProject()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all')
  const [openCreate, setOpenCreate] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [form, setForm] = useState<ProjectForm>({
    name: '',
    description: '',
    ownerId: mockMembers[0]?.id ?? '',
    startDate: '',
    endDate: '',
  })

  const projectIds = useMemo(() => projects.map((p) => p.id), [projects])
  const { data: reqOverview = {} } = useProjectRequirementStats(projectIds)

  const activeCount = projects.filter((p) => p.status === 'active').length
  const planningCount = projects.filter((p) => p.status === 'planning').length
  const totalReqs = Object.values(reqOverview).reduce((acc, p) => acc + p.stats.total, 0)

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchKeyword =
        !keyword ||
        p.name.toLowerCase().includes(keyword.toLowerCase()) ||
        p.description.toLowerCase().includes(keyword.toLowerCase()) ||
        p.code.toLowerCase().includes(keyword.toLowerCase())
      const matchStatus = status === 'all' || p.status === status
      return matchKeyword && matchStatus
    })
  }, [projects, keyword, status])

  const emptyForm = (): ProjectForm => ({
    name: '',
    description: '',
    ownerId: mockMembers[0]?.id ?? '',
    startDate: '',
    endDate: '',
  })

  const createProject = () => {
    if (!form.name.trim()) return
    createMutation.mutate(
      {
        name: form.name.trim(),
        description: form.description.trim() || '暂无描述',
        ownerId: form.ownerId,
        memberIds: [form.ownerId],
        status: 'planning',
        color: '#0A84FF',
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        budget: 0,
        context: { industry: '', techStack: [], conventions: [] },
      },
      {
        onSuccess: () => {
          setOpenCreate(false)
          setForm(emptyForm())
        },
      },
    )
  }

  const saveEditProject = () => {
    if (!editing || !form.name.trim()) return
    patchMutation.mutate(
      {
        projectId: editing.id,
        name: form.name.trim(),
        description: form.description.trim() || editing.description,
        ownerId: form.ownerId,
        memberIds: editing.memberIds.includes(form.ownerId)
          ? editing.memberIds
          : [form.ownerId, ...editing.memberIds],
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      },
      {
        onSuccess: () => {
          setEditing(null)
          setForm(emptyForm())
        },
      },
    )
  }

  const removeProject = (projectId: string) => {
    deleteMutation.mutate(
      { projectId },
      {
        onSuccess: () => {
          setDeleteTarget(null)
        },
      },
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-base)]">
      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-8">
        {/* Page Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)] mb-1">项目管理</p>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-1)]">项目列表</h1>
            <p className="text-sm text-[var(--text-2)] mt-1">管理团队研发项目与需求流水线</p>
          </div>
          <div className="flex items-end gap-4">
            <Stat label="进行中" value={activeCount} variant="blue" />
            <Stat label="规划中" value={planningCount} variant="teal" />
            <Stat label="需求总数" value={totalReqs} variant="gray" />
            <div className="ml-2">
              <button
                onClick={() => setOpenCreate(true)}
                className="flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-all h-9"
              >
                <Plus size={13} />
                新建项目
              </button>
            </div>
          </div>
        </div>

        <section className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
            <input
              className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] pl-9 pr-3 text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
              placeholder="搜索项目名 / 编号 / 描述"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          {(['all', 'active', 'planning', 'paused', 'done'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs',
                status === s
                  ? 'border-[rgba(10,132,255,0.25)] bg-[var(--accent-sub)] text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)]',
              )}
            >
              {s === 'all' ? '全部状态' : STATUS_LABEL[s]}
            </button>
          ))}

        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {isLoading && (
            <div className="col-span-full rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-6 text-center text-sm text-[var(--text-2)]">
              正在加载项目列表...
            </div>
          )}

          {isError && (
            <div className="col-span-full rounded-xl border border-[rgba(255,69,58,0.3)] bg-[var(--danger-sub)] px-4 py-6 text-center text-sm text-[var(--danger)]">
              项目列表加载失败，请检查后端服务是否可用
            </div>
          )}

          {filtered.map((project) => {
            const overview = reqOverview[project.id]
            const req = overview?.stats ?? {
              total: 0,
              done: 0,
              running: 0,
              blocked: 0,
              queued: 0,
            }
            const reqCount = req.total
            const activePipes = overview?.active ?? []
            const owner = mockMembers.find((m) => m.id === project.ownerId)
            return (
              <article
                key={project.id}
                className="flex cursor-pointer flex-col overflow-hidden rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--bg-panel)] transition-all hover:-translate-y-0.5 hover:border-[rgba(88,166,255,0.4)] hover:shadow-[0_8px_24px_rgba(0,0,0,.35)]"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                {/* Color band */}
                <div
                  className="h-1 shrink-0"
                  style={{ background: `linear-gradient(90deg,${project.color},${project.color}88)` }}
                />

                {/* Card body */}
                <div className="flex-1 px-[18px] py-4">
                  {/* Top row: emoji + name/code + status badge */}
                  <div className="mb-2.5 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-[18px] leading-none">
                        {PROJECT_EMOJI[project.id] ?? '📁'}
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate text-[15px] font-bold text-[var(--text-1)]">
                          {project.name}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--text-3)]">{project.code}</span>
                      </div>
                    </div>
                    <Badge variant={STATUS_BADGE[project.status]} className="shrink-0">
                      {STATUS_LABEL[project.status]}
                    </Badge>
                  </div>

                  {/* Description */}
                  <p className="mb-3 line-clamp-2 text-[12px] leading-[1.5] text-[var(--text-2)]">
                    {project.description}
                  </p>

                  {/* Active pipeline pills */}
                  <div className="mb-3 flex flex-wrap gap-1">
                    {activePipes.length === 0 ? (
                      <span className="text-[11px] text-[var(--text-3)]">— 无运行中的流水线</span>
                    ) : (
                      activePipes.map((pipe) => (
                        <span
                          key={pipe.id}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]',
                            pipe.status === 'blocked'
                              ? 'border-[rgba(210,153,34,0.3)] bg-[var(--warning-sub)] text-[var(--warning)]'
                              : 'border-[rgba(31,111,235,0.3)] bg-[#1f2d3d] text-[#79c0ff]',
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 shrink-0 rounded-full',
                              pipe.status === 'blocked' ? 'bg-[var(--warning)]' : 'animate-pulse bg-[#58a6ff]',
                            )}
                          />
                          {pipe.code}&nbsp;{pipe.status === 'blocked' ? '阻塞' : '执行中'}
                        </span>
                      ))
                    )}
                  </div>

                  {/* Segmented progress bar */}
                  <div className="mb-3.5 flex h-[6px] overflow-hidden rounded-full bg-[#21262d]">
                    <div className="bg-[#3fb950]" style={{ width: `${reqCount ? (req.done / reqCount) * 100 : 0}%` }} />
                    <div className="bg-[#58a6ff]" style={{ width: `${reqCount ? (req.running / reqCount) * 100 : 0}%` }} />
                    <div className="bg-[#d29922]" style={{ width: `${reqCount ? (req.blocked / reqCount) * 100 : 0}%` }} />
                    <div className="bg-[#30363d]" style={{ width: `${reqCount ? (req.queued / reqCount) * 100 : 0}%` }} />
                  </div>

                  {/* Req counts — 4 numbers */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className="text-base font-bold text-[#3fb950]">{req.done}</span>
                      <span className="mt-0.5 text-[9px] text-[var(--text-3)]">已完成</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-base font-bold text-[#58a6ff]">{req.running}</span>
                      <span className="mt-0.5 text-[9px] text-[var(--text-3)]">执行中</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-base font-bold text-[#d29922]">{req.blocked}</span>
                      <span className="mt-0.5 text-[9px] text-[var(--text-3)]">等待审批</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-base font-bold text-[var(--text-2)]">{req.queued}</span>
                      <span className="mt-0.5 text-[9px] text-[var(--text-3)]">待启动</span>
                    </div>
                  </div>
                </div>

                {/* Card footer */}
                <div className="flex items-center justify-between gap-2 border-t border-[#21262d] px-[18px] py-2.5">
                  <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--text-2)]">
                    <span>👤&nbsp;{owner?.name ?? '未分配'}</span>
                    {project.endDate && (
                      <span>📅&nbsp;截止 {project.endDate.slice(5).replace('-', '/')}</span>
                    )}
                    {project.budget !== undefined && project.budget > 0 && (
                      <span>💰&nbsp;¥{project.budget.toLocaleString()}</span>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setEditing(project)
                          setForm({
                            name: project.name,
                            description: project.description,
                            ownerId: project.ownerId,
                            startDate: project.startDate ?? '',
                            endDate: project.endDate ?? '',
                          })
                      }}
                      className="rounded border border-transparent px-2 py-1 text-[11px] text-[var(--text-2)] transition-all hover:border-[var(--border)] hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-1)]"
                    >
                      <Pencil size={10} className="mr-0.5 inline" />
                      编辑
                    </button>
                    <button
                      onClick={() => setDeleteTarget(project)}
                      className="rounded border border-[rgba(255,69,58,0.3)] bg-[var(--danger-sub)] px-2 py-1 text-[11px] text-[var(--danger)]"
                    >
                      <Trash2 size={10} className="mr-0.5 inline" />
                      删除
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </section>

        {filtered.length === 0 && (
          <section className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-panel)] px-6 py-14 text-center">
            <p className="text-sm font-semibold text-[var(--text-1)]">没有找到匹配项目</p>
            <p className="mt-1 text-xs text-[var(--text-2)]">试试调整搜索词或状态筛选条件</p>
          </section>
        )}
      </main>

      {(openCreate || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-[580px] flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-[var(--shadow-lg)]">
            <div className="shrink-0 border-b border-[var(--border)] px-5 py-4">
              <h2 className="text-sm font-semibold text-[var(--text-1)]">{editing ? '编辑项目' : '新建项目'}</h2>
              <p className="mt-1 text-xs text-[var(--text-2)]">填写基本信息，创建后可在项目设置中配置上下文与环境地址</p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <Field label="项目名称" required>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="例：智能交付工厂"
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
                />
              </Field>

              <Field label="项目负责人" required>
                <select
                  value={form.ownerId}
                  onChange={(e) => setForm((prev) => ({ ...prev, ownerId: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
                >
                  {mockMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.role}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="项目描述">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  placeholder="简述项目背景与目标"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2 text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="开始时间">
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
                  />
                </Field>
                <Field label="截止时间">
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
                  />
                </Field>
              </div>
            </div>

            <div className="shrink-0 flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
              <button
                onClick={() => {
                  setOpenCreate(false)
                  setEditing(null)
                }}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-2)]"
              >
                取消
              </button>
              <button
                onClick={editing ? saveEditProject : createProject}
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white"
              >
                {editing ? '保存修改' : '创建项目'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[560px] rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h3 className="text-sm font-semibold text-[var(--text-1)]">删除项目确认</h3>
              <p className="mt-1 text-xs text-[var(--text-2)]">删除项目会同时移除该项目下的需求与流水线视图</p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-3">
                <p className="text-xs text-[var(--text-2)]">目标项目</p>
                <p className="text-sm font-semibold text-[var(--text-1)]">
                  {deleteTarget.code} · {deleteTarget.name}
                </p>
              </div>
              <div className="rounded-xl border border-[rgba(255,159,10,0.25)] bg-[var(--warning-sub)] p-3 text-xs text-[var(--warning)]">
                影响扫描结果：将删除该项目配置、成员分配关系和需求视图。请确保已完成数据备份。
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
                onClick={() => removeProject(deleteTarget.id)}
                className="rounded-lg border border-[rgba(255,69,58,0.3)] bg-[var(--danger-sub)] px-3 py-1.5 text-xs font-semibold text-[var(--danger)]"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--text-2)]">
        {label}
        {required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
      </span>
      {children}
    </label>
  )
}

function Stat({ label, value, variant }: { label: string; value: number; variant: 'blue' | 'teal' | 'gray' }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-xl font-bold tabular-nums text-[var(--text-1)]">{value}</span>
      <Badge variant={variant} className="text-[10px]">{label}</Badge>
    </div>
  )
}