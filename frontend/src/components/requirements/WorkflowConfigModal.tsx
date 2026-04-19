import { useState, useEffect } from 'react'
import { useScrollLock } from '@/hooks/useScrollLock'
import { X, ChevronDown, ChevronRight, Copy, Check, AlertCircle, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildWorkflowSuggestPrompt } from '@/lib/buildWorkflowPrompt'
import { useWorkflowSuggest } from '@/hooks/useWorkflowSuggest'
import type { PipelineStep, ProjectContext, ReviewPolicy } from '@/types/project'
import { DEFAULT_REVIEW_POLICY } from '@/types/project'
import type { AgentRole } from '@/types/agent'

// ── 每个 Agent 角色的元信息（与 FlowNode / getStepDetail 保持一致）────
const ROLE_META: Record<AgentRole, { personaName: string; personaTitle: string }> = {
  analyst:    { personaName: 'Mary',    personaTitle: '战略商业分析师' },
  pm:         { personaName: 'John',    personaTitle: '产品经理' },
  ux:         { personaName: 'Sally',   personaTitle: 'UX 设计师' },
  architect:  { personaName: 'Winston', personaTitle: '系统架构师' },
  sm:         { personaName: 'Bob',     personaTitle: 'Scrum Master' },
  dev:        { personaName: 'Amelia',  personaTitle: '研发工程师' },
  qa:         { personaName: 'Quinn',   personaTitle: 'QA 工程师' },
  quickdev:   { personaName: 'Barry',   personaTitle: '快速开发专家' },
  techwriter: { personaName: 'Paige',   personaTitle: '技术文档专家' },
  reqLead:    { personaName: 'Lena',    personaTitle: '需求总监' },
}

// ── 每个 Agent 角色拥有的命令能力 ────────────────────────────────────
const AGENT_COMMANDS: Record<AgentRole, { code: string; name: string }[]> = {
  analyst:    [
    { code: 'BP', name: '头脑风暴' }, { code: 'MR', name: '市场研究' },
    { code: 'DR', name: '领域研究' }, { code: 'TR', name: '技术研究' },
    { code: 'CB', name: '产品简报' }, { code: 'DP', name: '文档项目' },
  ],
  pm:         [
    { code: 'CP', name: '创建 PRD' }, { code: 'VP', name: '验证 PRD' },
    { code: 'EP', name: '编辑 PRD' }, { code: 'CE', name: '创建 Epic' },
    { code: 'IR', name: '就绪检查' }, { code: 'CC', name: '方向修正' },
  ],
  ux:         [
    { code: 'CU', name: '创建 UX 设计' },
    { code: 'IA', name: '信息架构' },
    { code: 'RE', name: 'UX 审查' },
    { code: 'HG', name: 'HTML 预览生成' },
    { code: 'HD', name: '开发交付规格' },
    { code: 'PR', name: 'UX 规划评审' },
    { code: 'DES', name: '设计系统' },
  ],
  architect:  [{ code: 'CA', name: '创建架构' }, { code: 'GPC', name: '生成项目上下文' }],
  sm:         [
    { code: 'SP', name: 'Sprint 规划' }, { code: 'CS', name: '创建 Story' },
    { code: 'VS', name: '验证 Story' }, { code: 'SS', name: 'Sprint 状态' },
  ],
  dev:        [{ code: 'DS', name: 'Dev Story' }, { code: 'ER', name: '复盘' }],
  qa:         [
    { code: 'QA', name: 'QA 自动化测试' }, { code: 'CR', name: '代码审查' },
    { code: 'TS', name: '测试策略' }, { code: 'TRV', name: '可测试性评审' },
    { code: 'SA', name: '验收标准强化' }, { code: 'QG', name: '质量门禁' },
    { code: 'BE', name: '浏览器测试' }, { code: 'TD', name: '测试数据' },
    { code: 'IT', name: '增量选测' }, { code: 'TH', name: '测试历史' },
    { code: 'CT', name: '成本追踪' }, { code: 'LJ', name: '质量评审' },
    { code: 'GTV', name: '缺陷验证' }, { code: 'RS', name: '回归策略' },
    { code: 'XA', name: '跨Agent协作' }, { code: 'FD', name: 'Flake检测' },
    { code: 'OB', name: '仪表盘' },
  ],
  quickdev:   [{ code: 'QQ', name: '快速开发' }],
  techwriter: [
    { code: 'DP', name: '文档项目' }, { code: 'WD', name: '编写文档' },
    { code: 'MG', name: 'Mermaid 图表' }, { code: 'VD', name: '验证文档' },
    { code: 'EC', name: '解释概念' },
  ],
  reqLead: [
    { code: 'BP', name: '头脑风暴' }, { code: 'MR', name: '市场研究' },
    { code: 'DR', name: '领域研究' }, { code: 'TR', name: '技术研究' },
    { code: 'CB', name: '产品简报' }, { code: 'DP', name: '文档项目' },
    { code: 'CP', name: '创建 PRD' }, { code: 'VP', name: '验证 PRD' },
    { code: 'EP', name: '编辑 PRD' },
  ],
}

// ── 内置工作流模板 ────────────────────────────────────────────────────
interface TemplateStep {
  name: string
  agentRole: AgentRole
}

interface WorkflowTemplate {
  id: 'full' | 'quick' | 'bugfix' | 'requirements' | 'custom'
  icon: string
  label: string
  desc: string
  steps: TemplateStep[]
}

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'full',
    icon: '🔵',
    label: '全流程',
    desc: '适合大需求：分析→评审→设计→架构→策略→开发→测试→门禁',
    steps: [
      { name: '需求分析',       agentRole: 'analyst'   },
      { name: '可测试性评审',   agentRole: 'qa'        },
      { name: 'UX 设计',       agentRole: 'ux'        },
      { name: '架构设计',       agentRole: 'architect' },
      { name: '测试策略',       agentRole: 'qa'        },
      { name: '开发实现',       agentRole: 'dev'       },
      { name: '测试与质量门禁', agentRole: 'qa'        },
    ],
  },
  {
    id: 'quick',
    icon: '🚀',
    label: '快速开发',
    desc: '小需求或功能迭代：快速开发→测试',
    steps: [
      { name: '快速开发',   agentRole: 'quickdev' },
      { name: '自动化测试', agentRole: 'qa'       },
    ],
  },
  {
    id: 'bugfix',
    icon: '🐛',
    label: 'Bug 修复',
    desc: '直接修复缺陷：开发→测试',
    steps: [
      { name: '开发修复',   agentRole: 'dev' },
      { name: '回归测试',   agentRole: 'qa'  },
    ],
  },
  {
    id: 'requirements',
    icon: '📝',
    label: '需求驱动',
    desc: '从研究到 PRD 一气呵成→评审→UX→架构→策略→开发→测试→门禁',
    steps: [
      { name: '需求研究与规划', agentRole: 'reqLead'   },
      { name: '可测试性评审',   agentRole: 'qa'        },
      { name: 'UX 设计',       agentRole: 'ux'        },
      { name: '架构设计',       agentRole: 'architect' },
      { name: '测试策略',       agentRole: 'qa'        },
      { name: '开发实现',       agentRole: 'dev'       },
      { name: '测试与质量门禁', agentRole: 'qa'        },
    ],
  },
  {
    id: 'custom',
    icon: '⚙️',
    label: '自定义',
    desc: '手动选择并配置所需 Agent 节点',
    steps: [
      { name: '需求分析',    agentRole: 'analyst'    },
      { name: '需求总监',    agentRole: 'reqLead'    },
      { name: '产品规划',    agentRole: 'pm'         },
      { name: 'UX 设计',    agentRole: 'ux'         },
      { name: '架构设计',    agentRole: 'architect'  },
      { name: 'Sprint 管理', agentRole: 'sm'         },
      { name: '开发实现',    agentRole: 'dev'        },
      { name: '自动化测试',  agentRole: 'qa'         },
      { name: '快速开发',    agentRole: 'quickdev'   },
      { name: '技术文档',    agentRole: 'techwriter' },
    ],
  },
]

// ── 组件内部步骤状态 ─────────────────────────────────────────────────
interface StepState extends TemplateStep {
  enabled: boolean
  enabledCommands: string[]
  requiresApproval: boolean
  reviewPolicy: ReviewPolicy
}

function templateToStepStates(template: WorkflowTemplate): StepState[] {
  return template.steps.map((s) => ({
    ...s,
    enabled: true,
    enabledCommands: (AGENT_COMMANDS[s.agentRole] ?? []).map((c) => c.code),
    requiresApproval: false,
    reviewPolicy: { ...DEFAULT_REVIEW_POLICY },
  }))
}

// ── Props ─────────────────────────────────────────────────────────────
interface WorkflowConfigModalProps {
  open: boolean
  reqTitle: string
  reqSummary: string
  projectContext: ProjectContext
  onClose: () => void
  onConfirm: (pipeline: PipelineStep[]) => void
}

type CopyState = 'idle' | 'copied' | 'error'

export function WorkflowConfigModal({ open, reqTitle, reqSummary, projectContext, onClose, onConfirm }: WorkflowConfigModalProps) {
  const [activeTemplateId, setActiveTemplateId] = useState<WorkflowTemplate['id']>('full')
  const [steps, setSteps] = useState<StepState[]>(() =>
    templateToStepStates(WORKFLOW_TEMPLATES[0]),
  )
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const [aiPanelOpen, setAiPanelOpen] = useState(true)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [aiApplied, setAiApplied] = useState(false)

  const { mutate: fetchSuggest, data: suggestion, isPending: isSuggesting, isError: isSuggestError } = useWorkflowSuggest()

  useScrollLock(open)

  // 打开时自动触发 AI 分析
  useEffect(() => {
    if (!open) return
    setAiApplied(false)
    fetchSuggest({ projectContext, reqTitle, reqSummary })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // 收到建议后自动切换到推荐模板（只切换一次）
  useEffect(() => {
    if (!suggestion || aiApplied) return
    const tpl = WORKFLOW_TEMPLATES.find((t) => t.id === suggestion.recommendedTemplateId)
    if (tpl) {
      selectTemplate(tpl)
      setAiApplied(true)
    }
  }, [suggestion]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  const prompt = buildWorkflowSuggestPrompt(reqTitle, reqSummary, projectContext)

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt).then(
      () => {
        setCopyState('copied')
        setTimeout(() => setCopyState('idle'), 1500)
      },
      () => {
        setCopyState('error')
        setTimeout(() => setCopyState('idle'), 3000)
      },
    )
  }

  const enabledCount = steps.filter((s) => s.enabled).length

  // 切换模板
  const selectTemplate = (tpl: WorkflowTemplate) => {
    setActiveTemplateId(tpl.id)
    setSteps(templateToStepStates(tpl))
    setExpandedStep(null)
  }

  // 切换步骤启用；若展开的是被禁用的步骤，同时收起
  const toggleStep = (idx: number) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, enabled: !s.enabled } : s)),
    )
    if (expandedStep === idx) setExpandedStep(null)
  }

  // 切换审批标记
  const toggleApproval = (idx: number) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, requiresApproval: !s.requiresApproval } : s)),
    )
  }

  // 切换单个审查策略开关
  const toggleReviewPolicy = (idx: number, key: keyof ReviewPolicy) => {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === idx ? { ...s, reviewPolicy: { ...s.reviewPolicy, [key]: !s.reviewPolicy[key] } } : s,
      ),
    )
  }

  // 切换单个命令
  const toggleCommand = (stepIdx: number, code: string) => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== stepIdx) return s
        const already = s.enabledCommands.includes(code)
        return {
          ...s,
          enabledCommands: already
            ? s.enabledCommands.filter((c) => c !== code)
            : [...s.enabledCommands, code],
        }
      }),
    )
  }

  // 确认：构建 PipelineStep[]
  // agentName = 人格名（如 'Mary'），role = 职称（如 '战略商业分析师'），
  // commands = 启用命令链（如 'BP → DR → TR'）——与 FlowNode / getStepDetail 匹配
  const handleConfirm = () => {
    const ts = Date.now()
    const pipeline: PipelineStep[] = steps
      .filter((s) => s.enabled)
      .map((s, i) => {
        const meta = ROLE_META[s.agentRole]
        return {
          id: `new-${ts}-${i + 1}`,
          name: s.name,
          agentName: meta.personaName,
          role: meta.personaTitle,
          commands: s.enabledCommands.join(' → '),
          status: 'queued' as const,
          updatedAt: '--:--',
          agentRole: s.agentRole,
          enabledCommands: s.enabledCommands,
          requiresApproval: s.requiresApproval,
          reviewPolicy: s.reviewPolicy,
        }
      })
    onConfirm(pipeline)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/60 p-4">
      <div
        className="flex w-full max-w-[820px] flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-[var(--shadow-lg)]"
        style={{ maxHeight: '88vh' }}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="text-[11px] text-[var(--text-3)]">配置 Agent 工作流</p>
            <h3 className="mt-0.5 max-w-[560px] truncate text-sm font-semibold text-[var(--text-1)]">
              {reqTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-3)] hover:text-[var(--text-1)]"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── AI 建议面板 ─────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-[var(--border)]">
          {/* 面板标题行（可点击折叠） */}
          <button
            onClick={() => setAiPanelOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-2.5 text-left hover:bg-[var(--bg-hover)]"
          >
            <div className="flex items-center gap-2">
              {isSuggesting
                ? <Loader2 size={12} className="animate-spin text-[var(--accent)]" />
                : <Sparkles size={12} className={cn(suggestion ? 'text-[var(--accent)]' : 'text-[var(--text-3)]')} />
              }
              <span className="text-[11px] font-semibold text-[var(--text-2)]">AI 分析建议</span>
              {isSuggesting && (
                <span className="text-[10px] text-[var(--text-3)]">分析中...</span>
              )}
              {suggestion && !isSuggesting && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
                  suggestion.confidence === 'high'
                    ? 'bg-[var(--success-sub)] text-[var(--success)]'
                    : suggestion.confidence === 'medium'
                      ? 'bg-[var(--accent-sub)] text-[var(--accent)]'
                      : 'bg-[var(--warning-sub)] text-[var(--warning)]',
                )}>
                  {suggestion.confidence === 'high' ? '高置信' : suggestion.confidence === 'medium' ? '中置信' : '低置信'}
                </span>
              )}
              {isSuggestError && (
                <span className="text-[10px] text-[var(--danger)]">分析失败，已保持默认模板</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {aiPanelOpen
                ? <ChevronDown size={13} className="shrink-0 text-[var(--text-3)]" />
                : <ChevronRight size={13} className="shrink-0 text-[var(--text-3)]" />
              }
            </div>
          </button>

          {/* 展开内容 */}
          {aiPanelOpen && (
            <div className="px-5 pb-3 space-y-2">
              {/* AI 推荐结果 */}
              {suggestion && !isSuggesting && (
                <div className="rounded-xl border border-[rgba(10,132,255,0.25)] bg-[var(--accent-sub)] px-4 py-2.5">
                  <p className="text-[11px] leading-relaxed text-[var(--text-1)]">{suggestion.reasoning}</p>
                  {suggestion.warnings.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {suggestion.warnings.map((w, i) => (
                        <p key={i} className="flex items-start gap-1.5 text-[10px] text-[var(--warning)]">
                          <AlertCircle size={10} className="mt-0.5 shrink-0" />{w}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Prompt 复制区 */}
              <div className="relative rounded-xl border border-[var(--border)] bg-[var(--bg-base)]">
                <pre className="max-h-[100px] overflow-y-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[10px] leading-relaxed text-[var(--text-3)]">
                  {prompt}
                </pre>
                <button
                  onClick={handleCopy}
                  className={cn(
                    'absolute right-2 top-2 flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition-all',
                    copyState === 'copied'
                      ? 'border-[rgba(52,199,89,0.4)] bg-[var(--success-sub)] text-[var(--success)]'
                      : copyState === 'error'
                        ? 'border-[rgba(255,59,48,0.3)] bg-[var(--danger-sub)] text-[var(--danger)]'
                        : 'border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-2)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
                  )}
                >
                  {copyState === 'copied' && <Check size={10} />}
                  {copyState === 'error' && <AlertCircle size={10} />}
                  {copyState === 'idle' && <Copy size={10} />}
                  {copyState === 'copied'
                    ? '已复制 ✓'
                    : copyState === 'error'
                      ? '复制失败，请手动复制'
                      : '复制 Prompt'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 overflow-hidden">

          {/* Left: 模板选择 */}
          <div className="flex w-[192px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-[var(--border)] p-3">
            <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
              内置模板
            </p>
            {WORKFLOW_TEMPLATES.map((tpl) => {
              const isActive = activeTemplateId === tpl.id
              return (
                <button
                  key={tpl.id}
                  onClick={() => selectTemplate(tpl)}
                  className={cn(
                    'flex flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-all',
                    isActive
                      ? 'border-[rgba(10,132,255,0.5)] bg-[var(--accent-sub)]'
                      : 'border-[var(--border)] bg-[var(--bg-panel-2)] hover:border-[rgba(88,166,255,0.3)]',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px]">{tpl.icon}</span>
                    <span className={cn(
                      'text-[12px] font-semibold',
                      isActive ? 'text-[var(--accent)]' : 'text-[var(--text-1)]',
                    )}>
                      {tpl.label}
                    </span>
                  </div>
                  <p className="text-[10px] leading-snug text-[var(--text-3)]">{tpl.desc}</p>
                </button>
              )
            })}
          </div>

          {/* Right: 流水线预览 + 能力配置 */}
          <div className="flex flex-1 flex-col overflow-y-auto p-5 gap-4">

            {/* 顶部计数 */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                工作流预览
              </p>
              <span className="text-[10px] text-[var(--text-3)]">
                已启用{' '}
                <span className="font-semibold text-[var(--text-1)]">{enabledCount}</span>
                {' '}/ {steps.length} 个节点
              </span>
            </div>

            {/* ── 水平节点流（与详情页 FlowNode + NodeArrow 样式一致）── */}
            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max items-center gap-0">
                {steps.map((step, idx) => {
                  const meta    = ROLE_META[step.agentRole]
                  const cmds    = AGENT_COMMANDS[step.agentRole] ?? []
                  const isLast  = idx === steps.length - 1
                  const isSel   = expandedStep === idx

                  // 与 FlowNode 完全相同的颜色逻辑（queued 状态 + enabled/disabled 变体）
                  const cardCls = step.enabled
                    ? isSel
                      ? 'border-[rgba(88,166,255,0.55)] bg-[rgba(88,166,255,0.06)] ring-2 ring-[#58a6ff] ring-offset-1 ring-offset-[var(--bg-base)]'
                      : 'border-[#21262d] bg-[#0d1117] hover:brightness-110'
                    : 'border-[#21262d] bg-[#0d1117] opacity-30'

                  return (
                    <div key={`${step.agentRole}-${idx}`} className="flex items-center">
                      {/* ── Node card ── */}
                      <div className="relative flex shrink-0 flex-col">
                        {/* 主卡片：点击选中以展开命令配置 */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => step.enabled && setExpandedStep(isSel ? null : idx)}
                          onKeyDown={(e) => e.key === 'Enter' && step.enabled && setExpandedStep(isSel ? null : idx)}
                          className={cn(
                            'relative flex w-[136px] cursor-pointer flex-col rounded-xl border-[1.5px] p-3 text-left transition-all active:scale-[0.98]',
                            cardCls,
                          )}
                        >
                          {/* Agent 名称 + 启用/停用 toggle */}
                          <div className="mb-1.5 flex items-start justify-between gap-1">
                            <span className="text-[12px] font-bold leading-tight text-[var(--text-1)]">
                              {meta.personaName}
                            </span>
                            {/* 启用/停用 — stopPropagation 防止触发卡片选中 */}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleStep(idx) }}
                              className={cn(
                                'shrink-0 rounded border px-1.5 py-[2px] text-[8px] font-semibold leading-none transition-all',
                                step.enabled
                                  ? 'border-[rgba(63,185,80,0.4)] bg-[rgba(63,185,80,0.1)] text-[#3fb950]'
                                  : 'border-[var(--border)] bg-transparent text-[var(--text-3)]',
                              )}
                            >
                              {step.enabled ? '启用' : '停用'}
                            </button>
                          </div>

                          {/* 步骤职能（与 FlowNode role 字段对应）*/}
                          <span className="text-[10px] leading-tight text-[var(--text-3)]">
                            {step.name}
                          </span>

                          {/* 审批开关 */}
                          {step.enabled && (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleApproval(idx) }}
                              className={cn(
                                'mt-2 self-start rounded border px-2 py-[3px] text-[9px] font-semibold leading-none transition-all',
                                step.requiresApproval
                                  ? 'border-[rgba(255,159,10,0.5)] bg-[rgba(255,159,10,0.15)] text-[#ff9f0a]'
                                  : 'border-[var(--border)] bg-[var(--bg-panel-2)] text-[var(--text-2)] hover:text-[var(--text-1)]',
                              )}
                            >
                              {step.requiresApproval ? '需审批' : '自动'}
                            </button>
                          )}

                          {/* 命令链预览（与 FlowNode commands 字段对应）*/}
                          {step.enabled && cmds.length > 0 && (
                            <span className="mt-2 font-mono text-[9px] leading-snug text-[#58a6ff] opacity-80">
                              {step.enabledCommands.slice(0, 3).join(' → ')}
                              {step.enabledCommands.length > 3 && ' …'}
                            </span>
                          )}

                          {/* 命令数量指示 */}
                          {step.enabled && cmds.length > 0 && (
                            <span className="mt-1 text-[9px] text-[var(--text-3)]">
                              {step.enabledCommands.length}/{cmds.length} 命令
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ── 箭头连接符（与 NodeArrow 完全相同）── */}
                      {!isLast && (
                        <div className="flex shrink-0 items-center">
                          <div className="h-px w-8 bg-[#30363d]" />
                          <div className="border-y-[5px] border-l-[7px] border-y-transparent border-l-[#30363d]" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── 命令能力配置面板（选中节点时展示）── */}
            {expandedStep !== null && steps[expandedStep]?.enabled && (() => {
              const step = steps[expandedStep]
              const cmds = AGENT_COMMANDS[step.agentRole] ?? []
              const meta = ROLE_META[step.agentRole]
              if (cmds.length === 0) return null
              return (
                <div className="rounded-xl border border-[rgba(88,166,255,0.25)] bg-[rgba(88,166,255,0.04)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-[var(--text-1)]">
                      {meta.personaName} ({meta.personaTitle}) — 命令能力配置
                    </p>
                    <button
                      onClick={() => setExpandedStep(null)}
                      className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-3)] hover:text-[var(--text-1)]"
                    >
                      收起
                    </button>
                  </div>
                  <p className="mb-2.5 text-[10px] text-[var(--text-3)]">勾选该 Agent 可使用的命令：</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cmds.map((cmd) => {
                      const checked = step.enabledCommands.includes(cmd.code)
                      return (
                        <button
                          key={cmd.code}
                          onClick={() => toggleCommand(expandedStep, cmd.code)}
                          className={cn(
                            'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all',
                            checked
                              ? 'border-[rgba(10,132,255,0.5)] bg-[var(--accent-sub)] text-[var(--accent)]'
                              : 'border-[var(--border)] bg-[var(--bg-panel-3)] text-[var(--text-3)]',
                          )}
                        >
                          {cmd.code}
                          <span className="ml-1 text-[9px] font-normal opacity-70">{cmd.name}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* ── 审查策略 ── */}
                  <div className="mt-4 border-t border-[var(--border)] pt-3">
                    <p className="mb-2 text-[10px] font-semibold text-[var(--text-2)]">审查策略</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { key: 'stepPause',    label: '命令间暂停',   desc: '每条命令执行后等待用户点击继续' },
                          { key: 'adversarial',  label: '对抗性审查',   desc: '检查逻辑缺口、未验证假设' },
                          { key: 'edgeCase',     label: '边界用例审查', desc: '检查边界条件、异常路径' },
                          { key: 'structural',   label: '结构完整性审查', desc: '检查章节结构与完整性' },
                        ] as { key: keyof ReviewPolicy; label: string; desc: string }[]
                      ).map(({ key, label, desc }) => {
                        const on = step.reviewPolicy[key]
                        return (
                          <button
                            key={key}
                            title={desc}
                            onClick={() => toggleReviewPolicy(expandedStep, key)}
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
                </div>
              )
            })()}

          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-5 py-3">
          <p className="text-[11px] text-[var(--text-3)]">
            {enabledCount === 0
              ? '至少选择 1 个 Agent 节点'
              : `将创建包含 ${enabledCount} 个节点的流水线`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-2)] hover:text-[var(--text-1)]"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={enabledCount === 0}
              className={cn(
                'rounded-lg px-4 py-1.5 text-xs font-semibold transition-all',
                enabledCount > 0
                  ? 'bg-[var(--accent)] text-white hover:opacity-90'
                  : 'cursor-not-allowed bg-[var(--bg-panel-3)] text-[var(--text-3)]',
              )}
            >
              确认创建
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

