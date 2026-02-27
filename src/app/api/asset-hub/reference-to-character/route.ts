import { NextRequest } from 'next/server'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { readRequestJsonObject } from '@/lib/request-json'
import { TASK_TYPE } from '@/lib/task/types'
import { maybeSubmitLLMTask } from '@/lib/llm-observe/route-task'
import { parseLLMRuntimeOptions } from '@/lib/llm-observe/route-runtime-options'

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toBooleanFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

function parseReferenceImages(body: Record<string, unknown>): string[] {
  const list = Array.isArray(body.referenceImageUrls)
    ? body.referenceImageUrls.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
    : []
  if (list.length > 0) return list.slice(0, 5)
  const single = typeof body.referenceImageUrl === 'string' ? body.referenceImageUrl.trim() : ''
  return single ? [single] : []
}

function buildAssetHubReferencePayload(
  body: Record<string, unknown>,
  referenceImages: string[],
): Record<string, unknown> {
  const isBackgroundJob = toBooleanFlag(body.isBackgroundJob)
  const characterId = toTrimmedString(body.characterId)
  const appearanceId = toTrimmedString(body.appearanceId)
  const extractOnly = toBooleanFlag(body.extractOnly)
  const customDescription = toTrimmedString(body.customDescription)
  const characterName = toTrimmedString(body.characterName)
  const artStyle = toTrimmedString(body.artStyle)

  return {
    ...(referenceImages.length > 1 ? { referenceImageUrls: referenceImages } : { referenceImageUrl: referenceImages[0] }),
    ...(isBackgroundJob ? { isBackgroundJob: true } : {}),
    ...(characterId ? { characterId } : {}),
    ...(appearanceId ? { appearanceId } : {}),
    ...(extractOnly ? { extractOnly: true } : {}),
    ...(customDescription ? { customDescription } : {}),
    ...(characterName ? { characterName } : {}),
    ...(artStyle ? { artStyle } : {}),
  }
}

/**
 * 资产中心 - 参考图转角色（任务化）
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
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
  const referenceImages = parseReferenceImages(body)
  const taskPayload = buildAssetHubReferencePayload(body, referenceImages)
  if (parsedRuntimeOptions.options.model) {
    taskPayload.analysisModel = parsedRuntimeOptions.options.model
  }
  if (referenceImages.length === 0) {
    throw new ApiError('INVALID_PARAMS')
  }

  const isBackgroundJob = taskPayload.isBackgroundJob === true
  const characterId = typeof taskPayload.characterId === 'string' ? taskPayload.characterId : ''
  const appearanceId = typeof taskPayload.appearanceId === 'string' ? taskPayload.appearanceId : ''
  if (isBackgroundJob && (!characterId || !appearanceId)) {
    throw new ApiError('INVALID_PARAMS')
  }

  const asyncTaskResponse = await maybeSubmitLLMTask({
    request,
    userId: session.user.id,
    projectId: 'global-asset-hub',
    type: TASK_TYPE.ASSET_HUB_REFERENCE_TO_CHARACTER,
    targetType: appearanceId ? 'GlobalCharacterAppearance' : 'GlobalCharacter',
    targetId: appearanceId || characterId || session.user.id,
    routePath: '/api/asset-hub/reference-to-character',
    body: taskPayload,
    dedupeKey: `asset_hub_reference_to_character:${appearanceId || characterId || session.user.id}`})
  if (asyncTaskResponse) return asyncTaskResponse

  throw new ApiError('INVALID_PARAMS')
})
