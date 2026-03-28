import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { auditAndCheck } from '@/lib/api-rbac'

type RouteParams = { projectId: string; playlistId: string }

/**
 * GET /api/cg/[projectId]/playlists/[playlistId]/items
 */
export const GET = apiHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) => {
  const { projectId, playlistId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, projectId },
  })
  if (!playlist) {
    throw new ApiError('NOT_FOUND', { message: 'Playlist not found in this project' })
  }

  const items = await prisma.playlistItem.findMany({
    where: { playlistId },
    orderBy: { sortOrder: 'asc' },
    include: {
      version: {
        include: {
          createdBy: { select: { id: true, name: true, image: true } },
          productionTask: {
            include: {
              shot: { select: { id: true, code: true, name: true } },
              asset: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
    },
  })

  return NextResponse.json({ items })
})

interface AddItemBody {
  versionId: string
}

/**
 * POST /api/cg/[projectId]/playlists/[playlistId]/items
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) => {
  const { projectId, playlistId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'edit', 'playlist_item')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as AddItemBody

  if (!body.versionId?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'versionId is required' })
  }

  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, projectId },
  })
  if (!playlist) {
    throw new ApiError('NOT_FOUND', { message: 'Playlist not found in this project' })
  }

  const version = await prisma.cgVersion.findFirst({
    where: {
      id: body.versionId,
      productionTask: { pipelineStep: { projectId } },
    },
  })
  if (!version) {
    throw new ApiError('NOT_FOUND', { message: 'Version not found in this project' })
  }

  const maxSortOrder = await prisma.playlistItem.aggregate({
    where: { playlistId },
    _max: { sortOrder: true },
  })
  const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1

  const item = await prisma.playlistItem.create({
    data: {
      playlistId,
      versionId: body.versionId,
      sortOrder: nextSortOrder,
    },
    include: {
      version: {
        include: {
          createdBy: { select: { id: true, name: true, image: true } },
          productionTask: {
            include: {
              shot: { select: { id: true, code: true, name: true } },
              asset: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
    },
  })

  return NextResponse.json({ item }, { status: 201 })
})

interface ReorderBody {
  orderedIds: string[]
}

/**
 * PATCH /api/cg/[projectId]/playlists/[playlistId]/items
 * 批量更新 sortOrder（拖拽排序持久化）
 */
export const PATCH = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) => {
  const { projectId, playlistId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'edit', 'playlist_item')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as ReorderBody

  if (!Array.isArray(body.orderedIds) || body.orderedIds.length === 0) {
    throw new ApiError('INVALID_PARAMS', { message: 'orderedIds array is required' })
  }

  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, projectId },
  })
  if (!playlist) {
    throw new ApiError('NOT_FOUND', { message: 'Playlist not found in this project' })
  }

  await prisma.$transaction(
    body.orderedIds.map((id, index) =>
      prisma.playlistItem.updateMany({
        where: { id, playlistId },
        data: { sortOrder: index },
      }),
    ),
  )

  return NextResponse.json({ reordered: true })
})

/**
 * DELETE /api/cg/[projectId]/playlists/[playlistId]/items?itemId=xxx
 */
export const DELETE = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) => {
  const { projectId, playlistId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'delete', 'playlist_item')
  if (!rbac.allowed) return rbac.response

  const itemId = request.nextUrl.searchParams.get('itemId')
  if (!itemId) {
    throw new ApiError('INVALID_PARAMS', { message: 'itemId query param is required' })
  }

  const item = await prisma.playlistItem.findFirst({
    where: {
      id: itemId,
      playlistId,
      playlist: { projectId },
    },
  })
  if (!item) {
    throw new ApiError('NOT_FOUND', { message: 'Playlist item not found' })
  }

  await prisma.playlistItem.delete({ where: { id: itemId } })

  return NextResponse.json({ deleted: true })
})
