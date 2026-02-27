import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { getProjectModelConfig } from '@/lib/config-service'
import { requireProjectAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { readRequestJsonObject } from '@/lib/request-json'
import { TASK_TYPE } from '@/lib/task/types'
import { maybeSubmitLLMTask } from '@/lib/llm-observe/route-task'
import { parseLLMRuntimeOptions } from '@/lib/llm-observe/route-runtime-options'

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params
  const authResult = await requireProjectAuth(projectId)
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = await readRequestJsonObject(request)
  const userInstruction = typeof body.userInstruction === 'string' ? body.userInstruction.trim() : ''
  if (!userInstruction) {
    throw new ApiError('INVALID_PARAMS')
  }
  const parsedRuntimeOptions = parseLLMRuntimeOptions(body)
  if (!parsedRuntimeOptions.ok) {
    throw new ApiError('INVALID_PARAMS', { message: parsedRuntimeOptions.message })
  }
  if (
    parsedRuntimeOptions.options.reasoning !== undefined
    || parsedRuntimeOptions.options.reasoningEffort !== undefined
    || parsedRuntimeOptions.options.temperature !== undefined
  ) {
    throw new ApiError('INVALID_PARAMS', { message: 'Only model is supported for this route' })
  }

  const modelConfig = await getProjectModelConfig(projectId, session.user.id)
  const analysisModel = parsedRuntimeOptions.options.model || modelConfig.analysisModel || ''
  if (!analysisModel) {
    throw new ApiError('MISSING_CONFIG')
  }

  const dedupeDigest = createHash('sha1')
    .update(`${projectId}:${session.user.id}:character:${userInstruction}`)
    .digest('hex')
    .slice(0, 16)

  const payload = {
    userInstruction,
    analysisModel,
    displayMode: 'detail' as const}

  const asyncTaskResponse = await maybeSubmitLLMTask({
    request,
    userId: session.user.id,
    projectId,
    type: TASK_TYPE.AI_CREATE_CHARACTER,
    targetType: 'NovelPromotionCharacterDesign',
    targetId: projectId,
    routePath: `/api/novel-promotion/${projectId}/ai-create-character`,
    body: payload,
    dedupeKey: `novel_promotion_ai_create_character:${dedupeDigest}`})
  if (asyncTaskResponse) return asyncTaskResponse

  throw new ApiError('INVALID_PARAMS')
})
