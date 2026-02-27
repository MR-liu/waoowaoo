import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunState } from '@/lib/query/hooks/run-stream/types'

const logWarnMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logging/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/logging/core')>()
  return {
    ...actual,
    logWarn: logWarnMock,
  }
})

function buildRunState(): RunState {
  return {
    runId: 'run-1',
    status: 'processing',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    terminalAt: null,
    errorMessage: '',
    summary: null,
    payload: null,
    stepsById: {},
    stepOrder: [],
    activeStepId: null,
    selectedStepId: null,
  }
}

describe('run snapshot storage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    // cleanup for node test env
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (globalThis as { window?: unknown }).window
  })

  it('loadRunSnapshot logs load and cleanup failures when sessionStorage throws', async () => {
    const sessionStorage = {
      getItem: vi.fn(() => {
        throw new Error('read failed')
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(() => {
        throw new Error('remove failed')
      }),
    }
    Object.defineProperty(globalThis, 'window', {
      value: { sessionStorage },
      configurable: true,
      writable: true,
    })

    const mod = await import('@/lib/query/hooks/run-stream/snapshot')
    const result = mod.loadRunSnapshot('run:key')

    expect(result).toBeNull()
    expect(logWarnMock).toHaveBeenCalledWith(expect.stringContaining('[RunSnapshot] load failed key=run:key'))
    expect(logWarnMock).toHaveBeenCalledWith(expect.stringContaining('[RunSnapshot] cleanup after load failed key=run:key'))
  })

  it('saveRunSnapshot logs when setItem throws', async () => {
    const sessionStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error('write failed')
      }),
      removeItem: vi.fn(),
    }
    Object.defineProperty(globalThis, 'window', {
      value: { sessionStorage },
      configurable: true,
      writable: true,
    })

    const mod = await import('@/lib/query/hooks/run-stream/snapshot')
    mod.saveRunSnapshot('run:key', buildRunState())

    expect(logWarnMock).toHaveBeenCalledWith(expect.stringContaining('[RunSnapshot] save failed key=run:key'))
  })

  it('clearRunSnapshot logs when removeItem throws', async () => {
    const sessionStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(() => {
        throw new Error('remove failed')
      }),
    }
    Object.defineProperty(globalThis, 'window', {
      value: { sessionStorage },
      configurable: true,
      writable: true,
    })

    const mod = await import('@/lib/query/hooks/run-stream/snapshot')
    mod.clearRunSnapshot('run:key')

    expect(logWarnMock).toHaveBeenCalledWith(expect.stringContaining('[RunSnapshot] clear failed key=run:key'))
  })
})
