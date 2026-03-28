import { createScopedLogger } from '@/lib/logging/core'

const logger = createScopedLogger({ module: 'ai.scheduling-engine' })

// ─── Types ──────────────────────────────────────────────────────

export interface ResourceDefinition {
  userId: string
  name: string
  skills: string[]
  availability: number
  costPerHour: number
}

export interface TaskDefinition {
  id: string
  name: string
  requiredSkills: string[]
  estimatedHours: number
  dependencies: string[]
}

export interface SchedulingConstraints {
  projectDeadline: Date
  budgetLimit: number
  resources: ResourceDefinition[]
  tasks: TaskDefinition[]
}

export type PlanType = 'aggressive' | 'balanced' | 'conservative'
export type RiskLevel = 'high' | 'medium' | 'low'

export interface TaskAssignment {
  taskId: string
  assigneeId: string
  startDate: Date
  endDate: Date
  hoursPerDay: number
}

export interface SchedulePlan {
  name: string
  type: PlanType
  totalDays: number
  totalCost: number
  overtimePercentage: number
  riskLevel: RiskLevel
  assignments: TaskAssignment[]
}

// ─── Scheduling logic ───────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000
const STANDARD_HOURS_PER_DAY = 8

interface PlanProfile {
  type: PlanType
  name: string
  hoursPerDayMultiplier: number
  riskLevel: RiskLevel
}

const PLAN_PROFILES: PlanProfile[] = [
  { type: 'aggressive', name: 'Aggressive Plan', hoursPerDayMultiplier: 1.5, riskLevel: 'high' },
  { type: 'balanced', name: 'Balanced Plan', hoursPerDayMultiplier: 1.0, riskLevel: 'medium' },
  { type: 'conservative', name: 'Conservative Plan', hoursPerDayMultiplier: 0.75, riskLevel: 'low' },
]

function topologicalSort(tasks: TaskDefinition[]): TaskDefinition[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const task of tasks) {
    inDegree.set(task.id, 0)
    adjacency.set(task.id, [])
  }

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (taskMap.has(dep)) {
        const neighbors = adjacency.get(dep) ?? []
        neighbors.push(task.id)
        adjacency.set(dep, neighbors)
        inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1)
      }
    }
  }

  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }

  const sorted: TaskDefinition[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    const task = taskMap.get(current)
    if (task) sorted.push(task)

    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    }
  }

  if (sorted.length !== tasks.length) {
    throw new Error('Circular dependency detected in task graph')
  }

  return sorted
}

function findBestResource(
  task: TaskDefinition,
  resources: ResourceDefinition[],
  resourceEndDates: Map<string, Date>,
): ResourceDefinition | null {
  const eligible = resources.filter(r =>
    task.requiredSkills.every(skill => r.skills.includes(skill)),
  )

  if (eligible.length === 0) return null

  return eligible.reduce((best, current) => {
    const bestEnd = resourceEndDates.get(best.userId)?.getTime() ?? 0
    const currentEnd = resourceEndDates.get(current.userId)?.getTime() ?? 0
    return currentEnd < bestEnd ? current : best
  })
}

function generateSinglePlan(
  constraints: SchedulingConstraints,
  profile: PlanProfile,
): SchedulePlan {
  const sortedTasks = topologicalSort(constraints.tasks)
  const taskEndDates = new Map<string, Date>()
  const resourceEndDates = new Map<string, Date>()
  const now = new Date()

  for (const resource of constraints.resources) {
    resourceEndDates.set(resource.userId, now)
  }

  const assignments: TaskAssignment[] = []
  let totalCost = 0
  let totalOvertimeHours = 0
  let totalWorkHours = 0

  for (const task of sortedTasks) {
    let earliestStart = now

    for (const depId of task.dependencies) {
      const depEnd = taskEndDates.get(depId)
      if (depEnd && depEnd.getTime() > earliestStart.getTime()) {
        earliestStart = depEnd
      }
    }

    const resource = findBestResource(task, constraints.resources, resourceEndDates)
    if (!resource) {
      logger.warn({
        action: 'schedule.no_resource',
        message: `No eligible resource for task: ${task.name}`,
        details: { taskId: task.id, requiredSkills: task.requiredSkills },
      })
      continue
    }

    const resourceAvailable = resourceEndDates.get(resource.userId) ?? now
    const startDate = new Date(Math.max(earliestStart.getTime(), resourceAvailable.getTime()))

    const hoursPerDay = Math.min(
      STANDARD_HOURS_PER_DAY * profile.hoursPerDayMultiplier,
      resource.availability / 5,
    )
    const daysNeeded = Math.ceil(task.estimatedHours / hoursPerDay)
    const endDate = new Date(startDate.getTime() + daysNeeded * MS_PER_DAY)

    const overtimeHoursThisTask = Math.max(0, hoursPerDay - STANDARD_HOURS_PER_DAY) * daysNeeded
    totalOvertimeHours += overtimeHoursThisTask
    totalWorkHours += hoursPerDay * daysNeeded
    totalCost += task.estimatedHours * resource.costPerHour

    taskEndDates.set(task.id, endDate)
    resourceEndDates.set(resource.userId, endDate)

    assignments.push({
      taskId: task.id,
      assigneeId: resource.userId,
      startDate,
      endDate,
      hoursPerDay: Math.round(hoursPerDay * 100) / 100,
    })
  }

  let latestEnd = now
  for (const endDate of taskEndDates.values()) {
    if (endDate.getTime() > latestEnd.getTime()) {
      latestEnd = endDate
    }
  }

  const totalDays = Math.ceil((latestEnd.getTime() - now.getTime()) / MS_PER_DAY)
  const overtimePercentage = totalWorkHours > 0
    ? Math.round((totalOvertimeHours / totalWorkHours) * 10000) / 100
    : 0

  return {
    name: profile.name,
    type: profile.type,
    totalDays,
    totalCost: Math.round(totalCost * 100) / 100,
    overtimePercentage,
    riskLevel: profile.riskLevel,
    assignments,
  }
}

// ─── Public API ─────────────────────────────────────────────────

export function generateSchedulePlans(constraints: SchedulingConstraints): SchedulePlan[] {
  logger.info({
    action: 'schedule.generate.start',
    message: 'Generating schedule plans',
    details: {
      taskCount: constraints.tasks.length,
      resourceCount: constraints.resources.length,
      deadline: constraints.projectDeadline.toISOString(),
    },
  })

  if (constraints.tasks.length === 0) {
    throw new Error('No tasks provided for scheduling')
  }

  if (constraints.resources.length === 0) {
    throw new Error('No resources provided for scheduling')
  }

  const plans = PLAN_PROFILES.map(profile =>
    generateSinglePlan(constraints, profile),
  )

  logger.info({
    action: 'schedule.generate.complete',
    message: 'Schedule plans generated',
    details: {
      plans: plans.map(p => ({
        type: p.type,
        totalDays: p.totalDays,
        totalCost: p.totalCost,
        assignments: p.assignments.length,
      })),
    },
  })

  return plans
}
