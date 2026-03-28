import { NextRequest, NextResponse } from 'next/server'
import { getSignedUrl, toFetchableUrl } from '@/lib/cos'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'

export const GET = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult

  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')

  if (!key) {
    throw new ApiError('INVALID_PARAMS')
  }

  const signedUrl = toFetchableUrl(getSignedUrl(key, 3600))

  return NextResponse.redirect(signedUrl)
})
