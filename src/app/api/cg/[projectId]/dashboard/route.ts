import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-errors'

// ─── Response types ─────────────────────────────────────────────

interface TaskStatusCount {
  status: string
  count: number
}

interface BurndownPoint {
  date: string
  planned: number
  actual: number
}

interface ResourceUtilization {
  userId: string
  userName: string
  weeks: Array<{
    weekStart: string
    hoursAssigned: number
    taskCount: number
  }>
}

interface PipelineStatusGroup {
  stepName: string
  stepCode: string
  color: string | null
  statusCounts: TaskStatusCount[]
}

interface CostSummary {
  totalBudgetDays: number
  actualSpentDays: number
  estimatedCostRate: number
}

interface DashboardData {
  totalShots: number
  totalAssets: number
  completionRate: number
  overdueTasks: number
  statusBreakdown: TaskStatusCount[]
  burndown: BurndownPoint[]
  resourceUtilization: ResourceUtilization[]
  pipelineStatus: PipelineStatusGroup[]
  costSummary: CostSummary
}

// ─── Helpers ────────────────────────────────────────────────────

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return monday.toISOString().split('T')[0]
}

function generateWeekStarts(startDate: Date, endDate: Date): string[] {
  const weeks: string[] = []
  const current = new Date(startDate)
  const day = current.getDay()
  const diff = current.getDate() - day + (day === 0 ? -6 : 1)
  current.setDate(diff)
  current.setHours(0, 0, 0, 0)

  while (current.getTime() <= endDate.getTime() + MS_PER_WEEK) {
    weeks.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 7)
  }

  return weeks
}

// ─── Route handler ──────────────────────────────────────────────

/**
 * GET /api/cg/[projectId]/dashboard
 * Return aggregated dashboard data
 */
export const GET = apiHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const [shots, assets, tasks, pipelineSteps] = await Promise.all([
    prisma.cgShot.count({ where: { sequence: { projectId } } }),
    prisma.cgAsset.count({ where: { projectId } }),
    prisma.productionTask.findMany({
      where: { pipelineStep: { projectId } },
      include: {
        pipelineStep: { select: { name: true, code: true, color: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
    prisma.pipelineStep.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
      select: { name: true, code: true, color: true },
    }),
  ])

  const now = new Date()
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'approved' || t.status === 'final').length
  const overdueTasks = tasks.filter(t =>
    t.dueDate && t.dueDate < now && t.status !== 'approved' && t.status !== 'final',
  ).length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 10000) / 100 : 0

  // Status breakdown
  const statusMap = new Map<string, number>()
  for (const task of tasks) {
    statusMap.set(task.status, (statusMap.get(task.status) ?? 0) + 1)
  }
  const statusBreakdown: TaskStatusCount[] = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))

  // Burndown chart data
  const tasksWithDates = tasks.filter(t => t.startDate && t.dueDate)
  let burndown: BurndownPoint[] = []

  if (tasksWithDates.length > 0) {
    const allDates = tasksWithDates.flatMap(t => [t.startDate!, t.dueDate!])
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime()), now.getTime()))
    const weekStarts = generateWeekStarts(minDate, maxDate)

    burndown = weekStarts.map(weekStart => {
      const weekDate = new Date(weekStart)
      const plannedCompleted = tasksWithDates.filter(t =>
        t.dueDate! <= weekDate,
      ).length
      const actualCompleted = tasksWithDates.filter(t =>
        t.completedAt && t.completedAt <= weekDate,
      ).length

      return {
        date: weekStart,
        planned: plannedCompleted,
        actual: actualCompleted,
      }
    })
  }

  // Resource utilization
  const assignedTasks = tasks.filter(t => t.assignee && t.startDate && t.dueDate)
  const resourceMap = new Map<string, { userName: string; tasks: typeof assignedTasks }>()

  for (const task of assignedTasks) {
    if (!task.assignee) continue
    const key = task.assignee.id
    const existing = resourceMap.get(key) ?? { userName: task.assignee.name ?? 'Unknown', tasks: [] }
    existing.tasks.push(task)
    resourceMap.set(key, existing)
  }

  let allWeekStarts: string[] = []
  if (assignedTasks.length > 0) {
    const allAssignedDates = assignedTasks.flatMap(t => [t.startDate!, t.dueDate!])
    const minAssigned = new Date(Math.min(...allAssignedDates.map(d => d.getTime())))
    const maxAssigned = new Date(Math.max(...allAssignedDates.map(d => d.getTime())))
    allWeekStarts = generateWeekStarts(minAssigned, maxAssigned)
  }

  const resourceUtilization: ResourceUtilization[] = Array.from(resourceMap.entries())
    .map(([userId, { userName, tasks: userTasks }]) => ({
      userId,
      userName,
      weeks: allWeekStarts.map(weekStart => {
        const weekDate = new Date(weekStart)
        const weekEnd = new Date(weekDate.getTime() + MS_PER_WEEK)

        const activeTasks = userTasks.filter(t =>
          t.startDate! < weekEnd && t.dueDate! >= weekDate,
        )

        const hoursAssigned = activeTasks.reduce((sum, t) => {
          const bidDays = t.bidDays ?? 5
          return sum + (bidDays * 8) / Math.max(1,
            Math.ceil((t.dueDate!.getTime() - t.startDate!.getTime()) / MS_PER_WEEK),
          )
        }, 0)

        return {
          weekStart,
          hoursAssigned: Math.round(hoursAssigned * 10) / 10,
          taskCount: activeTasks.length,
        }
      }),
    }))

  // Pipeline status
  const pipelineStatus: PipelineStatusGroup[] = pipelineSteps.map(step => {
    const stepTasks = tasks.filter(t => t.pipelineStep.code === step.code)
    const stepStatusMap = new Map<string, number>()
    for (const t of stepTasks) {
      stepStatusMap.set(t.status, (stepStatusMap.get(t.status) ?? 0) + 1)
    }

    return {
      stepName: step.name,
      stepCode: step.code,
      color: step.color,
      statusCounts: Array.from(stepStatusMap.entries())
        .map(([status, count]) => ({ status, count })),
    }
  })

  // Cost summary
  const totalBudgetDays = tasks.reduce((sum, t) => sum + (t.bidDays ?? 0), 0)
  const actualSpentDays = tasks.reduce((sum, t) => sum + (t.actualDays ?? 0), 0)

  const dashboard: DashboardData = {
    totalShots: shots,
    totalAssets: assets,
    completionRate,
    overdueTasks,
    statusBreakdown,
    burndown,
    resourceUtilization,
    pipelineStatus,
    costSummary: {
      totalBudgetDays,
      actualSpentDays,
      estimatedCostRate: totalBudgetDays > 0
        ? Math.round((actualSpentDays / totalBudgetDays) * 10000) / 100
        : 0,
    },
  }

  return NextResponse.json({ dashboard })
})
