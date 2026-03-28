import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { isAdminSession } from '@/lib/admin'
import { generateComplianceReport } from '@/lib/security/tpn-compliance'

function ensureAdminAccess(session: { user: { id: string; name?: string | null; isAdmin?: boolean } }) {
  if (isAdminSession(session)) return
  throw new ApiError('FORBIDDEN', {
    message: 'Admin access required',
    errorCode: 'ADMIN_REQUIRED',
  })
}

/**
 * GET /api/admin/security/compliance
 * Return TPN compliance report
 */
export const GET = apiHandler(async (
  _request: NextRequest,
) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  ensureAdminAccess(authResult.session)

  const report = generateComplianceReport()

  return NextResponse.json({ report })
})
