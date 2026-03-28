import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { auditAndCheck } from '@/lib/api-rbac'

/**
 * GET /api/cg/[projectId]/versions
 * 获取版本列表（按 productionTaskId 过滤）
 */
export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const productionTaskId = request.nextUrl.searchParams.get('productionTaskId')
  if (!productionTaskId) {
    throw new ApiError('INVALID_PARAMS', { message: 'productionTaskId query param is required' })
  }

  const task = await prisma.productionTask.findFirst({
    where: {
      id: productionTaskId,
      pipelineStep: { projectId },
    },
  })
  if (!task) {
    throw new ApiError('NOT_FOUND', { message: 'ProductionTask not found in this project' })
  }

  const versions = await prisma.cgVersion.findMany({
    where: { productionTaskId },
    orderBy: { versionNumber: 'desc' },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  })

  return NextResponse.json({ versions })
})

interface CreateVersionBody {
  productionTaskId: string
  comment?: string
  status?: string
  filePath?: string
  mediaPath?: string
  mediaId?: string
  thumbnailUrl?: string
  metadata?: string
}

/**
 * POST /api/cg/[projectId]/versions
 * 创建版本（自动递增 versionNumber）
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'edit', 'version')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as CreateVersionBody

  if (!body.productionTaskId?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'productionTaskId is required' })
  }

  const task = await prisma.productionTask.findFirst({
    where: {
      id: body.productionTaskId,
      pipelineStep: { projectId },
    },
  })
  if (!task) {
    throw new ApiError('NOT_FOUND', { message: 'ProductionTask not found in this project' })
  }

  const latestVersion = await prisma.cgVersion.findFirst({
    where: { productionTaskId: body.productionTaskId },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  })
  const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1

  const version = await prisma.cgVersion.create({
    data: {
      productionTaskId: body.productionTaskId,
      versionNumber: nextVersionNumber,
      comment: body.comment ?? null,
      status: body.status ?? 'pending_review',
      filePath: body.filePath ?? null,
      mediaPath: body.mediaPath ?? null,
      mediaId: body.mediaId ?? null,
      thumbnailUrl: body.thumbnailUrl ?? null,
      metadata: body.metadata ?? null,
      createdById: authResult.session.user.id,
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  })

  return NextResponse.json({ version }, { status: 201 })
})
