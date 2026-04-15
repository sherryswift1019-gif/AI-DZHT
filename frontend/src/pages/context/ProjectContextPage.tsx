import { useState } from 'react'
import { Plus, X, Check, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const INDUSTRY_OPTIONS = [
  '电商 / 零售', '金融 / 保险', 'SaaS / 企业软件', '医疗健康', '教育 / 在线学习',
  '出行 / 物流', '游戏 / 娱乐', '政务 / 公共服务', '其他',
]

const TECH_PRESETS = [
  'React', 'Vue', 'TypeScript', 'Node.js', 'Python', 'Java', 'Go',
  'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Kafka',
  'Docker', 'Kubernetes', 'AWS', 'Microservices',
]

export function ProjectContextPage() {
  const [industryType, setIndustryType] = useState('电商 / 零售')
  const [customIndustry, setCustomIndustry] = useState('')
  const [techStack, setTechStack] = useState<string[]>(['React', 'TypeScript', 'Node.js', 'MySQL'])
  const [customTech, setCustomTech] = useState('')
  const [conventions, setConventions] = useState(
    'API 先行原则，禁止直接操作数据库\n所有接口需通过 Code Review 才能合并\n前端组件禁止内联样式，统一使用 CSS Modules'
  )
  const [saved, setSaved] = useState(false)

  const addTech = (t: string) => {
    const v = t.trim()
    if (v && !techStack.includes(v)) setTechStack((prev) => [...prev, v])
  }
  const removeTech = (t: string) => setTechStack((prev) => prev.filter((x) => x !== t))

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-40 h-13 flex items-center justify-between px-6 bg-[var(--glass-bg)] backdrop-blur-[24px] border-b border-[var(--border)]">
        <span className="text-sm font-semibold text-[var(--text-1)]">项目上下文配置</span>
        <button
          onClick={handleSave}
          className={cn(
            'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all',
            saved
              ? 'bg-[var(--success-sub)] text-[var(--success)] border border-[rgba(48,209,88,0.3)]'
              : 'bg-[var(--accent)] text-white hover:opacity-90',
          )}
        >
          {saved ? <><Check size={12} />已保存</> : '保存配置'}
        </button>
      </header>

      <main className="max-w-[720px] mx-auto w-full px-6 py-8 flex flex-col gap-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)] mb-1">三层上下文 · 第二层</p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-1)]">项目上下文</h1>
          <p className="text-sm text-[var(--text-2)] mt-1">配置一次，项目内所有 Agent 实例自动携带此上下文，无需每次重复说明</p>
        </div>

        {/* Context injection explanation */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[var(--accent-sub)] border border-[rgba(10,132,255,0.2)]">
          <Info size={14} className="text-[var(--accent)] mt-0.5 flex-shrink-0" />
          <div className="text-xs text-[var(--accent)] leading-relaxed">
            <span className="font-semibold">三层上下文注入优先级：</span>需求层 &gt; 项目层（此页面）&gt; Agent 基础层。
            高优先级层的内容会覆盖同类字段中的低优先级内容。
          </div>
        </div>

        {/* Industry */}
        <section className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-2)]">
            行业领域
          </label>
          <div className="flex flex-wrap gap-2">
            {INDUSTRY_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => { setIndustryType(opt); setCustomIndustry('') }}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
                  industryType === opt && !customIndustry
                    ? 'bg-[var(--accent-sub)] text-[var(--accent)] border-[rgba(10,132,255,0.3)]'
                    : 'bg-[var(--bg-panel)] text-[var(--text-2)] border-[var(--border)] hover:border-[var(--border-strong)]',
                )}
              >
                {opt}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="或输入自定义行业…"
            value={customIndustry}
            onChange={(e) => { setCustomIndustry(e.target.value); if (e.target.value) setIndustryType('其他') }}
            className={cn(
              'h-9 px-4 rounded-xl text-sm w-full max-w-xs',
              'bg-[var(--bg-panel)] border border-[var(--border)]',
              'text-[var(--text-1)] placeholder:text-[var(--text-3)]',
              'focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-sub)]',
            )}
          />
        </section>

        {/* Tech stack */}
        <section className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-2)]">
            技术栈
          </label>

          {/* Selected tags */}
          {techStack.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)]">
              {techStack.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--accent-sub)] text-[var(--accent)] border border-[rgba(10,132,255,0.2)]">
                  {t}
                  <button onClick={() => removeTech(t)} className="hover:text-[var(--danger)] transition-colors ml-0.5">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Presets */}
          <div className="flex flex-wrap gap-1.5">
            {TECH_PRESETS.filter((t) => !techStack.includes(t)).map((t) => (
              <button
                key={t}
                onClick={() => addTech(t)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-[var(--text-2)] bg-[var(--bg-panel)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:text-[var(--text-1)] transition-all"
              >
                <Plus size={10} />
                {t}
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="添加自定义技术…"
              value={customTech}
              onChange={(e) => setCustomTech(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { addTech(customTech); setCustomTech('') } }}
              className={cn(
                'h-9 px-4 rounded-xl text-sm flex-1',
                'bg-[var(--bg-panel)] border border-[var(--border)]',
                'text-[var(--text-1)] placeholder:text-[var(--text-3)]',
                'focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-sub)]',
              )}
            />
            <button
              onClick={() => { addTech(customTech); setCustomTech('') }}
              disabled={!customTech.trim()}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--accent)] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all"
            >
              添加
            </button>
          </div>
        </section>

        {/* Team conventions */}
        <section className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-2)]">
            团队规范
            <span className="normal-case font-normal text-[var(--text-3)] ml-2">每行一条规范，Agent 会自动遵守</span>
          </label>
          <textarea
            value={conventions}
            onChange={(e) => setConventions(e.target.value)}
            rows={6}
            placeholder="例如：
API 先行原则，禁止直接操作数据库
所有接口需通过 Code Review 才能合并
前端组件禁止内联样式…"
            className={cn(
              'w-full px-4 py-3 rounded-xl text-sm resize-none',
              'bg-[var(--bg-panel)] border border-[var(--border)]',
              'text-[var(--text-1)] placeholder:text-[var(--text-3)]',
              'focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-sub)]',
            )}
          />
          <p className="text-[11px] text-[var(--text-3)]">
            {conventions.split('\n').filter((l) => l.trim()).length} 条规范
          </p>
        </section>
      </main>
    </div>
  )
}
