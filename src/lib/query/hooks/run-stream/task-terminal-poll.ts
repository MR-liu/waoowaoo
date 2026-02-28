import { resolveTaskErrorMessage } from '@/lib/task/error-message'
import { TASK_STATUS } from '@/lib/task/types'
import { logWarn as _ulogWarn } from '@/lib/logging/core'
import type { RunStreamEvent } from '@/lib/novel-promotion/run-stream/types'
import { readTextField, toObject, toTerminalRunResult } from './event-parser'
import { readResponseJsonSafely } from './response-json'
import type { RunResult } from './types'

type PollTaskTerminalStateArgs = {
  taskId: string
  applyAndCapture: (event: RunStreamEvent) => void
}

export async function pollTaskTerminalState({ taskId, applyAndCapture }: PollTaskTerminalStateArgs): Promise<RunResult | null> {
  try {
    const taskSnapshotUrl = `/api/tasks/${taskId}`
    const snapshotResponse = await fetch(taskSnapshotUrl, {
      method: 'GET',
      cache: 'no-store',
    })
    if (!snapshotResponse.ok) {
      const errorBody = await readResponseJsonSafely({
        response: snapshotResponse,
        context: 'task terminal poll error payload',
        requestUrl: taskSnapshotUrl,
      })
      const payload = toObject(errorBody.payload)
      const fallbackMessage = resolveTaskErrorMessage(
        payload,
        `task status request failed: HTTP ${snapshotResponse.status}`,
      )
      const message = errorBody.parseError ? `${fallbackMessage}; ${errorBody.parseError}` : fallbackMessage
      const terminalEvent: RunStreamEvent = {
        runId: taskId,
        event: 'run.error',
        ts: new Date().toISOString(),
        status: 'failed',
        message,
        payload: {
          ...payload,
          httpStatus: snapshotResponse.status,
          ...(errorBody.parseError ? { parseError: errorBody.parseError } : {}),
        },
      }
      applyAndCapture(terminalEvent)
      return toTerminalRunResult(terminalEvent) || {
        runId: taskId,
        status: 'failed',
        summary: null,
        payload: terminalEvent.payload || null,
        errorMessage: message,
      }
    }
    const snapshotBody = await readResponseJsonSafely({
      response: snapshotResponse,
      context: 'task terminal poll snapshot payload',
      requestUrl: taskSnapshotUrl,
    })
    if (snapshotBody.parseError) {
      const terminalEvent: RunStreamEvent = {
        runId: taskId,
        event: 'run.error',
        ts: new Date().toISOString(),
        status: 'failed',
        message: snapshotBody.parseError,
        payload: {
          httpStatus: snapshotResponse.status,
          parseError: snapshotBody.parseError,
        },
      }
      applyAndCapture(terminalEvent)
      return toTerminalRunResult(terminalEvent) || {
        runId: taskId,
        status: 'failed',
        summary: null,
        payload: terminalEvent.payload || null,
        errorMessage: snapshotBody.parseError,
      }
    }
    const snapshotData = toObject(snapshotBody.payload)
    const task = toObject(snapshotData.task)
    const taskStatus = readTextField(task, 'status')
    if (taskStatus === TASK_STATUS.COMPLETED) {
      const payload = toObject(task.result)
      const terminalEvent: RunStreamEvent = {
        runId: taskId,
        event: 'run.complete',
        ts: new Date().toISOString(),
        status: 'completed',
        payload,
      }
      applyAndCapture(terminalEvent)
      return toTerminalRunResult(terminalEvent) || {
        runId: taskId,
        status: 'completed',
        summary: payload,
        payload,
        errorMessage: '',
      }
    }
    if (taskStatus === TASK_STATUS.FAILED) {
      const message = resolveTaskErrorMessage(task, 'run failed')
      const terminalEvent: RunStreamEvent = {
        runId: taskId,
        event: 'run.error',
        ts: new Date().toISOString(),
        status: 'failed',
        message,
        payload: task,
      }
      applyAndCapture(terminalEvent)
      return toTerminalRunResult(terminalEvent) || {
        runId: taskId,
        status: 'failed',
        summary: null,
        payload: task,
        errorMessage: message,
      }
    }
  } catch (error) {
    _ulogWarn('[RunStream] task terminal polling failed', {
      taskId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
  return null
}
