import { useMutation } from '@tanstack/react-query'
import type { WorkflowSuggestRequest, WorkflowSuggestResponse } from '@/types/project'

export function useWorkflowSuggest() {
  return useMutation<WorkflowSuggestResponse, Error, WorkflowSuggestRequest>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/v1/workflow/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`AI 分析请求失败 (${res.status})`)
      return res.json() as Promise<WorkflowSuggestResponse>
    },
  })
}
