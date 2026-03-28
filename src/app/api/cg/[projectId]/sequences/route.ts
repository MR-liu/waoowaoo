import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { auditAndCheck } from '@/lib/api-rbac'

/**
 * GET /api/cg/[projectId]/sequences
 * 获取项目下的所有场次（含镜头数量）
 */
export const GET = apiHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const sequences = await prisma.sequence.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: { select: { shots: true } },
    },
  })

  return NextResponse.json({
    sequences: sequences.map(seq => ({
      ...seq,
      shotsCount: seq._count.shots,
      _count: undefined,
    })),
  })
})

interface CreateSequenceBody {
  name: string
  code: string
  sortOrder?: number
  description?: string
  status?: string
}

/**
 * POST /api/cg/[projectId]/sequences
 * 创建场次
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'edit', 'sequence')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as CreateSequenceBody

  if (!body.name?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'name is required' })
  }
  if (!body.code?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'code is required' })
  }

  const sequence = await prisma.sequence.create({
    data: {
      projectId,
      name: body.name.trim(),
      code: body.code.trim(),
      sortOrder: body.sortOrder ?? 0,
      description: body.description ?? null,
      status: body.status ?? 'not_started',
    },
  })

  return NextResponse.json({ sequence }, { status: 201 })
})
