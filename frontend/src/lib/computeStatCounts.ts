import type { Requirement } from '@/types/project'

export interface StatCounts {
  queued: number
  running: number
  pendingApproval: number
  pendingInput: number
  blocked: number
  done: number
}

/**
 * 互斥分类：每条需求仅归入一个桶，求和 === requirements.length
 */
export function computeStatCounts(requirements: Requirement[]): StatCounts {
  const counts: StatCounts = { queued: 0, running: 0, pendingApproval: 0, pendingInput: 0, blocked: 0, done: 0 }
  for (const r of requirements) {
    switch (r.status) {
      case 'done':    counts.done++;    break
      case 'blocked': counts.blocked++; break
      case 'queued':  counts.queued++;  break
      case 'running': {
        const current = r.pipeline.find(s => s.status !== 'done')
        if (current?.status === 'pending_approval' || current?.status === 'pending_advisory_approval') {
          counts.pendingApproval++
        } else if (current?.status === 'pending_input') {
          counts.pendingInput++
        } else {
          counts.running++
        }
        break
      }
    }
  }
  return counts
}
