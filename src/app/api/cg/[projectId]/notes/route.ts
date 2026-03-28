import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { auditAndCheck } from '@/lib/api-rbac'

/**
 * GET /api/cg/[projectId]/notes
 * 获取笔记列表（按 shotId/assetId/productionTaskId/versionId 过滤）
 */
export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const shotId = request.nextUrl.searchParams.get('shotId')
  const assetId = request.nextUrl.searchParams.get('assetId')
  const productionTaskId = request.nextUrl.searchParams.get('productionTaskId')
  const versionId = request.nextUrl.searchParams.get('versionId')

  interface NoteWhereFilter {
    shotId?: string
    assetId?: string
    productionTaskId?: string
    versionId?: string
    OR?: Array<
      | { shot: { sequence: { projectId: string } } }
      | { asset: { projectId: string } }
      | { productionTask: { pipelineStep: { projectId: string } } }
      | { version: { productionTask: { pipelineStep: { projectId: string } } } }
    >
  }

  const where: NoteWhereFilter = {}
  if (shotId) where.shotId = shotId
  if (assetId) where.assetId = assetId
  if (productionTaskId) where.productionTaskId = productionTaskId
  if (versionId) where.versionId = versionId

  if (!shotId && !assetId && !productionTaskId && !versionId) {
    where.OR = [
      { shot: { sequence: { projectId } } },
      { asset: { projectId } },
      { productionTask: { pipelineStep: { projectId } } },
      { version: { productionTask: { pipelineStep: { projectId } } } },
    ]
  }

  const notes = await prisma.cgNote.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  })

  return NextResponse.json({ notes })
})

interface CreateNoteBody {
  content: string
  shotId?: string
  assetId?: string
  productionTaskId?: string
  versionId?: string
  annotations?: string
  frameNumber?: number
}

/**
 * POST /api/cg/[projectId]/notes
 * 创建笔记
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'edit', 'note')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as CreateNoteBody

  if (!body.content?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'content is required' })
  }

  if (!body.shotId && !body.assetId && !body.productionTaskId && !body.versionId) {
    throw new ApiError('INVALID_PARAMS', {
      message: 'At least one of shotId, assetId, productionTaskId, or versionId is required',
    })
  }

  // Validate that referenced entities belong to this project
  if (body.shotId) {
    const shot = await prisma.cgShot.findFirst({
      where: { id: body.shotId, sequence: { projectId } },
    })
    if (!shot) throw new ApiError('NOT_FOUND', { message: 'Shot not found in this project' })
  }
  if (body.assetId) {
    const asset = await prisma.cgAsset.findFirst({
      where: { id: body.assetId, projectId },
    })
    if (!asset) throw new ApiError('NOT_FOUND', { message: 'Asset not found in this project' })
  }
  if (body.productionTaskId) {
    const task = await prisma.productionTask.findFirst({
      where: { id: body.productionTaskId, pipelineStep: { projectId } },
    })
    if (!task) throw new ApiError('NOT_FOUND', { message: 'ProductionTask not found in this project' })
  }
  if (body.versionId) {
    const version = await prisma.cgVersion.findFirst({
      where: { id: body.versionId, productionTask: { pipelineStep: { projectId } } },
    })
    if (!version) throw new ApiError('NOT_FOUND', { message: 'Version not found in this project' })
  }

  const note = await prisma.cgNote.create({
    data: {
      authorId: authResult.session.user.id,
      content: body.content.trim(),
      shotId: body.shotId ?? null,
      assetId: body.assetId ?? null,
      productionTaskId: body.productionTaskId ?? null,
      versionId: body.versionId ?? null,
      annotations: body.annotations ?? null,
      frameNumber: body.frameNumber ?? null,
    },
    include: {
      author: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  })

  return NextResponse.json({ note }, { status: 201 })
})
