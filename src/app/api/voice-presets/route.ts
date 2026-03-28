import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-errors'

/**
 * GET /api/voice-presets
 * List system voice presets.
 */
export const GET = apiHandler(async () => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult

  const presets = await prisma.voicePreset.findMany({
    where: { isSystem: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ presets })
})
