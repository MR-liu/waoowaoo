import { resolveTaskErrorMessage } from './error-message'

type TaskStatus = 'queued' | 'processing' | 'completed' | 'failed'

type TaskSnapshot = {
  id: string
  status: TaskStatus
  progress?: number | null
  result?: Record<string, unknown> | null
  errorMessage?: string | null
}

type TaskSnapshotResponse = {
  success: boolean
  task?: TaskSnapshot | null
}

type WaitTaskOptions = {
  intervalMs?: number
  timeoutMs?: number
  onTaskUpdate?: (task: TaskSnapshot) => void
}

type ReadResponseJsonResult = {
  payload: unknown | null
  parseError: string | null
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

async function readResponseJsonSafely(response: Response, context: string): Promise<ReadResponseJsonResult> {
  try {
    const payload = await response.clone().json()
    return { payload, parseError: null }
  } catch (error) {
    return {
      payload: null,
      parseError: `${context}: invalid JSON response (${toErrorMessage(error)})`,
    }
  }
}

export function isAsyncTaskResponse(data: unknown): data is { async: true; taskId: string } {
  if (!data || typeof data !== 'object') return false
  const payload = data as Record<string, unknown>
  return payload.async === true && typeof payload.taskId === 'string' && payload.taskId.length > 0
}

export async function waitForTaskResult(taskId: string, options: WaitTaskOptions = {}) {
  const intervalMs = options.intervalMs ?? 1500
  const timeoutMs = options.timeoutMs ?? 0
  const onTaskUpdate = options.onTaskUpdate
  const startedAt = Date.now()

  while (true) {
    if (timeoutMs > 0 && Date.now() - startedAt > timeoutMs) {
      throw new Error(`Task timeout: ${taskId}`)
    }

    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'GET',
      cache: 'no-store',
    })
    const snapshotBody = await readResponseJsonSafely(response, `task snapshot ${taskId}`)
    if (!response.ok) {
      const errorPayload = snapshotBody.payload
      if (snapshotBody.parseError) {
        throw new Error(`Task fetch failed: ${taskId}; ${snapshotBody.parseError}`)
      }
      throw new Error(resolveTaskErrorMessage(errorPayload, `Task fetch failed: ${taskId}`))
    }
    if (snapshotBody.parseError) {
      throw new Error(snapshotBody.parseError)
    }
    const payload = (snapshotBody.payload || {}) as TaskSnapshotResponse
    const task = payload.task
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    onTaskUpdate?.(task)

    if (task.status === 'completed') {
      return task.result || { success: true }
    }
    if (task.status === 'failed') {
      throw new Error(resolveTaskErrorMessage(task, `Task ${task.status}`))
    }
    if (task.status !== 'queued' && task.status !== 'processing') {
      throw new Error(resolveTaskErrorMessage(task, `Task ${task.status}`))
    }

    await sleep(intervalMs)
  }
}

export async function resolveTaskResponse<T = Record<string, unknown>>(response: Response, options?: WaitTaskOptions) {
  const responseBody = await readResponseJsonSafely(response, 'resolve task response')
  if (responseBody.parseError) {
    throw new Error(responseBody.parseError)
  }
  const data = responseBody.payload
  if (!response.ok) {
    throw new Error(resolveTaskErrorMessage(data, 'Request failed'))
  }
  if (isAsyncTaskResponse(data)) {
    return await waitForTaskResult(data.taskId, options) as T
  }
  return (data || {}) as T
}
