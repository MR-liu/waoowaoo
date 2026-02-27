import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TASK_TYPE, type TaskType } from '@/lib/task/types'
import { buildMockRequest } from '../../../helpers/request'

type AuthState = {
  authenticated: boolean
  projectMode: 'novel-promotion' | 'other'
}

type LLMRouteCase = {
  routeFile: string
  body: Record<string, unknown>
  params?: Record<string, string>
  expectedTaskType: TaskType
  expectedTargetType: string
  expectedProjectId: string
}

type RouteContext = {
  params: Promise<Record<string, string>>
}

const authState = vi.hoisted<AuthState>(() => ({
  authenticated: true,
  projectMode: 'novel-promotion',
}))

const maybeSubmitLLMTaskMock = vi.hoisted(() =>
  vi.fn(async () => new Response(
    JSON.stringify({ taskId: 'task-1', async: true }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )),
)

const configServiceMock = vi.hoisted(() => ({
  getUserModelConfig: vi.fn(async () => ({
    analysisModel: 'llm::analysis',
  })),
  getProjectModelConfig: vi.fn(async () => ({
    analysisModel: 'llm::analysis',
  })),
}))

const prismaMock = vi.hoisted(() => ({
  globalCharacter: {
    findUnique: vi.fn(async () => ({
      id: 'global-character-1',
      userId: 'user-1',
    })),
  },
  globalLocation: {
    findUnique: vi.fn(async () => ({
      id: 'global-location-1',
      userId: 'user-1',
      name: 'Global Location',
    })),
  },
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

vi.mock('@/lib/llm-observe/route-task', () => ({
  maybeSubmitLLMTask: maybeSubmitLLMTaskMock,
}))
vi.mock('@/lib/config-service', () => configServiceMock)
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

const ROUTE_CASES: ReadonlyArray<LLMRouteCase> = [
  {
    routeFile: 'src/app/api/asset-hub/ai-design-character/route.ts',
    body: { userInstruction: 'design a heroic character' },
    expectedTaskType: TASK_TYPE.ASSET_HUB_AI_DESIGN_CHARACTER,
    expectedTargetType: 'GlobalAssetHubCharacterDesign',
    expectedProjectId: 'global-asset-hub',
  },
  {
    routeFile: 'src/app/api/asset-hub/ai-design-location/route.ts',
    body: { userInstruction: 'design a noir city location' },
    expectedTaskType: TASK_TYPE.ASSET_HUB_AI_DESIGN_LOCATION,
    expectedTargetType: 'GlobalAssetHubLocationDesign',
    expectedProjectId: 'global-asset-hub',
  },
  {
    routeFile: 'src/app/api/asset-hub/ai-modify-character/route.ts',
    body: {
      characterId: 'global-character-1',
      appearanceIndex: 0,
      currentDescription: 'old desc',
      modifyInstruction: 'make the outfit darker',
    },
    expectedTaskType: TASK_TYPE.ASSET_HUB_AI_MODIFY_CHARACTER,
    expectedTargetType: 'GlobalCharacter',
    expectedProjectId: 'global-asset-hub',
  },
  {
    routeFile: 'src/app/api/asset-hub/ai-modify-location/route.ts',
    body: {
      locationId: 'global-location-1',
      imageIndex: 0,
      currentDescription: 'old location desc',
      modifyInstruction: 'add more fog',
    },
    expectedTaskType: TASK_TYPE.ASSET_HUB_AI_MODIFY_LOCATION,
    expectedTargetType: 'GlobalLocation',
    expectedProjectId: 'global-asset-hub',
  },
  {
    routeFile: 'src/app/api/asset-hub/reference-to-character/route.ts',
    body: { referenceImageUrl: 'https://example.com/ref.png' },
    expectedTaskType: TASK_TYPE.ASSET_HUB_REFERENCE_TO_CHARACTER,
    expectedTargetType: 'GlobalCharacter',
    expectedProjectId: 'global-asset-hub',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/ai-create-character/route.ts',
    body: { userInstruction: 'create a rebel hero' },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.AI_CREATE_CHARACTER,
    expectedTargetType: 'NovelPromotionCharacterDesign',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/ai-create-location/route.ts',
    body: { userInstruction: 'create a mountain temple' },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.AI_CREATE_LOCATION,
    expectedTargetType: 'NovelPromotionLocationDesign',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/ai-modify-appearance/route.ts',
    body: {
      characterId: 'character-1',
      appearanceId: 'appearance-1',
      currentDescription: 'old appearance',
      modifyInstruction: 'add armor',
    },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.AI_MODIFY_APPEARANCE,
    expectedTargetType: 'CharacterAppearance',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/ai-modify-location/route.ts',
    body: {
      locationId: 'location-1',
      currentDescription: 'old location',
      modifyInstruction: 'add rain',
    },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.AI_MODIFY_LOCATION,
    expectedTargetType: 'NovelPromotionLocation',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/ai-modify-shot-prompt/route.ts',
    body: {
      panelId: 'panel-1',
      currentPrompt: 'old prompt',
      modifyInstruction: 'more dramatic angle',
    },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.AI_MODIFY_SHOT_PROMPT,
    expectedTargetType: 'NovelPromotionPanel',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/analyze-global/route.ts',
    body: {},
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.ANALYZE_GLOBAL,
    expectedTargetType: 'NovelPromotionProject',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/analyze-shot-variants/route.ts',
    body: { panelId: 'panel-1' },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.ANALYZE_SHOT_VARIANTS,
    expectedTargetType: 'NovelPromotionPanel',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/analyze/route.ts',
    body: { episodeId: 'episode-1', content: 'Analyze this chapter' },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.ANALYZE_NOVEL,
    expectedTargetType: 'NovelPromotionProject',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/character-profile/batch-confirm/route.ts',
    body: { items: ['character-1', 'character-2'] },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.CHARACTER_PROFILE_BATCH_CONFIRM,
    expectedTargetType: 'NovelPromotionProject',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/character-profile/confirm/route.ts',
    body: { characterId: 'character-1' },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.CHARACTER_PROFILE_CONFIRM,
    expectedTargetType: 'NovelPromotionCharacter',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/clips/route.ts',
    body: { episodeId: 'episode-1' },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.CLIPS_BUILD,
    expectedTargetType: 'NovelPromotionEpisode',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/episodes/split/route.ts',
    body: { content: 'x'.repeat(120) },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.EPISODE_SPLIT_LLM,
    expectedTargetType: 'NovelPromotionProject',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/reference-to-character/route.ts',
    body: { referenceImageUrl: 'https://example.com/ref.png' },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.REFERENCE_TO_CHARACTER,
    expectedTargetType: 'NovelPromotionProject',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/screenplay-conversion/route.ts',
    body: { episodeId: 'episode-1' },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.SCREENPLAY_CONVERT,
    expectedTargetType: 'NovelPromotionEpisode',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/script-to-storyboard-stream/route.ts',
    body: { episodeId: 'episode-1' },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.SCRIPT_TO_STORYBOARD_RUN,
    expectedTargetType: 'NovelPromotionEpisode',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/story-to-script-stream/route.ts',
    body: { episodeId: 'episode-1', content: 'story text' },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.STORY_TO_SCRIPT_RUN,
    expectedTargetType: 'NovelPromotionEpisode',
    expectedProjectId: 'project-1',
  },
  {
    routeFile: 'src/app/api/novel-promotion/[projectId]/voice-analyze/route.ts',
    body: { episodeId: 'episode-1' },
    params: { projectId: 'project-1' },
    expectedTaskType: TASK_TYPE.VOICE_ANALYZE,
    expectedTargetType: 'NovelPromotionEpisode',
    expectedProjectId: 'project-1',
  },
]

async function invokePostRoute(routeCase: LLMRouteCase): Promise<Response> {
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

describe('api contract - llm observe routes (behavior)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.authenticated = true
    authState.projectMode = 'novel-promotion'
    maybeSubmitLLMTaskMock.mockResolvedValue(
      new Response(JSON.stringify({ taskId: 'task-1', async: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
  })

  it('keeps expected coverage size', () => {
    expect(ROUTE_CASES.length).toBe(22)
  })

  for (const routeCase of ROUTE_CASES) {
    it(`${routeCase.routeFile} -> returns 401 when unauthenticated`, async () => {
      authState.authenticated = false
      const res = await invokePostRoute(routeCase)
      expect(res.status).toBe(401)
      expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
    })

    it(`${routeCase.routeFile} -> submits llm task with expected contract when authenticated`, async () => {
      const res = await invokePostRoute(routeCase)
      expect(res.status).toBe(200)
      expect(maybeSubmitLLMTaskMock).toHaveBeenCalledWith(expect.objectContaining({
        type: routeCase.expectedTaskType,
        targetType: routeCase.expectedTargetType,
        projectId: routeCase.expectedProjectId,
        userId: 'user-1',
      }))

      const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined
      expect(callArg?.type).toBe(routeCase.expectedTaskType)
      expect(callArg?.targetType).toBe(routeCase.expectedTargetType)
      expect(callArg?.projectId).toBe(routeCase.expectedProjectId)
      expect(callArg?.userId).toBe('user-1')

      const json = await res.json() as Record<string, unknown>
      expect(json.async).toBe(true)
      expect(typeof json.taskId).toBe('string')
    })
  }

  it('story-to-script-stream payload uses whitelist contract', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/story-to-script-stream/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/story-to-script-stream',
      method: 'POST',
      body: {
        episodeId: 'episode-1',
        content: 'story text',
        model: 'llm::analysis',
        reasoning: true,
        reasoningEffort: 'high',
        temperature: 0.4,
        unexpectedKey: 'should-drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)

    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      episodeId: 'episode-1',
      content: 'story text',
      model: 'llm::analysis',
      reasoning: true,
      reasoningEffort: 'high',
      temperature: 0.4,
      displayMode: 'detail',
    })
    expect(callArg?.body?.unexpectedKey).toBeUndefined()
  })

  it('asset-hub ai-design-character payload only accepts model override', async () => {
    const mod = await import('@/app/api/asset-hub/ai-design-character/route')
    const req = buildMockRequest({
      path: '/api/asset-hub/ai-design-character',
      method: 'POST',
      body: {
        userInstruction: 'design a heroic character',
        model: 'llm::analysis-override',
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req)
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      userInstruction: 'design a heroic character',
      analysisModel: 'llm::analysis-override',
      displayMode: 'detail',
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('asset-hub ai-design-character rejects unsupported reasoning options explicitly', async () => {
    const mod = await import('@/app/api/asset-hub/ai-design-character/route')
    const req = buildMockRequest({
      path: '/api/asset-hub/ai-design-character',
      method: 'POST',
      body: {
        userInstruction: 'design a heroic character',
        reasoning: true,
      },
    })

    const res = await mod.POST(req)
    expect(res.status).toBe(400)
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })

  it('ai-create-character payload only accepts model override', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/ai-create-character/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/ai-create-character',
      method: 'POST',
      body: {
        userInstruction: 'create a rebel hero',
        model: 'llm::analysis-override',
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      userInstruction: 'create a rebel hero',
      analysisModel: 'llm::analysis-override',
      displayMode: 'detail',
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('ai-create-character rejects unsupported temperature explicitly', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/ai-create-character/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/ai-create-character',
      method: 'POST',
      body: {
        userInstruction: 'create a rebel hero',
        temperature: 0.4,
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(400)
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })

  it('script-to-storyboard-stream payload uses whitelist contract', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/script-to-storyboard-stream/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/script-to-storyboard-stream',
      method: 'POST',
      body: {
        episodeId: 'episode-1',
        model: 'llm::analysis',
        reasoning: false,
        reasoningEffort: 'low',
        temperature: 0.3,
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)

    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      episodeId: 'episode-1',
      model: 'llm::analysis',
      reasoning: false,
      reasoningEffort: 'low',
      temperature: 0.3,
      displayMode: 'detail',
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('script-to-storyboard-stream rejects invalid reasoningEffort explicitly', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/script-to-storyboard-stream/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/script-to-storyboard-stream',
      method: 'POST',
      body: {
        episodeId: 'episode-1',
        reasoningEffort: 'ultra',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(400)
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })

  it('story-to-script-stream rejects out-of-range temperature explicitly', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/story-to-script-stream/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/story-to-script-stream',
      method: 'POST',
      body: {
        episodeId: 'episode-1',
        content: 'story text',
        temperature: 3.2,
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(400)
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })

  it('analyze route payload uses whitelist contract', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/analyze/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/analyze',
      method: 'POST',
      body: {
        episodeId: 'episode-1',
        content: 'Analyze this chapter',
        model: 'llm::analysis',
        reasoning: true,
        reasoningEffort: 'high',
        temperature: 0.7,
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      episodeId: 'episode-1',
      content: 'Analyze this chapter',
      model: 'llm::analysis',
      reasoning: true,
      reasoningEffort: 'high',
      temperature: 0.7,
      displayMode: 'detail',
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('analyze route rejects non-boolean reasoning explicitly', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/analyze/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/analyze',
      method: 'POST',
      body: {
        episodeId: 'episode-1',
        content: 'Analyze this chapter',
        reasoning: 'true',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(400)
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })

  it('clips route payload uses whitelist contract', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/clips/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/clips',
      method: 'POST',
      body: {
        episodeId: 'episode-1',
        model: 'llm::analysis',
        reasoning: true,
        reasoningEffort: 'minimal',
        temperature: 0.1,
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      episodeId: 'episode-1',
      model: 'llm::analysis',
      reasoning: true,
      reasoningEffort: 'minimal',
      temperature: 0.1,
      displayMode: 'detail',
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('episodes-split route payload uses whitelist contract', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/episodes/split/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/episodes/split',
      method: 'POST',
      body: {
        content: 'x'.repeat(120),
        model: 'llm::analysis',
        reasoning: true,
        reasoningEffort: 'high',
        temperature: 0.4,
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      content: 'x'.repeat(120),
      model: 'llm::analysis',
      reasoning: true,
      reasoningEffort: 'high',
      temperature: 0.4,
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('voice-analyze route payload uses whitelist contract', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/voice-analyze/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/voice-analyze',
      method: 'POST',
      body: {
        episodeId: 'episode-1',
        model: 'llm::analysis',
        reasoning: false,
        reasoningEffort: 'medium',
        temperature: 0.25,
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      episodeId: 'episode-1',
      model: 'llm::analysis',
      reasoning: false,
      reasoningEffort: 'medium',
      temperature: 0.25,
      displayMode: 'detail',
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('screenplay-conversion route payload uses whitelist contract', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/screenplay-conversion/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/screenplay-conversion',
      method: 'POST',
      body: {
        episodeId: 'episode-1',
        model: 'llm::analysis',
        reasoning: true,
        reasoningEffort: 'high',
        temperature: 0.35,
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      episodeId: 'episode-1',
      model: 'llm::analysis',
      reasoning: true,
      reasoningEffort: 'high',
      temperature: 0.35,
      displayMode: 'detail',
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('ai-modify-location route payload uses whitelist contract', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/ai-modify-location/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/ai-modify-location',
      method: 'POST',
      body: {
        locationId: 'location-1',
        imageIndex: 2.9,
        currentDescription: 'old location',
        modifyInstruction: 'add rain',
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      locationId: 'location-1',
      imageIndex: 2,
      currentDescription: 'old location',
      modifyInstruction: 'add rain',
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('ai-modify-location route accepts model override only', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/ai-modify-location/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/ai-modify-location',
      method: 'POST',
      body: {
        locationId: 'location-1',
        currentDescription: 'old location',
        modifyInstruction: 'add rain',
        model: 'llm::analysis-override',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      locationId: 'location-1',
      imageIndex: 0,
      currentDescription: 'old location',
      modifyInstruction: 'add rain',
      analysisModel: 'llm::analysis-override',
    })
  })

  it('ai-modify-location route rejects unsupported reasoning options explicitly', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/ai-modify-location/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/ai-modify-location',
      method: 'POST',
      body: {
        locationId: 'location-1',
        currentDescription: 'old location',
        modifyInstruction: 'add rain',
        reasoning: true,
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(400)
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })

  it('analyze-global route payload uses whitelist contract', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/analyze-global/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/analyze-global',
      method: 'POST',
      body: {
        model: 'llm::analysis',
        reasoning: true,
        reasoningEffort: 'medium',
        temperature: 0.5,
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      model: 'llm::analysis',
      reasoning: true,
      reasoningEffort: 'medium',
      temperature: 0.5,
      displayMode: 'detail',
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('analyze-global route rejects out-of-range temperature explicitly', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/analyze-global/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/analyze-global',
      method: 'POST',
      body: {
        temperature: 2.5,
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(400)
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })

  it('analyze-shot-variants route payload uses whitelist contract', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/analyze-shot-variants/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/analyze-shot-variants',
      method: 'POST',
      body: {
        panelId: 'panel-1',
        episodeId: 'episode-1',
        model: 'llm::analysis',
        reasoning: true,
        reasoningEffort: 'low',
        temperature: 0.6,
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      panelId: 'panel-1',
      episodeId: 'episode-1',
      model: 'llm::analysis',
      reasoning: true,
      reasoningEffort: 'low',
      temperature: 0.6,
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('voice-analyze route rejects invalid model type explicitly', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/voice-analyze/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/voice-analyze',
      method: 'POST',
      body: {
        episodeId: 'episode-1',
        model: { invalid: true },
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(400)
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })

  it('clips route rejects non-boolean reasoning explicitly', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/clips/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/clips',
      method: 'POST',
      body: {
        episodeId: 'episode-1',
        reasoning: 'true',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(400)
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })

  it('screenplay-conversion route rejects invalid reasoningEffort explicitly', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/screenplay-conversion/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/screenplay-conversion',
      method: 'POST',
      body: {
        episodeId: 'episode-1',
        reasoningEffort: 'ultra',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(400)
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })

  it('episodes-split route rejects non-boolean reasoning explicitly', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/episodes/split/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/episodes/split',
      method: 'POST',
      body: {
        content: 'x'.repeat(120),
        reasoning: 'true',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(400)
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })

  it('analyze-shot-variants route rejects out-of-range temperature explicitly', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/analyze-shot-variants/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/analyze-shot-variants',
      method: 'POST',
      body: {
        panelId: 'panel-1',
        temperature: -0.1,
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(400)
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })

  it('ai-modify-appearance route payload uses whitelist contract', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/ai-modify-appearance/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/ai-modify-appearance',
      method: 'POST',
      body: {
        characterId: 'character-1',
        appearanceId: 'appearance-1',
        currentDescription: 'old appearance',
        modifyInstruction: 'add armor',
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      characterId: 'character-1',
      appearanceId: 'appearance-1',
      currentDescription: 'old appearance',
      modifyInstruction: 'add armor',
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('ai-modify-appearance route accepts model override only', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/ai-modify-appearance/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/ai-modify-appearance',
      method: 'POST',
      body: {
        characterId: 'character-1',
        appearanceId: 'appearance-1',
        currentDescription: 'old appearance',
        modifyInstruction: 'add armor',
        model: 'llm::analysis-override',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      characterId: 'character-1',
      appearanceId: 'appearance-1',
      currentDescription: 'old appearance',
      modifyInstruction: 'add armor',
      analysisModel: 'llm::analysis-override',
    })
  })

  it('ai-modify-shot-prompt route payload uses whitelist contract', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/ai-modify-shot-prompt/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/ai-modify-shot-prompt',
      method: 'POST',
      body: {
        panelId: 'panel-1',
        episodeId: 'episode-1',
        currentPrompt: 'old prompt',
        currentVideoPrompt: 'old video prompt',
        modifyInstruction: 'more dramatic angle',
        referencedAssets: [{ id: 'asset-1' }, 'invalid'],
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      panelId: 'panel-1',
      episodeId: 'episode-1',
      currentPrompt: 'old prompt',
      currentVideoPrompt: 'old video prompt',
      modifyInstruction: 'more dramatic angle',
      referencedAssets: [{ id: 'asset-1' }],
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('ai-modify-shot-prompt route rejects unsupported temperature explicitly', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/ai-modify-shot-prompt/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/ai-modify-shot-prompt',
      method: 'POST',
      body: {
        currentPrompt: 'old prompt',
        modifyInstruction: 'more dramatic angle',
        temperature: 0.4,
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(400)
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })

  it('character-profile-confirm route payload uses whitelist contract', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/character-profile/confirm/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/character-profile/confirm',
      method: 'POST',
      body: {
        characterId: 'character-1',
        profileData: { age_range: 'adult' },
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      characterId: 'character-1',
      profileData: { age_range: 'adult' },
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('character-profile-confirm route accepts model override only', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/character-profile/confirm/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/character-profile/confirm',
      method: 'POST',
      body: {
        characterId: 'character-1',
        model: 'llm::analysis-override',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      characterId: 'character-1',
      analysisModel: 'llm::analysis-override',
    })
  })

  it('character-profile-batch-confirm route payload uses whitelist contract', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/character-profile/batch-confirm/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/character-profile/batch-confirm',
      method: 'POST',
      body: {
        force: true,
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({ force: true })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('character-profile-batch-confirm route rejects unsupported temperature explicitly', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/character-profile/batch-confirm/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/character-profile/batch-confirm',
      method: 'POST',
      body: {
        temperature: 0.5,
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(400)
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })

  it('reference-to-character route payload uses whitelist contract', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/reference-to-character/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/reference-to-character',
      method: 'POST',
      body: {
        referenceImageUrls: ['https://example.com/a.png', 'https://example.com/b.png'],
        isBackgroundJob: true,
        characterId: 'character-1',
        appearanceId: 'appearance-1',
        extractOnly: true,
        customDescription: 'custom desc',
        characterName: 'new name',
        artStyle: 'anime',
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      referenceImageUrls: ['https://example.com/a.png', 'https://example.com/b.png'],
      isBackgroundJob: true,
      characterId: 'character-1',
      appearanceId: 'appearance-1',
      extractOnly: true,
      customDescription: 'custom desc',
      characterName: 'new name',
      artStyle: 'anime',
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('reference-to-character route accepts model override only', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/reference-to-character/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/reference-to-character',
      method: 'POST',
      body: {
        referenceImageUrl: 'https://example.com/ref.png',
        model: 'llm::analysis-override',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      referenceImageUrl: 'https://example.com/ref.png',
      analysisModel: 'llm::analysis-override',
    })
  })

  it('asset-hub reference-to-character route payload uses whitelist contract', async () => {
    const mod = await import('@/app/api/asset-hub/reference-to-character/route')
    const req = buildMockRequest({
      path: '/api/asset-hub/reference-to-character',
      method: 'POST',
      body: {
        referenceImageUrl: 'https://example.com/ref.png',
        extractOnly: true,
        customDescription: 'custom desc',
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req)
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      referenceImageUrl: 'https://example.com/ref.png',
      extractOnly: true,
      customDescription: 'custom desc',
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('asset-hub reference-to-character route rejects unsupported reasoning options explicitly', async () => {
    const mod = await import('@/app/api/asset-hub/reference-to-character/route')
    const req = buildMockRequest({
      path: '/api/asset-hub/reference-to-character',
      method: 'POST',
      body: {
        referenceImageUrl: 'https://example.com/ref.png',
        reasoning: true,
      },
    })

    const res = await mod.POST(req)
    expect(res.status).toBe(400)
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })

  it('asset-hub ai-modify-character route payload uses normalized contract', async () => {
    const mod = await import('@/app/api/asset-hub/ai-modify-character/route')
    const req = buildMockRequest({
      path: '/api/asset-hub/ai-modify-character',
      method: 'POST',
      body: {
        characterId: ' global-character-1 ',
        appearanceIndex: 1.8,
        currentDescription: ' old desc ',
        modifyInstruction: ' make it darker ',
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req)
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      characterId: 'global-character-1',
      appearanceIndex: 1,
      currentDescription: 'old desc',
      modifyInstruction: 'make it darker',
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })

  it('asset-hub ai-modify-character route accepts model override only', async () => {
    const mod = await import('@/app/api/asset-hub/ai-modify-character/route')
    const req = buildMockRequest({
      path: '/api/asset-hub/ai-modify-character',
      method: 'POST',
      body: {
        characterId: 'global-character-1',
        appearanceIndex: 0,
        currentDescription: 'old desc',
        modifyInstruction: 'make it darker',
        model: 'llm::analysis-override',
      },
    })

    const res = await mod.POST(req)
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      characterId: 'global-character-1',
      appearanceIndex: 0,
      currentDescription: 'old desc',
      modifyInstruction: 'make it darker',
      analysisModel: 'llm::analysis-override',
    })
  })

  it('asset-hub ai-modify-character route rejects unsupported reasoning options explicitly', async () => {
    const mod = await import('@/app/api/asset-hub/ai-modify-character/route')
    const req = buildMockRequest({
      path: '/api/asset-hub/ai-modify-character',
      method: 'POST',
      body: {
        characterId: 'global-character-1',
        appearanceIndex: 0,
        currentDescription: 'old desc',
        modifyInstruction: 'make it darker',
        reasoning: true,
      },
    })

    const res = await mod.POST(req)
    expect(res.status).toBe(400)
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })

  it('asset-hub ai-modify-location route payload uses normalized contract', async () => {
    const mod = await import('@/app/api/asset-hub/ai-modify-location/route')
    const req = buildMockRequest({
      path: '/api/asset-hub/ai-modify-location',
      method: 'POST',
      body: {
        locationId: ' global-location-1 ',
        imageIndex: 2.9,
        currentDescription: ' old location desc ',
        modifyInstruction: ' add fog ',
        ignored: 'drop',
      },
    })

    const res = await mod.POST(req)
    expect(res.status).toBe(200)
    const callArg = maybeSubmitLLMTaskMock.mock.calls.at(-1)?.[0] as { body?: Record<string, unknown> } | undefined
    expect(callArg?.body).toEqual({
      locationId: 'global-location-1',
      locationName: 'Global Location',
      imageIndex: 2,
      currentDescription: 'old location desc',
      modifyInstruction: 'add fog',
    })
    expect(callArg?.body?.ignored).toBeUndefined()
  })
})
