import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LLMConfig, LLMConfigUpdateRequest, LLMProviderInfo, LLMTestResponse } from '@/types/llm'

const BASE = '/api/v1/llm-config'

export function useLLMConfig() {
  return useQuery<LLMConfig>({
    queryKey: ['llm-config'],
    queryFn: async () => {
      const res = await fetch(BASE)
      if (!res.ok) throw new Error('Failed to load LLM config')
      return res.json()
    },
  })
}

export function useLLMProviders() {
  return useQuery<LLMProviderInfo[]>({
    queryKey: ['llm-config', 'models'],
    queryFn: async () => {
      const res = await fetch(`${BASE}/models`)
      if (!res.ok) throw new Error('Failed to load models')
      return res.json()
    },
  })
}

export function useUpdateLLMConfig() {
  const qc = useQueryClient()
  return useMutation<LLMConfig, Error, LLMConfigUpdateRequest>({
    mutationFn: async (body) => {
      const res = await fetch(BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to update config')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['llm-config'] }),
  })
}

export function useTestLLMConnection() {
  return useMutation<LLMTestResponse, Error, LLMConfigUpdateRequest>({
    mutationFn: async (body) => {
      const res = await fetch(`${BASE}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to test connection')
      return res.json()
    },
  })
}
