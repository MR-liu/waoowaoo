import { createScopedLogger } from '@/lib/logging/core'
import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, ApiError, getRequestId } from '@/lib/api-errors'
import { getProjectChannel, listEventsAfter, normalizeTaskLifecyclePayload } from '@/lib/task/publisher'
import { isErrorResponse, requireProjectAuthLight, requireUserAuth } from '@/lib/api-auth'
import { TASK_EVENT_TYPE, TASK_SSE_EVENT_TYPE, type SSEEvent } from '@/lib/task/types'
import { getSharedSubscriber } from '@/lib/sse/shared-subscriber'
import { prisma } from '@/lib/prisma'
import {
  recordTaskSSEConnection,
  recordTaskSSEConnectionDuration,
  recordTaskSSEPayloadParseFailed,
  recordTaskSSEReplayEvents,
} from '@/lib/task/metrics'

function parseReplayCursorId(value: string | null): number {
  if (!value) return 0
  const trimmed = value.trim()
  if (!trimmed || !/^\d+$/.test(trimmed)) return 0
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function parseEpisodeFilter(value: string | null): string | null {
  if (!value) return null
  const normalized = value.trim()
  return normalized || null
}

function parseNumericEventId(value: string | null | undefined): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || !/^\d+$/.test(trimmed)) return null
  const parsed = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

const SEMANTIC_DEDUPE_WINDOW_MS = 5_000
const SEMANTIC_DEDUPE_CACHE_SIZE = 8_000

function readEventString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function readEventNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function parseEventTsMs(value: string): number | null {
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return null
  return ms
}

function buildSemanticDedupeKey(event: SSEEvent): string | null {
  const payload = asObject(event.payload)
  if (!payload) return null

  if (event.type === TASK_SSE_EVENT_TYPE.STREAM) {
    const stream = asObject(payload.stream)
    if (!stream) return null
    const seq = readEventNumber(stream.seq)
    if (seq === null) return null
    const runId = readEventString(payload.streamRunId) || '__run'
    const stepId = readEventString(payload.stepId) || '__step'
    const lane = readEventString(stream.lane) || '__lane'
    const kind = readEventString(stream.kind) || '__kind'
    return `stream|${event.taskId}|${runId}|${stepId}|${lane}|${kind}|${String(seq)}`
  }

  const lifecycleType = readEventString(payload.lifecycleType)
  if (!lifecycleType) return null
  const stage = readEventString(payload.stage) || '__stage'
  const stepId = readEventString(payload.stepId) || '__step'
  const progress = readEventNumber(payload.progress)
  const flowStageIndex = readEventNumber(payload.flowStageIndex)
  const flowStageTotal = readEventNumber(payload.flowStageTotal)
  return [
    'lifecycle',
    event.taskId,
    lifecycleType,
    stage,
    stepId,
    progress === null ? '__progress' : String(progress),
    flowStageIndex === null ? '__stageIndex' : String(flowStageIndex),
    flowStageTotal === null ? '__stageTotal' : String(flowStageTotal),
  ].join('|')
}

function pruneSemanticDedupeCache(cache: Map<string, number>, nowMs: number) {
  if (cache.size <= SEMANTIC_DEDUPE_CACHE_SIZE) return
  const staleThreshold = nowMs - SEMANTIC_DEDUPE_WINDOW_MS * 2
  for (const [cacheKey, tsMs] of cache.entries()) {
    if (tsMs < staleThreshold) {
      cache.delete(cacheKey)
    }
  }
  if (cache.size <= SEMANTIC_DEDUPE_CACHE_SIZE) return
  const overflow = cache.size - SEMANTIC_DEDUPE_CACHE_SIZE
  let removed = 0
  for (const cacheKey of cache.keys()) {
    cache.delete(cacheKey)
    removed += 1
    if (removed >= overflow) break
  }
}

function shouldDedupeBySemanticKey(cache: Map<string, number>, event: SSEEvent): boolean {
  const semanticKey = buildSemanticDedupeKey(event)
  if (!semanticKey) return false
  const eventTsMs = parseEventTsMs(event.ts) ?? Date.now()
  const previousTsMs = cache.get(semanticKey)
  cache.set(semanticKey, eventTsMs)
  pruneSemanticDedupeCache(cache, eventTsMs)
  if (previousTsMs === undefined) return false
  return Math.abs(eventTsMs - previousTsMs) <= SEMANTIC_DEDUPE_WINDOW_MS
}

function shouldForwardEvent(
  event: SSEEvent,
  context: {
    projectId: string
    userId: string
    episodeId: string | null
  },
) {
  if (event.projectId !== context.projectId) return false
  if (event.userId !== context.userId) return false
  if (context.episodeId && event.episodeId !== context.episodeId) return false
  return true
}

function formatSSE(event: SSEEvent) {
  const dataLine = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
  if (typeof event.id === 'string' && /^\d+$/.test(event.id)) {
    return `id: ${event.id}\n${dataLine}`
  }
  return dataLine
}

function formatHeartbeat() {
  return `event: heartbeat\ndata: {"ts":"${new Date().toISOString()}"}\n\n`
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

async function listActiveLifecycleSnapshot(params: {
  projectId: string
  episodeId: string | null
  userId: string
  limit?: number
}) {
  const limit = params.limit || 500
  const rows = await prisma.task.findMany({
    where: {
      projectId: params.projectId,
      userId: params.userId,
      status: {
        in: ['queued', 'processing']},
      ...(params.episodeId ? { episodeId: params.episodeId } : {})},
    orderBy: {
      updatedAt: 'desc'},
    take: limit,
    select: {
      id: true,
      type: true,
      targetType: true,
      targetId: true,
      episodeId: true,
      userId: true,
      status: true,
      progress: true,
      payload: true,
      updatedAt: true}})

  return rows.map((row): SSEEvent => {
    const payload = asObject(row.payload)
    const lifecycleType = row.status === 'queued'
      ? TASK_EVENT_TYPE.CREATED
      : TASK_EVENT_TYPE.PROCESSING
    const eventPayload = normalizeTaskLifecyclePayload(
      lifecycleType,
      row.type,
      {
        ...(payload || {}),
        progress: typeof row.progress === 'number' ? row.progress : null,
      },
    )

    return {
      id: `snapshot:${row.id}:${row.updatedAt.getTime()}`,
      type: TASK_SSE_EVENT_TYPE.LIFECYCLE,
      taskId: row.id,
      projectId: params.projectId,
      userId: row.userId,
      ts: row.updatedAt.toISOString(),
      taskType: row.type,
      targetType: row.targetType,
      targetId: row.targetId,
      episodeId: row.episodeId,
      payload: eventPayload}
  })
}

export const GET = apiHandler(async (request: NextRequest) => {
  const projectId = request.nextUrl.searchParams.get('projectId')
  const episodeId = parseEpisodeFilter(request.nextUrl.searchParams.get('episodeId'))
  if (!projectId) {
    throw new ApiError('INVALID_PARAMS')
  }

  const authResult = projectId === 'global-asset-hub'
    ? await requireUserAuth()
    : await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const channel = getProjectChannel(projectId)
  const sharedSubscriber = getSharedSubscriber()
  const requestId = getRequestId(request)
  const encoder = new TextEncoder()
  const lastEventId = parseReplayCursorId(request.headers.get('last-event-id'))
  const signal = request.signal
  let closeStream: (() => Promise<void>) | null = null

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      let timer: ReturnType<typeof setInterval> | null = null
      let unsubscribe: (() => Promise<void>) | null = null
      const connectedAt = Date.now()
      const logger = createScopedLogger({
        module: 'sse',
        action: 'sse.stream',
        requestId: requestId || undefined,
        projectId,
        userId: session.user.id})
      logger.info({
        action: 'sse.connect',
        message: 'sse connection established',
        details: {
          lastEventId: lastEventId || 0}})
      recordTaskSSEConnection({
        requestId: requestId || null,
        projectId,
        userId: session.user.id,
        event: 'connect',
        episodeId,
        lastEventId,
      })

      const safeEnqueue = (chunk: string) => {
        if (closed) return
        controller.enqueue(encoder.encode(chunk))
      }

      const context = {
        projectId,
        userId: session.user.id,
        episodeId,
      }
      const deliveredEventIds = new Set<string>()
      const deliveredSemanticKeys = new Map<string, number>()
      const pendingLiveEvents: Array<{ event: SSEEvent; index: number }> = []
      let pendingIndex = 0
      let bufferingLiveEvents = true

      const deliverEvent = (event: SSEEvent) => {
        if (!shouldForwardEvent(event, context)) return
        const eventId = typeof event.id === 'string' ? event.id.trim() : ''
        if (eventId) {
          if (deliveredEventIds.has(eventId)) return
          deliveredEventIds.add(eventId)
        }
        if (shouldDedupeBySemanticKey(deliveredSemanticKeys, event)) return
        safeEnqueue(formatSSE(event))
      }

      const flushPendingLiveEvents = () => {
        if (pendingLiveEvents.length === 0) return
        pendingLiveEvents
          .sort((a, b) => {
            const aId = parseNumericEventId(a.event.id)
            const bId = parseNumericEventId(b.event.id)
            if (aId !== null && bId !== null) {
              if (aId !== bId) return aId - bId
              return a.index - b.index
            }
            if (aId !== null) return -1
            if (bId !== null) return 1
            return a.index - b.index
          })
          .forEach((item) => {
            deliverEvent(item.event)
          })
        pendingLiveEvents.length = 0
      }

      const close = async () => {
        if (closed) return
        closed = true
        try {
          await unsubscribe?.()
        } catch (error) {
          logger.warn({
            action: 'sse.unsubscribe.failed',
            message: 'failed to unsubscribe shared listener',
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
        }
        logger.info({
          action: 'sse.disconnect',
          message: 'sse connection closed'})
        recordTaskSSEConnection({
          requestId: requestId || null,
          projectId,
          userId: session.user.id,
          event: 'disconnect',
          episodeId,
          lastEventId,
        })
        recordTaskSSEConnectionDuration({
          requestId: requestId || null,
          projectId,
          userId: session.user.id,
          durationMs: Date.now() - connectedAt,
          episodeId,
        })
        if (timer) {
          clearInterval(timer)
          timer = null
        }
        try {
          controller.close()
        } catch (error) {
          logger.warn({
            action: 'sse.controller.close_failed',
            message: 'failed to close sse controller',
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
        }
      }
      closeStream = close

      signal.addEventListener('abort', () => {
        void close()
      })

      unsubscribe = await sharedSubscriber.addChannelListener(channel, (message) => {
        try {
          const event = JSON.parse(message) as SSEEvent
          if (!shouldForwardEvent(event, context)) return
          if (bufferingLiveEvents) {
            pendingLiveEvents.push({
              event,
              index: pendingIndex++,
            })
            return
          }
          deliverEvent(event)
        } catch (error) {
          recordTaskSSEPayloadParseFailed({
            requestId: requestId || null,
            projectId,
            userId: session.user.id,
          })
          logger.warn({
            action: 'sse.message.parse_failed',
            message: 'failed to parse sse payload from redis pubsub',
            details: {
              preview: message.slice(0, 120),
            },
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
        }
      })

      if (lastEventId > 0) {
        const missed = await listEventsAfter(projectId, lastEventId, 5000, {
          userId: session.user.id,
        })
        const replayEvents = missed.filter((event) => shouldForwardEvent(event, context))
        logger.info({
          action: 'sse.replay',
          message: 'sse replay sent',
          details: {
            fromEventId: lastEventId,
            scanned: missed.length,
            delivered: replayEvents.length}})
        recordTaskSSEReplayEvents({
          requestId: requestId || null,
          projectId,
          userId: session.user.id,
          source: 'replay',
          delivered: replayEvents.length,
        })
        for (const event of replayEvents) {
          deliverEvent(event)
        }
      } else {
        const snapshotEvents = await listActiveLifecycleSnapshot({
          projectId,
          episodeId,
          userId: session.user.id,
          limit: 500})
        logger.info({
          action: 'sse.active_snapshot',
          message: 'sse active snapshot sent',
          details: {
            count: snapshotEvents.length}})
        recordTaskSSEReplayEvents({
          requestId: requestId || null,
          projectId,
          userId: session.user.id,
          source: 'snapshot',
          delivered: snapshotEvents.length,
        })
        for (const event of snapshotEvents) {
          deliverEvent(event)
        }
      }

      bufferingLiveEvents = false
      flushPendingLiveEvents()
      timer = setInterval(() => safeEnqueue(formatHeartbeat()), 15_000)
    },
    cancel() {
      void closeStream?.()
    }})

  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'}})
})
