import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createScopedLogger } from '@/lib/logging/core'
import { withPrismaRetry } from '@/lib/prisma-retry'
import { rollbackTaskBilling } from '@/lib/billing'
import { locales } from '@/i18n/routing'
import { TASK_STATUS, type CreateTaskInput, type TaskBillingInfo, type TaskStatus } from './types'
import { recordTaskTransitionDenied } from './metrics'

const ACTIVE_STATUSES: TaskStatus[] = [TASK_STATUS.QUEUED, TASK_STATUS.PROCESSING]
const TERMINAL_STATUSES: TaskStatus[] = [TASK_STATUS.COMPLETED, TASK_STATUS.FAILED, TASK_STATUS.DISMISSED]
const taskModel = prisma.task
const serviceLogger = createScopedLogger({ module: 'task.service' })
const STATUS_SOURCES = {
  enqueueMeta: [TASK_STATUS.QUEUED] as const,
  processing: [TASK_STATUS.QUEUED, TASK_STATUS.PROCESSING] as const,
  externalId: [TASK_STATUS.PROCESSING] as const,
  progress: [TASK_STATUS.PROCESSING] as const,
  completed: [TASK_STATUS.PROCESSING] as const,
  failed: [TASK_STATUS.QUEUED, TASK_STATUS.PROCESSING] as const,
  heartbeat: [TASK_STATUS.PROCESSING] as const,
}
export type ActiveTaskFailureSource =
  | 'task_locale_missing'
  | 'dedupe_orphan'
  | 'reconcile_orphan'

function assertStatusSourcesDoNotIncludeTerminalStates() {
  const terminal = new Set<TaskStatus>(TERMINAL_STATUSES)
  for (const [sourceName, sourceStatuses] of Object.entries(STATUS_SOURCES) as Array<
    [keyof typeof STATUS_SOURCES, readonly TaskStatus[]]
  >) {
    const invalid = sourceStatuses.filter((status) => terminal.has(status))
    if (invalid.length > 0) {
      throw new Error(`TASK_STATUS_SOURCE_INVALID:${sourceName}:${invalid.join(',')}`)
    }
  }
}

assertStatusSourcesDoNotIncludeTerminalStates()

/**
 * 校验 BullMQ Job 是否仍然活着。
 * 若检查失败（如 Redis 不可用），必须显式失败并上报，不允许静默降级。
 */
async function verifyJobAlive(taskId: string): Promise<boolean> {
  try {
    const { isJobAlive } = await import('./reconcile')
    return await isJobAlive(taskId)
  } catch (error) {
    serviceLogger.error({
      action: 'task.verify_job_alive.failed',
      message: 'failed to verify BullMQ job liveness',
      taskId,
      errorCode: 'RECONCILE_CHECK_FAILED',
      retryable: true,
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
    throw new Error('RECONCILE_CHECK_FAILED')
  }
}

function isPrismaKnownError(error: unknown): error is { code?: string } {
  return typeof error === 'object' && error !== null && 'code' in error
}

function isActiveStatus(status: string) {
  return status === TASK_STATUS.QUEUED || status === TASK_STATUS.PROCESSING
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function normalizeLocale(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  for (const locale of locales) {
    if (normalized === locale || normalized.startsWith(`${locale}-`)) {
      return locale
    }
  }
  return null
}

function hasTaskLocale(payload: unknown): boolean {
  const payloadObject = toObject(payload)
  const payloadMeta = toObject(payloadObject.meta)
  const locale = normalizeLocale(payloadMeta.locale) || normalizeLocale(payloadObject.locale)
  return locale !== null
}

function toNullableJson(value?: Prisma.InputJsonValue | Record<string, unknown> | TaskBillingInfo | null) {
  if (value === undefined) return undefined
  if (value === null) return Prisma.JsonNull
  return value as Prisma.InputJsonValue
}

function parseTaskBillingInfo(raw: unknown): TaskBillingInfo | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  if (!('billable' in raw)) return null
  const billable = (raw as { billable?: unknown }).billable
  if (typeof billable !== 'boolean') return null
  return raw as TaskBillingInfo
}

function needsRollback(info: TaskBillingInfo | null): info is Extract<TaskBillingInfo, { billable: true }> {
  if (!info || !info.billable) return false
  if (!info.freezeId) return false
  if (info.modeSnapshot === 'OFF' || info.modeSnapshot === 'SHADOW') return false
  if (info.status === 'settled' || info.status === 'rolled_back') return false
  return true
}

type TaskBillingRollbackResult = {
  attempted: boolean
  rolledBack: boolean
  billingInfo: TaskBillingInfo | null
}

function resolveCompensationFailure(
  rollback: TaskBillingRollbackResult,
  fallbackCode: string,
  fallbackMessage: string,
) {
  if (!rollback.attempted || rollback.rolledBack) {
    return {
      errorCode: fallbackCode,
      errorMessage: fallbackMessage,
    }
  }
  return {
    errorCode: 'BILLING_COMPENSATION_FAILED',
    errorMessage: `${fallbackMessage}; billing rollback failed`,
  }
}

async function releaseTerminalTaskDedupeKey(taskId: string) {
  const result = await taskModel.updateMany({
    where: {
      id: taskId,
      status: { in: [...TERMINAL_STATUSES] },
      dedupeKey: { not: null },
    },
    data: {
      dedupeKey: null,
    },
  })
  return result.count > 0
}

export async function failActiveTaskWithDedupeRelease(params: {
  taskId: string
  errorCode: string
  errorMessage: string
  source: ActiveTaskFailureSource
}) {
  const updated = await taskModel.updateMany({
    where: taskWhereBySources(params.taskId, STATUS_SOURCES.failed),
    data: {
      status: TASK_STATUS.FAILED,
      errorCode: params.errorCode.slice(0, 80),
      errorMessage: params.errorMessage.slice(0, 2000),
      finishedAt: new Date(),
      heartbeatAt: null,
      dedupeKey: null,
    },
  })
  if (updated.count > 0) return true

  const snapshot = await taskModel.findUnique({
    where: { id: params.taskId },
    select: {
      status: true,
      dedupeKey: true,
    },
  })
  if (!snapshot) {
    recordTaskTransitionDenied({
      taskId: params.taskId,
      source: params.source,
      expectedStatuses: STATUS_SOURCES.failed,
      currentStatus: null,
      reason: 'task_missing',
    })
    serviceLogger.warn({
      action: 'task.transition.denied.missing',
      message: 'task not found when failing active task',
      taskId: params.taskId,
      source: params.source,
      expectedStatuses: STATUS_SOURCES.failed,
    })
    return false
  }

  if (
    isTerminalTaskStatus(snapshot.status)
    && typeof snapshot.dedupeKey === 'string'
    && snapshot.dedupeKey.trim()
  ) {
    const released = await releaseTerminalTaskDedupeKey(params.taskId)
    if (released) {
      serviceLogger.info({
        action: 'task.dedupe.release_terminal',
        message: 'released dedupeKey on terminal task after transition race',
        taskId: params.taskId,
        source: params.source,
        currentStatus: snapshot.status,
      })
    }
  }

  recordTaskTransitionDenied({
    taskId: params.taskId,
    source: params.source,
    expectedStatuses: STATUS_SOURCES.failed,
    currentStatus: snapshot.status,
    reason: 'status_mismatch',
  })
  serviceLogger.warn({
    action: 'task.transition.denied',
    message: 'failed to apply active->failed transition due to status mismatch',
    taskId: params.taskId,
    source: params.source,
    expectedStatuses: STATUS_SOURCES.failed,
    currentStatus: snapshot.status,
  })
  return false
}

function isTerminalTaskStatus(status: string): status is TaskStatus {
  return status === TASK_STATUS.COMPLETED
    || status === TASK_STATUS.FAILED
    || status === TASK_STATUS.DISMISSED
}

async function failTaskWithMissingLocale(task: {
  id: string
  billingInfo: unknown
}) {
  const rollbackResult = await rollbackTaskBillingForTask({
    taskId: task.id,
    billingInfo: task.billingInfo,
  })
  const failure = resolveCompensationFailure(
    rollbackResult,
    'TASK_LOCALE_REQUIRED',
    'task locale is missing',
  )
  await failActiveTaskWithDedupeRelease({
    taskId: task.id,
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
    source: 'task_locale_missing',
  })
}

export async function rollbackTaskBillingForTask(params: {
  taskId: string
  billingInfo?: unknown
}): Promise<TaskBillingRollbackResult> {
  const current =
    params.billingInfo === undefined
      ? await taskModel.findUnique({
        where: { id: params.taskId },
        select: { billingInfo: true },
      })
      : { billingInfo: params.billingInfo }

  const billingInfo = parseTaskBillingInfo(current?.billingInfo ?? null)
  if (!needsRollback(billingInfo)) {
    return {
      attempted: false,
      rolledBack: true,
      billingInfo,
    }
  }

  const nextInfo = (await rollbackTaskBilling({
    id: params.taskId,
    billingInfo,
  })) as TaskBillingInfo

  await updateTaskBillingInfo(params.taskId, nextInfo)

  return {
    attempted: true,
    rolledBack: nextInfo.billable ? nextInfo.status === 'rolled_back' : true,
    billingInfo: nextInfo,
  }
}

export async function createTask(input: CreateTaskInput) {
  const model = taskModel

  if (input.dedupeKey) {
    const existing = await model.findFirst({
      where: {
        dedupeKey: input.dedupeKey,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (existing) {
      if (isActiveStatus(existing.status)) {
        if (!hasTaskLocale(existing.payload)) {
          await failTaskWithMissingLocale(existing)
        } else {
          // 校验 BullMQ Job 是否真的还活着，防止 DB 与队列状态脱节导致永久卡死
          const jobAlive = await verifyJobAlive(existing.id)
          if (jobAlive) {
            return { task: existing, deduped: true as const }
          }

          const rollbackResult = await rollbackTaskBillingForTask({
            taskId: existing.id,
            billingInfo: existing.billingInfo,
          })
          const failure = resolveCompensationFailure(
            rollbackResult,
            'RECONCILE_ORPHAN',
            'Queue job lost, replaced by new task',
          )

          // Job 已死（terminal / missing）→ 终止孤儿任务，释放 dedupeKey，继续创建新任务
          await failActiveTaskWithDedupeRelease({
            taskId: existing.id,
            errorCode: failure.errorCode,
            errorMessage: failure.errorMessage,
            source: 'dedupe_orphan',
          })
        }
      } else {
        // dedupeKey is unique in DB. Release terminal-task key so a new task can be created.
        await releaseTerminalTaskDedupeKey(existing.id)
      }
    }
  }

  const createData = {
    userId: input.userId,
    projectId: input.projectId,
    episodeId: input.episodeId || null,
    type: input.type,
    targetType: input.targetType,
    targetId: input.targetId,
    status: TASK_STATUS.QUEUED,
    progress: 0,
    attempt: 0,
    maxAttempts: input.maxAttempts ?? 5,
    priority: input.priority ?? 0,
    dedupeKey: input.dedupeKey || null,
    payload: toNullableJson(input.payload ?? null),
    billingInfo: toNullableJson(input.billingInfo ?? null),
    queuedAt: new Date(),
  }

  try {
    const task = await model.create({ data: createData })
    return { task, deduped: false as const }
  } catch (error: unknown) {
    if (input.dedupeKey && isPrismaKnownError(error) && error.code === 'P2002') {
      const collided = await model.findFirst({
        where: { dedupeKey: input.dedupeKey },
        orderBy: { createdAt: 'desc' },
      })

      if (collided) {
        if (isActiveStatus(collided.status)) {
          if (!hasTaskLocale(collided.payload)) {
            await failTaskWithMissingLocale(collided)
          } else {
            // P2002 竞态路径：同样校验 BullMQ Job 状态
            const jobAlive = await verifyJobAlive(collided.id)
            if (jobAlive) {
              return { task: collided, deduped: true as const }
            }

            const rollbackResult = await rollbackTaskBillingForTask({
              taskId: collided.id,
              billingInfo: collided.billingInfo,
            })
            const failure = resolveCompensationFailure(
              rollbackResult,
              'RECONCILE_ORPHAN',
              'Queue job lost, replaced by new task',
            )

            await failActiveTaskWithDedupeRelease({
              taskId: collided.id,
              errorCode: failure.errorCode,
              errorMessage: failure.errorMessage,
              source: 'dedupe_orphan',
            })
          }
        } else {
          await releaseTerminalTaskDedupeKey(collided.id)
        }

        const task = await model.create({ data: createData })
        return { task, deduped: false as const }
      }
    }

    throw error
  }
}

export async function getTaskById(taskId: string) {
  return await taskModel.findUnique({ where: { id: taskId } })
}

export async function queryTasks(filters: {
  projectId?: string
  targetType?: string
  targetId?: string
  status?: TaskStatus[]
  type?: string[]
  limit?: number
}) {
  return await taskModel.findMany({
    where: {
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.targetType ? { targetType: filters.targetType } : {}),
      ...(filters.targetId ? { targetId: filters.targetId } : {}),
      ...(filters.status?.length ? { status: { in: filters.status } } : {}),
      ...(filters.type?.length ? { type: { in: filters.type } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: filters.limit ?? 50,
  })
}

export async function getActiveTasksForTarget(params: {
  targetType: string
  targetId: string
  projectId?: string
}) {
  return await taskModel.findMany({
    where: {
      targetType: params.targetType,
      targetId: params.targetId,
      ...(params.projectId ? { projectId: params.projectId } : {}),
      status: { in: [...ACTIVE_STATUSES] },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function markTaskEnqueueFailed(taskId: string, error: string) {
  const updated = await taskModel.updateMany({
    where: taskWhereBySources(taskId, STATUS_SOURCES.enqueueMeta),
    data: {
      enqueueAttempts: { increment: 1 },
      lastEnqueueError: error.slice(0, 500),
    },
  })
  if (updated.count <= 0) {
    await logStatusTransitionDenied({
      taskId,
      source: 'enqueueMeta',
      details: { operation: 'markTaskEnqueueFailed' },
    })
  }
  return updated.count > 0
}

export async function resetProcessingTasksToQueuedOnStartup() {
  const result = await taskModel.updateMany({
    where: {
      status: TASK_STATUS.PROCESSING,
    },
    data: {
      status: TASK_STATUS.QUEUED,
      startedAt: null,
      heartbeatAt: null,
    },
  })
  return result.count
}

export async function markTaskEnqueued(taskId: string) {
  const updated = await taskModel.updateMany({
    where: taskWhereBySources(taskId, STATUS_SOURCES.enqueueMeta),
    data: {
      enqueuedAt: new Date(),
      lastEnqueueError: null,
    },
  })
  if (updated.count <= 0) {
    await logStatusTransitionDenied({
      taskId,
      source: 'enqueueMeta',
      details: { operation: 'markTaskEnqueued' },
    })
  }
  return updated.count > 0
}

export async function updateTaskBillingInfo(taskId: string, billingInfo: TaskBillingInfo | null) {
  return await taskModel.update({
    where: { id: taskId },
    data: {
      billingInfo: toNullableJson(billingInfo as unknown as Prisma.InputJsonValue),
    },
  })
}

function taskWhereBySources(taskId: string, statuses: readonly TaskStatus[]) {
  return {
    id: taskId,
    status: { in: [...statuses] },
  }
}

async function logStatusTransitionDenied(params: {
  taskId: string
  source: keyof typeof STATUS_SOURCES
  details?: Record<string, unknown>
}) {
  const current = await taskModel.findUnique({
    where: { id: params.taskId },
    select: { status: true },
  })
  if (!current) {
    recordTaskTransitionDenied({
      taskId: params.taskId,
      source: params.source,
      expectedStatuses: STATUS_SOURCES[params.source],
      currentStatus: null,
      reason: 'task_missing',
    })
    serviceLogger.warn({
      action: 'task.transition.denied.missing',
      message: 'task transition denied because task does not exist',
      taskId: params.taskId,
      source: params.source,
      expectedStatuses: STATUS_SOURCES[params.source],
      details: params.details || null,
    })
    return
  }
  recordTaskTransitionDenied({
    taskId: params.taskId,
    source: params.source,
    expectedStatuses: STATUS_SOURCES[params.source],
    currentStatus: current.status,
    reason: 'status_mismatch',
  })
  serviceLogger.warn({
    action: 'task.transition.denied',
    message: 'task transition denied by status guard',
    taskId: params.taskId,
    source: params.source,
    expectedStatuses: STATUS_SOURCES[params.source],
    currentStatus: current.status,
    details: params.details || null,
  })
}

export async function isTaskActive(taskId: string) {
  const task = await withPrismaRetry(() =>
    taskModel.findUnique({
      where: { id: taskId },
      select: { status: true },
    })
  )
  if (!task) return false
  return isActiveStatus(task.status)
}

export async function tryMarkTaskProcessing(taskId: string, externalId?: string | null) {
  const result = await taskModel.updateMany({
    where: taskWhereBySources(taskId, STATUS_SOURCES.processing),
    data: {
      status: TASK_STATUS.PROCESSING,
      startedAt: new Date(),
      heartbeatAt: new Date(),
      externalId: externalId || null,
      attempt: { increment: 1 },
    },
  })
  if (result.count <= 0) {
    await logStatusTransitionDenied({
      taskId,
      source: 'processing',
      details: { operation: 'tryMarkTaskProcessing' },
    })
  }
  return result.count > 0
}

export async function trySetTaskExternalId(taskId: string, externalId: string) {
  const value = typeof externalId === 'string' ? externalId.trim() : ''
  if (!value) return false
  const result = await taskModel.updateMany({
    where: {
      ...taskWhereBySources(taskId, STATUS_SOURCES.externalId),
      OR: [
        { externalId: null },
        { externalId: '' },
      ],
    },
    data: {
      externalId: value,
    },
  })
  if (result.count <= 0) {
    await logStatusTransitionDenied({
      taskId,
      source: 'externalId',
      details: { operation: 'trySetTaskExternalId' },
    })
  }
  return result.count > 0
}

export async function touchTaskHeartbeat(taskId: string) {
  const result = await taskModel.updateMany({
    where: taskWhereBySources(taskId, STATUS_SOURCES.heartbeat),
    data: { heartbeatAt: new Date() },
  })
  if (result.count <= 0) {
    await logStatusTransitionDenied({
      taskId,
      source: 'heartbeat',
      details: { operation: 'touchTaskHeartbeat' },
    })
  }
  return result.count > 0
}

export async function tryUpdateTaskProgress(taskId: string, progress: number, payload?: Record<string, unknown> | null) {
  const result = await taskModel.updateMany({
    where: taskWhereBySources(taskId, STATUS_SOURCES.progress),
    data: {
      progress,
      ...(payload ? { payload: toNullableJson(payload) } : {}),
    },
  })
  if (result.count <= 0) {
    await logStatusTransitionDenied({
      taskId,
      source: 'progress',
      details: { operation: 'tryUpdateTaskProgress' },
    })
  }
  return result.count > 0
}

export async function tryMarkTaskCompleted(taskId: string, resultPayload?: Record<string, unknown> | null) {
  const result = await taskModel.updateMany({
    where: taskWhereBySources(taskId, STATUS_SOURCES.completed),
    data: {
      status: TASK_STATUS.COMPLETED,
      progress: 100,
      result: toNullableJson(resultPayload ?? null),
      finishedAt: new Date(),
      heartbeatAt: null,
    },
  })
  if (result.count <= 0) {
    await logStatusTransitionDenied({
      taskId,
      source: 'completed',
      details: { operation: 'tryMarkTaskCompleted' },
    })
  }
  return result.count > 0
}

export async function tryMarkTaskFailed(taskId: string, errorCode: string, errorMessage: string) {
  const result = await taskModel.updateMany({
    where: taskWhereBySources(taskId, STATUS_SOURCES.failed),
    data: {
      status: TASK_STATUS.FAILED,
      errorCode: errorCode.slice(0, 80),
      errorMessage: errorMessage.slice(0, 2000),
      finishedAt: new Date(),
      heartbeatAt: null,
    },
  })
  if (result.count <= 0) {
    await logStatusTransitionDenied({
      taskId,
      source: 'failed',
      details: { operation: 'tryMarkTaskFailed' },
    })
  }
  return result.count > 0
}

export async function markTaskProcessing(taskId: string, externalId?: string | null) {
  return await tryMarkTaskProcessing(taskId, externalId)
}

export async function updateTaskProgress(taskId: string, progress: number, payload?: Record<string, unknown> | null) {
  return await tryUpdateTaskProgress(taskId, progress, payload)
}

export async function markTaskCompleted(taskId: string, result?: Record<string, unknown> | null) {
  return await tryMarkTaskCompleted(taskId, result)
}

export async function markTaskFailed(taskId: string, errorCode: string, errorMessage: string) {
  return await tryMarkTaskFailed(taskId, errorCode, errorMessage)
}

export async function cancelTask(taskId: string, reason = 'Task cancelled by user') {
  const snapshot = await taskModel.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      billingInfo: true,
    },
  })
  if (!snapshot) {
    return {
      task: null,
      cancelled: false,
    }
  }

  const active = isActiveStatus(snapshot.status)
  const rollbackResult = active
    ? await rollbackTaskBillingForTask({
      taskId: taskId,
      billingInfo: snapshot.billingInfo,
    })
    : {
      attempted: false,
      rolledBack: true,
      billingInfo: parseTaskBillingInfo(snapshot.billingInfo),
    }

  const failure = resolveCompensationFailure(rollbackResult, 'TASK_CANCELLED', reason)
  const cancelled = await tryMarkTaskFailed(taskId, failure.errorCode, failure.errorMessage)
  const task = await taskModel.findUnique({ where: { id: taskId } })
  return {
    task,
    cancelled,
  }
}

export async function sweepStaleTasks(params: {
  processingThresholdMs: number
  limit?: number
}) {
  const limit = Math.max(1, params.limit || 200)
  const processingBefore = new Date(Date.now() - Math.max(1, params.processingThresholdMs))

  const staleProcessing = await taskModel.findMany({
    where: {
      status: TASK_STATUS.PROCESSING,
      OR: [
        { heartbeatAt: { lt: processingBefore } },
        {
          heartbeatAt: null,
          startedAt: { lt: processingBefore },
        },
        {
          heartbeatAt: null,
          startedAt: null,
          updatedAt: { lt: processingBefore },
        },
      ],
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    select: {
      id: true,
      userId: true,
      projectId: true,
      episodeId: true,
      type: true,
      targetType: true,
      targetId: true,
      billingInfo: true,
    },
  })

  if (staleProcessing.length === 0) return []

  const finishedAt = new Date()
  const timedOut: Array<typeof staleProcessing[number] & {
    errorCode: string
    errorMessage: string
  }> = []
  for (const task of staleProcessing) {
    const rollbackResult = await rollbackTaskBillingForTask({
      taskId: task.id,
      billingInfo: task.billingInfo,
    })
    const failure = resolveCompensationFailure(
      rollbackResult,
      'WATCHDOG_TIMEOUT',
      'Task heartbeat timeout',
    )

    const updated = await taskModel.updateMany({
      where: {
        id: task.id,
        status: TASK_STATUS.PROCESSING,
      },
      data: {
        status: TASK_STATUS.FAILED,
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
        finishedAt,
        heartbeatAt: null,
      },
    })
    if (updated.count > 0) {
      timedOut.push({
        ...task,
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
      })
    }
  }

  return timedOut
}

export async function dismissFailedTasks(taskIds: string[], userId: string) {
  const dismissedTasks = await dismissFailedTasksWithDetails(taskIds, userId)
  return dismissedTasks.length
}

export async function dismissFailedTasksWithDetails(taskIds: string[], userId: string) {
  if (taskIds.length === 0) return []
  const uniqueTaskIds = Array.from(new Set(taskIds.filter((id) => typeof id === 'string' && id.trim())))
  if (uniqueTaskIds.length === 0) return []

  const candidates = await taskModel.findMany({
    where: {
      id: { in: uniqueTaskIds },
      userId,
      status: TASK_STATUS.FAILED,
    },
    select: {
      id: true,
      userId: true,
      projectId: true,
      type: true,
      targetType: true,
      targetId: true,
      episodeId: true,
      payload: true,
    },
  })
  if (candidates.length === 0) return []

  const dismissibleIds = candidates.map((task) => task.id)
  const result = await taskModel.updateMany({
    where: {
      id: { in: dismissibleIds },
      userId,
      status: TASK_STATUS.FAILED,
    },
    data: {
      status: TASK_STATUS.DISMISSED,
      finishedAt: new Date(),
      heartbeatAt: null,
    },
  })
  if (result.count <= 0) return []

  return await taskModel.findMany({
    where: {
      id: { in: dismissibleIds },
      userId,
      status: TASK_STATUS.DISMISSED,
    },
    select: {
      id: true,
      userId: true,
      projectId: true,
      type: true,
      targetType: true,
      targetId: true,
      episodeId: true,
      payload: true,
    },
  })
}
