import type { Worker } from 'bullmq'
import { createImageWorker } from './image.worker'
import { createVideoWorker } from './video.worker'
import { createVoiceWorker } from './voice.worker'
import { createTextWorker } from './text.worker'
import type { TaskJobData } from '@/lib/task/types'

export const WORKER_LANE = {
  IMAGE: 'image',
  VIDEO: 'video',
  VOICE: 'voice',
  TEXT: 'text',
} as const

export type WorkerLane = (typeof WORKER_LANE)[keyof typeof WORKER_LANE]

const ALL_WORKER_LANES: readonly WorkerLane[] = [
  WORKER_LANE.IMAGE,
  WORKER_LANE.VIDEO,
  WORKER_LANE.VOICE,
  WORKER_LANE.TEXT,
] as const

const workerFactories: Record<WorkerLane, () => Worker<TaskJobData>> = {
  [WORKER_LANE.IMAGE]: createImageWorker,
  [WORKER_LANE.VIDEO]: createVideoWorker,
  [WORKER_LANE.VOICE]: createVoiceWorker,
  [WORKER_LANE.TEXT]: createTextWorker,
}

export function parseWorkerLanes(raw: string | null | undefined): WorkerLane[] {
  if (!raw || !raw.trim()) {
    return [...ALL_WORKER_LANES]
  }
  const normalized = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  if (normalized.length === 0) {
    return [...ALL_WORKER_LANES]
  }

  const unique = new Set<WorkerLane>()
  for (const lane of normalized) {
    if (!ALL_WORKER_LANES.includes(lane as WorkerLane)) {
      throw new Error(`WORKER_QUEUES_INVALID: unsupported lane "${lane}"`)
    }
    unique.add(lane as WorkerLane)
  }

  if (unique.size === 0) {
    throw new Error('WORKER_QUEUES_EMPTY: at least one worker lane is required')
  }
  return Array.from(unique)
}

export function createWorkersByLanes(lanes: readonly WorkerLane[]): Array<Worker<TaskJobData>> {
  if (lanes.length === 0) {
    throw new Error('WORKER_LANES_EMPTY: at least one worker lane is required')
  }
  return lanes.map((lane) => workerFactories[lane]())
}
