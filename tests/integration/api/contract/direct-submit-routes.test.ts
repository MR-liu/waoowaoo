import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TASK_TYPE, type TaskType } from '@/lib/task/types'
import { buildMockRequest } from '../../../helpers/request'

type AuthState = {
  authenticated: boolean
  projectMode: 'novel-promotion' | 'other'
}

type SubmitResult = {
  taskId: string
  async: true
}

type RouteContext = {
  params: Promise<Record<string, string>>
}

type DirectRouteCase = {
  routeFile: string
  body: Record<string, unknown>
  params?: Record<string, string>
  expectedTaskType: TaskType
  expectedTargetType: string
  expectedProjectId: string
}

const authState = vi.hoisted<AuthState>(() => ({
  authenticated: true,
  projectMode: 'novel-promotion',
}))

const submitTaskMock = vi.hoisted(() => vi.fn<[], Promise<SubmitResult>>())

const configServiceMock = vi.hoisted(() => ({
  getUserModelConfig: vi.fn(async () => ({
    characterModel: 'img::character',
    locationModel: 'img::location',
    editModel: 'img::edit',
  })),
  buildImageBillingPayloadFromUserConfig: vi.fn((input: { basePayload: Record<string, unknown> }) => ({
    ...input.basePayload,
    generationOptions: { resolution: '1024x1024' },
  })),
  getProjectModelConfig: vi.fn(async () => ({
    characterModel: 'img::character',
    locationModel: 'img::location',
    editModel: 'img::edit',
    storyboardModel: 'img::storyboard',
    analysisModel: 'llm::analysis',
  })),
  buildImageBillingPayload: vi.fn(async (input: { basePayload: Record<string, unknown> }) => ({
    ...input.basePayload,
    generationOptions: { resolution: '1024x1024' },
  })),
  resolveProjectModelCapabilityGenerationOptions: vi.fn(async () => ({
    resolution: '1024x1024',
  })),
}))

const hasOutputMock = vi.hoisted(() => ({
  hasGlobalCharacterOutput: vi.fn(async () => false),
  hasGlobalLocationOutput: vi.fn(async () => false),
  hasGlobalCharacterAppearanceOutput: vi.fn(async () => false),
  hasGlobalLocationImageOutput: vi.fn(async () => false),
  hasCharacterAppearanceOutput: vi.fn(async () => false),
  hasLocationImageOutput: vi.fn(async () => false),
  hasPanelLipSyncOutput: vi.fn(async () => false),
  hasPanelImageOutput: vi.fn(async () => false),
  hasPanelVideoOutput: vi.fn(async () => false),
  hasVoiceLineAudioOutput: vi.fn(async () => false),
}))

const prismaMock = vi.hoisted(() => ({
  userPreference: {
    findUnique: vi.fn(async () => ({ lipSyncModel: 'fal::lipsync-model' })),
  },
  novelPromotionPanel: {
    findFirst: vi.fn(async () => ({ id: 'panel-1' })),
    findMany: vi.fn(async () => []),
    findUnique: vi.fn(async ({ where }: { where?: { id?: string } }) => {
      const id = where?.id || 'panel-1'
      if (id === 'panel-src') {
        return {
          id,
          panelIndex: 1,
          shotType: 'wide',
          cameraMove: 'static',
          description: 'source description',
          videoPrompt: 'source video prompt',
          location: 'source location',
          characters: '[]',
          srtSegment: '',
          duration: 3,
        }
      }
      if (id === 'panel-ins') {
        return {
          id,
          panelIndex: 2,
          shotType: 'medium',
          cameraMove: 'push',
          description: 'insert description',
          videoPrompt: 'insert video prompt',
          location: 'insert location',
          characters: '[]',
          srtSegment: '',
          duration: 3,
        }
      }
      return {
        id,
        panelIndex: 0,
        shotType: 'medium',
        cameraMove: 'static',
        description: 'panel description',
        videoPrompt: 'panel prompt',
        location: 'panel location',
        characters: '[]',
        srtSegment: '',
        duration: 3,
      }
    }),
    update: vi.fn(async () => ({})),
    create: vi.fn(async () => ({ id: 'panel-created', panelIndex: 3 })),
  },
  novelPromotionProject: {
    findUnique: vi.fn(async () => ({
      id: 'project-data-1',
      characters: [
        { name: 'Narrator', customVoiceUrl: 'https://voice.example/narrator.mp3' },
      ],
    })),
  },
  novelPromotionEpisode: {
    findFirst: vi.fn(async () => ({
      id: 'episode-1',
      speakerVoices: '{}',
    })),
  },
  novelPromotionVoiceLine: {
    findMany: vi.fn(async () => [
      { id: 'line-1', speaker: 'Narrator', content: 'hello world voice line' },
    ]),
    findFirst: vi.fn(async () => ({
      id: 'line-1',
      speaker: 'Narrator',
      content: 'hello world voice line',
    })),
  },
  $transaction: vi.fn(async (fn: (tx: {
    novelPromotionPanel: {
      findMany: (args: unknown) => Promise<Array<{ id: string; panelIndex: number }>>
      update: (args: unknown) => Promise<unknown>
      create: (args: unknown) => Promise<{ id: string; panelIndex: number }>
    }
  }) => Promise<unknown>) => {
    const tx = {
      novelPromotionPanel: {
        findMany: async () => [],
        update: async () => ({}),
        create: async () => ({ id: 'panel-created', panelIndex: 3 }),
      },
    }
    return await fn(tx)
  }),
}))

vi.mock('@/lib/api-auth', () => {
  const unauthorized = () => new Response(
    JSON.stringify({ error: { code: 'UNAUTHORIZED' } }),
    { status: 401, headers: { 'content-type': 'application/json' } },
  )

  return {
    isErrorResponse: (value: unknown) => value instanceof Response,
    requireUserAuth: async () => {
      if (!authState.authenticated) return unauthorized()
      return { session: { user: { id: 'user-1' } } }
    },
    requireProjectAuth: async (projectId: string) => {
      if (!authState.authenticated) return unauthorized()
      return {
        session: { user: { id: 'user-1' } },
        project: { id: projectId, userId: 'user-1', mode: authState.projectMode },
      }
    },
    requireProjectAuthLight: async (projectId: string) => {
      if (!authState.authenticated) return unauthorized()
      return {
        session: { user: { id: 'user-1' } },
        project: { id: projectId, userId: 'user-1', mode: authState.projectMode },
      }
    },
  }
})

vi.mock('@/lib/task/submitter', () => ({
  submitTask: submitTaskMock,
}))
vi.mock('@/lib/task/resolve-locale', () => ({
  resolveRequiredTaskLocale: vi.fn(() => 'zh'),
}))
vi.mock('@/lib/config-service', () => configServiceMock)
vi.mock('@/lib/task/has-output', () => hasOutputMock)
vi.mock('@/lib/billing', () => ({
  buildDefaultTaskBillingInfo: vi.fn(() => ({ mode: 'default' })),
}))
vi.mock('@/lib/qwen-voice-design', () => ({
  validateVoicePrompt: vi.fn(() => ({ valid: true })),
  validatePreviewText: vi.fn(() => ({ valid: true })),
}))
vi.mock('@/lib/media/outbound-image', () => ({
  sanitizeImageInputsForTaskPayload: vi.fn((inputs: unknown[]) => ({
    normalized: inputs
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
    issues: [] as Array<{ reason: string }>,
  })),
}))
vi.mock('@/lib/model-capabilities/lookup', () => ({
  resolveBuiltinCapabilitiesByModelKey: vi.fn(() => ({ video: { firstlastframe: true } })),
}))
vi.mock('@/lib/model-pricing/lookup', () => ({
  resolveBuiltinPricing: vi.fn(() => ({ status: 'ok' })),
}))
vi.mock('@/lib/api-config', () => ({
  resolveModelSelection: vi.fn(async () => ({
    model: 'img::storyboard',
  })),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

function toApiPath(routeFile: string): string {
  return routeFile
    .replace(/^src\/app/, '')
    .replace(/\/route\.ts$/, '')
    .replace('[projectId]', 'project-1')
}

function toModuleImportPath(routeFile: string): string {
  return `@/${routeFile.replace(/^src\//, '').replace(/\.ts$/, '')}`
}

const DIRECT_CASES: ReadonlyArray<DirectRouteCase> = [
  {
    routeFile: 'src/app/api/asset-hub/generate-image/route.ts',
    body: { type: 'character', id: 'global-character-1', appearanceIndex: 0 },
    expectedTaskType: TASK_TYPE.ASSET_HUB_IMAGE,
    expectedTargetType: 'GlobalCharacter',
    expectedProjectId: 'global-asset-hub',
  },
  {
    routeFile: 'src/app/api/asset-hub/modify-image/route.ts',
    body: {
      type: 'character',
      id: 'global-character-1',
      modifyPrompt: 'sharpen details',
      appearanceIndex: 0,
      imageIndex: 0,
      extraImageUrls: ['https://example.com/ref-a.png'],
    },
    expectedTaskType: TASK_TYPE.ASSET_HUB_MODIFY,
    expectedTargetType: 'GlobalCharacterAppearance',
    expectedProjectId: 'global-asset-hub',
  },
  {
    routeFile: 'src/app/api/asset-hub/voice-design/route.ts',
    body: { voicePrompt: 'female calm narrator', previewText: '你好世界' },
    expectedTaskType: TASK_TYPE.ASSET_HUB_VOICE_DESIGN,
    expectedTargetType: 'GlobalAssetHubVoiceDesign',
    expectedProjectId: 'global-asset-hub',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/generate-image/route.ts',
    body: { type: 'character', id: 'character-1', appearanceId: 'appearance-1' },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.IMAGE_CHARACTER,
    expectedTargetType: 'CharacterAppearance',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/generate-video/route.ts',
    body: { videoModel: 'fal::video-model', storyboardId: 'storyboard-1', panelIndex: 0 },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.VIDEO_PANEL,
    expectedTargetType: 'NovelPromotionPanel',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/insert-panel/route.ts',
    body: { storyboardId: 'storyboard-1', insertAfterPanelId: 'panel-ins', userInput: '新增一个特写镜头' },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.INSERT_PANEL,
    expectedTargetType: 'NovelPromotionStoryboard',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/lip-sync/route.ts',
    body: {
      storyboardId: 'storyboard-1',
      panelIndex: 0,
      voiceLineId: 'line-1',
      lipSyncModel: 'fal::lip-model',
    },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.LIP_SYNC,
    expectedTargetType: 'NovelPromotionPanel',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/modify-asset-image/route.ts',
    body: {
      type: 'character',
      characterId: 'character-1',
      appearanceId: 'appearance-1',
      modifyPrompt: 'enhance texture',
      extraImageUrls: ['https://example.com/ref-b.png'],
    },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.MODIFY_ASSET_IMAGE,
    expectedTargetType: 'CharacterAppearance',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/modify-storyboard-image/route.ts',
    body: {
      storyboardId: 'storyboard-1',
      panelIndex: 0,
      modifyPrompt: 'increase contrast',
      extraImageUrls: ['https://example.com/ref-c.png'],
      selectedAssets: [{ imageUrl: 'https://example.com/ref-d.png' }],
    },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.MODIFY_ASSET_IMAGE,
    expectedTargetType: 'NovelPromotionPanel',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/panel-variant/route.ts',
    body: {
      storyboardId: 'storyboard-1',
      insertAfterPanelId: 'panel-ins',
      sourcePanelId: 'panel-src',
      variant: { video_prompt: 'new prompt', description: 'variant desc' },
    },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.PANEL_VARIANT,
    expectedTargetType: 'NovelPromotionPanel',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/regenerate-group/route.ts',
    body: { type: 'character', id: 'character-1', appearanceId: 'appearance-1' },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.REGENERATE_GROUP,
    expectedTargetType: 'CharacterAppearance',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/regenerate-panel-image/route.ts',
    body: { panelId: 'panel-1', count: 1 },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.IMAGE_PANEL,
    expectedTargetType: 'NovelPromotionPanel',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/regenerate-single-image/route.ts',
    body: { type: 'character', id: 'character-1', appearanceId: 'appearance-1', imageIndex: 0 },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.IMAGE_CHARACTER,
    expectedTargetType: 'CharacterAppearance',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/regenerate-storyboard-text/route.ts',
    body: { storyboardId: 'storyboard-1' },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.REGENERATE_STORYBOARD_TEXT,
    expectedTargetType: 'NovelPromotionStoryboard',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/voice-design/route.ts',
    body: { voicePrompt: 'warm female voice', previewText: 'This is preview text' },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.VOICE_DESIGN,
    expectedTargetType: 'NovelPromotionProject',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/voice-generate/route.ts',
    body: { episodeId: 'episode-1', lineId: 'line-1', audioModel: 'fal::audio-model' },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.VOICE_LINE,
    expectedTargetType: 'NovelPromotionVoiceLine',
    expectedProjectId: 'project-1',
  },
]

async function invokePostRoute(routeCase: DirectRouteCase): Promise<Response> {
  const modulePath = toModuleImportPath(routeCase.routeFile)
  const mod = await import(modulePath)
  const post = mod.POST as (request: Request, context?: RouteContext) => Promise<Response>
  const req = buildMockRequest({
    path: toApiPath(routeCase.routeFile),
    method: 'POST',
    body: routeCase.body,
  })
  return await post(req, { params: Promise.resolve(routeCase.params || {}) })
}

describe('api contract - direct submit routes (behavior)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.authenticated = true
    authState.projectMode = 'novel-promotion'
    let seq = 0
    submitTaskMock.mockImplementation(async () => ({
      taskId: `task-${++seq}`,
      async: true,
    }))
  })

  it('keeps expected coverage size', () => {
    expect(DIRECT_CASES.length).toBe(16)
  })

  for (const routeCase of DIRECT_CASES) {
    it(`${routeCase.routeFile} -> returns 401 when unauthenticated`, async () => {
      authState.authenticated = false
      const res = await invokePostRoute(routeCase)
      expect(res.status).toBe(401)
      expect(submitTaskMock).not.toHaveBeenCalled()
    })

    it(`${routeCase.routeFile} -> submits task with expected contract when authenticated`, async () => {
      const res = await invokePostRoute(routeCase)
      expect(res.status).toBe(200)
      expect(submitTaskMock).toHaveBeenCalledWith(expect.objectContaining({
        type: routeCase.expectedTaskType,
        targetType: routeCase.expectedTargetType,
        projectId: routeCase.expectedProjectId,
        userId: 'user-1',
      }))

      const submitArg = submitTaskMock.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined
      expect(submitArg?.type).toBe(routeCase.expectedTaskType)
      expect(submitArg?.targetType).toBe(routeCase.expectedTargetType)
      expect(submitArg?.projectId).toBe(routeCase.expectedProjectId)
      expect(submitArg?.userId).toBe('user-1')

      const json = await res.json() as Record<string, unknown>
      const isVoiceGenerateRoute = routeCase.routeFile.endsWith('/voice-generate/route.ts')
      if (isVoiceGenerateRoute) {
        expect(json.success).toBe(true)
        expect(json.async).toBe(true)
        expect(typeof json.taskId).toBe('string')
      } else {
        expect(json.async).toBe(true)
        expect(typeof json.taskId).toBe('string')
      }
    })
  }

  it('generate-video route submits sanitized payload only', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/generate-video/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/generate-video',
      method: 'POST',
      body: {
        videoModel: 'fal::video-model',
        storyboardId: 'storyboard-1',
        panelIndex: 0,
        customPrompt: 'cinematic prompt',
        generationOptions: { resolution: '1024x1024', duration: 5, aspectRatio: '16:9' },
        firstLastFrame: { flModel: 'fal::video-model', customPrompt: 'transition' },
        unexpected: 'drop-me',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)

    const submitArg = submitTaskMock.mock.calls.at(-1)?.[0] as { payload?: Record<string, unknown> } | undefined
    const payload = submitArg?.payload
    expect(payload).toBeTruthy()
    expect(payload?.videoModel).toBe('fal::video-model')
    expect(payload?.storyboardId).toBe('storyboard-1')
    expect(payload?.panelIndex).toBe(0)
    expect(payload?.customPrompt).toBe('cinematic prompt')
    expect(payload?.generationOptions).toEqual({ resolution: '1024x1024', duration: 5 })
    expect(payload?.firstLastFrame).toEqual({ flModel: 'fal::video-model', customPrompt: 'transition' })
    expect(payload?.unexpected).toBeUndefined()
  })

  it('lip-sync route submits sanitized payload only', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/lip-sync/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/lip-sync',
      method: 'POST',
      body: {
        storyboardId: 'storyboard-1',
        panelIndex: 0,
        voiceLineId: 'line-1',
        lipSyncModel: 'fal::lip-model',
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)

    const submitArg = submitTaskMock.mock.calls.at(-1)?.[0] as { payload?: Record<string, unknown> } | undefined
    const payload = submitArg?.payload
    expect(payload).toBeTruthy()
    expect(payload?.storyboardId).toBe('storyboard-1')
    expect(payload?.panelIndex).toBe(0)
    expect(payload?.voiceLineId).toBe('line-1')
    expect(payload?.lipSyncModel).toBe('fal::lip-model')
    expect(payload?.ignored).toBeUndefined()
  })

  it('asset-hub generate-image route submits sanitized payload only', async () => {
    const mod = await import('@/app/api/asset-hub/generate-image/route')
    const req = buildMockRequest({
      path: '/api/asset-hub/generate-image',
      method: 'POST',
      body: {
        type: 'character',
        id: 'global-character-1',
        appearanceIndex: 1.9,
        unexpected: 'drop',
      },
    })

    const res = await mod.POST(req)
    expect(res.status).toBe(200)

    const submitArg = submitTaskMock.mock.calls.at(-1)?.[0] as { payload?: Record<string, unknown> } | undefined
    const payload = submitArg?.payload
    expect(payload).toBeTruthy()
    expect(payload?.type).toBe('character')
    expect(payload?.id).toBe('global-character-1')
    expect(payload?.appearanceIndex).toBe(1)
    expect(payload?.generationOptions).toEqual({ resolution: '1024x1024' })
    expect(payload?.unexpected).toBeUndefined()
  })

  it('asset-hub modify-image route submits sanitized payload only', async () => {
    const mod = await import('@/app/api/asset-hub/modify-image/route')
    const req = buildMockRequest({
      path: '/api/asset-hub/modify-image',
      method: 'POST',
      body: {
        type: 'character',
        id: 'global-character-1',
        modifyPrompt: 'enhance details',
        appearanceIndex: 2.9,
        imageIndex: 1.2,
        extraImageUrls: [' https://example.com/global-ref.png ', ''],
        unexpected: 'drop',
      },
    })

    const res = await mod.POST(req)
    expect(res.status).toBe(200)

    const submitArg = submitTaskMock.mock.calls.at(-1)?.[0] as { payload?: Record<string, unknown> } | undefined
    const payload = submitArg?.payload
    expect(payload).toBeTruthy()
    expect(payload?.type).toBe('character')
    expect(payload?.id).toBe('global-character-1')
    expect(payload?.modifyPrompt).toBe('enhance details')
    expect(payload?.appearanceIndex).toBe(2)
    expect(payload?.imageIndex).toBe(1)
    expect(payload?.extraImageUrls).toEqual(['https://example.com/global-ref.png'])
    expect(payload?.generationOptions).toEqual({ resolution: '1024x1024' })
    expect((payload?.meta as Record<string, unknown>)?.outboundImageInputAudit).toBeTruthy()
    expect(payload?.unexpected).toBeUndefined()
  })

  it('generate-image route submits sanitized payload only', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/generate-image/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/generate-image',
      method: 'POST',
      body: {
        type: 'character',
        id: 'character-1',
        appearanceId: 'appearance-1',
        imageIndex: 2.9,
        unexpected: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)

    const submitArg = submitTaskMock.mock.calls.at(-1)?.[0] as { payload?: Record<string, unknown> } | undefined
    const payload = submitArg?.payload
    expect(payload).toBeTruthy()
    expect(payload?.type).toBe('character')
    expect(payload?.id).toBe('character-1')
    expect(payload?.appearanceId).toBe('appearance-1')
    expect(payload?.imageIndex).toBe(2)
    expect(payload?.generationOptions).toEqual({ resolution: '1024x1024' })
    expect(payload?.unexpected).toBeUndefined()
  })

  it('modify-asset-image route submits sanitized payload only', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/modify-asset-image/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/modify-asset-image',
      method: 'POST',
      body: {
        type: 'character',
        characterId: 'character-1',
        appearanceId: 'appearance-1',
        modifyPrompt: 'enhance details',
        extraImageUrls: [' https://example.com/ref-a.png ', ''],
        imageIndex: 1.8,
        unexpected: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)

    const submitArg = submitTaskMock.mock.calls.at(-1)?.[0] as { payload?: Record<string, unknown> } | undefined
    const payload = submitArg?.payload
    expect(payload).toBeTruthy()
    expect(payload?.type).toBe('character')
    expect(payload?.appearanceId).toBe('appearance-1')
    expect(payload?.characterId).toBe('character-1')
    expect(payload?.modifyPrompt).toBe('enhance details')
    expect(payload?.extraImageUrls).toEqual(['https://example.com/ref-a.png'])
    expect(payload?.imageIndex).toBe(1)
    expect(payload?.generationOptions).toEqual({ resolution: '1024x1024' })
    expect((payload?.meta as Record<string, unknown>)?.outboundImageInputAudit).toBeTruthy()
    expect(payload?.unexpected).toBeUndefined()
  })

  it('modify-storyboard-image route submits sanitized payload only', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/modify-storyboard-image/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/modify-storyboard-image',
      method: 'POST',
      body: {
        storyboardId: 'storyboard-1',
        panelIndex: 0,
        modifyPrompt: 'increase contrast',
        extraImageUrls: [' https://example.com/ref-c.png '],
        selectedAssets: [
          { id: 'asset-1', type: 'image', imageUrl: ' https://example.com/ref-d.png ', ignoreMe: true },
        ],
        unexpected: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)

    const submitArg = submitTaskMock.mock.calls.at(-1)?.[0] as { payload?: Record<string, unknown> } | undefined
    const payload = submitArg?.payload
    expect(payload).toBeTruthy()
    expect(payload?.type).toBe('storyboard')
    expect(payload?.panelIndex).toBe(0)
    expect(payload?.modifyPrompt).toBe('increase contrast')
    expect(payload?.extraImageUrls).toEqual(['https://example.com/ref-c.png'])
    expect(payload?.selectedAssets).toEqual([
      { id: 'asset-1', type: 'image', imageUrl: 'https://example.com/ref-d.png' },
    ])
    expect(payload?.generationOptions).toEqual({ resolution: '1024x1024' })
    expect((payload?.meta as Record<string, unknown>)?.outboundImageInputAudit).toBeTruthy()
    expect(payload?.unexpected).toBeUndefined()
  })

  it('regenerate-group route submits sanitized payload only', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/regenerate-group/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/regenerate-group',
      method: 'POST',
      body: {
        type: 'character',
        id: 'character-1',
        appearanceId: 'appearance-1',
        appearanceIndex: 1.8,
        unexpected: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)

    const submitArg = submitTaskMock.mock.calls.at(-1)?.[0] as { payload?: Record<string, unknown> } | undefined
    const payload = submitArg?.payload
    expect(payload).toBeTruthy()
    expect(payload?.type).toBe('character')
    expect(payload?.id).toBe('character-1')
    expect(payload?.appearanceId).toBe('appearance-1')
    expect(payload?.appearanceIndex).toBe(1)
    expect(payload?.generationOptions).toEqual({ resolution: '1024x1024' })
    expect(payload?.unexpected).toBeUndefined()
  })

  it('regenerate-panel-image route submits sanitized payload only', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/regenerate-panel-image/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/regenerate-panel-image',
      method: 'POST',
      body: {
        panelId: 'panel-1',
        count: 2.9,
        unexpected: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)

    const submitArg = submitTaskMock.mock.calls.at(-1)?.[0] as { payload?: Record<string, unknown> } | undefined
    const payload = submitArg?.payload
    expect(payload).toBeTruthy()
    expect(payload?.panelId).toBe('panel-1')
    expect(payload?.candidateCount).toBe(2)
    expect(payload?.imageModel).toBe('img::storyboard')
    expect(payload?.generationOptions).toEqual({ resolution: '1024x1024' })
    expect(payload?.count).toBeUndefined()
    expect(payload?.unexpected).toBeUndefined()
  })

  it('regenerate-single-image route submits sanitized payload only', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/regenerate-single-image/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/regenerate-single-image',
      method: 'POST',
      body: {
        type: 'character',
        id: 'character-1',
        appearanceId: 'appearance-1',
        imageIndex: 3.7,
        unexpected: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)

    const submitArg = submitTaskMock.mock.calls.at(-1)?.[0] as { payload?: Record<string, unknown> } | undefined
    const payload = submitArg?.payload
    expect(payload).toBeTruthy()
    expect(payload?.type).toBe('character')
    expect(payload?.id).toBe('character-1')
    expect(payload?.appearanceId).toBe('appearance-1')
    expect(payload?.imageIndex).toBe(3)
    expect(payload?.generationOptions).toEqual({ resolution: '1024x1024' })
    expect(payload?.unexpected).toBeUndefined()
  })

  it('insert-panel route submits sanitized payload only', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/insert-panel/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/insert-panel',
      method: 'POST',
      body: {
        storyboardId: 'storyboard-1',
        insertAfterPanelId: 'panel-ins',
        prompt: '补一个过渡镜头',
        unexpected: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)

    const submitArg = submitTaskMock.mock.calls.at(-1)?.[0] as { payload?: Record<string, unknown> } | undefined
    const payload = submitArg?.payload
    expect(payload).toBeTruthy()
    expect(payload?.storyboardId).toBe('storyboard-1')
    expect(payload?.insertAfterPanelId).toBe('panel-ins')
    expect(payload?.userInput).toBe('补一个过渡镜头')
    expect(payload?.analysisModel).toBe('llm::analysis')
    expect(payload?.prompt).toBeUndefined()
    expect(payload?.unexpected).toBeUndefined()
  })

  it('regenerate-storyboard-text route submits sanitized payload only', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/regenerate-storyboard-text/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/regenerate-storyboard-text',
      method: 'POST',
      body: {
        storyboardId: 'storyboard-1',
        unexpected: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)

    const submitArg = submitTaskMock.mock.calls.at(-1)?.[0] as { payload?: Record<string, unknown> } | undefined
    const payload = submitArg?.payload
    expect(payload).toBeTruthy()
    expect(payload?.storyboardId).toBe('storyboard-1')
    expect(payload?.analysisModel).toBe('llm::analysis')
    expect(payload?.unexpected).toBeUndefined()
  })

  it('panel-variant route submits sanitized payload only', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/panel-variant/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/panel-variant',
      method: 'POST',
      body: {
        storyboardId: 'storyboard-1',
        insertAfterPanelId: 'panel-ins',
        sourcePanelId: 'panel-src',
        variant: {
          video_prompt: 'new prompt',
          description: 'variant desc',
          shot_type: 'close-up',
          ignoreMe: true,
        },
        unexpected: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)

    const submitArg = submitTaskMock.mock.calls.at(-1)?.[0] as { payload?: Record<string, unknown> } | undefined
    const payload = submitArg?.payload
    expect(payload).toBeTruthy()
    expect(payload?.storyboardId).toBe('storyboard-1')
    expect(payload?.insertAfterPanelId).toBe('panel-ins')
    expect(payload?.sourcePanelId).toBe('panel-src')
    expect(typeof payload?.newPanelId).toBe('string')
    expect(payload?.variant).toEqual({
      video_prompt: 'new prompt',
      description: 'variant desc',
      shot_type: 'close-up',
    })
    expect((payload?.variant as Record<string, unknown>)?.ignoreMe).toBeUndefined()
    expect(payload?.unexpected).toBeUndefined()
  })
})
