import { NextRequest, NextResponse } from 'next/server'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError, getRequestId } from '@/lib/api-errors'
import { submitTask } from '@/lib/task/submitter'
import { resolveRequiredTaskLocale } from '@/lib/task/resolve-locale'
import { TASK_TYPE } from '@/lib/task/types'
import { buildDefaultTaskBillingInfo } from '@/lib/billing'
import { getUserModelConfig, buildImageBillingPayloadFromUserConfig } from '@/lib/config-service'
import {
  hasGlobalCharacterOutput,
  hasGlobalLocationOutput
} from '@/lib/task/has-output'
import { withTaskUiPayload } from '@/lib/task/ui-payload'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toInteger(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.floor(parsed)
}

function buildAssetHubGenerateImageTaskPayload(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) return {}
  const type = toTrimmedString(input.type)
  const id = toTrimmedString(input.id)
  const appearanceIndex = toInteger(input.appearanceIndex)
  const imageIndex = toInteger(input.imageIndex)

  return {
    ...(type ? { type } : {}),
    ...(id ? { id } : {}),
    ...(appearanceIndex !== null ? { appearanceIndex } : {}),
    ...(imageIndex !== null ? { imageIndex } : {}),
  }
}

export const POST = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = await request.json()
  const taskPayload = buildAssetHubGenerateImageTaskPayload(body)
  const locale = resolveRequiredTaskLocale(request, body)
  const type = typeof taskPayload.type === 'string' ? taskPayload.type : ''
  const id = typeof taskPayload.id === 'string' ? taskPayload.id : ''
  const appearanceIndex = typeof taskPayload.appearanceIndex === 'number'
    ? taskPayload.appearanceIndex
    : null

  if (!type || !id) {
    throw new ApiError('INVALID_PARAMS')
  }

  if (type !== 'character' && type !== 'location') {
    throw new ApiError('INVALID_PARAMS')
  }

  const targetType = type === 'character' ? 'GlobalCharacter' : 'GlobalLocation'
  const hasOutputAtStart = type === 'character'
    ? await hasGlobalCharacterOutput({
      characterId: id,
      appearanceIndex
    })
    : await hasGlobalLocationOutput({
      locationId: id
    })
  const userModelConfig = await getUserModelConfig(session.user.id)
  const imageModel = type === 'character'
    ? userModelConfig.characterModel
    : userModelConfig.locationModel

  let billingPayload: Record<string, unknown>
  try {
    billingPayload = buildImageBillingPayloadFromUserConfig({
      userModelConfig,
      imageModel,
      basePayload: taskPayload,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Image model capability not configured'
    throw new ApiError('INVALID_PARAMS', { code: 'IMAGE_MODEL_CAPABILITY_NOT_CONFIGURED', message })
  }
  const result = await submitTask({
    userId: session.user.id,
    locale,
    requestId: getRequestId(request),
    projectId: 'global-asset-hub',
    type: TASK_TYPE.ASSET_HUB_IMAGE,
    targetType,
    targetId: id,
    payload: withTaskUiPayload(billingPayload, { hasOutputAtStart }),
    dedupeKey: `${TASK_TYPE.ASSET_HUB_IMAGE}:${targetType}:${id}:${appearanceIndex ?? 'na'}`,
    billingInfo: buildDefaultTaskBillingInfo(TASK_TYPE.ASSET_HUB_IMAGE, billingPayload)
  })

  return NextResponse.json(result)
})
