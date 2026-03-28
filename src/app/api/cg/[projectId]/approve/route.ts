import { NextRequest, NextResponse } from 'next/server'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { auditAndCheck } from '@/lib/api-rbac'
import { processApproval, canPerformApproval, type ApprovalAction } from '@/lib/approval/engine'

const VALID_ACTIONS: ApprovalAction[] = ['approve', 'reject', 'request_changes']

interface ApprovalRequestBody {
  versionId: string
  action: string
  comment?: string
}

export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult
  const userId = authResult.session.user.id

  const rbac = await auditAndCheck(userId, projectId, 'approve', 'cg_version')
  if (!rbac.allowed) return rbac.response

  const body = await request.json() as ApprovalRequestBody

  if (!body.versionId || !body.action) {
    throw new ApiError('INVALID_PARAMS', { message: 'versionId and action are required' })
  }

  if (!VALID_ACTIONS.includes(body.action as ApprovalAction)) {
    throw new ApiError('INVALID_PARAMS', { message: `action must be one of: ${VALID_ACTIONS.join(', ')}` })
  }

  const result = await processApproval({
    versionId: body.versionId,
    action: body.action as ApprovalAction,
    reviewerId: userId,
    comment: body.comment,
    projectId,
  })

  return NextResponse.json(result)
})
