import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { auditAndCheck } from '@/lib/api-rbac'

/**
 * GET /api/cg/[projectId]/assets/variations?assetId=xxx
 * List variations for an asset.
 */
export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const assetId = request.nextUrl.searchParams.get('assetId')
  if (!assetId) {
    throw new ApiError('INVALID_PARAMS', { message: 'assetId query parameter is required' })
  }

  const variations = await prisma.assetVariation.findMany({
    where: {
      assetId,
      asset: { projectId },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ variations })
})

interface CreateVariationBody {
  assetId: string
  name: string
  code: string
  description?: string
}

/**
 * POST /api/cg/[projectId]/assets/variations
 * Create a variation for an asset.
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'edit', 'assetVariation')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as CreateVariationBody

  if (!body.assetId?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'assetId is required' })
  }
  if (!body.name?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'name is required' })
  }
  if (!body.code?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'code is required' })
  }

  const asset = await prisma.cgAsset.findFirst({
    where: { id: body.assetId, projectId },
  })
  if (!asset) {
    throw new ApiError('NOT_FOUND', { message: 'Asset not found in this project' })
  }

  const variation = await prisma.assetVariation.create({
    data: {
      assetId: body.assetId,
      name: body.name.trim(),
      code: body.code.trim(),
      description: body.description ?? null,
    },
  })

  return NextResponse.json({ variation }, { status: 201 })
})

/**
 * DELETE /api/cg/[projectId]/assets/variations?variationId=xxx
 * Delete a variation.
 */
export const DELETE = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'edit', 'assetVariation')
  if (!rbac.allowed) return rbac.response

  const variationId = request.nextUrl.searchParams.get('variationId')
  if (!variationId) {
    throw new ApiError('INVALID_PARAMS', { message: 'variationId query parameter is required' })
  }

  const variation = await prisma.assetVariation.findFirst({
    where: {
      id: variationId,
      asset: { projectId },
    },
  })
  if (!variation) {
    throw new ApiError('NOT_FOUND', { message: 'Variation not found in this project' })
  }

  await prisma.assetVariation.delete({ where: { id: variationId } })

  return NextResponse.json({ success: true })
})
