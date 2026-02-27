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

function buildAnalyzeGlobalTaskPayload(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) return { displayMode: 'detail' as const }
  const parsed = parseLLMRuntimeOptions(input)
  if (!parsed.ok) {
    throw new ApiError('INVALID_PARAMS', { message: parsed.message })
  }

  return {
    ...parsed.options,
    displayMode: 'detail' as const,
  }
}

/**
 * 全局资产分析（任务化）
 */
export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params
  const authResult = await requireProjectAuth(projectId)
  if (isErrorResponse(authResult)) return authResult
  const { session, project } = authResult
  const body = await readRequestJsonObject(request)
  const taskPayload = buildAnalyzeGlobalTaskPayload(body)

  if (project.mode !== 'novel-promotion') {
    throw new ApiError('INVALID_PARAMS')
  }

  const asyncTaskResponse = await maybeSubmitLLMTask({
    request,
    userId: session.user.id,
    projectId,
    type: TASK_TYPE.ANALYZE_GLOBAL,
    targetType: 'NovelPromotionProject',
    targetId: projectId,
    routePath: `/api/novel-promotion/${projectId}/analyze-global`,
    body: taskPayload,
    dedupeKey: `analyze_global:${projectId}`})
  if (asyncTaskResponse) return asyncTaskResponse

  throw new ApiError('INVALID_PARAMS')
})
