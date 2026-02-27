import { NextRequest } from 'next/server'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { readRequestJsonObject } from '@/lib/request-json'
import { TASK_TYPE } from '@/lib/task/types'
import { maybeSubmitLLMTask } from '@/lib/llm-observe/route-task'
import { parseLLMRuntimeOptions } from '@/lib/llm-observe/route-runtime-options'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function buildVoiceAnalyzeTaskPayload(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) {
    return { displayMode: 'detail' as const }
  }
  const episodeId = toTrimmedString(input.episodeId)
  const parsed = parseLLMRuntimeOptions(input)
  if (!parsed.ok) {
    throw new ApiError('INVALID_PARAMS', { message: parsed.message })
  }
  return {
    ...(episodeId ? { episodeId } : {}),
    ...parsed.options,
    displayMode: 'detail' as const,
  }
}

/**
 * POST /api/novel-promotion/[projectId]/voice-analyze
 * 台词分析（任务化）
 */
export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params
  const body = await readRequestJsonObject(request)
  const taskPayload = buildVoiceAnalyzeTaskPayload(body)
  const episodeId = typeof taskPayload.episodeId === 'string' ? taskPayload.episodeId : ''

  if (!episodeId) {
    throw new ApiError('INVALID_PARAMS')
  }

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult
  const { session, project } = authResult

  if (project.mode !== 'novel-promotion') {
    throw new ApiError('INVALID_PARAMS')
  }

  const asyncTaskResponse = await maybeSubmitLLMTask({
    request,
    userId: session.user.id,
    projectId,
    episodeId,
    type: TASK_TYPE.VOICE_ANALYZE,
    targetType: 'NovelPromotionEpisode',
    targetId: episodeId,
    routePath: `/api/novel-promotion/${projectId}/voice-analyze`,
    body: taskPayload,
    dedupeKey: `voice_analyze:${episodeId}`,
    priority: 1,
  })
  if (asyncTaskResponse) return asyncTaskResponse

  throw new ApiError('INVALID_PARAMS')
})
