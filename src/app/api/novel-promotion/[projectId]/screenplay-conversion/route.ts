import { NextRequest } from 'next/server'
import { requireProjectAuth, isErrorResponse } from '@/lib/api-auth'
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

function buildScreenplayConvertTaskPayload(input: unknown): Record<string, unknown> {
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
 * POST /api/novel-promotion/[projectId]/screenplay-conversion
 * 将 clips 转换为结构化剧本
 */
export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params
  const body = await readRequestJsonObject(request)
  const taskPayload = buildScreenplayConvertTaskPayload(body)
  const episodeId = typeof taskPayload.episodeId === 'string' ? taskPayload.episodeId : ''

  if (!episodeId) {
    throw new ApiError('INVALID_PARAMS')
  }

  const authResult = await requireProjectAuth(projectId)
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
    type: TASK_TYPE.SCREENPLAY_CONVERT,
    targetType: 'NovelPromotionEpisode',
    targetId: episodeId,
    routePath: `/api/novel-promotion/${projectId}/screenplay-conversion`,
    body: taskPayload,
    dedupeKey: `screenplay_convert:${episodeId}`,
    priority: 2,
  })
  if (asyncTaskResponse) return asyncTaskResponse

  throw new ApiError('INVALID_PARAMS')
})
