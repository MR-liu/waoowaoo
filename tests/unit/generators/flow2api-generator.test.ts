import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiConfigMock = vi.hoisted(() => ({
  getProviderConfig: vi.fn(async () => ({
    id: 'flow2api',
    name: 'Flow2API',
    apiKey: 'flow2api-key',
    baseUrl: 'http://localhost:8000/v1',
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

import { Flow2ApiImageGenerator, Flow2ApiVideoGenerator } from '@/lib/generators/flow2api'

interface CompletionBody {
  model: string
  stream: boolean
  messages: Array<{
    role: string
    content: string | Array<{ type: string }>
  }>
}

function parseCompletionBody(init: RequestInit | undefined): CompletionBody {
  const body = init?.body
  expect(typeof body).toBe('string')
  if (typeof body !== 'string') {
    throw new Error('request body should be string')
  }
  return JSON.parse(body) as CompletionBody
}

function buildSseResponse(parts: Array<Record<string, unknown>>): Response {
  const lines = parts.map((part) => `data: ${JSON.stringify(part)}`)
  lines.push('data: [DONE]')
  return new Response(`${lines.join('\n')}\n`, { status: 200 })
}

describe('Flow2Api generators', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('maps image model and parses markdown image url', async () => {
    fetchMock.mockResolvedValue(buildSseResponse([
      {
        id: 'chatcmpl-image',
        choices: [
          {
            delta: {
              content: '![Generated Image](https://cdn.flow2api.dev/out/image-1.png)',
            },
          },
        ],
      },
    ]))

    const generator = new Flow2ApiImageGenerator('flow2api')
    const result = await generator.generate({
      userId: 'user-1',
      prompt: '生成一张图',
      options: {
        modelId: 'gemini-3.1-flash-image-preview',
        aspectRatio: '1:1',
        resolution: '2K',
      },
    })

    expect(result.success).toBe(true)
    expect(result.imageUrl).toBe('https://cdn.flow2api.dev/out/image-1.png')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(requestUrl).toBe('http://localhost:8000/v1/chat/completions')
    const payload = parseCompletionBody(requestInit)
    expect(payload.model).toBe('gemini-3.1-flash-image-square-2k')
    expect(payload.stream).toBe(true)
  })

  it('maps video model in normal mode and parses html video url', async () => {
    fetchMock.mockResolvedValue(buildSseResponse([
      {
        id: 'chatcmpl-video',
        choices: [
          {
            delta: {
              content: "```html\n<video src='https://cdn.flow2api.dev/out/video-1.mp4' controls></video>\n```",
            },
          },
        ],
      },
    ]))

    const generator = new Flow2ApiVideoGenerator('flow2api')
    const result = await generator.generate({
      userId: 'user-1',
      imageUrl: 'data:image/png;base64,Zmlyc3QtZnJhbWU=',
      prompt: '让角色转身',
      options: {
        modelId: 'veo-3.1-generate-preview',
        aspectRatio: '16:9',
      },
    })

    expect(result.success).toBe(true)
    expect(result.videoUrl).toBe('https://cdn.flow2api.dev/out/video-1.mp4')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    const payload = parseCompletionBody(requestInit)
    expect(payload.model).toBe('veo_3_1_i2v_s_fast_ultra_relaxed')
    expect(payload.stream).toBe(true)

    const content = payload.messages[0]?.content
    expect(Array.isArray(content)).toBe(true)
    if (!Array.isArray(content)) {
      throw new Error('content should be multimodal array')
    }
    const imageParts = content.filter((entry) => entry.type === 'image_url')
    expect(imageParts).toHaveLength(1)
  })

  it('maps video model in firstlastframe mode and includes last frame image', async () => {
    fetchMock.mockResolvedValue(buildSseResponse([
      {
        id: 'chatcmpl-video',
        choices: [
          {
            delta: {
              content: "```html\n<video src='https://cdn.flow2api.dev/out/video-1.mp4' controls></video>\n```",
            },
          },
        ],
      },
    ]))

    const generator = new Flow2ApiVideoGenerator('flow2api')
    const result = await generator.generate({
      userId: 'user-1',
      imageUrl: 'data:image/png;base64,Zmlyc3QtZnJhbWU=',
      prompt: '让角色转身',
      options: {
        modelId: 'veo-3.1-fast-generate-preview',
        aspectRatio: '9:16',
        generationMode: 'firstlastframe',
        lastFrameImageUrl: 'data:image/png;base64,bGFzdC1mcmFtZQ==',
      },
    })

    expect(result.success).toBe(true)
    expect(result.videoUrl).toBe('https://cdn.flow2api.dev/out/video-1.mp4')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    const payload = parseCompletionBody(requestInit)
    expect(payload.model).toBe('veo_3_1_i2v_s_fast_portrait_fl')
    expect(payload.stream).toBe(true)

    const content = payload.messages[0]?.content
    expect(Array.isArray(content)).toBe(true)
    if (!Array.isArray(content)) {
      throw new Error('content should be multimodal array')
    }
    const imageParts = content.filter((entry) => entry.type === 'image_url')
    expect(imageParts).toHaveLength(2)
  })

  it('infers firstlastframe mode from lastFrameImageUrl when generationMode is omitted', async () => {
    fetchMock.mockResolvedValue(buildSseResponse([
      {
        id: 'chatcmpl-video',
        choices: [
          {
            delta: {
              content: "```html\n<video src='https://cdn.flow2api.dev/out/video-2.mp4' controls></video>\n```",
            },
          },
        ],
      },
    ]))

    const generator = new Flow2ApiVideoGenerator('flow2api')
    const result = await generator.generate({
      userId: 'user-1',
      imageUrl: 'data:image/png;base64,Zmlyc3QtZnJhbWU=',
      prompt: '让角色转身',
      options: {
        modelId: 'veo-3.1-fast-generate-preview',
        aspectRatio: '16:9',
        lastFrameImageUrl: 'data:image/png;base64,bGFzdC1mcmFtZQ==',
      },
    })

    expect(result.success).toBe(true)
    expect(result.videoUrl).toBe('https://cdn.flow2api.dev/out/video-2.mp4')

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    const payload = parseCompletionBody(requestInit)
    expect(payload.model).toBe('veo_3_1_i2v_s_fast_fl')
    const content = payload.messages[0]?.content
    expect(Array.isArray(content)).toBe(true)
    if (!Array.isArray(content)) {
      throw new Error('content should be multimodal array')
    }
    const imageParts = content.filter((entry) => entry.type === 'image_url')
    expect(imageParts).toHaveLength(2)
  })

  it('throws when generationMode=firstlastframe but lastFrameImageUrl is missing', async () => {
    const generator = new Flow2ApiVideoGenerator('flow2api')
    const result = await generator.generate({
      userId: 'user-1',
      imageUrl: 'data:image/png;base64,Zmlyc3QtZnJhbWU=',
      prompt: '让角色转身',
      options: {
        modelId: 'veo-3.1-fast-generate-preview',
        generationMode: 'firstlastframe',
      },
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('FLOW2API_VIDEO_OPTION_REQUIRED: lastFrameImageUrl')
  })
})
