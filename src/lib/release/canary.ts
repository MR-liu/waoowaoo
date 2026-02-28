export type CanaryStep = {
  trafficPercent: number
  holdMinutes: number
  entryCriteria: string[]
  rollbackCriteria: string[]
}

export type CanaryPlan = {
  service: string
  versioning: string
  steps: CanaryStep[]
}

export function validateCanaryPlan(plan: CanaryPlan): string[] {
  const violations: string[] = []

  if (!plan.service || !plan.service.trim()) {
    violations.push('service is required')
  }
  if (!plan.versioning || !plan.versioning.trim()) {
    violations.push('versioning is required')
  }
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    violations.push('steps must be a non-empty array')
    return violations
  }

  let previousTraffic = 0
  for (let index = 0; index < plan.steps.length; index += 1) {
    const step = plan.steps[index]
    const prefix = `steps[${String(index)}]`
    if (!Number.isFinite(step.trafficPercent) || step.trafficPercent <= 0 || step.trafficPercent > 100) {
      violations.push(`${prefix}.trafficPercent must be within (0, 100]`)
    }
    if (step.trafficPercent <= previousTraffic) {
      violations.push(`${prefix}.trafficPercent must be strictly increasing`)
    }
    previousTraffic = step.trafficPercent

    if (!Number.isFinite(step.holdMinutes) || step.holdMinutes <= 0) {
      violations.push(`${prefix}.holdMinutes must be > 0`)
    }
    if (!Array.isArray(step.entryCriteria) || step.entryCriteria.length === 0) {
      violations.push(`${prefix}.entryCriteria must be non-empty`)
    }
    if (!Array.isArray(step.rollbackCriteria) || step.rollbackCriteria.length === 0) {
      violations.push(`${prefix}.rollbackCriteria must be non-empty`)
    }
  }

  const finalStep = plan.steps[plan.steps.length - 1]
  if (finalStep && finalStep.trafficPercent !== 100) {
    violations.push('final step trafficPercent must be 100')
  }

  return violations
}
