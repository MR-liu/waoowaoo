import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { auditAndCheck } from '@/lib/api-rbac'

/**
 * GET /api/cg/[projectId]/playlists
 */
export const GET = apiHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const playlists = await prisma.playlist.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      _count: { select: { items: true } },
    },
  })

  return NextResponse.json({ playlists })
})

interface CreatePlaylistBody {
  name: string
}

/**
 * POST /api/cg/[projectId]/playlists
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'edit', 'playlist')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as CreatePlaylistBody

  if (!body.name?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'name is required' })
  }

  const playlist = await prisma.playlist.create({
    data: {
      projectId,
      name: body.name.trim(),
      createdById: authResult.session.user.id,
    },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      _count: { select: { items: true } },
    },
  })

  return NextResponse.json({ playlist }, { status: 201 })
})
