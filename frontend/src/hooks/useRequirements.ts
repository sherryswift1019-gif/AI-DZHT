import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Requirement, RequirementPriority, PipelineStep } from '@/types/project'

const BASE = '/api/v1/projects'

// ── List ─────────────────────────────────────────────────────────────────────

export function useRequirementList(projectId: string) {
  return useQuery<Requirement[]>({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/${projectId}/requirements`)
      if (!res.ok) throw new Error(`Failed to fetch requirements (${res.status})`)
      return res.json() as Promise<Requirement[]>
    },
    enabled: !!projectId,
  })
}

// ── Create ────────────────────────────────────────────────────────────────────

export interface CreateReqPayload {
  projectId: string
  title: string
  summary: string
  priority: RequirementPriority
  assigneeId: string
  pipeline: PipelineStep[]
}

export function useCreateRequirement() {
  const qc = useQueryClient()
  return useMutation<Requirement, Error, CreateReqPayload>({
    mutationFn: async ({ projectId, ...body }) => {
      const res = await fetch(`${BASE}/${projectId}/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Failed to create requirement (${res.status})`)
      return res.json() as Promise<Requirement>
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['requirements', vars.projectId] })
    },
  })
}

// ── Patch ─────────────────────────────────────────────────────────────────────

export interface PatchReqPayload {
  projectId: string
  reqId: string
  title?: string
  summary?: string
  priority?: RequirementPriority
  assigneeId?: string
  status?: string
  pipeline?: PipelineStep[]
}

export function usePatchRequirement() {
  const qc = useQueryClient()
  return useMutation<Requirement, Error, PatchReqPayload>({
    mutationFn: async ({ projectId, reqId, ...body }) => {
      const res = await fetch(`${BASE}/${projectId}/requirements/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Failed to update requirement (${res.status})`)
      return res.json() as Promise<Requirement>
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['requirements', vars.projectId] })
    },
  })
}

// ── Delete ────────────────────────────────────────────────────────────────────

export interface DeleteReqPayload {
  projectId: string
  reqId: string
}

export function useDeleteRequirement() {
  const qc = useQueryClient()
  return useMutation<void, Error, DeleteReqPayload>({
    mutationFn: async ({ projectId, reqId }) => {
      const res = await fetch(`${BASE}/${projectId}/requirements/${reqId}`, {
        method: 'DELETE',
      })
      if (!res.ok && res.status !== 204) throw new Error(`Failed to delete requirement (${res.status})`)
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['requirements', vars.projectId] })
    },
  })
}
