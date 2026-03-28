import { createScopedLogger } from '@/lib/logging/core'

const logger = createScopedLogger({ module: 'ayon-client' })

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AyonConfig {
  serverUrl: string
  apiKey: string
}

export interface AyonProject {
  name: string
  code: string
}

export interface AyonFolder {
  id: string
  name: string
  folderType: string
  parentId: string | null
}

export interface AyonTask {
  id: string
  name: string
  taskType: string
  folderId: string
  assignees: string[]
  status: string
}

export interface AyonVersion {
  id: string
  version: number
  productId: string
  author: string
  status: string
  createdAt: string
}

export interface AyonEvent {
  id: string
  topic: string
  project: string
  description: string
  summary: Record<string, unknown>
  createdAt: string
  dependsOn: string | null
  status: 'pending' | 'finished' | 'failed'
}

interface AyonListResponse<T> {
  detail?: string
  data?: T[]
}

interface AyonSingleResponse<T> {
  detail?: string
  data?: T
}

// ---------------------------------------------------------------------------
// Config resolution
// ---------------------------------------------------------------------------

function resolveConfig(overrides?: Partial<AyonConfig>): AyonConfig {
  const serverUrl = overrides?.serverUrl || process.env.AYON_SERVER_URL
  const apiKey = overrides?.apiKey || process.env.AYON_API_KEY

  if (!serverUrl) {
    throw new Error('AYON_SERVER_URL is not configured')
  }
  if (!apiKey) {
    throw new Error('AYON_API_KEY is not configured')
  }

  return { serverUrl: serverUrl.replace(/\/+$/, ''), apiKey }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

interface AyonRequestInit {
  method: string
  path: string
  body?: Record<string, unknown>
  config: AyonConfig
}

async function ayonFetch<T>(init: AyonRequestInit): Promise<T> {
  const url = `${init.config.serverUrl}${init.path}`
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${init.config.apiKey}`,
    'Content-Type': 'application/json',
  }

  const fetchInit: RequestInit = {
    method: init.method,
    headers,
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  }

  logger.debug({
    action: 'ayon.http.request',
    message: `${init.method} ${init.path}`,
    details: { url },
  })

  const response = await fetch(url, fetchInit)

  if (!response.ok) {
    const errorText = await response.text().catch(() => '<unreadable>')
    logger.error({
      action: 'ayon.http.error',
      message: `AYON API returned ${response.status}`,
      details: { url, status: response.status, body: errorText },
    })
    throw new Error(`AYON API error ${response.status}: ${errorText}`)
  }

  return (await response.json()) as T
}

// ---------------------------------------------------------------------------
// Client class
// ---------------------------------------------------------------------------

export class AyonClient {
  private readonly config: AyonConfig

  constructor(overrides?: Partial<AyonConfig>) {
    this.config = resolveConfig(overrides)
  }

  async listProjects(): Promise<AyonProject[]> {
    const res = await ayonFetch<AyonListResponse<AyonProject>>({
      method: 'GET',
      path: '/api/projects',
      config: this.config,
    })
    return res.data ?? []
  }

  async listFolders(projectName: string): Promise<AyonFolder[]> {
    const res = await ayonFetch<AyonListResponse<AyonFolder>>({
      method: 'GET',
      path: `/api/projects/${encodeURIComponent(projectName)}/folders`,
      config: this.config,
    })
    return res.data ?? []
  }

  async createFolder(
    projectName: string,
    payload: { name: string; folderType: string; parentId?: string },
  ): Promise<AyonFolder> {
    const res = await ayonFetch<AyonSingleResponse<AyonFolder>>({
      method: 'POST',
      path: `/api/projects/${encodeURIComponent(projectName)}/folders`,
      body: {
        name: payload.name,
        folderType: payload.folderType,
        ...(payload.parentId ? { parentId: payload.parentId } : {}),
      },
      config: this.config,
    })
    if (!res.data) {
      throw new Error('AYON createFolder returned no data')
    }
    return res.data
  }

  async listVersions(projectName: string): Promise<AyonVersion[]> {
    const res = await ayonFetch<AyonListResponse<AyonVersion>>({
      method: 'GET',
      path: `/api/projects/${encodeURIComponent(projectName)}/versions`,
      config: this.config,
    })
    return res.data ?? []
  }

  async listTasks(projectName: string, folderId?: string): Promise<AyonTask[]> {
    const query = folderId ? `?folderId=${encodeURIComponent(folderId)}` : ''
    const res = await ayonFetch<AyonListResponse<AyonTask>>({
      method: 'GET',
      path: `/api/projects/${encodeURIComponent(projectName)}/tasks${query}`,
      config: this.config,
    })
    return res.data ?? []
  }

  async listEvents(
    projectName: string,
    options?: { after?: string; topics?: string[] },
  ): Promise<AyonEvent[]> {
    const params = new URLSearchParams()
    if (options?.after) params.set('after', options.after)
    if (options?.topics?.length) params.set('topics', options.topics.join(','))
    const query = params.toString() ? `?${params.toString()}` : ''

    const res = await ayonFetch<AyonListResponse<AyonEvent>>({
      method: 'GET',
      path: `/api/projects/${encodeURIComponent(projectName)}/events${query}`,
      config: this.config,
    })
    return res.data ?? []
  }
}
