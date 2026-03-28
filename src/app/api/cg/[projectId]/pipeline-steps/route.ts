import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { auditAndCheck } from '@/lib/api-rbac'

/**
 * GET /api/cg/[projectId]/pipeline-steps
 * 获取项目的流程步骤列表
 */
export const GET = apiHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const pipelineSteps = await prisma.pipelineStep.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
  })

  return NextResponse.json({ pipelineSteps })
})

interface CreatePipelineStepBody {
  name: string
  code: string
  sortOrder?: number
  color?: string
  icon?: string
  entityType?: string
}

/**
 * POST /api/cg/[projectId]/pipeline-steps
 * 创建流程步骤
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'edit', 'pipeline_step')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as CreatePipelineStepBody

  if (!body.name?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'name is required' })
  }
  if (!body.code?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'code is required' })
  }

  const pipelineStep = await prisma.pipelineStep.create({
    data: {
      projectId,
      name: body.name.trim(),
      code: body.code.trim(),
      sortOrder: body.sortOrder ?? 0,
      color: body.color ?? null,
      icon: body.icon ?? null,
      entityType: body.entityType ?? 'shot',
    },
  })

  return NextResponse.json({ pipelineStep }, { status: 201 })
})
