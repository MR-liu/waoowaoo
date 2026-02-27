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

function buildAnalyzeNovelTaskPayload(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) return { displayMode: 'detail' as const }

  const episodeId = toTrimmedString(input.episodeId)
  const content = toTrimmedString(input.content)
  const parsed = parseLLMRuntimeOptions(input)
  if (!parsed.ok) {
    throw new ApiError('INVALID_PARAMS', { message: parsed.message })
  }

  return {
    ...(episodeId ? { episodeId } : {}),
    ...(content ? { content } : {}),
    ...parsed.options,
    displayMode: 'detail' as const,
  }
}

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params
  const body = await readRequestJsonObject(request)
  const taskPayload = buildAnalyzeNovelTaskPayload(body)
  const episodeId = typeof taskPayload.episodeId === 'string' ? taskPayload.episodeId : null

  const authResult = await requireProjectAuth(projectId, {
    include: { characters: true, locations: true },
  })
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
    type: TASK_TYPE.ANALYZE_NOVEL,
    targetType: 'NovelPromotionProject',
    targetId: projectId,
    routePath: `/api/novel-promotion/${projectId}/analyze`,
    body: taskPayload,
    dedupeKey: `analyze_novel:${projectId}:${episodeId || 'global'}`,
    priority: 1,
  })
  if (asyncTaskResponse) return asyncTaskResponse

  throw new ApiError('INVALID_PARAMS')
})
