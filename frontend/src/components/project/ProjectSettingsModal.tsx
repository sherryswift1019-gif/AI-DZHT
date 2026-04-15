import { useEffect, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { mockMembers } from '@/mocks/data/projects'
import type { EnvLink, Project, ProjectContext, ProjectSettings, ProjectStatus } from '@/types/project'
import { usePatchProject } from '@/hooks/useProjects'

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'basic' | 'environments' | 'context'

type BasicForm = {
  name: string
  description: string
  ownerId: string
  status: ProjectStatus
  startDate: string
  endDate: string
  color: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'basic', label: '基本信息' },
  { key: 'environments', label: '环境配置' },
  { key: 'context', label: '项目上下文' },
]

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: '规划中' },
  { value: 'active', label: '进行中' },
  { value: 'paused', label: '已暂停' },
  { value: 'done', label: '已完成' },
]

const COLOR_PRESETS = [
  '#0A84FF', '#30D158', '#FF9F0A', '#FF453A',
  '#BF5AF2', '#64D2FF', '#FFD60A', '#FF6961',
]

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  project: Project
  onClose: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProjectSettingsModal({ open, project, onClose }: Props) {
  const patchMutation = usePatchProject()
  const [activeTab, setActiveTab] = useState<Tab>('basic')

  // Basic form state
  const [basic, setBasic] = useState<BasicForm>(toBasicForm(project))

  // Environments state: repository + envLinks
  const [repository, setRepository] = useState(project.settings?.repository ?? '')
  const [envLinks, setEnvLinks] = useState<EnvLink[]>(
    project.settings?.environments ?? [],
  )

  // Context state
  const [context, setContext] = useState<ProjectContext>(
    project.settings?.context ?? project.context ?? { industry: '', techStack: [], conventions: [] },
  )
  const [techStackRaw, setTechStackRaw] = useState(
    (project.settings?.context ?? project.context)?.techStack.join(', ') ?? '',
  )
  const [conventionsRaw, setConventionsRaw] = useState(
    (project.settings?.context ?? project.context)?.conventions.join('\n') ?? '',
  )

  // Reset when project changes
  useEffect(() => {
    setBasic(toBasicForm(project))
    setRepository(project.settings?.repository ?? '')
    setEnvLinks(project.settings?.environments ?? [])
    const ctx = project.settings?.context ?? project.context ?? { industry: '', techStack: [], conventions: [] }
    setContext(ctx)
    setTechStackRaw(ctx.techStack.join(', '))
    setConventionsRaw(ctx.conventions.join('\n'))
  }, [project.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  // ── Env helpers ──────────────────────────────────────────────────────────────

  const addEnv = () => setEnvLinks((prev) => [...prev, { name: '', url: '' }])

  const updateEnv = (idx: number, key: keyof EnvLink, val: string) =>
    setEnvLinks((prev) => prev.map((e, i) => (i === idx ? { ...e, [key]: val } : e)))

  const removeEnv = (idx: number) =>
    setEnvLinks((prev) => prev.filter((_, i) => i !== idx))

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = () => {
    const mergedContext: ProjectContext = {
      industry: context.industry,
      techStack: techStackRaw.split(',').map((s) => s.trim()).filter(Boolean),
      conventions: conventionsRaw.split('\n').map((s) => s.trim()).filter(Boolean),
    }

    const settings: ProjectSettings = {
      repository: repository.trim() || undefined,
      environments: envLinks.filter((e) => e.name.trim() || e.url.trim()),
      context: mergedContext,
    }

    patchMutation.mutate(
      {
        projectId: project.id,
        name: basic.name.trim() || project.name,
        description: basic.description.trim(),
        ownerId: basic.ownerId,
        status: basic.status,
        color: basic.color,
        startDate: basic.startDate || undefined,
        endDate: basic.endDate || undefined,
        context: mergedContext,
        settings,
      },
      {
        onSuccess: () => onClose(),
      },
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[620px] w-full max-w-[680px] flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-[var(--shadow-lg)]">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-1)]">项目设置</h2>
            <p className="mt-0.5 text-xs text-[var(--text-2)]">{project.code} · {project.name}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-3)] hover:text-[var(--text-1)]"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 gap-1 border-b border-[var(--border)] px-4 pt-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'rounded-t-lg border-b-2 px-3 pb-2 text-xs font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── Tab: 基本信息 ── */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <Field label="项目名称" required>
                <input
                  value={basic.name}
                  onChange={(e) => setBasic((p) => ({ ...p, name: e.target.value }))}
                  className={inputCls}
                />
              </Field>

              <Field label="项目负责人" required>
                <select
                  value={basic.ownerId}
                  onChange={(e) => setBasic((p) => ({ ...p, ownerId: e.target.value }))}
                  className={inputCls}
                >
                  {mockMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} · {m.role}</option>
                  ))}
                </select>
              </Field>

              <Field label="项目状态">
                <select
                  value={basic.status}
                  onChange={(e) => setBasic((p) => ({ ...p, status: e.target.value as ProjectStatus }))}
                  className={inputCls}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="项目描述">
                <textarea
                  value={basic.description}
                  onChange={(e) => setBasic((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className={cn(inputCls, 'h-auto py-2')}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="开始时间">
                  <input type="date" value={basic.startDate} onChange={(e) => setBasic((p) => ({ ...p, startDate: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="截止时间">
                  <input type="date" value={basic.endDate} onChange={(e) => setBasic((p) => ({ ...p, endDate: e.target.value }))} className={inputCls} />
                </Field>
              </div>

              <Field label="主题色">
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBasic((p) => ({ ...p, color: c }))}
                      className={cn(
                        'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                        basic.color === c ? 'border-white scale-110' : 'border-transparent',
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </Field>
            </div>
          )}

          {/* ── Tab: 环境配置 ── */}
          {activeTab === 'environments' && (
            <div className="space-y-4">
              <Field label="代码仓库">
                <input
                  value={repository}
                  onChange={(e) => setRepository(e.target.value)}
                  placeholder="https://github.com/org/repo"
                  className={inputCls}
                />
              </Field>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-2)]">环境地址</span>
                  <button
                    type="button"
                    onClick={addEnv}
                    className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-2)] hover:text-[var(--accent)] hover:border-[var(--accent)]"
                  >
                    <Plus size={11} />
                    添加环境
                  </button>
                </div>

                {envLinks.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[var(--border)] py-6 text-center text-xs text-[var(--text-3)]">
                    暂无环境地址，点击「添加环境」新增
                  </div>
                )}

                <div className="space-y-2">
                  {envLinks.map((env, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        value={env.name}
                        onChange={(e) => updateEnv(idx, 'name', e.target.value)}
                        placeholder="环境名称，如：开发环境"
                        className={cn(inputCls, 'w-[160px] shrink-0')}
                      />
                      <input
                        value={env.url}
                        onChange={(e) => updateEnv(idx, 'url', e.target.value)}
                        placeholder="https://dev.example.com"
                        className={cn(inputCls, 'flex-1')}
                      />
                      <button
                        type="button"
                        onClick={() => removeEnv(idx)}
                        className="shrink-0 rounded-lg border border-[rgba(255,69,58,0.3)] bg-[var(--danger-sub)] p-1.5 text-[var(--danger)]"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: 项目上下文 ── */}
          {activeTab === 'context' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[rgba(10,132,255,0.2)] bg-[var(--accent-sub)] px-3.5 py-3 text-xs text-[var(--accent)]">
                项目上下文会作为 AI 对话时的参考背景，让 Agent 更精准地理解你的项目特点。
              </div>

              <Field label="行业领域">
                <input
                  value={context.industry}
                  onChange={(e) => setContext((p) => ({ ...p, industry: e.target.value }))}
                  placeholder="例：SaaS / 企业软件"
                  className={inputCls}
                />
              </Field>

              <Field label="技术栈">
                <input
                  value={techStackRaw}
                  onChange={(e) => setTechStackRaw(e.target.value)}
                  placeholder="逗号分隔，例：React, TypeScript, FastAPI"
                  className={inputCls}
                />
              </Field>

              <Field label="研发规范">
                <textarea
                  value={conventionsRaw}
                  onChange={(e) => setConventionsRaw(e.target.value)}
                  rows={6}
                  placeholder={'每行一条规范，例：\nPRD 变更必须走版本评审\n阻塞超过 2 小时必须触发告警'}
                  className={cn(inputCls, 'h-auto py-2 resize-none')}
                />
              </Field>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-2)]"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={patchMutation.isPending}
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {patchMutation.isPending ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  'h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)]'

function toBasicForm(project: Project): BasicForm {
  return {
    name: project.name,
    description: project.description,
    ownerId: project.ownerId,
    status: project.status,
    startDate: project.startDate ?? '',
    endDate: project.endDate ?? '',
    color: project.color,
  }
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
