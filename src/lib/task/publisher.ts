import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { createScopedLogger } from '@/lib/logging/core'
import {
  TASK_STATUS,
  TASK_EVENT_TYPE,
  TASK_SSE_EVENT_TYPE,
  type TaskEventType,
  type TaskLifecycleEventType,
  type TaskStatus,
  type SSEEvent,
} from './types'
import { coerceTaskIntent, resolveTaskIntent } from './intent'
import { getTaskFlowMeta } from '@/lib/llm-observe/stage-pipeline'
import { recordTaskTerminalStateMismatch } from './metrics'

const CHANNEL_PREFIX = 'task-events:project:'
const STREAM_EPHEMERAL_ENABLED = process.env.LLM_STREAM_EPHEMERAL_ENABLED !== 'false'
const publisherLogger = createScopedLogger({ module: 'task.publisher' })
const TERMINAL_TASK_STATUS_TO_LIFECYCLE: Record<
  Extract<TaskStatus, 'completed' | 'failed' | 'dismissed'>,
  TaskLifecycleEventType
> = {
  [TASK_STATUS.COMPLETED]: TASK_EVENT_TYPE.COMPLETED,
  [TASK_STATUS.FAILED]: TASK_EVENT_TYPE.FAILED,
  [TASK_STATUS.DISMISSED]: TASK_EVENT_TYPE.DISMISSED,
}

type TaskEventRow = {
  id: number
  taskId: string
  projectId: string
  userId: string
  eventType: string
  payload: Record<string, unknown> | null
  createdAt: Date
}

type TaskMeta = {
  id: string
  type: string
  targetType: string
  targetId: string
  episodeId: string | null
}

type TaskTerminalRow = {
  id: string
  projectId: string
  userId: string
  type: string
  targetType: string
  targetId: string
  episodeId: string | null
  status: string
  payload: Record<string, unknown> | null
  errorCode: string | null
  errorMessage: string | null
  finishedAt: Date | null
  updatedAt: Date
}

type TaskEventModel = {
  create: (args: unknown) => Promise<TaskEventRow>
  findMany: (args: unknown) => Promise<TaskEventRow[]>
}

type TaskModel = {
  findMany: (args: unknown) => Promise<TaskMeta[]>
  findUnique: (args: unknown) => Promise<TaskTerminalRow | null>
}

const taskEventModel = (prisma as unknown as { taskEvent: TaskEventModel }).taskEvent
const taskModel = (prisma as unknown as { task: TaskModel }).task

function createEphemeralId() {
  return `ephemeral:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`
}

function isLifecycleEventType(value: string): value is TaskLifecycleEventType {
  return value === TASK_EVENT_TYPE.CREATED ||
    value === TASK_EVENT_TYPE.PROCESSING ||
    value === TASK_EVENT_TYPE.COMPLETED ||
    value === TASK_EVENT_TYPE.FAILED ||
    value === TASK_EVENT_TYPE.DISMISSED
}

function normalizeLifecycleType(type: TaskEventType): TaskLifecycleEventType {
  if (isLifecycleEventType(type)) return type
  return TASK_EVENT_TYPE.PROCESSING
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function readPositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }
  return null
}

function normalizeFlowFields(
  taskType: string | null | undefined,
  payload: Record<string, unknown>,
): Pick<Record<string, unknown>, 'flowId' | 'flowStageIndex' | 'flowStageTotal' | 'flowStageTitle'> {
  const flowMeta = getTaskFlowMeta(taskType)
  const flowId = readString(payload.flowId) || flowMeta.flowId
  const flowStageIndex = readPositiveInt(payload.flowStageIndex) || flowMeta.flowStageIndex
  const flowStageTotal = Math.max(
    flowStageIndex,
    readPositiveInt(payload.flowStageTotal) || flowMeta.flowStageTotal,
  )
  const flowStageTitle = readString(payload.flowStageTitle) || flowMeta.flowStageTitle
  return {
    flowId,
    flowStageIndex,
    flowStageTotal,
    flowStageTitle,
  }
}

function isStreamEventType(type: string) {
  return type === TASK_SSE_EVENT_TYPE.STREAM
}

function shouldReplayLifecycleRow(type: string) {
  return isLifecycleEventType(type)
}

function shouldReplayTaskRow(type: string) {
  return shouldReplayLifecycleRow(type) || isStreamEventType(type)
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function normalizeLifecyclePayload(
  type: TaskEventType,
  taskType: string | null | undefined,
  payload?: Record<string, unknown> | null,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(payload || {}) }
  const lifecycleType = normalizeLifecycleType(type)
  const payloadUi = next.ui && typeof next.ui === 'object' && !Array.isArray(next.ui)
    ? (next.ui as Record<string, unknown>)
    : null
  const flowFields = normalizeFlowFields(taskType, next)
  next.lifecycleType = lifecycleType
  next.intent = coerceTaskIntent(next.intent ?? payloadUi?.intent, taskType)
  next.flowId = flowFields.flowId
  next.flowStageIndex = flowFields.flowStageIndex
  next.flowStageTotal = flowFields.flowStageTotal
  if (typeof next.flowStageTitle !== 'string' || !next.flowStageTitle.trim()) {
    next.flowStageTitle = flowFields.flowStageTitle
  }

  return next
}

function buildLifecycleEvent(params: {
  id: string
  ts: string
  lifecycleType: TaskEventType
  taskId: string
  projectId: string
  userId: string
  taskType?: string | null
  targetType?: string | null
  targetId?: string | null
  episodeId?: string | null
  payload?: Record<string, unknown> | null
}): SSEEvent {
  return {
    id: params.id,
    type: TASK_SSE_EVENT_TYPE.LIFECYCLE,
    taskId: params.taskId,
    projectId: params.projectId,
    userId: params.userId,
    ts: params.ts,
    taskType: params.taskType || null,
    targetType: params.targetType || null,
    targetId: params.targetId || null,
    episodeId: params.episodeId || null,
    payload: normalizeLifecyclePayload(params.lifecycleType, params.taskType, params.payload || null),
  }
}

function normalizeStreamPayload(
  taskType: string | null | undefined,
  payload?: Record<string, unknown> | null,
): Record<string, unknown> {
  const next = {
    ...(payload || {}),
  }
  const flowFields = normalizeFlowFields(taskType, next)
  return {
    ...next,
    lifecycleType:
      typeof next.lifecycleType === 'string' && next.lifecycleType.trim()
        ? next.lifecycleType
        : TASK_EVENT_TYPE.PROCESSING,
    intent: resolveTaskIntent(taskType),
    flowId: flowFields.flowId,
    flowStageIndex: flowFields.flowStageIndex,
    flowStageTotal: flowFields.flowStageTotal,
    ...(typeof next.flowStageTitle === 'string' && next.flowStageTitle.trim()
      ? {}
      : { flowStageTitle: flowFields.flowStageTitle }),
  }
}

function buildStreamEvent(params: {
  id: string
  ts: string
  taskId: string
  projectId: string
  userId: string
  taskType?: string | null
  targetType?: string | null
  targetId?: string | null
  episodeId?: string | null
  payload?: Record<string, unknown> | null
}): SSEEvent {
  return {
    id: params.id,
    type: TASK_SSE_EVENT_TYPE.STREAM,
    taskId: params.taskId,
    projectId: params.projectId,
    userId: params.userId,
    ts: params.ts,
    taskType: params.taskType || null,
    targetType: params.targetType || null,
    targetId: params.targetId || null,
    episodeId: params.episodeId || null,
    payload: normalizeStreamPayload(params.taskType, params.payload || null),
  }
}

async function mapRowsToReplayEvents(rows: TaskEventRow[]): Promise<SSEEvent[]> {
  if (rows.length === 0) return []

  const taskIds = Array.from(new Set(rows.map((row) => row.taskId)))
  const tasks: TaskMeta[] = taskIds.length
    ? await taskModel.findMany({
        where: { id: { in: taskIds } },
        select: {
          id: true,
          type: true,
          targetType: true,
          targetId: true,
          episodeId: true,
        },
      })
    : []
  const taskMap = new Map<string, TaskMeta>(tasks.map((task) => [task.id, task]))

  return rows.map((row): SSEEvent => {
    const task = taskMap.get(row.taskId)
    if (isStreamEventType(row.eventType)) {
      return buildStreamEvent({
        id: String(row.id),
        ts: row.createdAt.toISOString(),
        taskId: row.taskId,
        projectId: row.projectId,
        userId: row.userId,
        taskType: task?.type || null,
        targetType: task?.targetType || null,
        targetId: task?.targetId || null,
        episodeId: task?.episodeId || null,
        payload: row.payload || null,
      })
    }
    const lifecycleType = row.eventType as TaskEventType
    return buildLifecycleEvent({
      id: String(row.id),
      ts: row.createdAt.toISOString(),
      lifecycleType,
      taskId: row.taskId,
      projectId: row.projectId,
      userId: row.userId,
      taskType: task?.type || null,
      targetType: task?.targetType || null,
      targetId: task?.targetId || null,
      episodeId: task?.episodeId || null,
      payload: row.payload || null,
    })
  })
}

function isTerminalTaskStatus(status: string): status is Extract<TaskStatus, 'completed' | 'failed' | 'dismissed'> {
  return status === TASK_STATUS.COMPLETED || status === TASK_STATUS.FAILED || status === TASK_STATUS.DISMISSED
}

function readTerminalLifecycleType(event: SSEEvent): TaskLifecycleEventType | null {
  if (event.type !== TASK_SSE_EVENT_TYPE.LIFECYCLE) return null
  const payload = toObject(event.payload)
  const lifecycleType = payload.lifecycleType
  if (typeof lifecycleType !== 'string') return null
  if (!isLifecycleEventType(lifecycleType)) return null
  if (
    lifecycleType !== TASK_EVENT_TYPE.COMPLETED
    && lifecycleType !== TASK_EVENT_TYPE.FAILED
    && lifecycleType !== TASK_EVENT_TYPE.DISMISSED
  ) {
    return null
  }
  return lifecycleType
}

function findReplayTerminalLifecycleType(events: SSEEvent[]): TaskLifecycleEventType | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const terminalType = readTerminalLifecycleType(events[index] as SSEEvent)
    if (terminalType) return terminalType
  }
  return null
}

function buildTerminalReconcileEvent(params: {
  task: TaskTerminalRow
  expectedLifecycleType: TaskLifecycleEventType
  replayTerminalLifecycleType: TaskLifecycleEventType | null
}): SSEEvent {
  const reconcileReason = params.replayTerminalLifecycleType
    ? 'terminal_event_mismatch'
    : 'terminal_event_missing'
  const tsDate = params.task.finishedAt || params.task.updatedAt
  const payload = {
    ...toObject(params.task.payload),
    source: 'db_reconcile',
    reconcileReason,
    reconcileErrorCode: 'TASK_TERMINAL_STATE_MISMATCH',
    expectedLifecycleType: params.expectedLifecycleType,
    replayTerminalLifecycleType: params.replayTerminalLifecycleType,
    dbStatus: params.task.status,
    stage: 'task_terminal_reconciled',
    stageLabel: '任务终态已通过数据库对账补齐',
    ...(params.task.errorCode ? { errorCode: params.task.errorCode } : {}),
    ...(params.task.errorMessage ? { message: params.task.errorMessage } : {}),
  } as Record<string, unknown>

  return buildLifecycleEvent({
    id: `reconcile:${params.task.id}:${tsDate.getTime()}:${params.expectedLifecycleType}`,
    ts: tsDate.toISOString(),
    lifecycleType: params.expectedLifecycleType,
    taskId: params.task.id,
    projectId: params.task.projectId,
    userId: params.task.userId,
    taskType: params.task.type,
    targetType: params.task.targetType,
    targetId: params.task.targetId,
    episodeId: params.task.episodeId,
    payload,
  })
}

function reconcileTerminalLifecycleEvents(task: TaskTerminalRow | null, events: SSEEvent[]): SSEEvent[] {
  if (!task) return events
  if (!isTerminalTaskStatus(task.status)) return events
  const expectedLifecycleType = TERMINAL_TASK_STATUS_TO_LIFECYCLE[task.status]
  const replayTerminalLifecycleType = findReplayTerminalLifecycleType(events)
  if (replayTerminalLifecycleType === expectedLifecycleType) {
    return events
  }

  recordTaskTerminalStateMismatch({
    taskId: task.id,
    projectId: task.projectId,
    dbStatus: task.status,
    expectedLifecycleType,
    replayTerminalLifecycleType,
  })

  publisherLogger.warn({
    action: 'task.replay.terminal_mismatch',
    message: 'task terminal lifecycle mismatch detected during replay',
    errorCode: 'TASK_TERMINAL_STATE_MISMATCH',
    taskId: task.id,
    projectId: task.projectId,
    userId: task.userId,
    dbStatus: task.status,
    expectedLifecycleType,
    replayTerminalLifecycleType,
  })

  const reconciledEvent = buildTerminalReconcileEvent({
    task,
    expectedLifecycleType,
    replayTerminalLifecycleType,
  })
  return [...events, reconciledEvent]
}

function toTaskTerminalRow(value: unknown): TaskTerminalRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const id = readString(row.id)
  const projectId = readString(row.projectId)
  const userId = readString(row.userId)
  const type = readString(row.type)
  const targetType = readString(row.targetType)
  const targetId = readString(row.targetId)
  const status = readString(row.status)
  const episodeIdRaw = row.episodeId
  const episodeId = typeof episodeIdRaw === 'string' ? episodeIdRaw : null
  const payloadRaw = row.payload
  const payload =
    payloadRaw && typeof payloadRaw === 'object' && !Array.isArray(payloadRaw)
      ? (payloadRaw as Record<string, unknown>)
      : null
  const errorCode = readString(row.errorCode)
  const errorMessage = readString(row.errorMessage)
  const finishedAtRaw = row.finishedAt
  const finishedAt = finishedAtRaw instanceof Date ? finishedAtRaw : null
  const updatedAtRaw = row.updatedAt
  const updatedAt = updatedAtRaw instanceof Date ? updatedAtRaw : null
  if (!id || !projectId || !userId || !type || !targetType || !targetId || !status || !updatedAt) {
    return null
  }
  return {
    id,
    projectId,
    userId,
    type,
    targetType,
    targetId,
    episodeId,
    status,
    payload,
    errorCode,
    errorMessage,
    finishedAt,
    updatedAt,
  }
}

async function listTaskTerminalRows(taskIds: string[]): Promise<TaskTerminalRow[]> {
  if (taskIds.length === 0) return []
  const rowsUnknown = await (taskModel.findMany({
    where: { id: { in: taskIds } },
    select: {
      id: true,
      projectId: true,
      userId: true,
      type: true,
      targetType: true,
      targetId: true,
      episodeId: true,
      status: true,
      payload: true,
      errorCode: true,
      errorMessage: true,
      finishedAt: true,
      updatedAt: true,
    },
  }) as Promise<unknown>)
  if (!Array.isArray(rowsUnknown)) return []
  const rows: TaskTerminalRow[] = []
  for (const row of rowsUnknown) {
    const normalized = toTaskTerminalRow(row)
    if (normalized) rows.push(normalized)
  }
  return rows
}

function reconcileTerminalLifecycleEventsForTasks(tasks: TaskTerminalRow[], events: SSEEvent[]): SSEEvent[] {
  if (tasks.length === 0 || events.length === 0) return events
  const byTaskId = new Map<string, SSEEvent[]>()
  for (const event of events) {
    const list = byTaskId.get(event.taskId)
    if (list) {
      list.push(event)
      continue
    }
    byTaskId.set(event.taskId, [event])
  }

  const appended: SSEEvent[] = []
  for (const task of tasks) {
    const taskEvents = byTaskId.get(task.id)
    if (!taskEvents || taskEvents.length === 0) continue
    const reconciled = reconcileTerminalLifecycleEvents(task, taskEvents)
    if (reconciled.length > taskEvents.length) {
      const reconcileEvent = reconciled[reconciled.length - 1]
      if (reconcileEvent) {
        appended.push(reconcileEvent)
      }
    }
  }
  if (appended.length === 0) return events
  return [...events, ...appended]
}

export async function listTaskLifecycleEvents(taskId: string, limit = 500) {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 5000) : 500
  const [latestRows, task] = await Promise.all([
    taskEventModel.findMany({
      where: { taskId },
      orderBy: { id: 'desc' },
      take: safeLimit,
    }),
    taskModel.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        userId: true,
        type: true,
        targetType: true,
        targetId: true,
        episodeId: true,
        status: true,
        payload: true,
        errorCode: true,
        errorMessage: true,
        finishedAt: true,
        updatedAt: true,
      },
    }),
  ])
  const rows = [...latestRows].reverse()
  const replayRows = rows.filter((row) => shouldReplayTaskRow(row.eventType))
  const replayEvents = await mapRowsToReplayEvents(replayRows)
  return reconcileTerminalLifecycleEvents(task, replayEvents)
}

export function getProjectChannel(projectId: string) {
  return `${CHANNEL_PREFIX}${projectId}`
}

export async function publishTaskLifecycleEvent(params: {
  taskId: string
  projectId: string
  userId: string
  lifecycleType: TaskEventType
  taskType?: string | null
  targetType?: string | null
  targetId?: string | null
  episodeId?: string | null
  payload?: Record<string, unknown> | null
  persist?: boolean
}) {
  const persist = params.persist !== false
  const normalizedType = normalizeLifecycleType(params.lifecycleType)
  const event = persist
    ? await taskEventModel.create({
        data: {
          taskId: params.taskId,
          projectId: params.projectId,
          userId: params.userId,
          eventType: normalizedType,
          payload: normalizeLifecyclePayload(params.lifecycleType, params.taskType, params.payload || null),
        },
      })
    : null
  const ts = (event?.createdAt || new Date()).toISOString()
  const id = event?.id ? String(event.id) : createEphemeralId()

  const message = buildLifecycleEvent({
    id,
    ts,
    lifecycleType: params.lifecycleType,
    taskId: params.taskId,
    projectId: params.projectId,
    userId: params.userId,
    taskType: params.taskType || null,
    targetType: params.targetType || null,
    targetId: params.targetId || null,
    episodeId: params.episodeId || null,
    payload: params.payload || null,
  })

  await redis.publish(getProjectChannel(params.projectId), JSON.stringify(message))
  return message
}

export async function publishTaskEvent(params: {
  taskId: string
  projectId: string
  userId: string
  type: TaskEventType
  taskType?: string | null
  targetType?: string | null
  targetId?: string | null
  episodeId?: string | null
  payload?: Record<string, unknown> | null
  persist?: boolean
}) {
  return await publishTaskLifecycleEvent({
    taskId: params.taskId,
    projectId: params.projectId,
    userId: params.userId,
    lifecycleType: params.type,
    taskType: params.taskType,
    targetType: params.targetType,
    targetId: params.targetId,
    episodeId: params.episodeId,
    payload: params.payload,
    persist: params.persist,
  })
}

export async function publishTaskStreamEvent(params: {
  taskId: string
  projectId: string
  userId: string
  taskType?: string | null
  targetType?: string | null
  targetId?: string | null
  episodeId?: string | null
  payload?: Record<string, unknown> | null
  persist?: boolean
}) {
  if (!STREAM_EPHEMERAL_ENABLED) return null

  const persist = params.persist === true
  const normalizedPayload = normalizeStreamPayload(params.taskType, params.payload || null)
  const event = persist
    ? await taskEventModel.create({
        data: {
          taskId: params.taskId,
          projectId: params.projectId,
          userId: params.userId,
          eventType: TASK_SSE_EVENT_TYPE.STREAM,
          payload: normalizedPayload,
        },
      })
    : null
  const ts = (event?.createdAt || new Date()).toISOString()
  const id = event?.id ? String(event.id) : createEphemeralId()

  const message = buildStreamEvent({
    id,
    ts,
    taskId: params.taskId,
    projectId: params.projectId,
    userId: params.userId,
    taskType: params.taskType || null,
    targetType: params.targetType || null,
    targetId: params.targetId || null,
    episodeId: params.episodeId || null,
    payload: normalizedPayload,
  })

  await redis.publish(getProjectChannel(params.projectId), JSON.stringify(message))
  return message
}

export async function listEventsAfter(
  projectId: string,
  afterId: number,
  limit = 200,
  options?: {
    userId?: string
  },
) {
  const pageSize = Math.max(limit * 2, 400)
  const maxScanRows = Math.max(limit * 50, 20_000)
  let cursor = afterId
  let scannedRows = 0
  const collected: TaskEventRow[] = []

  while (collected.length < limit && scannedRows < maxScanRows) {
    const rows = await taskEventModel.findMany({
      where: {
        projectId,
        ...(options?.userId ? { userId: options.userId } : {}),
        id: { gt: cursor },
      },
      orderBy: { id: 'asc' },
      take: pageSize,
    })

    if (rows.length === 0) break
    scannedRows += rows.length

    for (const row of rows) {
      if (!shouldReplayTaskRow(row.eventType)) continue
      collected.push(row)
      if (collected.length >= limit) break
    }

    cursor = rows[rows.length - 1]?.id || cursor
    if (rows.length < pageSize) break
  }

  const replayRows = collected.slice(0, limit)
  const replayEvents = await mapRowsToReplayEvents(replayRows)
  const taskIds = Array.from(new Set(replayRows.map((row) => row.taskId)))
  const tasks = await listTaskTerminalRows(taskIds)
  return reconcileTerminalLifecycleEventsForTasks(tasks, replayEvents)
}
