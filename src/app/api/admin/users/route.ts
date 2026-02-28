import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { isAdminSession, isAdminUsername } from '@/lib/admin'

interface CreateUserRequestBody {
  name?: unknown
  password?: unknown
}

function parseUsername(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
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

export const GET = apiHandler(async () => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  ensureAdminAccess(authResult.session)

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      { createdAt: 'asc' },
      { name: 'asc' },
    ],
  })

  return NextResponse.json({
    users: users.map((user) => ({
      ...user,
      isAdmin: isAdminUsername(user.name),
    })),
  })
})

export const POST = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  ensureAdminAccess(authResult.session)

  const body = (await request.json()) as CreateUserRequestBody
  const name = parseUsername(body?.name)
  const password = parsePassword(body?.password)

  if (!name) {
    throw new ApiError('INVALID_PARAMS', {
      message: 'Username is required',
      field: 'name',
    })
  }

  if (password.length < 8) {
    throw new ApiError('INVALID_PARAMS', {
      message: 'Password must be at least 8 characters',
      field: 'password',
    })
  }

  const existing = await prisma.user.findUnique({
    where: { name },
    select: { id: true },
  })
  if (existing) {
    throw new ApiError('CONFLICT', {
      message: 'User already exists',
      errorCode: 'USER_ALREADY_EXISTS',
    })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const created = await prisma.user.create({
    data: {
      name,
      password: passwordHash,
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(
    {
      user: {
        ...created,
        isAdmin: isAdminUsername(created.name),
      },
    },
    { status: 201 },
  )
})
