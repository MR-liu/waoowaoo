import bcrypt from 'bcryptjs'
import { logInfo, logWarn } from '@/lib/logging/core'
import { prisma } from '@/lib/prisma'

type SessionLike = {
  user?: {
    name?: string | null
    isAdmin?: boolean | null
  } | null
} | null | undefined

function normalizeName(value: string | null | undefined): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function parseAdminUsernames(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export function getConfiguredAdminUsernames(): string[] {
  const primaryAdmin = normalizeName(process.env.ADMIN_USERNAME)
  const extraAdmins = parseAdminUsernames(process.env.ADMIN_USERNAMES)

  const unique = new Set<string>()
  if (primaryAdmin) unique.add(primaryAdmin)
  for (const username of extraAdmins) {
    unique.add(username)
  }
  return Array.from(unique)
}

export function isAdminUsername(name: string | null | undefined): boolean {
  const normalizedName = normalizeName(name)
  if (!normalizedName) return false
  return getConfiguredAdminUsernames().includes(normalizedName)
}

export function isAdminSession(session: SessionLike): boolean {
  if (session?.user?.isAdmin === true) return true
  return isAdminUsername(session?.user?.name)
}

export async function ensureAdminUser(): Promise<void> {
  const username = normalizeName(process.env.ADMIN_USERNAME)
  const password = process.env.ADMIN_PASSWORD || ''
  const hasUsername = username.length > 0
  const hasPassword = password.length > 0

  if (!hasUsername && !hasPassword) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD are required in production')
    }
    logWarn('[Admin Bootstrap] skipped: ADMIN_USERNAME and ADMIN_PASSWORD are not configured')
    return
  }

  if (!hasUsername || !hasPassword) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be configured together')
  }

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters long')
  }

  const shouldForcePasswordReset = parseBooleanFlag(process.env.ADMIN_FORCE_PASSWORD_RESET)
  const existingUser = await prisma.user.findUnique({
    where: { name: username },
    select: {
      id: true,
      password: true,
    },
  })

  const passwordHash = await bcrypt.hash(password, 12)

  if (!existingUser) {
    await prisma.user.create({
      data: {
        name: username,
        password: passwordHash,
      },
      select: { id: true },
    })
    logInfo('[Admin Bootstrap] created admin account', { username })
    return
  }

  if (!existingUser.password || shouldForcePasswordReset) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { password: passwordHash },
    })
    logInfo('[Admin Bootstrap] updated admin password', {
      username,
      forceReset: shouldForcePasswordReset,
    })
    return
  }

  logInfo('[Admin Bootstrap] existing admin user found, no password update performed', {
    username,
    forceReset: shouldForcePasswordReset,
  })
}
