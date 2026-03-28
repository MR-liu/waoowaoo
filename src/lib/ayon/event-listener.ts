/**
 * AYON event listener – polls AYON's event endpoint and maps
 * publish / version events to NEXUS-X entity updates.
 */

import { createScopedLogger } from '@/lib/logging/core'
import { AyonClient, type AyonEvent, type AyonVersion } from './client'
import { syncVersionToNexus } from './bridge'

const logger = createScopedLogger({ module: 'ayon-event-listener' })

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EventListenerConfig {
  ayonProjectName: string
  nexusProjectId: string
  /** Poll interval in milliseconds (default: 30_000) */
  pollIntervalMs?: number
  /** Only process events with these topics */
  topics?: string[]
}

interface EventListenerState {
  running: boolean
  lastEventId: string | null
  processedCount: number
  errorCount: number
  lastPollAt: Date | null
}

export interface EventListenerHandle {
  stop: () => void
  getState: () => Readonly<EventListenerState>
}

type MappedAction =
  | { type: 'sync_version'; version: AyonVersion; nexusTaskId: string }
  | { type: 'unknown' }

const DEFAULT_POLL_INTERVAL_MS = 30_000
const PUBLISH_TOPICS = ['version.publish', 'entity.version.created', 'entity.version.status_changed']

// ---------------------------------------------------------------------------
// Event mapping
// ---------------------------------------------------------------------------

function mapEventToAction(event: AyonEvent): MappedAction {
  if (
    event.topic === 'version.publish' ||
    event.topic === 'entity.version.created'
  ) {
    const summary = event.summary as Record<string, unknown>
    const versionId = typeof summary.entityId === 'string' ? summary.entityId : null
    const productId = typeof summary.productId === 'string' ? summary.productId : null
    const author = typeof summary.author === 'string' ? summary.author : 'unknown'
    const status = typeof summary.status === 'string' ? summary.status : 'pending_review'
    const taskId = typeof summary.nexusTaskId === 'string' ? summary.nexusTaskId : null

    if (!versionId || !taskId) {
      return { type: 'unknown' }
    }

    const ayonVersion: AyonVersion = {
      id: versionId,
      version: typeof summary.version === 'number' ? summary.version : 0,
      productId: productId ?? '',
      author,
      status,
      createdAt: event.createdAt,
    }

    return { type: 'sync_version', version: ayonVersion, nexusTaskId: taskId }
  }

  return { type: 'unknown' }
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

async function processEvent(event: AyonEvent, state: EventListenerState): Promise<void> {
  const action = mapEventToAction(event)

  switch (action.type) {
    case 'sync_version': {
      logger.info({
        action: 'ayon.event.sync_version',
        message: `Syncing AYON version ${action.version.id} -> NEXUS-X task ${action.nexusTaskId}`,
      })
      await syncVersionToNexus(action.version, action.nexusTaskId)
      state.processedCount++
      break
    }
    case 'unknown': {
      logger.debug({
        action: 'ayon.event.skip',
        message: `Skipping unmapped event topic "${event.topic}" (id=${event.id})`,
      })
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------

export function startEventListener(config: EventListenerConfig): EventListenerHandle {
  const client = new AyonClient()
  const pollInterval = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const topics = config.topics ?? PUBLISH_TOPICS

  const state: EventListenerState = {
    running: true,
    lastEventId: null,
    processedCount: 0,
    errorCount: 0,
    lastPollAt: null,
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null

  async function poll(): Promise<void> {
    if (!state.running) return

    try {
      const events = await client.listEvents(config.ayonProjectName, {
        after: state.lastEventId ?? undefined,
        topics,
      })

      state.lastPollAt = new Date()

      for (const event of events) {
        try {
          await processEvent(event, state)
        } catch (error) {
          state.errorCount++
          logger.error({
            action: 'ayon.event.process_error',
            message: `Failed to process event ${event.id}`,
            error: error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : { message: String(error) },
          })
        }
        state.lastEventId = event.id
      }
    } catch (error) {
      state.errorCount++
      logger.error({
        action: 'ayon.event.poll_error',
        message: 'Failed to poll AYON events',
        error: error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : { message: String(error) },
      })
    }

    if (state.running) {
      timeoutId = setTimeout(() => void poll(), pollInterval)
    }
  }

  void poll()

  logger.info({
    action: 'ayon.event_listener.started',
    message: `Event listener started for AYON project "${config.ayonProjectName}", polling every ${pollInterval}ms`,
  })

  return {
    stop() {
      state.running = false
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      logger.info({
        action: 'ayon.event_listener.stopped',
        message: 'Event listener stopped',
      })
    },
    getState() {
      return { ...state }
    },
  }
}
