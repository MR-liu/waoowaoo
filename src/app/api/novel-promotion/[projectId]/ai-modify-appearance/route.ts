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

function buildModifyAppearanceTaskPayload(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) return {}
  const characterId = toTrimmedString(input.characterId)
  const appearanceId = toTrimmedString(input.appearanceId)
  const currentDescription = toTrimmedString(input.currentDescription)
  const modifyInstruction = toTrimmedString(input.modifyInstruction)

  return {
    ...(characterId ? { characterId } : {}),
    ...(appearanceId ? { appearanceId } : {}),
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
  const taskPayload = buildModifyAppearanceTaskPayload(body)
  if (parsedRuntimeOptions.options.model) {
    taskPayload.analysisModel = parsedRuntimeOptions.options.model
  }
  const characterId = typeof taskPayload.characterId === 'string' ? taskPayload.characterId : ''
  const appearanceId = typeof taskPayload.appearanceId === 'string' ? taskPayload.appearanceId : ''
  const currentDescription =
    typeof taskPayload.currentDescription === 'string' ? taskPayload.currentDescription : ''
  const modifyInstruction =
    typeof taskPayload.modifyInstruction === 'string' ? taskPayload.modifyInstruction : ''

  if (!characterId || !appearanceId || !currentDescription || !modifyInstruction) {
    throw new ApiError('INVALID_PARAMS')
  }

  const asyncTaskResponse = await maybeSubmitLLMTask({
    request,
    userId: session.user.id,
    projectId,
    type: TASK_TYPE.AI_MODIFY_APPEARANCE,
    targetType: 'CharacterAppearance',
    targetId: appearanceId,
    routePath: `/api/novel-promotion/${projectId}/ai-modify-appearance`,
    body: taskPayload,
    dedupeKey: `ai_modify_appearance:${appearanceId}`})
  if (asyncTaskResponse) return asyncTaskResponse

  throw new ApiError('INVALID_PARAMS')
})
