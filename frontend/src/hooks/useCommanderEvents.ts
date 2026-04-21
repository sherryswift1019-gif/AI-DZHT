import { useCallback, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CommanderEvent, Requirement, WorkshopSessionState } from '@/types/project'

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
          || step.status === 'pending_input'
          || step.status === 'workshop_briefing'
          || step.status === 'workshop_dialogue'
          || step.status === 'workshop_generating'
          || step.status === 'workshop_quality_review',
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
    { projectId: string; reqId: string; stepId: string; text: string; skip?: boolean;
      selectedOptions?: string[]; attachmentIds?: string[]; issueAction?: string }>({
    mutationFn: async ({ projectId, reqId, stepId, text, skip, selectedOptions, attachmentIds, issueAction }) => {
      const res = await fetch(
        `${BASE}/${projectId}/requirements/${reqId}/user-input/${stepId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            skip: skip ?? false,
            ...(selectedOptions && { selectedOptions }),
            ...(attachmentIds && { attachmentIds }),
            ...(issueAction && { issueAction }),
          }),
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

// ── 中止流水线 ──────────────────────────────────────────────────────────────────

export function useAbortPipeline() {
  const qc = useQueryClient()
  return useMutation<{ status: string }, Error, { projectId: string; reqId: string }>({
    mutationFn: async ({ projectId, reqId }) => {
      const res = await fetch(`${BASE}/${projectId}/requirements/${reqId}/abort`, { method: 'POST' })
      if (!res.ok) throw new Error(`Failed to abort (${res.status})`)
      return res.json()
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['requirements', vars.projectId] })
    },
  })
}

// ── 重新开始流水线 ──────────────────────────────────────────────────────────────

export function useRestartPipeline() {
  const qc = useQueryClient()
  return useMutation<Requirement, Error, { projectId: string; reqId: string }>({
    mutationFn: async ({ projectId, reqId }) => {
      const res = await fetch(`${BASE}/${projectId}/requirements/${reqId}/restart`, { method: 'POST' })
      if (!res.ok) throw new Error(`Failed to restart (${res.status})`)
      return res.json() as Promise<Requirement>
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['requirements', vars.projectId] })
    },
  })
}

// ── 从断点恢复流水线 ────────────────────────────────────────────────────────────

export function useResumePipeline() {
  const qc = useQueryClient()
  return useMutation<Requirement, Error, { projectId: string; reqId: string }>({
    mutationFn: async ({ projectId, reqId }) => {
      const res = await fetch(`${BASE}/${projectId}/requirements/${reqId}/resume`, { method: 'POST' })
      if (!res.ok) throw new Error(`Failed to resume (${res.status})`)
      return res.json() as Promise<Requirement>
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['requirements', vars.projectId] })
    },
  })
}

// ── 命令级继续执行 ──────────────────────────────────────────────────────────────

export function useContinueStep() {
  const qc = useQueryClient()
  return useMutation<{ status: string }, Error,
    { projectId: string; reqId: string; stepId: string; feedback?: string }>({
    mutationFn: async ({ projectId, reqId, stepId, feedback }) => {
      const res = await fetch(
        `${BASE}/${projectId}/requirements/${reqId}/continue-step/${stepId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback: feedback ?? '' }),
        },
      )
      if (!res.ok) throw new Error(`Failed to continue step (${res.status})`)
      return res.json()
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['requirements', vars.projectId] })
    },
  })
}

// ── Workshop 会话状态查询（用于前端恢复） ────────────────────────────────────────

export function useWorkshopSession(
  projectId: string,
  reqId: string,
  stepId: string | undefined,
  enabled: boolean = true,
) {
  return useQuery<WorkshopSessionState | null>({
    queryKey: ['workshop-session', projectId, reqId, stepId],
    queryFn: async () => {
      if (!stepId) return null
      const res = await fetch(
        `${BASE}/${projectId}/requirements/${reqId}/workshop-session/${stepId}`,
      )
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`Failed to fetch workshop session (${res.status})`)
      return res.json() as Promise<WorkshopSessionState>
    },
    enabled: !!projectId && !!reqId && !!stepId && enabled,
    staleTime: 10_000,
  })
}

// ── Workshop 待处理项处理 ────────────────────────────────────────────────────────

export function useResolveWorkshopIssue() {
  const qc = useQueryClient()
  return useMutation<Requirement, Error,
    { projectId: string; reqId: string; stepId: string;
      issueId: string; action: string; detail?: string }>({
    mutationFn: async ({ projectId, reqId, stepId, issueId, action, detail }) => {
      const res = await fetch(
        `${BASE}/${projectId}/requirements/${reqId}/user-input/${stepId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: detail ?? '',
            issueAction: action,
            selectedOptions: [issueId],
          }),
        },
      )
      if (!res.ok) throw new Error(`Failed to resolve issue (${res.status})`)
      return res.json() as Promise<Requirement>
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['requirements', vars.projectId] })
      void qc.invalidateQueries({ queryKey: ['workshop-session', vars.projectId, vars.reqId] })
    },
  })
}