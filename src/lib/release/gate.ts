export type ReleaseGateCheck = {
  id: string
  required: boolean
  passed: boolean
  detail?: string
}

export type ReleaseGateResult = {
  passed: boolean
  failedRequired: string[]
  failedOptional: string[]
}

export function evaluateReleaseGate(checks: ReleaseGateCheck[]): ReleaseGateResult {
  const failedRequired: string[] = []
  const failedOptional: string[] = []

  for (const check of checks) {
    if (check.passed) continue
    if (check.required) {
      failedRequired.push(check.id)
      continue
    }
    failedOptional.push(check.id)
  }

  return {
    passed: failedRequired.length === 0,
    failedRequired,
    failedOptional,
  }
}
