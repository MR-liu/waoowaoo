import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'

export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAccess(projectId)
  if (isErrorResponse(authResult)) return authResult
  const userId = authResult.session.user.id

  const channelId = request.nextUrl.searchParams.get('channelId')
  const cursor = request.nextUrl.searchParams.get('cursor')
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50'), 100)

  let targetChannelId = channelId

  if (!targetChannelId) {
    const defaultChannel = await prisma.chatChannel.findFirst({
      where: { projectId, type: 'project' },
      orderBy: { createdAt: 'asc' },
    })

    if (!defaultChannel) {
      const created = await prisma.chatChannel.create({
        data: { projectId, name: 'General', type: 'project' },
      })
      targetChannelId = created.id
    } else {
      targetChannelId = defaultChannel.id
    }
  }

  const messages = await prisma.chatMessage.findMany({
    where: {
      channelId: targetChannelId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      sender: {
        select: { id: true, name: true, image: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const readState = await prisma.messageReadState.findUnique({
    where: { userId_channelId: { userId, channelId: targetChannelId } },
  })

  let unreadCount = 0
  if (readState?.lastReadMessageId) {
    const lastReadMsg = await prisma.chatMessage.findUnique({
      where: { id: readState.lastReadMessageId },
      select: { createdAt: true },
    })
    if (lastReadMsg) {
      unreadCount = await prisma.chatMessage.count({
        where: { channelId: targetChannelId, createdAt: { gt: lastReadMsg.createdAt } },
      })
    }
  } else {
    unreadCount = await prisma.chatMessage.count({
      where: { channelId: targetChannelId },
    })
  }

  return NextResponse.json({
    channelId: targetChannelId,
    messages: messages.reverse(),
    hasMore: messages.length === limit,
    nextCursor: messages.length > 0 ? messages[0].createdAt.toISOString() : null,
    unreadCount,
  })
})

export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAccess(projectId)
  if (isErrorResponse(authResult)) return authResult
  const userId = authResult.session.user.id

  const body = await request.json() as {
    channelId?: string
    content: string
    type?: string
    mentions?: string[]
    replyToId?: string
  }

  if (!body.content?.trim()) {
    throw new ApiError('INVALID_PARAMS')
  }

  let channelId = body.channelId

  if (!channelId) {
    const defaultChannel = await prisma.chatChannel.findFirst({
      where: { projectId, type: 'project' },
      orderBy: { createdAt: 'asc' },
    })
    if (!defaultChannel) {
      throw new ApiError('NOT_FOUND', { message: 'No chat channel found' })
    }
    channelId = defaultChannel.id
  }

  const message = await prisma.chatMessage.create({
    data: {
      channelId,
      senderId: userId,
      content: body.content.trim(),
      type: body.type || 'text',
      mentions: body.mentions ? JSON.stringify(body.mentions) : null,
      replyToId: body.replyToId || null,
    },
    include: {
      sender: {
        select: { id: true, name: true, image: true },
      },
    },
  })

  await prisma.messageReadState.upsert({
    where: { userId_channelId: { userId, channelId } },
    create: { userId, channelId, lastReadMessageId: message.id },
    update: { lastReadMessageId: message.id },
  })

  return NextResponse.json({ message })
})
