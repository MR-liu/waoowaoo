import { NextRequest, NextResponse } from 'next/server'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { auditAndCheck } from '@/lib/api-rbac'
import {
  breakdownScript,
  confirmBreakdown,
  type ScriptBreakdownResult,
} from '@/lib/ai/script-breakdown'

interface BreakdownRequestBody {
  scriptText?: string
}

/**
 * POST /api/cg/[projectId]/ai/breakdown
 * Accept script text, return breakdown result (scenes, characters, assets)
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'generate', 'ai_breakdown')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as BreakdownRequestBody

  if (!body.scriptText?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'scriptText is required' })
  }

  const result = await breakdownScript(body.scriptText, projectId)

  return NextResponse.json({ breakdown: result })
})

interface ConfirmBreakdownBody {
  breakdown?: ScriptBreakdownResult
}

/**
 * PUT /api/cg/[projectId]/ai/breakdown
 * Confirm breakdown and create entities in database
 */
export const PUT = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'edit', 'shot')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as ConfirmBreakdownBody

  if (!body.breakdown || !Array.isArray(body.breakdown.scenes)) {
    throw new ApiError('INVALID_PARAMS', { message: 'Valid breakdown result is required' })
  }

  const result = await confirmBreakdown(projectId, body.breakdown)

  return NextResponse.json({ result }, { status: 201 })
})
