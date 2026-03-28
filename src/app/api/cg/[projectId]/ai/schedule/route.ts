import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { auditAndCheck } from '@/lib/api-rbac'
import {
  generateSchedulePlans,
  type SchedulingConstraints,
  type ResourceDefinition,
  type TaskDefinition,
  type PlanType,
  type TaskAssignment,
} from '@/lib/ai/scheduling-engine'

// ─── Request body types ─────────────────────────────────────────

interface ScheduleRequestBody {
  projectDeadline?: string
  budgetLimit?: number
  resources?: ResourceDefinition[]
  tasks?: TaskDefinition[]
}

interface ApplyPlanBody {
  planType?: PlanType
  assignments?: TaskAssignment[]
}

// ─── Validators ─────────────────────────────────────────────────

function parseScheduleConstraints(body: ScheduleRequestBody): SchedulingConstraints {
  if (!body.projectDeadline) {
    throw new ApiError('INVALID_PARAMS', { message: 'projectDeadline is required' })
  }

  const deadline = new Date(body.projectDeadline)
  if (isNaN(deadline.getTime())) {
    throw new ApiError('INVALID_PARAMS', { message: 'Invalid projectDeadline date format' })
  }

  if (typeof body.budgetLimit !== 'number' || body.budgetLimit <= 0) {
    throw new ApiError('INVALID_PARAMS', { message: 'budgetLimit must be a positive number' })
  }

  if (!Array.isArray(body.resources) || body.resources.length === 0) {
    throw new ApiError('INVALID_PARAMS', { message: 'At least one resource is required' })
  }

  if (!Array.isArray(body.tasks) || body.tasks.length === 0) {
    throw new ApiError('INVALID_PARAMS', { message: 'At least one task is required' })
  }

  return {
    projectDeadline: deadline,
    budgetLimit: body.budgetLimit,
    resources: body.resources,
    tasks: body.tasks,
  }
}

/**
 * POST /api/cg/[projectId]/ai/schedule
 * Accept scheduling constraints, return 3 schedule plans
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'generate', 'ai_schedule')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as ScheduleRequestBody
  const constraints = parseScheduleConstraints(body)
  const plans = generateSchedulePlans(constraints)

  return NextResponse.json({ plans })
})

/**
 * PUT /api/cg/[projectId]/ai/schedule
 * Apply a selected plan to production tasks
 */
export const PUT = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'edit', 'production_task')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as ApplyPlanBody

  if (!body.planType) {
    throw new ApiError('INVALID_PARAMS', { message: 'planType is required' })
  }

  if (!Array.isArray(body.assignments) || body.assignments.length === 0) {
    throw new ApiError('INVALID_PARAMS', { message: 'assignments array is required' })
  }

  const updatePromises = body.assignments.map(async (assignment) => {
    const task = await prisma.productionTask.findFirst({
      where: {
        id: assignment.taskId,
        pipelineStep: { projectId },
      },
    })

    if (!task) return null

    return prisma.productionTask.update({
      where: { id: assignment.taskId },
      data: {
        assigneeId: assignment.assigneeId,
        startDate: new Date(assignment.startDate),
        dueDate: new Date(assignment.endDate),
        bidDays: Math.ceil(
          (new Date(assignment.endDate).getTime() - new Date(assignment.startDate).getTime()) /
          (24 * 60 * 60 * 1000),
        ),
      },
    })
  })

  const results = await Promise.all(updatePromises)
  const updated = results.filter(Boolean).length

  return NextResponse.json({
    applied: true,
    planType: body.planType,
    updatedTasks: updated,
  })
})
