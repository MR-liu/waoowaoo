import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { auditAndCheck } from '@/lib/api-rbac'

/**
 * GET /api/cg/[projectId]/production-tasks
 * 获取制作任务列表（可按 shotId/assetId/assigneeId/status 过滤）
 * 包含 pipelineStep、shot、asset、assignee 关联
 */
export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const shotId = request.nextUrl.searchParams.get('shotId')
  const assetId = request.nextUrl.searchParams.get('assetId')
  const assigneeId = request.nextUrl.searchParams.get('assigneeId')
  const status = request.nextUrl.searchParams.get('status')

  interface TaskWhereFilter {
    pipelineStep: { projectId: string }
    shotId?: string
    assetId?: string
    assigneeId?: string
    status?: string
  }

  const where: TaskWhereFilter = {
    pipelineStep: { projectId },
  }
  if (shotId) where.shotId = shotId
  if (assetId) where.assetId = assetId
  if (assigneeId) where.assigneeId = assigneeId
  if (status) where.status = status

  const tasks = await prisma.productionTask.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
    include: {
      pipelineStep: {
        select: { id: true, name: true, code: true, color: true, icon: true },
      },
      shot: {
        select: { id: true, code: true, name: true },
      },
      asset: {
        select: { id: true, code: true, name: true, assetType: true },
      },
      assignee: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  })

  return NextResponse.json({ tasks })
})

interface CreateProductionTaskBody {
  pipelineStepId: string
  shotId?: string
  assetId?: string
  assigneeId?: string
  status?: string
  priority?: number
  bidDays?: number
  actualDays?: number
  startDate?: string
  dueDate?: string
  sortOrder?: number
}

/**
 * POST /api/cg/[projectId]/production-tasks
 * 创建制作任务
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult
  const userId = authResult.session.user.id

  const rbac = await auditAndCheck(userId, projectId, 'edit', 'production_task')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as CreateProductionTaskBody

  if (!body.pipelineStepId?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'pipelineStepId is required' })
  }

  const pipelineStep = await prisma.pipelineStep.findFirst({
    where: { id: body.pipelineStepId, projectId },
  })
  if (!pipelineStep) {
    throw new ApiError('NOT_FOUND', { message: 'PipelineStep not found in this project' })
  }

  const task = await prisma.productionTask.create({
    data: {
      pipelineStepId: body.pipelineStepId,
      shotId: body.shotId ?? null,
      assetId: body.assetId ?? null,
      assigneeId: body.assigneeId ?? null,
      status: body.status ?? 'not_started',
      priority: body.priority ?? 0,
      bidDays: body.bidDays ?? null,
      actualDays: body.actualDays ?? null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      sortOrder: body.sortOrder ?? 0,
    },
    include: {
      pipelineStep: {
        select: { id: true, name: true, code: true, color: true, icon: true },
      },
      shot: {
        select: { id: true, code: true, name: true },
      },
      asset: {
        select: { id: true, code: true, name: true, assetType: true },
      },
      assignee: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  })

  return NextResponse.json({ task }, { status: 201 })
})

interface PatchTaskBody {
  id: string
  bidDays?: number | null
  actualDays?: number | null
  status?: string
  assigneeId?: string | null
  startDate?: string | null
  dueDate?: string | null
}

/**
 * PATCH /api/cg/[projectId]/production-tasks
 * 更新单个制作任务的可编辑字段
 */
export const PATCH = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult
  const userId = authResult.session.user.id

  const rbac = await auditAndCheck(userId, projectId, 'edit', 'production_task')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as PatchTaskBody

  if (!body.id?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'id is required' })
  }

  const existing = await prisma.productionTask.findFirst({
    where: { id: body.id, pipelineStep: { projectId } },
  })
  if (!existing) {
    throw new ApiError('NOT_FOUND', { message: 'Task not found in this project' })
  }

  const data: Record<string, unknown> = {}
  if ('bidDays' in body) data.bidDays = body.bidDays
  if ('actualDays' in body) data.actualDays = body.actualDays
  if ('status' in body) data.status = body.status
  if ('assigneeId' in body) data.assigneeId = body.assigneeId
  if ('startDate' in body) data.startDate = body.startDate ? new Date(body.startDate) : null
  if ('dueDate' in body) data.dueDate = body.dueDate ? new Date(body.dueDate) : null

  const task = await prisma.productionTask.update({
    where: { id: body.id },
    data,
    include: {
      pipelineStep: { select: { id: true, name: true, code: true, color: true, icon: true } },
      shot: { select: { id: true, code: true, name: true } },
      asset: { select: { id: true, code: true, name: true, assetType: true } },
      assignee: { select: { id: true, name: true, email: true, image: true } },
    },
  })

  return NextResponse.json({ task })
})
