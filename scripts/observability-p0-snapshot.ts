import { createScopedLogger } from '@/lib/logging/core'
import { evaluateObservabilitySnapshot } from '@/lib/observability/alerts'
import { prisma } from '@/lib/prisma'
import { imageQueue, textQueue, videoQueue, voiceQueue } from '@/lib/task/queues'
import { TASK_EVENT_TYPE, TASK_STATUS } from '@/lib/task/types'

type QueueBacklogStats = {
  queue: string
  waiting: number
  delayed: number
  active: number
  prioritized: number
  backlog: number
}

const logger = createScopedLogger({
  module: 'ops.observability_snapshot',
  action: 'ops.observability_snapshot.run',
})

function parseArgInt(flag: string, fallback: number): number {
  const prefix = `--${flag}=`
  const arg = process.argv.find((item) => item.startsWith(prefix))
  const raw = arg ? Number.parseInt(arg.slice(prefix.length), 10) : fallback
  return Number.isFinite(raw) && raw > 0 ? raw : fallback
}

function parseArgFlag(flag: string): boolean {
  return process.argv.includes(`--${flag}`)
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

async function collectQueueBacklog(): Promise<QueueBacklogStats[]> {
  const targets = [
    { queue: 'image', handle: imageQueue },
    { queue: 'video', handle: videoQueue },
    { queue: 'voice', handle: voiceQueue },
    { queue: 'text', handle: textQueue },
  ] as const

  const rows: QueueBacklogStats[] = []
  for (const target of targets) {
    const counts = await target.handle.getJobCounts('waiting', 'delayed', 'active', 'prioritized')
    const waiting = toCount(counts.waiting)
    const delayed = toCount(counts.delayed)
    const active = toCount(counts.active)
    const prioritized = toCount(counts.prioritized)
    rows.push({
      queue: target.queue,
      waiting,
      delayed,
      active,
      prioritized,
      backlog: waiting + delayed + active + prioritized,
    })
  }
  return rows
}

function expectedTerminalEvent(status: string): string | null {
  if (status === TASK_STATUS.COMPLETED) return TASK_EVENT_TYPE.COMPLETED
  if (status === TASK_STATUS.FAILED) return TASK_EVENT_TYPE.FAILED
  if (status === TASK_STATUS.DISMISSED) return TASK_EVENT_TYPE.DISMISSED
  return null
}

async function collectTerminalMismatchRate(since: Date): Promise<{
  terminalTaskCount: number
  mismatchCount: number
  mismatchRate: number
}> {
  const terminalTasks = await prisma.task.findMany({
    where: {
      status: {
        in: [TASK_STATUS.COMPLETED, TASK_STATUS.FAILED, TASK_STATUS.DISMISSED],
      },
      finishedAt: { gte: since },
    },
    select: {
      id: true,
      status: true,
    },
    take: 5_000,
  })

  if (terminalTasks.length === 0) {
    return {
      terminalTaskCount: 0,
      mismatchCount: 0,
      mismatchRate: 0,
    }
  }

  const taskIds = terminalTasks.map((task) => task.id)
  const terminalEvents = await prisma.taskEvent.findMany({
    where: {
      taskId: { in: taskIds },
      eventType: {
        in: [TASK_EVENT_TYPE.COMPLETED, TASK_EVENT_TYPE.FAILED, TASK_EVENT_TYPE.DISMISSED],
      },
    },
    select: {
      taskId: true,
      eventType: true,
    },
  })

  const eventMap = new Map<string, Set<string>>()
  for (const row of terminalEvents) {
    const set = eventMap.get(row.taskId)
    if (set) {
      set.add(row.eventType)
    } else {
      eventMap.set(row.taskId, new Set([row.eventType]))
    }
  }

  let mismatchCount = 0
  for (const task of terminalTasks) {
    const expected = expectedTerminalEvent(task.status)
    if (!expected) continue
    const events = eventMap.get(task.id)
    if (!events || !events.has(expected)) {
      mismatchCount += 1
    }
  }

  return {
    terminalTaskCount: terminalTasks.length,
    mismatchCount,
    mismatchRate: mismatchCount / terminalTasks.length,
  }
}

async function run() {
  const minutes = parseArgInt('minutes', 60)
  const staleProcessingMinutes = parseArgInt('stale-processing-minutes', 5)
  const strict = parseArgFlag('strict')
  const now = new Date()
  const since = new Date(now.getTime() - minutes * 60_000)
  const staleCutoff = new Date(now.getTime() - staleProcessingMinutes * 60_000)

  const [terminalCount, failedCount, staleProcessingCount, billingCompensationFailedCount, queueBacklog, mismatch] = await Promise.all([
    prisma.task.count({
      where: {
        status: {
          in: [TASK_STATUS.COMPLETED, TASK_STATUS.FAILED, TASK_STATUS.DISMISSED],
        },
        finishedAt: { gte: since },
      },
    }),
    prisma.task.count({
      where: {
        status: TASK_STATUS.FAILED,
        finishedAt: { gte: since },
      },
    }),
    prisma.task.count({
      where: {
        status: TASK_STATUS.PROCESSING,
        OR: [
          {
            heartbeatAt: {
              lt: staleCutoff,
            },
          },
          {
            heartbeatAt: null,
            startedAt: {
              lt: staleCutoff,
            },
          },
        ],
      },
    }),
    prisma.task.count({
      where: {
        status: TASK_STATUS.FAILED,
        errorCode: 'BILLING_COMPENSATION_FAILED',
        finishedAt: { gte: since },
      },
    }),
    collectQueueBacklog(),
    collectTerminalMismatchRate(since),
  ])

  const taskFailureRate = terminalCount > 0 ? failedCount / terminalCount : 0
  const maxQueueBacklog = queueBacklog.reduce((max, row) => Math.max(max, row.backlog), 0)
  const snapshot = {
    taskFailureRate,
    terminalMismatchRate: mismatch.mismatchRate,
    maxQueueBacklog,
    staleProcessingCount,
    billingCompensationFailedCount,
  }
  const alertResult = evaluateObservabilitySnapshot(snapshot)

  const report = {
    generatedAt: now.toISOString(),
    window: {
      minutes,
      from: since.toISOString(),
      to: now.toISOString(),
      staleProcessingMinutes,
    },
    snapshot: {
      ...snapshot,
      terminalTaskCount: mismatch.terminalTaskCount,
      terminalMismatchCount: mismatch.mismatchCount,
      failedTaskCount: failedCount,
      queueBacklog,
    },
    alert: alertResult,
  }

  logger.info({
    action: 'ops.observability_snapshot.generated',
    message: 'p0 observability snapshot generated',
    details: {
      overallLevel: alertResult.overallLevel,
      taskFailureRate,
      terminalMismatchRate: mismatch.mismatchRate,
      maxQueueBacklog,
      staleProcessingCount,
      billingCompensationFailedCount,
    },
  })
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)

  if (alertResult.overallLevel === 'critical' || (strict && alertResult.overallLevel !== 'ok')) {
    process.exitCode = 1
  }
}

run()
  .catch((error) => {
    logger.error({
      action: 'ops.observability_snapshot.failed',
      message: 'failed to generate p0 observability snapshot',
      errorCode: 'INTERNAL_ERROR',
      retryable: false,
      error:
        error instanceof Error
          ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
          : {
            message: String(error),
          },
    })
    process.exitCode = 1
  })
  .finally(async () => {
    await Promise.allSettled([
      imageQueue.close(),
      videoQueue.close(),
      voiceQueue.close(),
      textQueue.close(),
      prisma.$disconnect(),
    ])
  })
