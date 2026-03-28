import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'

export const GET = apiHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAccess(projectId)
  if (isErrorResponse(authResult)) return authResult

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  return NextResponse.json({
    members: members.map(m => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user,
    })),
  })
})

export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAccess(projectId)
  if (isErrorResponse(authResult)) return authResult

  if (authResult.role !== 'owner' && authResult.role !== 'producer') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Only owner or producer can add members' } },
      { status: 403 },
    )
  }

  const body = await request.json() as {
    username: string
    role?: string
  }

  if (!body.username) {
    throw new ApiError('INVALID_PARAMS')
  }

  const targetUser = await prisma.user.findUnique({
    where: { name: body.username },
  })

  if (!targetUser) {
    throw new ApiError('NOT_FOUND', { message: 'User not found' })
  }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: targetUser.id } },
  })

  if (existing) {
    return NextResponse.json({ member: existing, alreadyExists: true })
  }

  const member = await prisma.projectMember.create({
    data: {
      projectId,
      userId: targetUser.id,
      role: body.role || 'editor',
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  })

  return NextResponse.json({ member })
})
