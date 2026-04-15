import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useWizardStore } from '@/stores/agentWizardStore'
import { ArrowLeft, Sparkles, RotateCcw, Check, AlertTriangle } from 'lucide-react'
import type { PromptBlocks } from '@/types/agent'

const BLOCKS: { key: keyof PromptBlocks; label: string; placeholder: string }[] = [
  {
    key: 'roleDefinition',
    label: '① 角色定义',
    placeholder: '描述这个 Agent 的身份与专长领域。\n例如：你是专注电商平台的产品经理 Agent，深度理解电商转化漏斗与用户行为…',
  },
  {
    key: 'capabilityScope',
    label: '② 能力声明',
    placeholder: '说明这个 Agent 能做什么、边界在哪里。\n例如：负责电商需求的 PRD 编写、转化率分析、用户旅程研究，不负责技术实现…',
  },
  {
    key: 'behaviorConstraints',
    label: '③ 行为约束',
    placeholder: '列出必须遵守的团队规范与限制条件。\n例如：遵循 API 先行原则，禁止直接操作数据库，输出必须包含数据支撑…',
  },
  {
    key: 'outputSpec',
    label: '④ 输出规范',
    placeholder: '规定输出的格式、结构和质量标准。\n例如：使用 Markdown 格式，必须包含执行摘要，关键决策需列出备选方案…',
  },
]

interface Step3PromptProps {
  onFinish: () => void
  saveLabel?: string
}

export function Step3Prompt({ onFinish, saveLabel = '保存 Agent' }: Step3PromptProps) {
  const { promptBlocks, aiGenStatus, selectedCommands, name, role,
          setPromptBlock, setPromptBlocks, setAiGenStatus, setStep } = useWizardStore()
  const [activeBlock, setActiveBlock] = useState<keyof PromptBlocks | null>(null)
  const [blockHints, setBlockHints] = useState<Partial<Record<keyof PromptBlocks, string>>>({})

  const hasAnyContent = Object.values(promptBlocks).some((v) => v.trim().length > 0)

  // Simulate AI generation
  const handleGenerateAll = () => {
    if (aiGenStatus === 'generating') return
    setAiGenStatus('generating')

    setTimeout(() => {
      const commandList = selectedCommands.map((c) => `${c.code}（${c.name}）`).join('、')
      const hasCommands = selectedCommands.length > 0

      setPromptBlocks({
        roleDefinition: `你是 AI-DZHT 平台的${name || '专职'} Agent，定位为研发团队的 AI 协作伙伴。${role ? `你承担${roleLabel(role)}职能，` : ''}以专业、高效的方式协助团队完成研发目标。`,
        capabilityScope: hasCommands
          ? `你具备以下核心能力：${commandList}。\n\n你的职责范围聚焦于上述能力所涵盖的研发阶段，不承担超出范围的任务。当遇到边界外的请求时，明确说明并引导至合适的负责方。`
          : `你的能力范围由团队在使用过程中逐步明确。请根据实际分配的任务执行，并在每次交互中明确说明你的输出边界。`,
        behaviorConstraints: `1. 所有输出必须基于团队提供的上下文，不凭空假设业务背景\n2. 遵循团队既定的技术规范和协作流程\n3. 高风险操作（删除、重构、外部集成）前须明确标注并请求人工确认\n4. 输出内容保持客观，区分「事实」与「建议」\n5. 发现上下文不足时，主动提问而非自行填充`,
        outputSpec: `- 使用 Markdown 格式，层级清晰（标题用 ##/###）\n- 每次输出包含「执行摘要」（3 句话内）\n- 关键决策点列出 2-3 个备选方案及权衡分析\n- 代码/命令使用代码块标注语言类型\n- 输出末尾标注「待确认事项」（如有）`,
      })
      setAiGenStatus('done')
    }, 2000)
  }

  const handleBlockAI = (blockKey: keyof PromptBlocks) => {
    setAiGenStatus('generating')
    setTimeout(() => {
      const hint = blockHints[blockKey] || ''
      const current = promptBlocks[blockKey]
      setPromptBlock(blockKey, current + (hint ? `\n\n[AI 优化方向：${hint}] 已根据你的说明优化上述内容，聚焦于${hint}相关的具体要求。` : '\n\n[已根据所选能力自动优化此块内容]'))
      setBlockHints((prev) => ({ ...prev, [blockKey]: '' }))
      setAiGenStatus('done')
      setTimeout(() => setAiGenStatus('idle'), 1500)
    }, 1200)
  }

  const isGenerating = aiGenStatus === 'generating'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[var(--text-1)]">提示词配置</h2>
        <p className="text-sm text-[var(--text-2)] mt-1">
          四块结构化编辑，每块独立维护。AI 可一键生成草稿，也可手动编写
        </p>
      </div>

      {/* AI Generation CTA */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3 rounded-xl border',
        aiGenStatus === 'done'
          ? 'bg-[var(--success-sub)] border-[rgba(48,209,88,0.25)]'
          : aiGenStatus === 'error'
            ? 'bg-[var(--warning-sub)] border-[rgba(255,159,10,0.25)]'
            : 'bg-[var(--bg-panel)] border-[var(--border)]',
      )}>
        {aiGenStatus === 'error' ? (
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-[var(--orange)]" />
            <span className="text-sm text-[var(--orange)]">AI 生成服务暂不可用，请手动编辑下方内容</span>
          </div>
        ) : aiGenStatus === 'done' ? (
          <div className="flex items-center gap-2">
            <Check size={14} className="text-[var(--success)]" />
            <span className="text-sm text-[var(--success)]">草稿已生成，请检查并按需调整</span>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-[var(--text-1)]">
              基于已选 {selectedCommands.length} 个能力自动生成提示词草稿
            </p>
            <p className="text-xs text-[var(--text-2)] mt-0.5">生成后可逐块修改，或对单块触发二次优化</p>
          </div>
        )}
        <button
          onClick={aiGenStatus === 'done' ? () => setAiGenStatus('idle') : handleGenerateAll}
          disabled={isGenerating}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ml-4',
            aiGenStatus === 'done'
              ? 'bg-[var(--bg-panel-2)] text-[var(--text-2)] hover:text-[var(--text-1)]'
              : isGenerating
                ? 'bg-[var(--bg-panel-2)] text-[var(--text-3)] cursor-not-allowed'
                : 'bg-[var(--accent)] text-white hover:opacity-90',
          )}
        >
          {isGenerating ? (
            <>
              <span className="animate-spin">⟳</span> 生成中…
            </>
          ) : aiGenStatus === 'done' ? (
            <><RotateCcw size={12} /> 重新生成</>
          ) : (
            <><Sparkles size={12} /> AI 生成草稿</>
          )}
        </button>
      </div>

      {/* Four blocks */}
      <div className="flex flex-col gap-4">
        {BLOCKS.map((block) => (
          <PromptBlock
            key={block.key}
            blockKey={block.key}
            label={block.label}
            placeholder={block.placeholder}
            value={promptBlocks[block.key]}
            hint={blockHints[block.key] || ''}
            isActive={activeBlock === block.key}
            isGenerating={isGenerating}
            onFocus={() => setActiveBlock(block.key)}
            onBlur={() => setActiveBlock(null)}
            onChange={(v) => setPromptBlock(block.key, v)}
            onHintChange={(v) => setBlockHints((prev) => ({ ...prev, [block.key]: v }))}
            onBlockAI={() => handleBlockAI(block.key)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
        <button
          onClick={() => setStep(2)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-hover)] transition-all"
        >
          <ArrowLeft size={14} />
          上一步
        </button>
        <button
          onClick={onFinish}
          disabled={!hasAnyContent}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
            hasAnyContent
              ? 'bg-[var(--success)] text-white hover:opacity-90'
              : 'bg-[var(--bg-panel-2)] text-[var(--text-3)] cursor-not-allowed',
          )}
        >
          <Check size={14} />
          {saveLabel}
        </button>
      </div>
    </div>
  )
}

// ─── PromptBlock sub-component ────────────────────────────────────

interface PromptBlockProps {
  blockKey: keyof PromptBlocks
  label: string
  placeholder: string
  value: string
  hint: string
  isActive: boolean
  isGenerating: boolean
  onFocus: () => void
  onBlur: () => void
  onChange: (v: string) => void
  onHintChange: (v: string) => void
  onBlockAI: () => void
}

function PromptBlock({
  label, placeholder, value, hint,
  isActive, isGenerating,
  onFocus, onBlur, onChange, onHintChange, onBlockAI,
}: PromptBlockProps) {
  const [showHintInput, setShowHintInput] = useState(false)

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden transition-all',
        isActive
          ? 'border-[var(--accent)] shadow-[0_0_0_1px_var(--accent-sub)]'
          : 'border-[var(--border)]',
      )}
    >
      {/* Block header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-panel-2)] border-b border-[var(--border)]">
        <span className="text-xs font-semibold text-[var(--text-2)]">{label}</span>
        <div className="flex items-center gap-1">
          {!showHintInput && (
            <button
              onClick={() => setShowHintInput(true)}
              disabled={isGenerating}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-[var(--text-2)] hover:text-[var(--accent)] hover:bg-[var(--accent-sub)] transition-colors disabled:opacity-40"
            >
              <Sparkles size={10} />
              AI 优化此块
            </button>
          )}
        </div>
      </div>

      {/* AI hint input (conditional) */}
      {showHintInput && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-sub)] border-b border-[rgba(10,132,255,0.15)]">
          <Sparkles size={11} className="text-[var(--accent)] flex-shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="说明优化方向，例如：更聚焦电商转化漏斗分析…"
            value={hint}
            onChange={(e) => onHintChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { onBlockAI(); setShowHintInput(false) }
              if (e.key === 'Escape') setShowHintInput(false)
            }}
            className="flex-1 text-xs bg-transparent border-none outline-none text-[var(--text-1)] placeholder:text-[var(--accent)] placeholder:opacity-50"
          />
          <button
            onClick={() => { onBlockAI(); setShowHintInput(false) }}
            className="text-[11px] font-semibold text-[var(--accent)] hover:opacity-70 transition-opacity"
          >
            优化 ↵
          </button>
          <button
            onClick={() => setShowHintInput(false)}
            className="text-[11px] text-[var(--text-3)] hover:text-[var(--text-2)]"
          >
            取消
          </button>
        </div>
      )}

      {/* Textarea */}
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        rows={4}
        className={cn(
          'w-full px-4 py-3 text-sm bg-[var(--bg-panel)] resize-none',
          'text-[var(--text-1)] placeholder:text-[var(--text-3)]',
          'focus:outline-none',
          isGenerating && 'animate-pulse',
        )}
      />
    </div>
  )
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    commander: '全局调度',
    product: '产品管理',
    ux: 'UX 设计',
    arch: '技术架构',
    dev: '研发实现',
    review: '质量评审',
    test: '测试',
    deploy: '部署运维',
  }
  return map[role] || role
}
