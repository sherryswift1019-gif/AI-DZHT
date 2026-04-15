import { useMutation } from '@tanstack/react-query'
import type { StepDetailRequest, StepDetailResponse } from '@/types/project'

export function useStepDetail() {
  return useMutation<StepDetailResponse, Error, StepDetailRequest>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/v1/steps/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`步骤详情请求失败 (${res.status})`)
      return res.json() as Promise<StepDetailResponse>
    },
  })
}
