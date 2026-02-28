import { beforeEach, describe, expect, it, vi } from 'vitest'

const subscriberMock = vi.hoisted(() => ({
  on: vi.fn(),
  subscribe: vi.fn(async () => undefined),
  unsubscribe: vi.fn(async () => undefined),
}))

const createSubscriberMock = vi.hoisted(() => vi.fn(() => subscriberMock))
const logErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/redis', () => ({
  createSubscriber: createSubscriberMock,
}))

vi.mock('@/lib/logging/core', () => ({
  logError: logErrorMock,
}))

describe('shared subscriber', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete (globalThis as { __foldxSharedSubscriber?: unknown }).__foldxSharedSubscriber
  })

  it('logs error when unsubscribe fails', async () => {
    subscriberMock.unsubscribe.mockRejectedValueOnce(new Error('unsubscribe boom'))

    const mod = await import('@/lib/sse/shared-subscriber')
    const sharedSubscriber = mod.getSharedSubscriber()
    const removeListener = await sharedSubscriber.addChannelListener('project:project-1', () => undefined)

    expect(subscriberMock.subscribe).toHaveBeenCalledWith('project:project-1')

    await removeListener()

    expect(subscriberMock.unsubscribe).toHaveBeenCalledWith('project:project-1')
    expect(logErrorMock).toHaveBeenCalledWith(
      expect.stringContaining('[SSE:shared] unsubscribe failed channel=project:project-1 error=unsubscribe boom'),
    )
  })

  it('keeps subscription alive until last listener is removed', async () => {
    const mod = await import('@/lib/sse/shared-subscriber')
    const sharedSubscriber = mod.getSharedSubscriber()
    const removeA = await sharedSubscriber.addChannelListener('project:project-1', () => undefined)
    const removeB = await sharedSubscriber.addChannelListener('project:project-1', () => undefined)

    expect(subscriberMock.subscribe).toHaveBeenCalledTimes(1)

    await removeA()
    expect(subscriberMock.unsubscribe).not.toHaveBeenCalled()

    await removeB()
    expect(subscriberMock.unsubscribe).toHaveBeenCalledWith('project:project-1')
  })
})
