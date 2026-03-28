import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { auditAndCheck } from '@/lib/api-rbac'

/**
 * GET /api/cg/[projectId]/shots
 * 获取镜头列表（可按 sequenceId 过滤），包含场次信息
 */
export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const sequenceId = request.nextUrl.searchParams.get('sequenceId')

  const where: { sequence: { projectId: string }; sequenceId?: string } = {
    sequence: { projectId },
  }
  if (sequenceId) {
    where.sequenceId = sequenceId
  }

  const shots = await prisma.cgShot.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
    include: {
      sequence: {
        select: { id: true, name: true, code: true },
      },
    },
  })

  return NextResponse.json({ shots })
})

interface CreateShotBody {
  sequenceId: string
  code: string
  name?: string
  description?: string
  sortOrder?: number
  status?: string
  frameIn?: number
  frameOut?: number
  duration?: number
}

/**
 * POST /api/cg/[projectId]/shots
 * 创建镜头
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'edit', 'shot')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as CreateShotBody

  if (!body.sequenceId?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'sequenceId is required' })
  }
  if (!body.code?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'code is required' })
  }

  const sequence = await prisma.sequence.findFirst({
    where: { id: body.sequenceId, projectId },
  })
  if (!sequence) {
    throw new ApiError('NOT_FOUND', { message: 'Sequence not found in this project' })
  }

  const shot = await prisma.cgShot.create({
    data: {
      sequenceId: body.sequenceId,
      code: body.code.trim(),
      name: body.name?.trim() ?? null,
      description: body.description ?? null,
      sortOrder: body.sortOrder ?? 0,
      status: body.status ?? 'not_started',
      frameIn: body.frameIn ?? null,
      frameOut: body.frameOut ?? null,
      duration: body.duration ?? null,
    },
    include: {
      sequence: {
        select: { id: true, name: true, code: true },
      },
    },
  })

  return NextResponse.json({ shot }, { status: 201 })
})

interface PatchShotBody {
  id: string
  name?: string | null
  frameIn?: number | null
  frameOut?: number | null
  duration?: number | null
  status?: string
}

/**
 * PATCH /api/cg/[projectId]/shots
 * 更新单个镜头的可编辑字段
 */
export const PATCH = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'edit', 'shot')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as PatchShotBody

  if (!body.id?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'id is required' })
  }

  const existing = await prisma.cgShot.findFirst({
    where: { id: body.id, sequence: { projectId } },
  })
  if (!existing) {
    throw new ApiError('NOT_FOUND', { message: 'Shot not found in this project' })
  }

  const data: Record<string, unknown> = {}
  if ('name' in body) data.name = body.name
  if ('frameIn' in body) data.frameIn = body.frameIn
  if ('frameOut' in body) data.frameOut = body.frameOut
  if ('duration' in body) data.duration = body.duration
  if ('status' in body) data.status = body.status

  const shot = await prisma.cgShot.update({
    where: { id: body.id },
    data,
    include: {
      sequence: { select: { id: true, name: true, code: true } },
    },
  })

  return NextResponse.json({ shot })
})
