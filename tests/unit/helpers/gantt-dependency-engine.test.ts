import { describe, expect, it } from 'vitest'
import {
  calculateGhostBars,
  resolveExecutionOrder,
  findCriticalPath,
  autoSchedule,
  type GanttTask,
} from '@/lib/gantt/dependency-engine'

function makeTask(overrides: Partial<GanttTask> & { id: string }): GanttTask {
  const start = overrides.startDate ?? new Date('2025-06-01')
  const duration = overrides.duration ?? 5
  const end = overrides.endDate ?? new Date(start.getTime() + duration * 86_400_000)
  return {
    name: overrides.name ?? `Task ${overrides.id}`,
    startDate: start,
    endDate: end,
    duration,
    progress: overrides.progress ?? 0,
    assignee: overrides.assignee ?? null,
    dependencies: overrides.dependencies ?? [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// resolveExecutionOrder
// ---------------------------------------------------------------------------

describe('resolveExecutionOrder', () => {
  it('无依赖 -> 按原始顺序返回', () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b' }), makeTask({ id: 'c' })]
    const order = resolveExecutionOrder(tasks)
    expect(order).toHaveLength(3)
    expect(order).toContain('a')
    expect(order).toContain('b')
    expect(order).toContain('c')
  })

  it('线性依赖链 -> 按依赖顺序排列', () => {
    const tasks = [
      makeTask({ id: 'c', dependencies: [{ taskId: 'b', type: 'FS', lag: 0 }] }),
      makeTask({ id: 'b', dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }] }),
      makeTask({ id: 'a' }),
    ]
    const order = resolveExecutionOrder(tasks)
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'))
  })

  it('存在循环依赖 -> 抛出错误', () => {
    const tasks = [
      makeTask({ id: 'a', dependencies: [{ taskId: 'b', type: 'FS', lag: 0 }] }),
      makeTask({ id: 'b', dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }] }),
    ]
    expect(() => resolveExecutionOrder(tasks)).toThrow('Dependency cycle detected')
  })

  it('菱形依赖 -> 正确排序', () => {
    const tasks = [
      makeTask({ id: 'a' }),
      makeTask({ id: 'b', dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }] }),
      makeTask({ id: 'c', dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }] }),
      makeTask({
        id: 'd',
        dependencies: [
          { taskId: 'b', type: 'FS', lag: 0 },
          { taskId: 'c', type: 'FS', lag: 0 },
        ],
      }),
    ]
    const order = resolveExecutionOrder(tasks)
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'))
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'))
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'))
  })
})

// ---------------------------------------------------------------------------
// calculateGhostBars
// ---------------------------------------------------------------------------

describe('calculateGhostBars', () => {
  it('上游延迟 -> 下游产生 ghost bar', () => {
    const tasks = [
      makeTask({ id: 'a', startDate: new Date('2025-06-01'), duration: 5 }),
      makeTask({
        id: 'b',
        startDate: new Date('2025-06-06'),
        duration: 3,
        dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }],
      }),
    ]
    const ghosts = calculateGhostBars(tasks, 'a', 3)
    expect(ghosts).toHaveLength(1)
    expect(ghosts[0].taskId).toBe('b')
    expect(ghosts[0].reason).toContain('Task a')
    expect(ghosts[0].projectedStart.getTime()).toBeGreaterThan(
      ghosts[0].originalStart.getTime(),
    )
  })

  it('无下游任务 -> 空 ghost bars', () => {
    const tasks = [makeTask({ id: 'a' })]
    const ghosts = calculateGhostBars(tasks, 'a', 5)
    expect(ghosts).toHaveLength(0)
  })

  it('延迟传播多级 -> 级联产生 ghost bars', () => {
    const tasks = [
      makeTask({ id: 'a', startDate: new Date('2025-06-01'), duration: 3 }),
      makeTask({
        id: 'b',
        startDate: new Date('2025-06-04'),
        duration: 3,
        dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }],
      }),
      makeTask({
        id: 'c',
        startDate: new Date('2025-06-07'),
        duration: 2,
        dependencies: [{ taskId: 'b', type: 'FS', lag: 0 }],
      }),
    ]
    const ghosts = calculateGhostBars(tasks, 'a', 2)
    expect(ghosts.length).toBeGreaterThanOrEqual(2)
    const ghostIds = ghosts.map((g) => g.taskId)
    expect(ghostIds).toContain('b')
    expect(ghostIds).toContain('c')
  })

  it('延迟的 taskId 不存在 -> 返回空数组', () => {
    const tasks = [makeTask({ id: 'a' })]
    const ghosts = calculateGhostBars(tasks, 'nonexistent', 5)
    expect(ghosts).toHaveLength(0)
  })

  it('SS 依赖类型 -> 正确计算偏移', () => {
    const tasks = [
      makeTask({ id: 'a', startDate: new Date('2025-06-01'), duration: 5 }),
      makeTask({
        id: 'b',
        startDate: new Date('2025-06-01'),
        duration: 3,
        dependencies: [{ taskId: 'a', type: 'SS', lag: 0 }],
      }),
    ]
    const ghosts = calculateGhostBars(tasks, 'a', 3)
    expect(ghosts).toHaveLength(1)
    expect(ghosts[0].taskId).toBe('b')
  })
})

// ---------------------------------------------------------------------------
// findCriticalPath
// ---------------------------------------------------------------------------

describe('findCriticalPath', () => {
  it('空任务列表 -> 空路径', () => {
    expect(findCriticalPath([])).toEqual([])
  })

  it('单任务 -> 该任务为关键路径', () => {
    const tasks = [makeTask({ id: 'solo', duration: 10 })]
    expect(findCriticalPath(tasks)).toEqual(['solo'])
  })

  it('线性链路 -> 全部为关键路径', () => {
    const tasks = [
      makeTask({ id: 'a', duration: 3 }),
      makeTask({
        id: 'b',
        duration: 4,
        dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }],
      }),
      makeTask({
        id: 'c',
        duration: 2,
        dependencies: [{ taskId: 'b', type: 'FS', lag: 0 }],
      }),
    ]
    const cp = findCriticalPath(tasks)
    expect(cp).toEqual(['a', 'b', 'c'])
  })

  it('并行分支 -> 最长路径为关键路径', () => {
    const tasks = [
      makeTask({ id: 'start', duration: 1 }),
      makeTask({
        id: 'long',
        duration: 10,
        dependencies: [{ taskId: 'start', type: 'FS', lag: 0 }],
      }),
      makeTask({
        id: 'short',
        duration: 2,
        dependencies: [{ taskId: 'start', type: 'FS', lag: 0 }],
      }),
      makeTask({
        id: 'end',
        duration: 1,
        dependencies: [
          { taskId: 'long', type: 'FS', lag: 0 },
          { taskId: 'short', type: 'FS', lag: 0 },
        ],
      }),
    ]
    const cp = findCriticalPath(tasks)
    expect(cp).toContain('start')
    expect(cp).toContain('long')
    expect(cp).toContain('end')
    expect(cp).not.toContain('short')
  })
})

// ---------------------------------------------------------------------------
// autoSchedule
// ---------------------------------------------------------------------------

describe('autoSchedule', () => {
  const projectStart = new Date('2025-07-01')

  it('无依赖 -> 全部从 projectStart 开始', () => {
    const tasks = [
      makeTask({ id: 'x', duration: 3 }),
      makeTask({ id: 'y', duration: 5 }),
    ]
    const scheduled = autoSchedule(tasks, projectStart)
    expect(scheduled).toHaveLength(2)
    for (const t of scheduled) {
      expect(t.startDate.getTime()).toBe(projectStart.getTime())
    }
  })

  it('FS 依赖 -> 后继任务在前驱结束后开始', () => {
    const tasks = [
      makeTask({ id: 'a', duration: 5 }),
      makeTask({
        id: 'b',
        duration: 3,
        dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }],
      }),
    ]
    const scheduled = autoSchedule(tasks, projectStart)
    const a = scheduled.find((t) => t.id === 'a')!
    const b = scheduled.find((t) => t.id === 'b')!

    expect(a.startDate.getTime()).toBe(projectStart.getTime())
    expect(b.startDate.getTime()).toBe(a.endDate.getTime())
  })

  it('FS 依赖 + lag -> 后继任务在 lag 天后开始', () => {
    const tasks = [
      makeTask({ id: 'a', duration: 5 }),
      makeTask({
        id: 'b',
        duration: 3,
        dependencies: [{ taskId: 'a', type: 'FS', lag: 2 }],
      }),
    ]
    const scheduled = autoSchedule(tasks, projectStart)
    const a = scheduled.find((t) => t.id === 'a')!
    const b = scheduled.find((t) => t.id === 'b')!

    const expectedBStart = new Date(a.endDate.getTime() + 2 * 86_400_000)
    expect(b.startDate.getTime()).toBe(expectedBStart.getTime())
  })

  it('SS 依赖 -> 后继任务与前驱同时开始', () => {
    const tasks = [
      makeTask({ id: 'a', duration: 5 }),
      makeTask({
        id: 'b',
        duration: 3,
        dependencies: [{ taskId: 'a', type: 'SS', lag: 0 }],
      }),
    ]
    const scheduled = autoSchedule(tasks, projectStart)
    const a = scheduled.find((t) => t.id === 'a')!
    const b = scheduled.find((t) => t.id === 'b')!

    expect(b.startDate.getTime()).toBe(a.startDate.getTime())
  })

  it('多个前驱 -> 取最晚约束', () => {
    const tasks = [
      makeTask({ id: 'a', duration: 3 }),
      makeTask({ id: 'b', duration: 7 }),
      makeTask({
        id: 'c',
        duration: 2,
        dependencies: [
          { taskId: 'a', type: 'FS', lag: 0 },
          { taskId: 'b', type: 'FS', lag: 0 },
        ],
      }),
    ]
    const scheduled = autoSchedule(tasks, projectStart)
    const b = scheduled.find((t) => t.id === 'b')!
    const c = scheduled.find((t) => t.id === 'c')!

    expect(c.startDate.getTime()).toBe(b.endDate.getTime())
  })

  it('空任务列表 -> 返回空数组', () => {
    expect(autoSchedule([], projectStart)).toEqual([])
  })
})
