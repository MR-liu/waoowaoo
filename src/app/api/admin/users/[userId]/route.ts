import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { isAdminSession, isAdminUsername } from '@/lib/admin'

interface ResetPasswordBody {
  password?: unknown
}

function parsePassword(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
}

function ensureAdminAccess(session: { user: { id: string; name?: string | null; isAdmin?: boolean } }) {
  if (isAdminSession(session)) return
  throw new ApiError('FORBIDDEN', {
    message: 'Admin access required',
    errorCode: 'ADMIN_REQUIRED',
  })
}

export const PATCH = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  ensureAdminAccess(authResult.session)

  const { userId } = await context.params
  if (!userId) {
    throw new ApiError('INVALID_PARAMS', {
      message: 'userId is required',
    })
  }

  const body = (await request.json()) as ResetPasswordBody
  const password = parsePassword(body?.password)
  if (password.length < 8) {
    throw new ApiError('INVALID_PARAMS', {
      message: 'Password must be at least 8 characters',
      field: 'password',
    })
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  if (!existingUser) {
    throw new ApiError('NOT_FOUND', {
      message: 'User not found',
    })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { password: passwordHash },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({
    success: true,
    user: {
      ...updated,
      isAdmin: isAdminUsername(updated.name),
    },
  })
})
