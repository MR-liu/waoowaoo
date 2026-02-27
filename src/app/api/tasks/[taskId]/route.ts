import { NextRequest } from 'next/server'
import { apiHandler, apiSuccess, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { removeTaskJob } from '@/lib/task/queues'
import { listTaskLifecycleEvents, publishTaskEvent } from '@/lib/task/publisher'
import { cancelTask, getTaskById } from '@/lib/task/service'
import { TASK_EVENT_TYPE } from '@/lib/task/types'
import { normalizeTaskError } from '@/lib/errors/normalize'

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export const GET = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> },
) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult
  const { taskId } = await context.params

  const task = await getTaskById(taskId)
  if (!task || task.userId !== session.user.id) {
    throw new ApiError('NOT_FOUND')
  }

  const includeEvents = request.nextUrl.searchParams.get('includeEvents') === '1'
  const eventsLimitRaw = Number.parseInt(request.nextUrl.searchParams.get('eventsLimit') || '500', 10)
  const eventsLimit = Number.isFinite(eventsLimitRaw) ? Math.min(Math.max(eventsLimitRaw, 1), 5000) : 500
  const events = includeEvents ? await listTaskLifecycleEvents(taskId, eventsLimit) : null

  return apiSuccess(request, {
    task: {
      ...task,
      error: normalizeTaskError(task.errorCode, task.errorMessage)},
    ...(events ? { events } : {}),
  }, { flattenData: true })
})

export const DELETE = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> },
) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult
  const { taskId } = await context.params

  const task = await getTaskById(taskId)
  if (!task || task.userId !== session.user.id) {
    throw new ApiError('NOT_FOUND')
  }

  const { task: updatedTask, cancelled } = await cancelTask(taskId)
  if (!updatedTask) {
    throw new ApiError('NOT_FOUND')
  }

  if (cancelled) {
    let queueCleanupFailed = false
    let queueCleanupError: string | null = null
    try {
      const removed = await removeTaskJob(taskId)
      queueCleanupFailed = removed !== true
      if (queueCleanupFailed) {
        queueCleanupError = 'queue job not found during cancellation cleanup'
      }
    } catch (error: unknown) {
      queueCleanupFailed = true
      queueCleanupError = error instanceof Error ? error.message : String(error)
    }

    await publishTaskEvent({
      taskId: updatedTask.id,
      projectId: updatedTask.projectId,
      userId: updatedTask.userId,
      type: TASK_EVENT_TYPE.FAILED,
      taskType: updatedTask.type,
      targetType: updatedTask.targetType,
      targetId: updatedTask.targetId,
      episodeId: updatedTask.episodeId || null,
      payload: {
        ...toObject(updatedTask.payload),
        stage: 'cancelled',
        stageLabel: '任务已取消',
        cancelled: true,
        message: updatedTask.errorMessage || 'Task cancelled by user',
        queueCleanupFailed,
        queueCleanupError,
      },
      persist: false})
  }

  return apiSuccess(request, {
    success: true,
    cancelled,
    task: {
      ...updatedTask,
      error: normalizeTaskError(updatedTask.errorCode, updatedTask.errorMessage)},
  }, { flattenData: true })
})
