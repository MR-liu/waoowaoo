import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-errors'
import {
  calculateGhostBars,
  type GanttTask,
  type GhostBar,
  type DependencyType,
} from '@/lib/gantt/dependency-engine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GanttApiResponse {
  tasks: GanttTask[]
  ghostBars: GhostBar[]
}

interface DbDependency {
  id: string
  prerequisiteTaskId: string
  type: string
  lagDays: number
}

interface DbTask {
  id: string
  status: string
  bidDays: number | null
  startDate: Date | null
  dueDate: Date | null
  sortOrder: number
  pipelineStep: { id: string; name: string; code: string }
  shot: { id: string; code: string; name: string | null } | null
  asset: { id: string; code: string; name: string | null; assetType: string } | null
  assignee: { id: string; name: string | null } | null
  dependencies: DbDependency[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function taskDisplayName(task: DbTask): string {
  const entityName = task.shot?.name ?? task.shot?.code ?? task.asset?.name ?? task.asset?.code ?? ''
  return entityName ? `${entityName} – ${task.pipelineStep.name}` : task.pipelineStep.name
}

function isValidDependencyType(value: string): value is DependencyType {
  return value === 'FS' || value === 'SS' || value === 'FF' || value === 'SF'
}

function toGanttTask(dbTask: DbTask): GanttTask {
  const now = new Date()
  const duration = dbTask.bidDays ?? 1
  const startDate = dbTask.startDate ?? now
  const endDate = dbTask.dueDate ?? new Date(startDate.getTime() + duration * 86_400_000)

  const total = Math.max(1, duration)
  let progress = 0
  if (dbTask.status === 'completed' || dbTask.status === 'approved') {
    progress = 100
  } else if (dbTask.status === 'in_progress' || dbTask.status === 'review') {
    const elapsed = Math.max(0, (now.getTime() - startDate.getTime()) / 86_400_000)
    progress = Math.min(90, Math.round((elapsed / total) * 100))
  }

  return {
    id: dbTask.id,
    name: taskDisplayName(dbTask),
    startDate,
    endDate,
    duration,
    progress,
    assignee: dbTask.assignee?.name ?? null,
    dependencies: dbTask.dependencies
      .filter((d) => isValidDependencyType(d.type))
      .map((d) => ({
        taskId: d.prerequisiteTaskId,
        type: d.type as DependencyType,
        lag: d.lagDays,
      })),
  }
}

function detectDelayedTask(ganttTasks: GanttTask[]): { taskId: string; delayDays: number } | null {
  const now = new Date()
  let worst: { taskId: string; delayDays: number } | null = null

  for (const t of ganttTasks) {
    if (t.progress >= 100) continue
    const overdue = Math.round((now.getTime() - t.endDate.getTime()) / 86_400_000)
    if (overdue > 0 && (!worst || overdue > worst.delayDays)) {
      worst = { taskId: t.id, delayDays: overdue }
    }
  }

  return worst
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * GET /api/cg/[projectId]/gantt
 * Return all production tasks formatted for gantt view with dependencies and ghost bars.
 */
export const GET = apiHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const dbTasks = await prisma.productionTask.findMany({
    where: { pipelineStep: { projectId } },
    orderBy: { sortOrder: 'asc' },
    include: {
      pipelineStep: { select: { id: true, name: true, code: true } },
      shot: { select: { id: true, code: true, name: true } },
      asset: { select: { id: true, code: true, name: true, assetType: true } },
      assignee: { select: { id: true, name: true } },
      dependencies: {
        select: {
          id: true,
          prerequisiteTaskId: true,
          type: true,
          lagDays: true,
        },
      },
    },
  }) as unknown as DbTask[]

  const ganttTasks = dbTasks.map(toGanttTask)

  let ghostBars: GhostBar[] = []
  const delayed = detectDelayedTask(ganttTasks)
  if (delayed) {
    ghostBars = calculateGhostBars(ganttTasks, delayed.taskId, delayed.delayDays)
  }

  const response: GanttApiResponse = { tasks: ganttTasks, ghostBars }
  return NextResponse.json(response)
})
