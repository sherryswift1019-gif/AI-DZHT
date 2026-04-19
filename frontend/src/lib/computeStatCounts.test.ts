import { describe, it, expect } from 'vitest'
import { computeStatCounts } from './computeStatCounts'
import type { Requirement } from '@/types/project'
import type { PipelineStep, PipelineStepStatus, RequirementStatus } from '@/types/project'

// ── helpers ──────────────────────────────────────────────────────────

function makeStep(status: PipelineStepStatus): PipelineStep {
  return { id: 's1', name: 'step', agentName: 'A', status, updatedAt: '--' }
}

function makeReq(
  status: RequirementStatus,
  pipeline: PipelineStep[] = [],
): Requirement {
  return {
    id: `req-${Math.random()}`,
    projectId: 'p1',
    code: 'REQ-001',
    title: 'test',
    summary: '',
    priority: 'P1',
    status,
    assigneeId: 'u1',
    pipeline,
    stories: [],
  }
}

// ── tests ────────────────────────────────────────────────────────────

describe('computeStatCounts', () => {
  it('空数组返回全零', () => {
    const result = computeStatCounts([])
    expect(result).toEqual({
      queued: 0, running: 0, pendingApproval: 0, pendingInput: 0, blocked: 0, done: 0,
    })
  })

  it('done 需求归入 done 桶', () => {
    const result = computeStatCounts([makeReq('done')])
    expect(result.done).toBe(1)
    expect(result.queued + result.running + result.pendingApproval + result.pendingInput + result.blocked).toBe(0)
  })

  it('blocked 需求归入 blocked 桶', () => {
    const result = computeStatCounts([makeReq('blocked')])
    expect(result.blocked).toBe(1)
  })

  it('queued 需求归入 queued 桶', () => {
    const result = computeStatCounts([makeReq('queued')])
    expect(result.queued).toBe(1)
  })

  it('running + 当前步骤 running → running 桶', () => {
    const result = computeStatCounts([
      makeReq('running', [makeStep('done'), makeStep('running')]),
    ])
    expect(result.running).toBe(1)
    expect(result.pendingApproval).toBe(0)
  })

  it('running + 当前步骤 queued → running 桶', () => {
    const result = computeStatCounts([
      makeReq('running', [makeStep('done'), makeStep('queued')]),
    ])
    expect(result.running).toBe(1)
  })

  it('running + 当前步骤 pending_approval → pendingApproval 桶', () => {
    const result = computeStatCounts([
      makeReq('running', [makeStep('done'), makeStep('pending_approval')]),
    ])
    expect(result.pendingApproval).toBe(1)
    expect(result.running).toBe(0)
  })

  it('running + 当前步骤 pending_advisory_approval → pendingApproval 桶', () => {
    const result = computeStatCounts([
      makeReq('running', [makeStep('done'), makeStep('pending_advisory_approval')]),
    ])
    expect(result.pendingApproval).toBe(1)
  })

  it('running + 当前步骤 pending_input → pendingInput 桶', () => {
    const result = computeStatCounts([
      makeReq('running', [makeStep('done'), makeStep('pending_input')]),
    ])
    expect(result.pendingInput).toBe(1)
    expect(result.running).toBe(0)
  })

  it('running + 当前步骤 blocked → running 桶（步骤级 blocked 不影响需求分桶）', () => {
    const result = computeStatCounts([
      makeReq('running', [makeStep('done'), makeStep('blocked')]),
    ])
    expect(result.running).toBe(1)
    expect(result.blocked).toBe(0)
  })

  it('running + pipeline 为空数组 → running 桶（兜底）', () => {
    const result = computeStatCounts([makeReq('running', [])])
    expect(result.running).toBe(1)
  })

  it('running + pipeline 全 done → running 桶（兜底）', () => {
    const result = computeStatCounts([
      makeReq('running', [makeStep('done'), makeStep('done')]),
    ])
    expect(result.running).toBe(1)
  })

  it('互斥性：求和 === requirements.length（混合场景）', () => {
    const reqs = [
      makeReq('done'),
      makeReq('done'),
      makeReq('blocked'),
      makeReq('queued'),
      makeReq('queued'),
      makeReq('queued'),
      makeReq('running', [makeStep('running')]),
      makeReq('running', [makeStep('pending_approval')]),
      makeReq('running', [makeStep('pending_advisory_approval')]),
      makeReq('running', [makeStep('pending_input')]),
      makeReq('running', []),
    ]
    const result = computeStatCounts(reqs)
    const sum = result.queued + result.running + result.pendingApproval + result.pendingInput + result.blocked + result.done
    expect(sum).toBe(reqs.length)
    expect(result).toEqual({
      done: 2,
      blocked: 1,
      queued: 3,
      running: 2, // one running step + one empty pipeline
      pendingApproval: 2,
      pendingInput: 1,
    })
  })

  it('大量需求（99+）互斥性仍成立', () => {
    const reqs: Requirement[] = []
    for (let i = 0; i < 120; i++) {
      const statuses: RequirementStatus[] = ['done', 'blocked', 'queued', 'running']
      const status = statuses[i % 4]
      const pipeline = status === 'running'
        ? [makeStep('done'), makeStep(i % 8 === 0 ? 'pending_approval' : 'running')]
        : []
      reqs.push(makeReq(status, pipeline))
    }
    const result = computeStatCounts(reqs)
    const sum = result.queued + result.running + result.pendingApproval + result.pendingInput + result.blocked + result.done
    expect(sum).toBe(120)
  })

  // ── 增强测试（边界场景） ──────────────────────────────────────────

  describe('边界场景', () => {
    it('全部 done — 单一桶满载', () => {
      const reqs = Array.from({ length: 5 }, () => makeReq('done'))
      const result = computeStatCounts(reqs)
      expect(result.done).toBe(5)
      expect(result.queued + result.running + result.pendingApproval + result.pendingInput + result.blocked).toBe(0)
    })

    it('全部需要介入 — 介入组三桶各命中', () => {
      const reqs = [
        makeReq('running', [makeStep('pending_approval')]),
        makeReq('blocked'),
        makeReq('running', [makeStep('pending_input')]),
      ]
      const result = computeStatCounts(reqs)
      expect(result.pendingApproval).toBe(1)
      expect(result.blocked).toBe(1)
      expect(result.pendingInput).toBe(1)
      expect(result.queued + result.running + result.done).toBe(0)
    })

    it('全部 queued — 介入桶全零', () => {
      const reqs = Array.from({ length: 5 }, () => makeReq('queued'))
      const result = computeStatCounts(reqs)
      expect(result.queued).toBe(5)
      expect(result.pendingApproval + result.pendingInput + result.blocked).toBe(0)
    })
  })

  describe('pipeline 结构边界', () => {
    it('多步 pipeline — 取首个非 done 步骤决定分桶', () => {
      const result = computeStatCounts([
        makeReq('running', [
          makeStep('done'),
          makeStep('pending_approval'),
          makeStep('running'),
        ]),
      ])
      expect(result.pendingApproval).toBe(1)
      expect(result.running).toBe(0)
    })

    it('单步 pipeline（非 done） — 无 done 前缀也正确', () => {
      const result = computeStatCounts([
        makeReq('running', [makeStep('pending_input')]),
      ])
      expect(result.pendingInput).toBe(1)
    })

    it('advisory + mandatory 混合 — 均计入 pendingApproval', () => {
      const reqs = [
        makeReq('running', [makeStep('pending_approval')]),
        makeReq('running', [makeStep('pending_advisory_approval')]),
      ]
      const result = computeStatCounts(reqs)
      expect(result.pendingApproval).toBe(2)
    })
  })

  describe('纯函数契约', () => {
    it('running + 空 pipeline 时非 running 桶全零', () => {
      const result = computeStatCounts([makeReq('running', [])])
      expect(result).toEqual({ queued: 0, running: 1, pendingApproval: 0, pendingInput: 0, blocked: 0, done: 0 })
    })

    it('幂等性 — 同一输入两次调用结果深相等', () => {
      const reqs = [
        makeReq('done'),
        makeReq('running', [makeStep('pending_approval')]),
        makeReq('blocked'),
      ]
      const r1 = computeStatCounts(reqs)
      const r2 = computeStatCounts(reqs)
      expect(r1).toEqual(r2)
    })

    it('不修改原数组 — 调用前后 reqs 长度与内容不变', () => {
      const reqs = [makeReq('running', [makeStep('pending_approval')]), makeReq('done')]
      const snapshot = JSON.stringify(reqs)
      computeStatCounts(reqs)
      expect(JSON.stringify(reqs)).toBe(snapshot)
    })

    it('单条需求各状态互斥 — 仅命中桶为 1，其余全零', () => {
      const ZERO = { queued: 0, running: 0, pendingApproval: 0, pendingInput: 0, blocked: 0, done: 0 }
      const cases: Array<{ req: Requirement; expectedBucket: keyof typeof ZERO }> = [
        { req: makeReq('done'), expectedBucket: 'done' },
        { req: makeReq('blocked'), expectedBucket: 'blocked' },
        { req: makeReq('queued'), expectedBucket: 'queued' },
        { req: makeReq('running', [makeStep('running')]), expectedBucket: 'running' },
        { req: makeReq('running', [makeStep('pending_approval')]), expectedBucket: 'pendingApproval' },
        { req: makeReq('running', [makeStep('pending_input')]), expectedBucket: 'pendingInput' },
      ]
      for (const { req, expectedBucket } of cases) {
        const result = computeStatCounts([req])
        expect(result[expectedBucket]).toBe(1)
        const otherSum = Object.entries(result)
          .filter(([k]) => k !== expectedBucket)
          .reduce((acc, [, v]) => acc + v, 0)
        expect(otherSum).toBe(0)
      }
    })
  })
})
