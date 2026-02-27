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

function toNonNegativeInteger(value: unknown): number {
  const parsed = Number(value ?? 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.floor(parsed))
}

function buildModifyLocationTaskPayload(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) return {}
  const locationId = toTrimmedString(input.locationId)
  const currentDescription = toTrimmedString(input.currentDescription)
  const modifyInstruction = toTrimmedString(input.modifyInstruction)
  const imageIndex = toNonNegativeInteger(input.imageIndex)

  return {
    ...(locationId ? { locationId } : {}),
    imageIndex,
    ...(currentDescription ? { currentDescription } : {}),
    ...(modifyInstruction ? { modifyInstruction } : {}),
  }
}

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params
  const authResult = await requireProjectAuth(projectId)
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = await readRequestJsonObject(request)
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
  const taskPayload = buildModifyLocationTaskPayload(body)
  if (parsedRuntimeOptions.options.model) {
    taskPayload.analysisModel = parsedRuntimeOptions.options.model
  }
  const locationId = typeof taskPayload.locationId === 'string' ? taskPayload.locationId : ''
  const imageIndex = typeof taskPayload.imageIndex === 'number' ? taskPayload.imageIndex : 0
  const currentDescription =
    typeof taskPayload.currentDescription === 'string' ? taskPayload.currentDescription : ''
  const modifyInstruction =
    typeof taskPayload.modifyInstruction === 'string' ? taskPayload.modifyInstruction : ''

  if (!locationId || !currentDescription || !modifyInstruction) {
    throw new ApiError('INVALID_PARAMS')
  }

  const asyncTaskResponse = await maybeSubmitLLMTask({
    request,
    userId: session.user.id,
    projectId,
    type: TASK_TYPE.AI_MODIFY_LOCATION,
    targetType: 'NovelPromotionLocation',
    targetId: locationId,
    routePath: `/api/novel-promotion/${projectId}/ai-modify-location`,
    body: taskPayload,
    dedupeKey: `ai_modify_location:${locationId}:${imageIndex}`})
  if (asyncTaskResponse) return asyncTaskResponse

  throw new ApiError('INVALID_PARAMS')
})
