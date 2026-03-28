import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { createScopedLogger } from '@/lib/logging/core'

const logger = createScopedLogger({ module: 'audit' })

interface AuditEntry {
  userId: string
  projectId?: string
  action: string
  resource: string
  resourceId?: string
  metadata?: Record<string, unknown>
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const hdrs = await headers()
    const ipAddress = hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip') ?? null
    const userAgent = hdrs.get('user-agent') ?? null

    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        projectId: entry.projectId ?? null,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId ?? null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        ipAddress,
        userAgent,
      },
    })
  } catch (error) {
    logger.error({
      action: 'audit.record.failed',
      message: 'Failed to record audit log',
      error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
      ...entry,
    })
  }
}

/**
 * Record multiple audit entries in a single transaction.
 * Shares the same request context (IP, user-agent) across all entries.
 */
export async function recordAuditBulk(entries: AuditEntry[]): Promise<void> {
  if (entries.length === 0) return

  try {
    const hdrs = await headers()
    const ipAddress = hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip') ?? null
    const userAgent = hdrs.get('user-agent') ?? null

    await prisma.auditLog.createMany({
      data: entries.map(entry => ({
        userId: entry.userId,
        projectId: entry.projectId ?? null,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId ?? null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        ipAddress,
        userAgent,
      })),
    })
  } catch (error) {
    logger.error({
      action: 'audit.record_bulk.failed',
      message: `Failed to record ${entries.length} audit log entries`,
      error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
      details: { entryCount: entries.length },
    })
  }
}
