import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logging/core', () => ({
  createScopedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('AyonClient', () => {
  let originalServerUrl: string | undefined
  let originalApiKey: string | undefined

  beforeEach(() => {
    vi.resetModules()
    originalServerUrl = process.env.AYON_SERVER_URL
    originalApiKey = process.env.AYON_API_KEY
    process.env.AYON_SERVER_URL = 'https://ayon.example.com'
    process.env.AYON_API_KEY = 'test-api-key-123'
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
  })

  afterEach(() => {
    if (originalServerUrl === undefined) delete process.env.AYON_SERVER_URL
    else process.env.AYON_SERVER_URL = originalServerUrl
    if (originalApiKey === undefined) delete process.env.AYON_API_KEY
    else process.env.AYON_API_KEY = originalApiKey
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('AYON_SERVER_URL 未配置 -> 抛出错误', async () => {
    delete process.env.AYON_SERVER_URL
    const { AyonClient } = await import('@/lib/ayon/client')
    expect(() => new AyonClient()).toThrow('AYON_SERVER_URL is not configured')
  })

  it('AYON_API_KEY 未配置 -> 抛出错误', async () => {
    delete process.env.AYON_API_KEY
    const { AyonClient } = await import('@/lib/ayon/client')
    expect(() => new AyonClient()).toThrow('AYON_API_KEY is not configured')
  })

  it('listProjects -> 正确调用 AYON API 并返回项目列表', async () => {
    const mockProjects = [
      { name: 'project_a', code: 'PA' },
      { name: 'project_b', code: 'PB' },
    ]
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockProjects }),
    })

    const { AyonClient } = await import('@/lib/ayon/client')
    const client = new AyonClient()
    const result = await client.listProjects()

    expect(result).toEqual(mockProjects)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(callArgs[0]).toBe('https://ayon.example.com/api/projects')
    expect(callArgs[1].headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer test-api-key-123',
      }),
    )
  })

  it('listFolders -> URL 包含项目名', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    })

    const { AyonClient } = await import('@/lib/ayon/client')
    const client = new AyonClient()
    await client.listFolders('my_project')

    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(callArgs[0]).toBe('https://ayon.example.com/api/projects/my_project/folders')
  })

  it('createFolder -> 发送 POST 请求', async () => {
    const createdFolder = { id: 'f1', name: 'SEQ010', folderType: 'Sequence', parentId: null }
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: createdFolder }),
    })

    const { AyonClient } = await import('@/lib/ayon/client')
    const client = new AyonClient()
    const result = await client.createFolder('my_project', {
      name: 'SEQ010',
      folderType: 'Sequence',
    })

    expect(result).toEqual(createdFolder)
    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(callArgs[1].method).toBe('POST')
    const body = JSON.parse(callArgs[1].body as string) as Record<string, unknown>
    expect(body.name).toBe('SEQ010')
    expect(body.folderType).toBe('Sequence')
  })

  it('AYON API 返回非 2xx -> 抛出错误并包含状态码', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    })

    const { AyonClient } = await import('@/lib/ayon/client')
    const client = new AyonClient()

    await expect(client.listProjects()).rejects.toThrow('AYON API error 403: Forbidden')
  })

  it('listVersions -> 返回版本列表', async () => {
    const mockVersions = [
      { id: 'v1', version: 1, productId: 'p1', author: 'user1', status: 'approved', createdAt: '2025-06-01' },
    ]
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockVersions }),
    })

    const { AyonClient } = await import('@/lib/ayon/client')
    const client = new AyonClient()
    const result = await client.listVersions('my_project')

    expect(result).toEqual(mockVersions)
    expect(result[0].author).toBe('user1')
    expect(result[0].status).toBe('approved')
  })

  it('listEvents 传入 after 和 topics -> URL 包含正确 query params', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    })

    const { AyonClient } = await import('@/lib/ayon/client')
    const client = new AyonClient()
    await client.listEvents('my_project', {
      after: 'evt-100',
      topics: ['version.publish', 'entity.version.created'],
    })

    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit]
    const url = new URL(callArgs[0])
    expect(url.searchParams.get('after')).toBe('evt-100')
    expect(url.searchParams.get('topics')).toBe('version.publish,entity.version.created')
  })

  it('构造函数支持 config 覆盖 -> 使用传入值而非环境变量', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    })

    const { AyonClient } = await import('@/lib/ayon/client')
    const client = new AyonClient({
      serverUrl: 'https://custom-ayon.example.com/',
      apiKey: 'custom-key',
    })
    await client.listProjects()

    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(callArgs[0]).toBe('https://custom-ayon.example.com/api/projects')
    expect((callArgs[1].headers as Record<string, string>).Authorization).toBe('Bearer custom-key')
  })

  it('API 返回无 data 字段 -> listProjects 返回空数组', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    const { AyonClient } = await import('@/lib/ayon/client')
    const client = new AyonClient()
    const result = await client.listProjects()
    expect(result).toEqual([])
  })
})
