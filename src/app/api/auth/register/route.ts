import { NextRequest } from "next/server"
import { logAuthAction } from '@/lib/logging/semantic'
import { apiHandler, ApiError } from '@/lib/api-errors'

export const POST = apiHandler(async (request: NextRequest) => {
  let name = 'unknown'
  try {
    const body = await request.json()
    name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : 'unknown'
  } catch {
    name = 'unknown'
  }

  logAuthAction('REGISTER', name, {
    success: false,
    error: 'Registration is disabled for internal-only deployment',
  })

  throw new ApiError('FORBIDDEN', {
    message: 'Registration is disabled for internal-only deployment',
    errorCode: 'REGISTER_DISABLED',
  })
})
