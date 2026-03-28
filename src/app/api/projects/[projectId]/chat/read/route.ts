import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'

export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAccess(projectId)
  if (isErrorResponse(authResult)) return authResult
  const userId = authResult.session.user.id

  const body = await request.json() as {
    channelId: string
    lastReadMessageId: string
  }

  if (!body.channelId || !body.lastReadMessageId) {
    throw new ApiError('INVALID_PARAMS')
  }

  await prisma.messageReadState.upsert({
    where: { userId_channelId: { userId, channelId: body.channelId } },
    create: {
      userId,
      channelId: body.channelId,
      lastReadMessageId: body.lastReadMessageId,
    },
    update: {
      lastReadMessageId: body.lastReadMessageId,
    },
  })

  return NextResponse.json({ success: true })
})
