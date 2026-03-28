/**
 * Gantt chart dependency engine.
 *
 * Supports four dependency types (FS / SS / FF / SF),
 * ghost-bar calculation for cascading delays,
 * topological sort, critical-path analysis, and auto-scheduling.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'

export interface TaskDependency {
  taskId: string
  type: DependencyType
  lag: number
}

export interface GanttTask {
  id: string
  name: string
  startDate: Date
  endDate: Date
  duration: number
  progress: number
  assignee: string | null
  dependencies: TaskDependency[]
}

export interface GhostBar {
  taskId: string
  originalStart: Date
  originalEnd: Date
  projectedStart: Date
  projectedEnd: Date
  reason: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
}

function buildAdjacencyList(tasks: GanttTask[]): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  for (const t of tasks) {
    if (!adj.has(t.id)) adj.set(t.id, [])
    for (const dep of t.dependencies) {
      const list = adj.get(dep.taskId)
      if (list) {
        list.push(t.id)
      } else {
        adj.set(dep.taskId, [t.id])
      }
    }
  }
  return adj
}

function buildTaskMap(tasks: GanttTask[]): Map<string, GanttTask> {
  const map = new Map<string, GanttTask>()
  for (const t of tasks) map.set(t.id, t)
  return map
}

// ---------------------------------------------------------------------------
// Ghost bars: project cascading delays when an upstream task slips
// ---------------------------------------------------------------------------

export function calculateGhostBars(
  tasks: GanttTask[],
  delayedTaskId: string,
  delayDays: number,
): GhostBar[] {
  const taskMap = buildTaskMap(tasks)
  const adj = buildAdjacencyList(tasks)
  const ghostBars: GhostBar[] = []
  const visited = new Set<string>()

  const delayedTask = taskMap.get(delayedTaskId)
  if (!delayedTask) return ghostBars

  const delayMap = new Map<string, number>()
  delayMap.set(delayedTaskId, delayDays)

  const queue: string[] = [delayedTaskId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)

    const currentDelay = delayMap.get(currentId) ?? 0
    const dependents = adj.get(currentId) ?? []

    for (const depId of dependents) {
      const depTask = taskMap.get(depId)
      if (!depTask) continue

      const dep = depTask.dependencies.find((d) => d.taskId === currentId)
      if (!dep) continue

      const currentTask = taskMap.get(currentId)!
      const cascadedDelay = computeCascadedDelay(
        currentTask,
        depTask,
        dep.type,
        dep.lag,
        currentDelay,
      )

      if (cascadedDelay > 0) {
        const existing = delayMap.get(depId) ?? 0
        const effectiveDelay = Math.max(existing, cascadedDelay)
        delayMap.set(depId, effectiveDelay)

        ghostBars.push({
          taskId: depId,
          originalStart: depTask.startDate,
          originalEnd: depTask.endDate,
          projectedStart: addDays(depTask.startDate, effectiveDelay),
          projectedEnd: addDays(depTask.endDate, effectiveDelay),
          reason: `Upstream task "${currentTask.name}" delayed by ${currentDelay} day(s)`,
        })

        if (!visited.has(depId)) {
          queue.push(depId)
        }
      }
    }
  }

  return ghostBars
}

function computeCascadedDelay(
  predecessor: GanttTask,
  successor: GanttTask,
  type: DependencyType,
  lag: number,
  predecessorDelay: number,
): number {
  switch (type) {
    case 'FS': {
      const requiredStart = addDays(addDays(predecessor.endDate, predecessorDelay), lag)
      const slack = diffDays(requiredStart, successor.startDate)
      return Math.max(0, slack)
    }
    case 'SS': {
      const requiredStart = addDays(addDays(predecessor.startDate, predecessorDelay), lag)
      const slack = diffDays(requiredStart, successor.startDate)
      return Math.max(0, slack)
    }
    case 'FF': {
      const requiredEnd = addDays(addDays(predecessor.endDate, predecessorDelay), lag)
      const slack = diffDays(requiredEnd, successor.endDate)
      return Math.max(0, slack)
    }
    case 'SF': {
      const requiredEnd = addDays(addDays(predecessor.startDate, predecessorDelay), lag)
      const slack = diffDays(requiredEnd, successor.endDate)
      return Math.max(0, slack)
    }
  }
}

// ---------------------------------------------------------------------------
// Topological sort (Kahn's algorithm)
// ---------------------------------------------------------------------------

export function resolveExecutionOrder(tasks: GanttTask[]): string[] {
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const t of tasks) {
    if (!inDegree.has(t.id)) inDegree.set(t.id, 0)
    if (!adj.has(t.id)) adj.set(t.id, [])
  }

  for (const t of tasks) {
    for (const dep of t.dependencies) {
      const list = adj.get(dep.taskId)
      if (list) {
        list.push(t.id)
      } else {
        adj.set(dep.taskId, [t.id])
      }
      inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1)
    }
  }

  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }

  const order: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    order.push(current)

    const neighbors = adj.get(current) ?? []
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    }
  }

  if (order.length !== tasks.length) {
    throw new Error('Dependency cycle detected: cannot produce a valid execution order')
  }

  return order
}

// ---------------------------------------------------------------------------
// Critical path (forward + backward pass)
// ---------------------------------------------------------------------------

export function findCriticalPath(tasks: GanttTask[]): string[] {
  if (tasks.length === 0) return []

  const order = resolveExecutionOrder(tasks)
  const taskMap = buildTaskMap(tasks)

  const earliestStart = new Map<string, number>()
  const earliestFinish = new Map<string, number>()

  for (const id of order) {
    const task = taskMap.get(id)!
    let es = 0

    for (const dep of task.dependencies) {
      const predEF = earliestFinish.get(dep.taskId) ?? 0
      const constraint = computeEarliestConstraint(
        dep.type,
        dep.lag,
        earliestStart.get(dep.taskId) ?? 0,
        predEF,
      )
      es = Math.max(es, constraint)
    }

    earliestStart.set(id, es)
    earliestFinish.set(id, es + task.duration)
  }

  const projectDuration = Math.max(...Array.from(earliestFinish.values()))

  const latestFinish = new Map<string, number>()
  const latestStart = new Map<string, number>()
  const adj = buildAdjacencyList(tasks)

  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]
    const task = taskMap.get(id)!
    const successors = adj.get(id) ?? []

    let lf = projectDuration

    for (const succId of successors) {
      const succTask = taskMap.get(succId)!
      const dep = succTask.dependencies.find((d) => d.taskId === id)
      if (!dep) continue

      const constraint = computeLatestConstraint(
        dep.type,
        dep.lag,
        latestStart.get(succId) ?? projectDuration,
        latestFinish.get(succId) ?? projectDuration,
      )
      lf = Math.min(lf, constraint)
    }

    latestFinish.set(id, lf)
    latestStart.set(id, lf - task.duration)
  }

  const criticalPath: string[] = []
  for (const id of order) {
    const es = earliestStart.get(id) ?? 0
    const ls = latestStart.get(id) ?? 0
    const slack = ls - es
    if (Math.abs(slack) < 0.001) {
      criticalPath.push(id)
    }
  }

  return criticalPath
}

function computeEarliestConstraint(
  type: DependencyType,
  lag: number,
  predES: number,
  predEF: number,
): number {
  switch (type) {
    case 'FS': return predEF + lag
    case 'SS': return predES + lag
    case 'FF': return predEF + lag
    case 'SF': return predES + lag
  }
}

function computeLatestConstraint(
  type: DependencyType,
  lag: number,
  succLS: number,
  succLF: number,
): number {
  switch (type) {
    case 'FS': return succLS - lag
    case 'SS': return succLS - lag
    case 'FF': return succLF - lag
    case 'SF': return succLF - lag
  }
}

// ---------------------------------------------------------------------------
// Auto-schedule: place tasks based on dependencies starting from projectStart
// ---------------------------------------------------------------------------

export function autoSchedule(tasks: GanttTask[], projectStart: Date): GanttTask[] {
  if (tasks.length === 0) return []

  const order = resolveExecutionOrder(tasks)
  const taskMap = buildTaskMap(tasks)

  const scheduledStart = new Map<string, Date>()
  const scheduledEnd = new Map<string, Date>()

  for (const id of order) {
    const task = taskMap.get(id)!
    let earliest = projectStart

    for (const dep of task.dependencies) {
      const predStart = scheduledStart.get(dep.taskId) ?? projectStart
      const predEnd = scheduledEnd.get(dep.taskId) ?? projectStart

      const constraint = computeScheduleConstraint(
        dep.type,
        dep.lag,
        predStart,
        predEnd,
      )

      if (constraint.getTime() > earliest.getTime()) {
        earliest = constraint
      }
    }

    scheduledStart.set(id, earliest)
    scheduledEnd.set(id, addDays(earliest, task.duration))
  }

  return order.map((id) => {
    const original = taskMap.get(id)!
    return {
      ...original,
      startDate: scheduledStart.get(id)!,
      endDate: scheduledEnd.get(id)!,
    }
  })
}

function computeScheduleConstraint(
  type: DependencyType,
  lag: number,
  predStart: Date,
  predEnd: Date,
): Date {
  switch (type) {
    case 'FS': return addDays(predEnd, lag)
    case 'SS': return addDays(predStart, lag)
    case 'FF': return addDays(predEnd, lag)
    case 'SF': return addDays(predStart, lag)
  }
}
