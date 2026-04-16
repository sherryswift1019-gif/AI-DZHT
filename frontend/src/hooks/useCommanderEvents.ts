import { useCallback, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CommanderEvent, Requirement } from '@/types/project'

const BASE = '/api/v1/projects'

// ── 增量轮询指挥官事件 ──────────────────────────────────────────────────────

export function useCommanderEvents(projectId: string, requirement: Requirement | null) {
  const lastSeqRef = useRef(0)
  const [events, setEvents] = useState<CommanderEvent[]>([])
  const prevReqIdRef = useRef<string | null>(null)

  // 切换需求时重置
  if (requirement?.id !== prevReqIdRef.current) {
    prevReqIdRef.current = requirement?.id ?? null
    lastSeqRef.current = 0
    if (events.length > 0) setEvents([])
  }

  const reqId = requirement?.id ?? ''
  const isActive = !!requirement && requirement.status !== 'queued'

  useQuery({
    queryKey: ['commander-events', projectId, reqId, lastSeqRef.current],
    queryFn: async () => {
      const res = await fetch(
        `${BASE}/${projectId}/requirements/${reqId}/commander-events?after_seq=${lastSeqRef.current}`,
      )
      if (!res.ok) throw new Error(`Failed to fetch events (${res.status})`)
      const data = (await res.json()) as { events: CommanderEvent[]; lastSeq: number }
      if (data.events.length > 0) {
        lastSeqRef.current = data.lastSeq
        setEvents((prev) => [...prev, ...data.events])
      }
      return data
    },
    enabled: !!projectId && !!reqId && isActive,
    refetchInterval: () => {
      if (!requirement) return false
      const s = requirement.status
      if (s === 'running' || s === 'blocked') return 3000
      // 检查是否有步骤在 pending 审批
      const hasPending = requirement.pipeline.some(
        (step) => step.status === 'pending_approval'
          || step.status === 'pending_advisory_approval'
          || step.status === 'pending_input',
      )
      if (hasPending) return 3000
      // done 状态只拉取一次
      if (s === 'done' && lastSeqRef.current === 0) return false
      return false
    },
  })

  // 需求已完成时，如果还没加载事件，执行一次加载
  useQuery({
    queryKey: ['commander-events-history', projectId, reqId],
    queryFn: async () => {
      const res = await fetch(
        `${BASE}/${projectId}/requirements/${reqId}/commander-events?after_seq=0`,
      )
      if (!res.ok) throw new Error(`Failed to fetch event history (${res.status})`)
      const data = (await res.json()) as { events: CommanderEvent[]; lastSeq: number }
      if (data.events.length > 0) {
        lastSeqRef.current = data.lastSeq
        setEvents(data.events)
      }
      return data
    },
    enabled: !!projectId && !!reqId && requirement?.status === 'done' && events.length === 0,
  })

  return { events }
}

// ── 启动指挥官 ──────────────────────────────────────────────────────────────

export function useCommanderStart() {
  const qc = useQueryClient()
  return useMutation<Requirement, Error, { projectId: string; reqId: string }>({
    mutationFn: async ({ projectId, reqId }) => {
      const res = await fetch(`${BASE}/${projectId}/requirements/${reqId}/commander-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (!res.ok) throw new Error(`Failed to start commander (${res.status})`)
      return res.json() as Promise<Requirement>
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['requirements', vars.projectId] })
    },
  })
}

// ── 提交用户输入（对话式访谈） ────────────────────────────────────────────────

export function useSubmitUserInput() {
  const qc = useQueryClient()
  return useMutation<Requirement, Error,
    { projectId: string; reqId: string; stepId: string; text: string; skip?: boolean }>({
    mutationFn: async ({ projectId, reqId, stepId, text, skip }) => {
      const res = await fetch(
        `${BASE}/${projectId}/requirements/${reqId}/user-input/${stepId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, skip: skip ?? false }),
        },
      )
      if (!res.ok) throw new Error(`Failed to submit input (${res.status})`)
      return res.json() as Promise<Requirement>
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['requirements', vars.projectId] })
    },
  })
}
