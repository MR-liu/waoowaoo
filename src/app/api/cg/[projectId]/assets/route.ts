import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { auditAndCheck } from '@/lib/api-rbac'

/**
 * GET /api/cg/[projectId]/assets
 * 获取资产列表（可按 assetType 过滤）
 */
export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const assetType = request.nextUrl.searchParams.get('assetType')

  const where: { projectId: string; assetType?: string } = { projectId }
  if (assetType) {
    where.assetType = assetType
  }

  const assets = await prisma.cgAsset.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ assets })
})

interface CreateAssetBody {
  name: string
  code: string
  assetType: string
  description?: string
  status?: string
  metadata?: string
}

/**
 * POST /api/cg/[projectId]/assets
 * 创建资产
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'edit', 'asset')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as CreateAssetBody

  if (!body.name?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'name is required' })
  }
  if (!body.code?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'code is required' })
  }
  if (!body.assetType?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'assetType is required' })
  }

  const asset = await prisma.cgAsset.create({
    data: {
      projectId,
      name: body.name.trim(),
      code: body.code.trim(),
      assetType: body.assetType.trim(),
      description: body.description ?? null,
      status: body.status ?? 'not_started',
      metadata: body.metadata ?? null,
    },
  })

  return NextResponse.json({ asset }, { status: 201 })
})

interface PatchAssetBody {
  id: string
  name?: string
  status?: string
  description?: string | null
}

/**
 * PATCH /api/cg/[projectId]/assets
 * 更新单个资产的可编辑字段
 */
export const PATCH = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'edit', 'asset')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as PatchAssetBody

  if (!body.id?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'id is required' })
  }

  const existing = await prisma.cgAsset.findFirst({
    where: { id: body.id, projectId },
  })
  if (!existing) {
    throw new ApiError('NOT_FOUND', { message: 'Asset not found in this project' })
  }

  const data: Record<string, unknown> = {}
  if ('name' in body) data.name = body.name
  if ('status' in body) data.status = body.status
  if ('description' in body) data.description = body.description

  const asset = await prisma.cgAsset.update({
    where: { id: body.id },
    data,
  })

  return NextResponse.json({ asset })
})
