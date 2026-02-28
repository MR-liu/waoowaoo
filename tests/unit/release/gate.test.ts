import { describe, expect, it } from 'vitest'
import { evaluateReleaseGate } from '@/lib/release/gate'

describe('release gate', () => {
  it('passes when all required checks pass', () => {
    const result = evaluateReleaseGate([
      { id: 'p0-regression', required: true, passed: true },
      { id: 'observability-alert-check', required: true, passed: true },
      { id: 'p1-smoke', required: false, passed: false },
    ])

    expect(result.passed).toBe(true)
    expect(result.failedRequired).toEqual([])
    expect(result.failedOptional).toEqual(['p1-smoke'])
  })

  it('fails when any required check fails', () => {
    const result = evaluateReleaseGate([
      { id: 'p0-regression', required: true, passed: false },
      { id: 'observability-alert-check', required: true, passed: true },
    ])

    expect(result.passed).toBe(false)
    expect(result.failedRequired).toEqual(['p0-regression'])
    expect(result.failedOptional).toEqual([])
  })
})
