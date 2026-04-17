import React, { useEffect, useRef, useState } from 'react'

// ── LogStream (Claude 终端风格：结构化行块 + spinner + 可展开 tool result) ─────

export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export const LOG_TAG_COLOR: Record<string, string> = {
  init:     '#6e7681',
  analysis: '#79c0ff',
  writing:  '#79c0ff',
  planning: '#a5d6ff',
  design:   '#79c0ff',
  code:     '#79c0ff',
  review:   '#8b949e',
  decision: '#e3b341',
  output:   '#3fb950',
  // Commander 面板扩展
  exec:      '#58a6ff',
  done:      '#3fb950',
  interview: '#d2a8ff',
  knowledge: '#e3b341',
  revise:    '#f0883e',
  findings:  '#8b949e',
  pass:      '#3fb950',
}

export type LogGroup = {
  id: number
  tag: string
  content: string
  detail?: string
  isOutput: boolean
  isFix: boolean
}

export function buildLogGroups(lines: Array<{ time?: string; text: string }>): LogGroup[] {
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

interface LogStreamProps {
  lines: Array<{ time?: string; text: string }>
  className?: string
  maxHeight?: string
}

export const LogStream = React.memo(function LogStream({
  lines,
  className,
  maxHeight = '260px',
}: LogStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [expandedIds, setExpandedIds]   = useState<Set<number>>(new Set())

  // Spinner 帧动画（80ms/帧）
  useEffect(() => {
    const id = setInterval(() => setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length), 80)
    return () => clearInterval(id)
  }, [])

  // 新行出现时自动滚到底部
  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  const groups = buildLogGroups(lines)

  const toggle = (gid: number) =>
    setExpandedIds((prev) => { const s = new Set(prev); s.has(gid) ? s.delete(gid) : s.add(gid); return s })

  return (
    <div
      ref={containerRef}
      className={`rounded-xl border border-[var(--border)] bg-[#0d1117] px-3 py-2.5 font-mono overflow-y-auto ${className ?? ''}`}
      style={{ maxHeight }}
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
