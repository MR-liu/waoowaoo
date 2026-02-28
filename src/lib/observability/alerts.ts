export type AlertLevel = 'ok' | 'warn' | 'critical'
export type AlertDirection = 'above' | 'below'

export type AlertThresholdRule = {
  warn: number
  critical: number
  direction: AlertDirection
}

export type ObservabilitySnapshot = {
  taskFailureRate: number
  terminalMismatchRate: number
  maxQueueBacklog: number
  staleProcessingCount: number
  billingCompensationFailedCount: number
}

export type ObservabilityAlertKey =
  | 'taskFailureRate'
  | 'terminalMismatchRate'
  | 'maxQueueBacklog'
  | 'staleProcessingCount'
  | 'billingCompensationFailedCount'

export type ObservabilityAlertThresholds = Record<ObservabilityAlertKey, AlertThresholdRule>

export const DEFAULT_OBSERVABILITY_ALERT_THRESHOLDS: ObservabilityAlertThresholds = {
  // SLO: 任务24h成功率 >= 97%
  taskFailureRate: {
    warn: 0.03,
    critical: 0.05,
    direction: 'above',
  },
  // SLO: 终态错配率 < 0.1%
  terminalMismatchRate: {
    warn: 0.001,
    critical: 0.005,
    direction: 'above',
  },
  maxQueueBacklog: {
    warn: 200,
    critical: 500,
    direction: 'above',
  },
  staleProcessingCount: {
    warn: 10,
    critical: 30,
    direction: 'above',
  },
  billingCompensationFailedCount: {
    warn: 1,
    critical: 5,
    direction: 'above',
  },
}

export type AlertEvaluation = {
  key: ObservabilityAlertKey
  value: number
  rule: AlertThresholdRule
  level: AlertLevel
}

export type ObservabilityAlertResult = {
  overallLevel: AlertLevel
  checks: Record<ObservabilityAlertKey, AlertEvaluation>
}

function toFiniteNumber(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value
}

export function evaluateAlertLevel(value: number, rule: AlertThresholdRule): AlertLevel {
  const normalized = toFiniteNumber(value)
  if (rule.direction === 'below') {
    if (normalized <= rule.critical) return 'critical'
    if (normalized <= rule.warn) return 'warn'
    return 'ok'
  }
  if (normalized >= rule.critical) return 'critical'
  if (normalized >= rule.warn) return 'warn'
  return 'ok'
}

function mergeAlertLevel(current: AlertLevel, next: AlertLevel): AlertLevel {
  if (current === 'critical' || next === 'critical') return 'critical'
  if (current === 'warn' || next === 'warn') return 'warn'
  return 'ok'
}

export function evaluateObservabilitySnapshot(
  snapshot: ObservabilitySnapshot,
  thresholds: ObservabilityAlertThresholds = DEFAULT_OBSERVABILITY_ALERT_THRESHOLDS,
): ObservabilityAlertResult {
  const checks = {
    taskFailureRate: {
      key: 'taskFailureRate',
      value: toFiniteNumber(snapshot.taskFailureRate),
      rule: thresholds.taskFailureRate,
      level: evaluateAlertLevel(snapshot.taskFailureRate, thresholds.taskFailureRate),
    },
    terminalMismatchRate: {
      key: 'terminalMismatchRate',
      value: toFiniteNumber(snapshot.terminalMismatchRate),
      rule: thresholds.terminalMismatchRate,
      level: evaluateAlertLevel(snapshot.terminalMismatchRate, thresholds.terminalMismatchRate),
    },
    maxQueueBacklog: {
      key: 'maxQueueBacklog',
      value: toFiniteNumber(snapshot.maxQueueBacklog),
      rule: thresholds.maxQueueBacklog,
      level: evaluateAlertLevel(snapshot.maxQueueBacklog, thresholds.maxQueueBacklog),
    },
    staleProcessingCount: {
      key: 'staleProcessingCount',
      value: toFiniteNumber(snapshot.staleProcessingCount),
      rule: thresholds.staleProcessingCount,
      level: evaluateAlertLevel(snapshot.staleProcessingCount, thresholds.staleProcessingCount),
    },
    billingCompensationFailedCount: {
      key: 'billingCompensationFailedCount',
      value: toFiniteNumber(snapshot.billingCompensationFailedCount),
      rule: thresholds.billingCompensationFailedCount,
      level: evaluateAlertLevel(snapshot.billingCompensationFailedCount, thresholds.billingCompensationFailedCount),
    },
  } satisfies Record<ObservabilityAlertKey, AlertEvaluation>

  let overallLevel: AlertLevel = 'ok'
  for (const key of Object.keys(checks) as ObservabilityAlertKey[]) {
    overallLevel = mergeAlertLevel(overallLevel, checks[key].level)
  }

  return {
    overallLevel,
    checks,
  }
}
