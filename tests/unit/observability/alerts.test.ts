import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OBSERVABILITY_ALERT_THRESHOLDS,
  evaluateAlertLevel,
  evaluateObservabilitySnapshot,
} from '@/lib/observability/alerts'

describe('observability alerts', () => {
  it('evaluates above-direction threshold correctly', () => {
    const rule = DEFAULT_OBSERVABILITY_ALERT_THRESHOLDS.taskFailureRate
    expect(evaluateAlertLevel(0.01, rule)).toBe('ok')
    expect(evaluateAlertLevel(0.03, rule)).toBe('warn')
    expect(evaluateAlertLevel(0.06, rule)).toBe('critical')
  })

  it('merges per-check levels into overall critical when one check is critical', () => {
    const result = evaluateObservabilitySnapshot({
      taskFailureRate: 0.02,
      terminalMismatchRate: 0.006,
      maxQueueBacklog: 120,
      staleProcessingCount: 4,
      billingCompensationFailedCount: 0,
    })

    expect(result.checks.taskFailureRate.level).toBe('ok')
    expect(result.checks.terminalMismatchRate.level).toBe('critical')
    expect(result.overallLevel).toBe('critical')
  })

  it('returns warn level when thresholds are crossed but no critical breach', () => {
    const result = evaluateObservabilitySnapshot({
      taskFailureRate: 0.031,
      terminalMismatchRate: 0,
      maxQueueBacklog: 50,
      staleProcessingCount: 0,
      billingCompensationFailedCount: 0,
    })

    expect(result.checks.taskFailureRate.level).toBe('warn')
    expect(result.overallLevel).toBe('warn')
  })
})
