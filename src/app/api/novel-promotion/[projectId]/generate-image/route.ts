import { NextRequest, NextResponse } from 'next/server'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError, getRequestId } from '@/lib/api-errors'
import { submitTask } from '@/lib/task/submitter'
import { resolveRequiredTaskLocale } from '@/lib/task/resolve-locale'
import { TASK_TYPE } from '@/lib/task/types'
import { buildDefaultTaskBillingInfo } from '@/lib/billing'
import { withTaskUiPayload } from '@/lib/task/ui-payload'
import { getProjectModelConfig, buildImageBillingPayload } from '@/lib/config-service'
import {
  hasCharacterAppearanceOutput,
  hasLocationImageOutput
} from '@/lib/task/has-output'

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

function buildGenerateImageTaskPayload(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) return {}

  const type = toTrimmedString(input.type)
  const id = toTrimmedString(input.id)
  const appearanceId = toTrimmedString(input.appearanceId)
  const appearanceIndex = toInteger(input.appearanceIndex)
  const imageIndex = toInteger(input.imageIndex)
  const descriptionIndex = toInteger(input.descriptionIndex)

  return {
    ...(type ? { type } : {}),
    ...(id ? { id } : {}),
    ...(appearanceId ? { appearanceId } : {}),
    ...(appearanceIndex !== null ? { appearanceIndex } : {}),
    ...(imageIndex !== null ? { imageIndex } : {}),
    ...(descriptionIndex !== null ? { descriptionIndex } : {}),
  }
}

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = await request.json()
  const taskPayload = buildGenerateImageTaskPayload(body)
  const locale = resolveRequiredTaskLocale(request, body)
  const type = typeof taskPayload.type === 'string' ? taskPayload.type : ''
  const id = typeof taskPayload.id === 'string' ? taskPayload.id : ''
  const appearanceId = typeof taskPayload.appearanceId === 'string' ? taskPayload.appearanceId : ''

  if (!type || !id) {
    throw new ApiError('INVALID_PARAMS')
  }

  if (type !== 'character' && type !== 'location') {
    throw new ApiError('INVALID_PARAMS')
  }

  const taskType = type === 'character' ? TASK_TYPE.IMAGE_CHARACTER : TASK_TYPE.IMAGE_LOCATION
  const targetType = type === 'character' ? 'CharacterAppearance' : 'LocationImage'
  const targetId = type === 'character' ? (appearanceId || id) : id

  if (!targetId) {
    throw new ApiError('INVALID_PARAMS')
  }
  const appearanceIndex = typeof taskPayload.appearanceIndex === 'number'
    ? taskPayload.appearanceIndex
    : null
  const imageIndex = typeof taskPayload.imageIndex === 'number'
    ? taskPayload.imageIndex
    : null
  const hasOutputAtStart = type === 'character'
    ? await hasCharacterAppearanceOutput({
      appearanceId: targetId,
      characterId: id,
      appearanceIndex
    })
    : await hasLocationImageOutput({
      locationId: id,
      imageIndex
    })

  const projectModelConfig = await getProjectModelConfig(projectId, session.user.id)
  const imageModel = type === 'character'
    ? projectModelConfig.characterModel
    : projectModelConfig.locationModel

  let billingPayload: Record<string, unknown>
  try {
    billingPayload = await buildImageBillingPayload({
      projectId,
      userId: session.user.id,
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
    projectId,
    type: taskType,
    targetType,
    targetId,
    payload: withTaskUiPayload(billingPayload, { hasOutputAtStart }),
    dedupeKey: `${taskType}:${targetId}`,
    billingInfo: buildDefaultTaskBillingInfo(taskType, billingPayload)
  })

  return NextResponse.json(result)
})
