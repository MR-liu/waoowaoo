import { describe, expect, it } from 'vitest'
import { createWorkersByLanes, parseWorkerLanes } from '@/lib/workers/selection'

describe('worker selection', () => {
  it('returns all lanes when WORKER_QUEUES is empty', () => {
    expect(parseWorkerLanes(undefined)).toEqual(['image', 'video', 'voice', 'text'])
    expect(parseWorkerLanes('')).toEqual(['image', 'video', 'voice', 'text'])
  })

  it('parses comma-separated lanes and removes duplicates', () => {
    expect(parseWorkerLanes('image,voice,image,text')).toEqual(['image', 'voice', 'text'])
  })

  it('throws explicit error when lane is unsupported', () => {
    expect(() => parseWorkerLanes('image,invalid')).toThrow('WORKER_QUEUES_INVALID')
  })

  it('throws explicit error when creating workers with empty lanes', () => {
    expect(() => createWorkersByLanes([])).toThrow('WORKER_LANES_EMPTY')
  })
})
