import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'

interface SearchHit {
  entityType: 'shot' | 'asset' | 'version'
  entityId: string
  name: string
  thumbnailUrl: string | null
  tags: string[]
}

/**
 * GET /api/cg/[projectId]/search?q=query&limit=20
 * Full-text search across project entities (shots, assets, versions)
 * Uses direct Prisma queries — no in-memory index.
 */
export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const query = request.nextUrl.searchParams.get('q')
  if (!query?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'Query parameter "q" is required' })
  }

  const limitParam = request.nextUrl.searchParams.get('limit')
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : 20

  const pattern = `%${query.trim()}%`

  const [shots, assets, versions] = await Promise.all([
    prisma.cgShot.findMany({
      where: {
        sequence: { projectId },
        OR: [
          { code: { contains: query.trim() } },
          { name: { contains: query.trim() } },
          { description: { contains: query.trim() } },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        thumbnailUrl: true,
      },
      take: limit,
    }),
    prisma.cgAsset.findMany({
      where: {
        projectId,
        OR: [
          { code: { contains: query.trim() } },
          { name: { contains: query.trim() } },
          { description: { contains: query.trim() } },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        assetType: true,
        status: true,
        thumbnailUrl: true,
      },
      take: limit,
    }),
    prisma.cgVersion.findMany({
      where: {
        productionTask: { pipelineStep: { projectId } },
        OR: [
          { comment: { contains: query.trim() } },
        ],
      },
      select: {
        id: true,
        versionNumber: true,
        comment: true,
        status: true,
        thumbnailUrl: true,
        productionTask: {
          select: {
            shot: { select: { code: true } },
            asset: { select: { code: true } },
            pipelineStep: { select: { name: true } },
          },
        },
      },
      take: limit,
    }),
  ])

  void pattern

  const results: SearchHit[] = []

  for (const shot of shots) {
    results.push({
      entityType: 'shot',
      entityId: shot.id,
      name: shot.name ?? shot.code,
      thumbnailUrl: shot.thumbnailUrl,
      tags: [shot.code, shot.status],
    })
  }

  for (const asset of assets) {
    results.push({
      entityType: 'asset',
      entityId: asset.id,
      name: asset.name,
      thumbnailUrl: asset.thumbnailUrl,
      tags: [asset.code, asset.assetType, asset.status],
    })
  }

  for (const version of versions) {
    const entityCode = version.productionTask.shot?.code
      ?? version.productionTask.asset?.code
      ?? 'unknown'
    results.push({
      entityType: 'version',
      entityId: version.id,
      name: `${entityCode} v${version.versionNumber}`,
      thumbnailUrl: version.thumbnailUrl,
      tags: [entityCode, version.productionTask.pipelineStep.name, version.status],
    })
  }

  return NextResponse.json({ results: results.slice(0, limit), query, total: results.length })
})
