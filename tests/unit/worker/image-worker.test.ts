import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TASK_TYPE, type TaskJobData } from '@/lib/task/types'

type WorkerProcessor = (job: Job<TaskJobData>) => Promise<unknown>

const workerState = vi.hoisted(() => ({
  processor: null as WorkerProcessor | null,
}))

const reportTaskProgressMock = vi.hoisted(() => vi.fn(async () => undefined))
const withTaskLifecycleMock = vi.hoisted(() =>
  vi.fn(async (job: Job<TaskJobData>, handler: WorkerProcessor) => await handler(job)),
)
const handlersMock = vi.hoisted(() => ({
  handleAssetHubImageTask: vi.fn(async () => ({ ok: true, route: 'asset-hub-image' })),
  handleAssetHubModifyTask: vi.fn(async () => ({ ok: true, route: 'asset-hub-modify' })),
  handleCharacterImageTask: vi.fn(async () => ({ ok: true, route: 'character' })),
  handleLocationImageTask: vi.fn(async () => ({ ok: true, route: 'location' })),
  handleModifyAssetImageTask: vi.fn(async () => ({ ok: true, route: 'modify-asset-image' })),
  handlePanelImageTask: vi.fn(async () => ({ ok: true, route: 'panel' })),
  handlePanelVariantTask: vi.fn(async () => ({ ok: true, route: 'panel-variant' })),
}))

vi.mock('bullmq', () => ({
  Queue: class {
    constructor(_name: string) {}

    async add() {
      return { id: 'job-1' }
    }

    async getJob() {
      return null
    }
  },
  Worker: class {
    constructor(_name: string, processor: WorkerProcessor) {
      workerState.processor = processor
    }
  },
}))

vi.mock('@/lib/redis', () => ({
  queueRedis: {},
}))

vi.mock('@/lib/workers/shared', () => ({
  reportTaskProgress: reportTaskProgressMock,
  withTaskLifecycle: withTaskLifecycleMock,
}))

vi.mock('@/lib/workers/handlers/image-task-handlers', () => handlersMock)

function buildJob(params: {
  type: TaskJobData['type']
  payload?: Record<string, unknown>
}): Job<TaskJobData> {
  return {
    data: {
      taskId: 'task-image-1',
      type: params.type,
      locale: 'zh',
      projectId: 'project-1',
      episodeId: 'episode-1',
      targetType: 'NovelPromotionProject',
      targetId: 'target-1',
      payload: params.payload ?? {},
      userId: 'user-1',
    },
  } as unknown as Job<TaskJobData>
}

describe('worker image processor behavior', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    workerState.processor = null

    const mod = await import('@/lib/workers/image.worker')
    mod.createImageWorker()
  })

  it('REGENERATE_GROUP: payload.type=character 时路由到角色生图 handler', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    const job = buildJob({
      type: TASK_TYPE.REGENERATE_GROUP,
      payload: { type: 'character' },
    })

    const result = await processor!(job)
    expect(result).toEqual({ ok: true, route: 'character' })
    expect(handlersMock.handleCharacterImageTask).toHaveBeenCalledWith(job)
    expect(handlersMock.handleLocationImageTask).not.toHaveBeenCalled()
  })

  it('REGENERATE_GROUP: payload.type=location 时路由到场景生图 handler', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    const job = buildJob({
      type: TASK_TYPE.REGENERATE_GROUP,
      payload: { type: 'location' },
    })

    const result = await processor!(job)
    expect(result).toEqual({ ok: true, route: 'location' })
    expect(handlersMock.handleLocationImageTask).toHaveBeenCalledWith(job)
    expect(handlersMock.handleCharacterImageTask).not.toHaveBeenCalled()
  })

  it('REGENERATE_GROUP: payload.type 非法值时显式失败', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    const job = buildJob({
      type: TASK_TYPE.REGENERATE_GROUP,
      payload: { type: 'invalid-group' },
    })

    await expect(processor!(job)).rejects.toThrow('REGENERATE_GROUP_PAYLOAD_TYPE_INVALID')
  })
})
