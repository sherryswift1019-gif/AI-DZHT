import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Project, ProjectStatus, RequirementStatus } from '@/types/project'

const BASE = '/api/v1/projects'

type RequirementStats = {
  total: number
  done: number
  running: number
  blocked: number
  queued: number
}

type ActiveRequirementItem = {
  id: string
  code: string
  status: RequirementStatus
}

export type ProjectRequirementOverview = {
  stats: RequirementStats
  active: ActiveRequirementItem[]
}

export function useProjectList() {
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch(BASE)
      if (!res.ok) throw new Error(`Failed to fetch projects (${res.status})`)
      return res.json() as Promise<Project[]>
    },
  })
}

export function useProjectDetail(projectId: string) {
  return useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/${projectId}`)
      if (!res.ok) throw new Error(`Failed to fetch project (${res.status})`)
      return res.json() as Promise<Project>
    },
    enabled: !!projectId,
  })
}

export interface CreateProjectPayload {
  name: string
  description: string
  ownerId: string
  memberIds?: string[]
  status?: ProjectStatus
  color?: string
  context: Project['context']
  startDate?: string
  endDate?: string
  budget?: number
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation<Project, Error, CreateProjectPayload>({
    mutationFn: async (body) => {
      const res = await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Failed to create project (${res.status})`)
      return res.json() as Promise<Project>
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export interface PatchProjectPayload {
  projectId: string
  name?: string
  description?: string
  ownerId?: string
  memberIds?: string[]
  status?: ProjectStatus
  color?: string
  context?: Project['context']
  settings?: Project['settings']
  startDate?: string
  endDate?: string
  budget?: number
}

export function usePatchProject() {
  const qc = useQueryClient()
  return useMutation<Project, Error, PatchProjectPayload>({
    mutationFn: async ({ projectId, ...body }) => {
      const res = await fetch(`${BASE}/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Failed to update project (${res.status})`)
      return res.json() as Promise<Project>
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['projects'] })
      void qc.invalidateQueries({ queryKey: ['project', vars.projectId] })
    },
  })
}

export interface DeleteProjectPayload {
  projectId: string
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation<void, Error, DeleteProjectPayload>({
    mutationFn: async ({ projectId }) => {
      const res = await fetch(`${BASE}/${projectId}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error(`Failed to delete project (${res.status})`)
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['projects'] })
      void qc.removeQueries({ queryKey: ['project', vars.projectId] })
      void qc.removeQueries({ queryKey: ['requirements', vars.projectId] })
    },
  })
}

function emptyStats(): RequirementStats {
  return { total: 0, done: 0, running: 0, blocked: 0, queued: 0 }
}

export function useProjectRequirementStats(projectIds: string[]) {
  return useQuery<Record<string, ProjectRequirementOverview>>({
    queryKey: ['project-requirement-stats', ...projectIds],
    queryFn: async () => {
      const pairs = await Promise.all(
        projectIds.map(async (projectId) => {
          const res = await fetch(`${BASE}/${projectId}/requirements`)
          if (!res.ok) {
            return [projectId, { stats: emptyStats(), active: [] }] as const
          }
          const reqs = (await res.json()) as Array<{ id: string; code: string; status: RequirementStatus }>
          const stats = reqs.reduce<RequirementStats>((acc, req) => {
            acc.total += 1
            acc[req.status] += 1
            return acc
          }, emptyStats())

          const active = reqs
            .filter((req) => req.status === 'running' || req.status === 'blocked')
            .slice(0, 3)
            .map((req) => ({ id: req.id, code: req.code, status: req.status }))

          return [projectId, { stats, active }] as const
        }),
      )

      return Object.fromEntries(pairs)
    },
    enabled: projectIds.length > 0,
  })
}
