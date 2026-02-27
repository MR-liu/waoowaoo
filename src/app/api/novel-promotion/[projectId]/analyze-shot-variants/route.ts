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

function buildAnalyzeShotVariantsTaskPayload(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) return {}
  const panelId = toTrimmedString(input.panelId)
  const episodeId = toTrimmedString(input.episodeId)
  const parsed = parseLLMRuntimeOptions(input)
  if (!parsed.ok) {
    throw new ApiError('INVALID_PARAMS', { message: parsed.message })
  }
  return {
    ...(panelId ? { panelId } : {}),
    ...(episodeId ? { episodeId } : {}),
    ...parsed.options,
  }
}

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params
  const body = await readRequestJsonObject(request)
  const taskPayload = buildAnalyzeShotVariantsTaskPayload(body)
  const panelId = typeof taskPayload.panelId === 'string' ? taskPayload.panelId : ''

  if (!panelId) {
    throw new ApiError('INVALID_PARAMS')
  }

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const asyncTaskResponse = await maybeSubmitLLMTask({
    request,
    userId: session.user.id,
    projectId,
    episodeId: typeof taskPayload.episodeId === 'string' ? taskPayload.episodeId : null,
    type: TASK_TYPE.ANALYZE_SHOT_VARIANTS,
    targetType: 'NovelPromotionPanel',
    targetId: panelId,
    routePath: `/api/novel-promotion/${projectId}/analyze-shot-variants`,
    body: taskPayload,
    dedupeKey: `analyze_shot_variants:${panelId}`})
  if (asyncTaskResponse) return asyncTaskResponse

  throw new ApiError('INVALID_PARAMS')
})
