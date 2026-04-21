import { useEffect, useState } from 'react'
import { Plus, Trash2, X, Sparkles, ChevronDown, Pencil, ExternalLink, Loader2, CheckCircle2, AlertTriangle, GitBranch, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScrollLock } from '@/hooks/useScrollLock'
import { TEAM_MEMBERS } from '@/types/project'
import type { ContextLesson, EnvLink, GitConfig, Project, ProjectContext, ProjectSettings, ProjectStatus } from '@/types/project'
import { usePatchProject } from '@/hooks/useProjects'

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'basic' | 'environments' | 'context' | 'lessons'

type BasicForm = {
  name: string
  description: string
  ownerId: string
  status: ProjectStatus
  startDate: string
  endDate: string
  color: string
}

type LessonDraft = {
  date: string
  title: string
  background: string
  correctApproach: string
  promotedToRule: boolean
}

const emptyDraft = (): LessonDraft => ({
  date: new Date().toISOString().slice(0, 10),
  title: '',
  background: '',
  correctApproach: '',
  promotedToRule: false,
})

// ── Constants ──────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'basic', label: '基本信息' },
  { key: 'environments', label: '环境配置' },
  { key: 'context', label: '项目上下文' },
  { key: 'lessons', label: '历史教训' },
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
  hasRunningRequirements?: boolean
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProjectSettingsModal({ open, project, onClose, hasRunningRequirements = false }: Props) {
  const patchMutation = usePatchProject()
  const [activeTab, setActiveTab] = useState<Tab>('basic')

  useScrollLock(open)

  // Basic form state
  const [basic, setBasic] = useState<BasicForm>(toBasicForm(project))

  // Environments state: repository + envLinks
  const [repository, setRepository] = useState(project.settings?.repository ?? '')
  const [envLinks, setEnvLinks] = useState<EnvLink[]>(
    project.settings?.environments ?? [],
  )

  // Git config state
  const existingGitConfig = project.settings?.gitConfig
  const [githubToken, setGithubToken] = useState('')  // 不回显 Token，只显示脱敏
  const [showToken, setShowToken] = useState(false)
  const [autoCreatePR, setAutoCreatePR] = useState(existingGitConfig?.autoCreatePR ?? false)
  const [autoReview, setAutoReview] = useState(existingGitConfig?.autoReview ?? false)
  const [defaultBranch, setDefaultBranch] = useState(existingGitConfig?.defaultBranch ?? 'main')
  const [branchPrefix, setBranchPrefix] = useState(existingGitConfig?.branchPrefix ?? 'req/')
  const [showAdvancedGit, setShowAdvancedGit] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionResult, setConnectionResult] = useState<{
    ok: boolean; error?: string; login?: string; defaultBranch?: string; permissions?: Record<string, boolean>
  } | null>(null)

  // Context state
  const [context, setContext] = useState<ProjectContext>(
    project.settings?.context ?? project.context ?? { industry: '', techStack: [], conventions: [] },
  )
  const [techStackRaw, setTechStackRaw] = useState(
    (project.settings?.context ?? project.context)?.techStack.map((t) => typeof t === 'string' ? t : t.name).join(', ') ?? '',
  )
  const [conventionsRaw, setConventionsRaw] = useState(
    (project.settings?.context ?? project.context)?.rules?.map((r) => typeof r === 'string' ? r : r.text).join('\n') ?? '',
  )
  const [avoidRaw, setAvoidRaw] = useState(
    (project.settings?.context ?? project.context)?.avoid?.map((a) => {
      let s = a.item
      if (a.useInstead) s += ` → ${a.useInstead}`
      if (a.reason) s += `（${a.reason}）`
      return s
    }).join('\n') ?? '',
  )

  // Lessons state
  const [lessons, setLessons] = useState<ContextLesson[]>(
    project.settings?.context?.lessons ?? project.context.lessons ?? [],
  )
  const [addingLesson, setAddingLesson] = useState(false)
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null)
  const [lessonDraft, setLessonDraft] = useState<LessonDraft>(emptyDraft())
  const [isGenerating, setIsGenerating] = useState(false)

  // Reset when project changes
  useEffect(() => {
    setBasic(toBasicForm(project))
    setRepository(project.settings?.repository ?? '')
    setEnvLinks(project.settings?.environments ?? [])
    const ctx = project.settings?.context ?? project.context ?? { industry: '', techStack: [], rules: [] }
    setContext(ctx)
    setTechStackRaw(ctx.techStack.map((t) => typeof t === 'string' ? t : t.name).join(', '))
    setConventionsRaw(ctx.rules?.map((r) => typeof r === 'string' ? r : r.text).join('\n') ?? '')
    setAvoidRaw(ctx.avoid?.map((a) => {
      let s = typeof a === 'string' ? a : a.item
      if (a.useInstead) s += ` → ${a.useInstead}`
      if (a.reason) s += `（${a.reason}）`
      return s
    }).join('\n') ?? '')
    setLessons(ctx.lessons ?? [])
    setAddingLesson(false)
    setEditingLessonId(null)
    // Git config reset
    const gc = project.settings?.gitConfig
    setGithubToken('')
    setAutoCreatePR(gc?.autoCreatePR ?? false)
    setAutoReview(gc?.autoReview ?? false)
    setDefaultBranch(gc?.defaultBranch ?? 'main')
    setBranchPrefix(gc?.branchPrefix ?? 'req/')
    setConnectionResult(null)
  }, [project.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  // ── Env helpers ──────────────────────────────────────────────────────────────

  const addEnv = () => setEnvLinks((prev) => [...prev, { name: '', url: '' }])

  const updateEnv = (idx: number, key: keyof EnvLink, val: string) =>
    setEnvLinks((prev) => prev.map((e, i) => (i === idx ? { ...e, [key]: val } : e)))

  const removeEnv = (idx: number) =>
    setEnvLinks((prev) => prev.filter((_, i) => i !== idx))

  // ── Git Test Connection ────────────────────────────────────────────────────
  const handleTestConnection = async () => {
    setTestingConnection(true)
    setConnectionResult(null)
    try {
      const res = await fetch(`/api/v1/projects/${project.id}/git/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      setConnectionResult(data)
      if (data.ok && data.defaultBranch) {
        setDefaultBranch(data.defaultBranch)
      }
    } catch {
      setConnectionResult({ ok: false, error: '请求失败，请检查后端服务' })
    } finally {
      setTestingConnection(false)
    }
  }

  // ── AI Generate Context ─────────────────────────────────────────────────────

  const handleGenerateContext = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch('/api/v1/projects/generate-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: basic.name || project.name,
          description: basic.description || project.description,
          repository: repository.trim() || project.settings?.repository || undefined,
          existingContext: {
            industry: context.industry,
            techStack: techStackRaw.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ name })),
            rules: conventionsRaw.split('\n').map((s) => s.trim()).filter(Boolean).map((text) => ({ scope: 'all', text, source: 'human' })),
          },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        const msg = err?.detail || 'AI 生成上下文失败，请检查大模型配置'
        alert(msg)
        return
      }
      const data = await res.json()
      setContext((p) => ({
        ...p,
        industry: data.industry ?? p.industry,
        goal: data.goal ?? p.goal,
        targetUsers: data.targetUsers ?? p.targetUsers,
        archSummary: data.archSummary ?? p.archSummary,
        avoid: Array.isArray(data.avoid) ? data.avoid : (p.avoid ?? []),
      }))
      setTechStackRaw(
        Array.isArray(data.techStack)
          ? data.techStack.map((t: unknown) => (typeof t === 'string' ? t : (t as { name: string }).name)).join(', ')
          : '',
      )
      setConventionsRaw(
        Array.isArray(data.rules)
          ? data.rules.map((r: unknown) => (typeof r === 'string' ? r : (r as { text: string }).text)).join('\n')
          : '',
      )
      if (Array.isArray(data.avoid)) {
        setAvoidRaw(data.avoid.map((a: Record<string, string>) => {
          let s = a.item ?? a
          if (a.useInstead) s += ` → ${a.useInstead}`
          if (a.reason) s += `（${a.reason}）`
          return s
        }).join('\n'))
      }
    } catch (e) {
      console.error('AI 生成上下文失败', e)
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Lesson Helpers ────────────────────────────────────────────────────────

  const handleAddLesson = () => {
    if (!lessonDraft.title.trim()) return
    const newLesson: ContextLesson = { id: `lesson-${Date.now()}`, ...lessonDraft }
    setLessons((prev) => [newLesson, ...prev])
    if (lessonDraft.promotedToRule && lessonDraft.correctApproach.trim()) {
      const ruleText = `[教训] ${lessonDraft.title}：${lessonDraft.correctApproach.trim()}`
      setConventionsRaw((prev) => (prev ? `${prev}\n${ruleText}` : ruleText))
    }
    setAddingLesson(false)
    setLessonDraft(emptyDraft())
  }

  const handleSaveEditLesson = (id: string) => {
    setLessons((prev) => prev.map((l) => (l.id === id ? { ...l, ...lessonDraft } : l)))
    setEditingLessonId(null)
  }
  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = () => {
    const mergedContext: ProjectContext = {
      goal: context.goal ?? '',
      targetUsers: context.targetUsers ?? '',
      industry: context.industry,
      techStack: techStackRaw.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ name })),
      archSummary: context.archSummary ?? '',
      avoid: avoidRaw.split('\n').map((s) => s.trim()).filter(Boolean).map((line) => {
        const match = line.match(/^(.+?)(?:\s*→\s*(.+?))?(?:\s*[（(](.+?)[）)])?$/)
        return match
          ? { item: match[1].trim(), useInstead: match[2]?.trim(), reason: match[3]?.trim() }
          : { item: line }
      }),
      rules: conventionsRaw.split('\n').map((s) => s.trim()).filter(Boolean).map((text) => ({ scope: 'all' as const, text, source: 'human' as const })),
      domainModel: context.domainModel ?? '',
      lessons,
    }

    const gitConfig: GitConfig = {
      defaultBranch,
      branchPrefix,
      autoCreatePR,
      autoReview,
      ...(githubToken ? { githubToken } : {}),  // 仅在输入了新 Token 时才传
    }

    const settings: ProjectSettings = {
      repository: repository.trim() || undefined,
      gitConfig,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/60 p-4">
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
                  {TEAM_MEMBERS.map((m) => (
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
                  onChange={(e) => { setRepository(e.target.value); setConnectionResult(null) }}
                  placeholder="https://github.com/org/repo"
                  disabled={hasRunningRequirements}
                  title={hasRunningRequirements ? '有需求正在执行，暂时不可修改' : undefined}
                  className={cn(inputCls, hasRunningRequirements && 'opacity-50 cursor-not-allowed')}
                />
              </Field>

              {/* Git Token + 连接测试 */}
              {repository.trim() && (
                <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-2)]">
                    <GitBranch size={12} />
                    <span>Git 配置</span>
                  </div>

                  <Field label="GitHub Token">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showToken ? 'text' : 'password'}
                          value={githubToken}
                          onChange={(e) => setGithubToken(e.target.value)}
                          placeholder={existingGitConfig?.githubToken ? '已配置（输入新值覆盖）' : '粘贴 GitHub Personal Access Token'}
                          disabled={hasRunningRequirements}
                          title={hasRunningRequirements ? '有需求正在执行，暂时不可修改' : undefined}
                          className={cn(inputCls, hasRunningRequirements && 'opacity-50 cursor-not-allowed')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text-1)]"
                        >
                          {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--text-3)]">
                      需要 <code className="rounded bg-[var(--bg-panel-3)] px-1">repo</code> 权限 ·{' '}
                      <a
                        href="https://github.com/settings/tokens/new?scopes=repo&description=AI-DZHT"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--accent)] hover:underline inline-flex items-center gap-0.5"
                      >
                        创建 Token <ExternalLink size={10} />
                      </a>
                    </p>
                  </Field>

                  {/* 测试连接按钮 */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testingConnection}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-2)] hover:text-[var(--accent)] hover:border-[var(--accent)] disabled:opacity-50"
                    >
                      {testingConnection ? <Loader2 size={12} className="animate-spin" /> : <GitBranch size={12} />}
                      测试连接
                    </button>
                    {connectionResult && (
                      <div className={cn(
                        'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px]',
                        connectionResult.ok
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-red-500/10 text-red-400',
                      )}>
                        {connectionResult.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                        {connectionResult.ok
                          ? `连接成功 · ${connectionResult.login} · 默认分支: ${connectionResult.defaultBranch}`
                          : connectionResult.error}
                      </div>
                    )}
                  </div>

                  {/* PR 自动化开关 */}
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-2)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoCreatePR}
                        onChange={(e) => setAutoCreatePR(e.target.checked)}
                        className="rounded border-[var(--border)]"
                      />
                      完成后自动创建 PR
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-2)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoReview}
                        onChange={(e) => setAutoReview(e.target.checked)}
                        disabled={!autoCreatePR}
                        className="rounded border-[var(--border)] disabled:opacity-40"
                      />
                      自动 AI 审查
                    </label>
                  </div>

                  {/* 高级配置折叠区 */}
                  <button
                    type="button"
                    onClick={() => setShowAdvancedGit(!showAdvancedGit)}
                    className="flex items-center gap-1 text-[10px] text-[var(--text-3)] hover:text-[var(--text-2)]"
                  >
                    <ChevronDown size={10} className={cn('transition-transform', showAdvancedGit && 'rotate-180')} />
                    高级配置
                  </button>
                  {showAdvancedGit && (
                    <div className="space-y-2 pl-3 border-l-2 border-[var(--border)]">
                      <div className="flex gap-3">
                        <Field label="默认分支" className="flex-1">
                          <input
                            value={defaultBranch}
                            onChange={(e) => setDefaultBranch(e.target.value)}
                            placeholder="main"
                            className={inputCls}
                          />
                        </Field>
                        <Field label="分支前缀" className="flex-1">
                          <input
                            value={branchPrefix}
                            onChange={(e) => setBranchPrefix(e.target.value)}
                            placeholder="req/"
                            className={inputCls}
                          />
                        </Field>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
              <div className="flex items-start justify-between gap-3 rounded-xl border border-[rgba(10,132,255,0.2)] bg-[var(--accent-sub)] px-3.5 py-3">
                <p className="text-xs leading-relaxed text-[var(--accent)]">
                  项目上下文会作为 AI 对话时的参考背景，让 Agent 更精准地理解你的项目特点。
                </p>
                <button
                  type="button"
                  onClick={handleGenerateContext}
                  disabled={isGenerating}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[rgba(10,132,255,0.35)] bg-[var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  <Sparkles size={11} className={isGenerating ? 'animate-spin' : ''} />
                  {isGenerating ? 'AI 生成中...' : 'AI 生成上下文'}
                </button>
              </div>

              <Field label="项目目标">
                <input
                  value={context.goal ?? ''}
                  onChange={(e) => setContext((p) => ({ ...p, goal: e.target.value }))}
                  placeholder="例：构建一站式 AI 研发协作平台"
                  className={inputCls}
                />
              </Field>

              <Field label="目标用户">
                <input
                  value={context.targetUsers ?? ''}
                  onChange={(e) => setContext((p) => ({ ...p, targetUsers: e.target.value }))}
                  placeholder="例：AI 研发团队、技术管理者"
                  className={inputCls}
                />
              </Field>

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

              <Field label="架构摘要">
                <textarea
                  value={context.archSummary ?? ''}
                  onChange={(e) => setContext((p) => ({ ...p, archSummary: e.target.value }))}
                  rows={2}
                  placeholder="例：前后端分离，前端 React SPA + 后端 FastAPI REST，PostgreSQL 持久化"
                  className={cn(inputCls, 'h-auto py-2 resize-none')}
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

              <Field label="禁止项">
                <textarea
                  value={avoidRaw}
                  onChange={(e) => setAvoidRaw(e.target.value)}
                  rows={3}
                  placeholder={'每行一条，例：\nvar 声明 → const/let（作用域问题）\njQuery → React（项目已统一框架）'}
                  className={cn(inputCls, 'h-auto py-2 resize-none')}
                />
              </Field>

              <Field label="领域模型">
                <textarea
                  value={context.domainModel ?? ''}
                  onChange={(e) => setContext((p) => ({ ...p, domainModel: e.target.value }))}
                  rows={3}
                  placeholder="描述核心领域概念、实体关系等"
                  className={cn(inputCls, 'h-auto py-2 resize-none')}
                />
              </Field>
            </div>
          )}

          {/* ── Tab: 历史教训 ── */}
          {activeTab === 'lessons' && (
            <div className="space-y-3">
              {/* Add trigger / inline form */}
              {!addingLesson ? (
                <button
                  type="button"
                  onClick={() => { setEditingLessonId(null); setAddingLesson(true); setLessonDraft(emptyDraft()) }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] py-3 text-xs text-[var(--text-2)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <Plus size={12} /> 添加教训
                </button>
              ) : (
                <LessonForm
                  draft={lessonDraft}
                  onChange={setLessonDraft}
                  onSave={handleAddLesson}
                  onCancel={() => setAddingLesson(false)}
                />
              )}

              {/* Empty state */}
              {lessons.length === 0 && !addingLesson && (
                <div className="rounded-xl border border-dashed border-[var(--border)] py-8 text-center">
                  <p className="text-xs text-[var(--text-3)]">还没有记录任何教训</p>
                  <p className="mt-1 text-xs text-[var(--text-3)]">每次 Agent 出错后记录下来，让系统越来越懂你的项目</p>
                </div>
              )}

              {/* Lesson cards */}
              {lessons.map((lesson) =>
                editingLessonId === lesson.id ? (
                  <div key={lesson.id} className="rounded-xl border border-[var(--accent)] bg-[var(--bg-panel-2)]">
                    <LessonForm
                      draft={lessonDraft}
                      onChange={setLessonDraft}
                      onSave={() => handleSaveEditLesson(lesson.id)}
                      onCancel={() => setEditingLessonId(null)}
                    />
                  </div>
                ) : (
                  <div key={lesson.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)]">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setExpandedLessonId((prev) => (prev === lesson.id ? null : lesson.id))}
                        className="text-[var(--text-3)] hover:text-[var(--text-1)]"
                      >
                        <ChevronDown
                          size={13}
                          className={cn('transition-transform', expandedLessonId === lesson.id && 'rotate-180')}
                        />
                      </button>
                      <span className="rounded bg-[var(--bg-panel-3)] px-1.5 py-0.5 text-[11px] text-[var(--text-3)]">
                        {lesson.date}
                      </span>
                      <span className="flex-1 truncate text-xs font-medium text-[var(--text-1)]">{lesson.title}</span>
                      {lesson.promotedToRule && (
                        <span className="rounded-full bg-[var(--accent-sub)] px-1.5 py-0.5 text-[10px] text-[var(--accent)]">
                          已固化
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setAddingLesson(false)
                          setEditingLessonId(lesson.id)
                          setLessonDraft({
                            date: lesson.date,
                            title: lesson.title,
                            background: lesson.background,
                            correctApproach: lesson.correctApproach,
                            promotedToRule: lesson.promotedToRule,
                          })
                        }}
                        className="rounded p-1 text-[var(--text-3)] hover:text-[var(--text-1)]"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLessons((prev) => prev.filter((l) => l.id !== lesson.id))}
                        className="rounded p-1 text-[var(--text-3)] hover:text-[var(--danger)]"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {expandedLessonId === lesson.id && (
                      <div className="space-y-2 border-t border-[var(--border)] px-3 pb-3 pt-2">
                        {lesson.background && (
                          <div>
                            <span className="mb-0.5 block text-[10px] font-medium text-[var(--text-3)]">背景</span>
                            <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-2)]">{lesson.background}</p>
                          </div>
                        )}
                        {lesson.correctApproach && (
                          <div>
                            <span className="mb-0.5 block text-[10px] font-medium text-[var(--text-3)]">正确做法</span>
                            <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-2)]">{lesson.correctApproach}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ),
              )}
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

function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-xs font-medium text-[var(--text-2)]">
        {label}
        {required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
      </span>
      {children}
    </label>
  )
}

function LessonForm({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: LessonDraft
  onChange: (d: LessonDraft) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-2 p-3">
      <div className="flex gap-2">
        <input
          type="date"
          value={draft.date}
          onChange={(e) => onChange({ ...draft, date: e.target.value })}
          className={cn(inputCls, 'w-[140px] shrink-0')}
        />
        <input
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          placeholder="教训标题，例：删除确认统一用 Modal"
          className={inputCls}
        />
      </div>
      <textarea
        value={draft.background}
        onChange={(e) => onChange({ ...draft, background: e.target.value })}
        rows={2}
        placeholder="背景：Agent 做了什么？为什么是错的？"
        className={cn(inputCls, 'h-auto py-2 resize-none')}
      />
      <textarea
        value={draft.correctApproach}
        onChange={(e) => onChange({ ...draft, correctApproach: e.target.value })}
        rows={2}
        placeholder="正确做法：下次应该怎么做？"
        className={cn(inputCls, 'h-auto py-2 resize-none')}
      />
      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-2)]">
          <input
            type="checkbox"
            checked={draft.promotedToRule}
            onChange={(e) => onChange({ ...draft, promotedToRule: e.target.checked })}
            className="rounded"
          />
          同步固化为研发规范
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-2)]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!draft.title.trim()}
            className="rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
