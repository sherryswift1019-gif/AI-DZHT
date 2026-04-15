import { cn } from '@/lib/utils'
import { AgentAvatar } from '@/components/ui/AgentAvatar'
import { useWizardStore } from '@/stores/agentWizardStore'
import type { AgentRole } from '@/types/agent'
import { ArrowRight } from 'lucide-react'

const ROLES: { value: AgentRole; label: string; subtitle: string }[] = [
  { value: 'analyst',    label: '战略商业分析师', subtitle: '市场研究·竞品分析·产品简报' },
  { value: 'pm',         label: '产品经理',       subtitle: 'PRD 创建·需求验证·Story 拆解' },
  { value: 'ux',         label: 'UX 设计师',      subtitle: '交互设计·信息架构·UX 规格' },
  { value: 'architect',  label: '系统架构师',      subtitle: '技术架构·设计决策·项目上下文' },
  { value: 'sm',         label: 'Scrum Master',   subtitle: 'Sprint 规划·Story 管理·进度追踪' },
  { value: 'dev',        label: '研发工程师',      subtitle: 'Story 实现·单元测试·代码交付' },
  { value: 'qa',         label: 'QA 工程师',       subtitle: '自动化测试·代码评审·质量把关' },
  { value: 'quickdev',   label: '快速开发专家',    subtitle: '意图→代码·最小仪式感·快速交付' },
  { value: 'techwriter', label: '技术文档专家',    subtitle: '文档撰写·图表生成·概念说明' },
]

export function Step1BasicInfo() {
  const { name, description, role, setField, setStep } = useWizardStore()

  const canProceed = name.trim().length >= 2 && role !== ''

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[var(--text-1)]">基础信息</h2>
        <p className="text-sm text-[var(--text-2)] mt-1">为你的 Agent 取个名字，选择对应的研发角色</p>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
          Agent 名称 <span className="text-[var(--danger)]">*</span>
        </label>
        <input
          type="text"
          placeholder="例如：电商产品 Agent、合规优先架构师…"
          value={name}
          onChange={(e) => setField('name', e.target.value)}
          maxLength={40}
          className={cn(
            'h-10 px-4 rounded-xl text-sm w-full',
            'bg-[var(--bg-panel)] border border-[var(--border)]',
            'text-[var(--text-1)] placeholder:text-[var(--text-3)]',
            'focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-sub)]',
          )}
        />
        <div className="flex justify-between">
          {name.trim().length > 0 && name.trim().length < 2 && (
            <span className="text-xs text-[var(--danger)]">名称至少 2 个字符</span>
          )}
          <span className="text-xs text-[var(--text-3)] ml-auto">{name.length}/40</span>
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
          描述
          <span className="normal-case font-normal text-[var(--text-3)] ml-2">（可选，会展示在卡片上）</span>
        </label>
        <textarea
          placeholder="简要说明这个 Agent 的专长和使用场景…"
          value={description}
          onChange={(e) => setField('description', e.target.value)}
          maxLength={120}
          rows={2}
          className={cn(
            'px-4 py-2.5 rounded-xl text-sm w-full resize-none',
            'bg-[var(--bg-panel)] border border-[var(--border)]',
            'text-[var(--text-1)] placeholder:text-[var(--text-3)]',
            'focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-sub)]',
          )}
        />
        <span className="text-xs text-[var(--text-3)] self-end">{description.length}/120</span>
      </div>

      {/* Role */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
          研发角色 <span className="text-[var(--danger)]">*</span>
          <span className="normal-case font-normal text-[var(--text-3)] ml-2">决定头像与角色定位</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <button
              key={r.value}
              onClick={() => setField('role', r.value)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                role === r.value
                  ? 'border-[var(--accent)] bg-[var(--accent-sub)] ring-1 ring-[var(--accent-sub)]'
                  : 'border-[var(--border)] bg-[var(--bg-panel)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]',
              )}
            >
              <AgentAvatar role={r.value} name={r.label} size="sm" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text-1)] leading-tight">{r.label}</div>
                <div className="text-[11px] text-[var(--text-2)] mt-0.5 leading-tight">{r.subtitle}</div>
              </div>
              {role === r.value && (
                <div className="ml-auto size-4 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] text-white font-bold">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end pt-2">
        <button
          onClick={() => setStep(2)}
          disabled={!canProceed}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
            canProceed
              ? 'bg-[var(--accent)] text-white hover:opacity-90'
              : 'bg-[var(--bg-panel-2)] text-[var(--text-3)] cursor-not-allowed',
          )}
        >
          下一步：选择能力
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
