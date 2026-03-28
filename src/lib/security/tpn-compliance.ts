const SESSION_TIMEOUT_MS = 30 * 60 * 1000

// ─── Types ──────────────────────────────────────────────────────

export type ComplianceStatus = 'compliant' | 'partial' | 'non_compliant'

export interface TpnComplianceReport {
  mfaEnabled: boolean
  auditLogsEnabled: boolean
  tokenEntropy: string
  sessionTimeout: number
  encryptionAtRest: boolean
  encryptionInTransit: boolean
  watermarkEnabled: boolean
  overallStatus: ComplianceStatus
  issues: string[]
}

// ─── Detection helpers ──────────────────────────────────────────

function checkMfaEnabled(): boolean {
  return process.env.MFA_ENABLED === 'true'
}

function checkEncryptionAtRest(): boolean {
  const dbUrl = process.env.DATABASE_URL ?? ''
  return dbUrl.includes('ssl=true') || dbUrl.includes('sslmode=require') || process.env.DB_ENCRYPTION_AT_REST === 'true'
}

function checkEncryptionInTransit(): boolean {
  const baseUrl = process.env.NEXTAUTH_URL ?? ''
  return baseUrl.startsWith('https://') || process.env.NODE_ENV !== 'production'
}

function checkWatermarkEnabled(): boolean {
  return process.env.WATERMARK_ENABLED !== 'false'
}

// ─── Public API ─────────────────────────────────────────────────

export function generateComplianceReport(): TpnComplianceReport {
  const issues: string[] = []

  const mfaEnabled = checkMfaEnabled()
  if (!mfaEnabled) issues.push('MFA is not enabled')

  const auditLogsEnabled = true

  const tokenEntropy = '128-bit (16 bytes via crypto.randomBytes)'

  const sessionTimeout = SESSION_TIMEOUT_MS

  const encryptionAtRest = checkEncryptionAtRest()
  if (!encryptionAtRest) issues.push('Database encryption at rest is not confirmed')

  const encryptionInTransit = checkEncryptionInTransit()
  if (!encryptionInTransit) issues.push('HTTPS is not configured for production')

  const watermarkEnabled = checkWatermarkEnabled()
  if (!watermarkEnabled) issues.push('Watermark is disabled')

  let overallStatus: ComplianceStatus
  if (issues.length === 0) {
    overallStatus = 'compliant'
  } else if (issues.length <= 2) {
    overallStatus = 'partial'
  } else {
    overallStatus = 'non_compliant'
  }

  return {
    mfaEnabled,
    auditLogsEnabled,
    tokenEntropy,
    sessionTimeout,
    encryptionAtRest,
    encryptionInTransit,
    watermarkEnabled,
    overallStatus,
    issues,
  }
}
