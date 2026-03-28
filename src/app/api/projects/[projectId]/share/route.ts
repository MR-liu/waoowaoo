import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'

/**
 * POST /api/projects/[projectId]/share
 * 创建或重新生成分享链接
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAccess(projectId)
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json().catch(() => ({})) as {
    password?: string
    expiresInDays?: number
  }

  const shareCode = randomBytes(12).toString('base64url')
  const expiresAt = body.expiresInDays
    ? new Date(Date.now() + body.expiresInDays * 86_400_000)
    : null

  const share = await prisma.projectShare.create({
    data: {
      projectId,
      shareCode,
      password: body.password || null,
      expiresAt,
    },
  })

  return NextResponse.json({
    shareCode: share.shareCode,
    expiresAt: share.expiresAt,
    hasPassword: !!share.password,
  })
})

/**
 * GET /api/projects/[projectId]/share
 * 获取当前项目的分享信息
 */
export const GET = apiHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAccess(projectId)
  if (isErrorResponse(authResult)) return authResult

  const shares = await prisma.projectShare.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      shareCode: true,
      password: true,
      expiresAt: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    shares: shares.map(s => ({
      id: s.id,
      shareCode: s.shareCode,
      hasPassword: !!s.password,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
    })),
  })
})

/**
 * DELETE /api/projects/[projectId]/share
 * 删除分享链接
 */
export const DELETE = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAccess(projectId)
  if (isErrorResponse(authResult)) return authResult

  const shareId = request.nextUrl.searchParams.get('id')
  if (!shareId) {
    throw new ApiError('INVALID_PARAMS')
  }

  const share = await prisma.projectShare.findFirst({
    where: { id: shareId, projectId },
  })
  if (!share) {
    throw new ApiError('NOT_FOUND')
  }

  await prisma.projectShare.delete({ where: { id: shareId } })

  return NextResponse.json({ success: true })
})
