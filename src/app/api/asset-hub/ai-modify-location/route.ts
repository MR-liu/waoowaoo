import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { readRequestJsonObject } from '@/lib/request-json'
import { TASK_TYPE } from '@/lib/task/types'
import { maybeSubmitLLMTask } from '@/lib/llm-observe/route-task'
import { parseLLMRuntimeOptions } from '@/lib/llm-observe/route-runtime-options'

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toNonNegativeInteger(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.floor(parsed))
}

/**
 * 资产中心 - AI 修改场景描述（任务化）
 * POST /api/asset-hub/ai-modify-location
 * body: { locationId, imageIndex, currentDescription, modifyInstruction }
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const payload = await readRequestJsonObject(request)
  const parsedRuntimeOptions = parseLLMRuntimeOptions(payload)
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
  const locationId = toTrimmedString(payload?.locationId)
  const imageIndex = toNonNegativeInteger(payload?.imageIndex)
  const currentDescription = toTrimmedString(payload?.currentDescription)
  const modifyInstruction = toTrimmedString(payload?.modifyInstruction)
  const analysisModel = parsedRuntimeOptions.options.model

  if (!locationId || imageIndex === null || !currentDescription || !modifyInstruction) {
    throw new ApiError('INVALID_PARAMS')
  }

  const location = await prisma.globalLocation.findUnique({
    where: { id: locationId },
    select: { id: true, userId: true, name: true }})
  if (!location || location.userId !== session.user.id) {
    throw new ApiError('NOT_FOUND')
  }

  const asyncTaskResponse = await maybeSubmitLLMTask({
    request,
    userId: session.user.id,
    projectId: 'global-asset-hub',
    type: TASK_TYPE.ASSET_HUB_AI_MODIFY_LOCATION,
    targetType: 'GlobalLocation',
    targetId: locationId,
    routePath: '/api/asset-hub/ai-modify-location',
    body: {
      locationId,
      locationName: location.name,
      imageIndex,
      currentDescription,
      modifyInstruction,
      ...(analysisModel ? { analysisModel } : {}),
    },
    dedupeKey: `asset_hub_ai_modify_location:${locationId}:${imageIndex}`})
  if (asyncTaskResponse) return asyncTaskResponse

  throw new ApiError('INVALID_PARAMS')
})
