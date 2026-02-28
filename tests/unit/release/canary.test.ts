import { describe, expect, it } from 'vitest'
import { validateCanaryPlan, type CanaryPlan } from '@/lib/release/canary'

describe('canary plan validation', () => {
  it('passes for strictly increasing canary steps ending at 100%', () => {
    const plan: CanaryPlan = {
      service: 'foldx-web',
      versioning: 'immutable-image-tag',
      steps: [
        { trafficPercent: 5, holdMinutes: 10, entryCriteria: ['a'], rollbackCriteria: ['b'] },
        { trafficPercent: 50, holdMinutes: 20, entryCriteria: ['a'], rollbackCriteria: ['b'] },
        { trafficPercent: 100, holdMinutes: 30, entryCriteria: ['a'], rollbackCriteria: ['b'] },
      ],
    }

    expect(validateCanaryPlan(plan)).toEqual([])
  })

  it('fails when steps are not increasing or final step is not 100%', () => {
    const plan: CanaryPlan = {
      service: 'foldx-web',
      versioning: 'immutable-image-tag',
      steps: [
        { trafficPercent: 20, holdMinutes: 10, entryCriteria: ['a'], rollbackCriteria: ['b'] },
        { trafficPercent: 10, holdMinutes: 20, entryCriteria: ['a'], rollbackCriteria: ['b'] },
      ],
    }

    const violations = validateCanaryPlan(plan)
    expect(violations).toContain('steps[1].trafficPercent must be strictly increasing')
    expect(violations).toContain('final step trafficPercent must be 100')
  })
})
