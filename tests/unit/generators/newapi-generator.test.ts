import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiConfigMock = vi.hoisted(() => ({
  getProviderConfig: vi.fn(async () => ({
    id: 'newapi',
    name: 'NEW API',
    apiKey: 'newapi-key',
    baseUrl: 'http://localhost:3000/v1',
  })),
}))

const imageCacheMock = vi.hoisted(() => ({
  getImageBase64Cached: vi.fn(async () => 'data:image/png;base64,aGVsbG8='),
}))

const cosMock = vi.hoisted(() => ({
  imageUrlToBase64: vi.fn(async () => 'data:image/png;base64,d29ybGQ='),
}))

vi.mock('@/lib/api-config', () => apiConfigMock)
vi.mock('@/lib/image-cache', () => imageCacheMock)
vi.mock('@/lib/cos', () => cosMock)

import { NewApiImageGenerator, NewApiVideoGenerator } from '@/lib/generators/newapi'

interface ImagePayload {
  model: string
  prompt: string
  size?: string
  quality?: string
  response_format?: string
  n?: number
}

interface VideoPayload {
  model: string
  prompt: string
  image: string
  duration?: number
  with_audio?: boolean
  response_format?: string
  quality?: string
  size?: string
}

function parseJsonBody<T>(init: RequestInit | undefined): T {
  const body = init?.body
  expect(typeof body).toBe('string')
  if (typeof body !== 'string') {
    throw new Error('request body should be string')
  }
  return JSON.parse(body) as T
}

function parseFormBody(init: RequestInit | undefined): FormData {
  const body = init?.body
  expect(body instanceof FormData).toBe(true)
  if (!(body instanceof FormData)) {
    throw new Error('request body should be FormData')
  }
  return body
}

describe('NEW API generators', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('uses /images/generations and maps aspect ratio + resolution', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: 'aGVsbG8=' }],
    }), { status: 200 }))

    const generator = new NewApiImageGenerator('newapi')
    const result = await generator.generate({
      userId: 'user-1',
      prompt: '生成一张海报',
      options: {
        modelId: 'gpt-image-1',
        aspectRatio: '9:16',
        resolution: '4K',
        outputFormat: 'b64_json',
      },
    })

    expect(result.success).toBe(true)
    expect(result.imageBase64).toBe('aGVsbG8=')
    expect(result.imageUrl).toBe('data:image/png;base64,aGVsbG8=')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(requestUrl).toBe('http://localhost:3000/v1/images/generations')
    const payload = parseJsonBody<ImagePayload>(requestInit)
    expect(payload.model).toBe('gpt-image-1')
    expect(payload.size).toBe('1024x1792')
    expect(payload.quality).toBe('hd')
    expect(payload.response_format).toBe('b64_json')
  })

  it('uses /images/edits when reference images are provided', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      data: [{ url: '/outputs/newapi-image.png' }],
    }), { status: 200 }))

    const generator = new NewApiImageGenerator('newapi')
    const result = await generator.generate({
      userId: 'user-1',
      prompt: '保持角色一致并更换背景',
      referenceImages: ['https://cdn.example.com/reference.png'],
      options: {
        modelId: 'gpt-image-1',
        aspectRatio: '1:1',
      },
    })

    expect(result.success).toBe(true)
    expect(result.imageUrl).toBe('http://localhost:3000/outputs/newapi-image.png')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(requestUrl).toBe('http://localhost:3000/v1/images/edits')
    const body = parseFormBody(requestInit)
    expect(body.get('model')).toBe('gpt-image-1')
    expect(body.get('prompt')).toBe('保持角色一致并更换背景')
    expect(body.get('size')).toBe('1024x1024')
    expect(body.get('image')).toBeTruthy()
  })

  it('uses /video/generations and returns async externalId', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      task_id: 'task_123',
      status: 'queued',
    }), { status: 200 }))

    const generator = new NewApiVideoGenerator('newapi')
    const result = await generator.generate({
      userId: 'user-1',
      imageUrl: 'data:image/png;base64,Zmlyc3QtZnJhbWU=',
      prompt: '让角色转身并微笑',
      options: {
        modelId: 'kling-v1',
        aspectRatio: '16:9',
        resolution: '1080p',
        duration: 8,
        generateAudio: true,
      },
    })

    expect(result.success).toBe(true)
    expect(result.async).toBe(true)
    expect(result.requestId).toBe('task_123')
    expect(result.externalId).toBe('NEWAPI:VIDEO:task_123')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(requestUrl).toBe('http://localhost:3000/v1/video/generations')
    const payload = parseJsonBody<VideoPayload>(requestInit)
    expect(payload.model).toBe('kling-v1')
    expect(payload.response_format).toBe('url')
    expect(payload.duration).toBe(8)
    expect(payload.with_audio).toBe(true)
    expect(payload.quality).toBe('hd')
    expect(payload.size).toBe('1792x1024')
  })
})
