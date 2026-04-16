import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Agent, Command } from '@/types/agent'

const BASE = '/api/v1'

// ── Queries ─────────────────────────────────────────────────────────────────

export function useAgentList() {
  return useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await fetch(`${BASE}/agents`)
      if (!res.ok) throw new Error(`Failed to fetch agents (${res.status})`)
      const json = await res.json() as { data: Agent[]; total: number }
      return json.data
    },
  })
}

export function useAgentDetail(agentId: string | undefined) {
  return useQuery<Agent>({
    queryKey: ['agent', agentId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/agents/${agentId}`)
      if (!res.ok) throw new Error(`Failed to fetch agent (${res.status})`)
      const json = await res.json() as { data: Agent }
      return json.data
    },
    enabled: !!agentId,
  })
}

export function useCommandList() {
  return useQuery<Command[]>({
    queryKey: ['commands'],
    queryFn: async () => {
      const res = await fetch(`${BASE}/commands`)
      if (!res.ok) throw new Error(`Failed to fetch commands (${res.status})`)
      const json = await res.json() as { data: Command[]; total: number }
      return json.data
    },
  })
}

// ── Mutations ───────────────────────────────────────────────────────────────

export interface CreateAgentPayload {
  name: string
  description?: string
  role: Agent['role']
  source?: Agent['source']
  status?: Agent['status']
  version?: string
  commandIds?: string[]
  promptBlocks?: Agent['promptBlocks']
  shareScope?: Agent['shareScope']
  forkedFrom?: Agent['forkedFrom']
  createdBy?: string
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation<Agent, Error, CreateAgentPayload>({
    mutationFn: async (body) => {
      const res = await fetch(`${BASE}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Failed to create agent (${res.status})`)
      const json = await res.json() as { data: Agent }
      return json.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

export interface PatchAgentPayload {
  agentId: string
  name?: string
  description?: string
  role?: Agent['role']
  status?: Agent['status']
  version?: string
  commandIds?: string[]
  promptBlocks?: Agent['promptBlocks']
  shareScope?: Agent['shareScope']
}

export function usePatchAgent() {
  const qc = useQueryClient()
  return useMutation<Agent, Error, PatchAgentPayload>({
    mutationFn: async ({ agentId, ...body }) => {
      const res = await fetch(`${BASE}/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Failed to update agent (${res.status})`)
      const json = await res.json() as { data: Agent }
      return json.data
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['agents'] })
      void qc.invalidateQueries({ queryKey: ['agent', vars.agentId] })
    },
  })
}

export function useDeleteAgent() {
  const qc = useQueryClient()
  return useMutation<void, Error, { agentId: string }>({
    mutationFn: async ({ agentId }) => {
      const res = await fetch(`${BASE}/agents/${agentId}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error(`Failed to delete agent (${res.status})`)
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['agents'] })
      void qc.removeQueries({ queryKey: ['agent', vars.agentId] })
    },
  })
}
