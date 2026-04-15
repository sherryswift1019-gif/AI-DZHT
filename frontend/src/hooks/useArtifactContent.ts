import { useMutation } from '@tanstack/react-query'
import type { ArtifactContentRequest, ArtifactContentResponse } from '@/types/project'

export function useArtifactContent() {
  return useMutation<ArtifactContentResponse, Error, ArtifactContentRequest>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/v1/artifacts/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`产出物内容请求失败 (${res.status})`)
      return res.json() as Promise<ArtifactContentResponse>
    },
  })
}
