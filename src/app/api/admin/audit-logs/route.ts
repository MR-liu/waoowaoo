import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isAdminSession } from '@/lib/admin'
import type { Prisma } from '@prisma/client'

function ensureAdminAccess(session: { user: { id: string; name?: string | null; isAdmin?: boolean } }) {
  if (isAdminSession(session)) return
  throw new ApiError('FORBIDDEN', {
    message: 'Admin access required',
    errorCode: 'ADMIN_REQUIRED',
  })
}

/**
 * GET /api/admin/audit-logs
 * Query audit logs with filters and pagination (admin only)
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  ensureAdminAccess(authResult.session)

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId') || undefined
  const projectId = searchParams.get('projectId') || undefined
  const action = searchParams.get('action') || undefined
  const from = searchParams.get('from') || undefined
  const to = searchParams.get('to') || undefined
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)))

  const where: Prisma.AuditLogWhereInput = {}
  if (userId) where.userId = userId
  if (projectId) where.projectId = projectId
  if (action) where.action = action
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) {
      const endOfDay = new Date(to)
      endOfDay.setHours(23, 59, 59, 999)
      where.createdAt.lte = endOfDay
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ])

  const totalPages = Math.ceil(total / pageSize)

  return NextResponse.json({
    logs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  })
})
