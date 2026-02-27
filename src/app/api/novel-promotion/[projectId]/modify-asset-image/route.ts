import { NextRequest, NextResponse } from 'next/server'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError, getRequestId } from '@/lib/api-errors'
import { submitTask } from '@/lib/task/submitter'
import { resolveRequiredTaskLocale } from '@/lib/task/resolve-locale'
import { TASK_TYPE } from '@/lib/task/types'
import { buildDefaultTaskBillingInfo } from '@/lib/billing'
import { withTaskUiPayload } from '@/lib/task/ui-payload'
import { getProjectModelConfig, buildImageBillingPayload } from '@/lib/config-service'
import { sanitizeImageInputsForTaskPayload } from '@/lib/media/outbound-image'
import {
  hasCharacterAppearanceOutput,
  hasLocationImageOutput
} from '@/lib/task/has-output'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function toInteger(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.floor(parsed)
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function buildModifyAssetTaskPayload(
  input: unknown,
  extraImageUrls: string[],
  extraImageIssues: Array<Record<string, unknown>>,
): Record<string, unknown> {
  if (!isRecord(input)) {
    return {
      extraImageUrls,
      meta: {
        outboundImageInputAudit: {
          extraImageUrls: extraImageIssues,
        },
      },
    }
  }

  const type = toTrimmedString(input.type)
  const modifyPrompt = toTrimmedString(input.modifyPrompt)
  const appearanceId = toTrimmedString(input.appearanceId)
  const characterId = toTrimmedString(input.characterId || input.id)
  const locationImageId = toTrimmedString(input.locationImageId)
  const locationId = toTrimmedString(input.locationId || input.id)
  const appearanceIndex = toInteger(input.appearanceIndex)
  const imageIndex = toInteger(input.imageIndex)

  return {
    ...(type ? { type } : {}),
    ...(modifyPrompt ? { modifyPrompt } : {}),
    ...(appearanceId ? { appearanceId } : {}),
    ...(characterId ? { characterId } : {}),
    ...(locationImageId ? { locationImageId } : {}),
    ...(locationId ? { locationId } : {}),
    ...(appearanceIndex !== null ? { appearanceIndex } : {}),
    ...(imageIndex !== null ? { imageIndex } : {}),
    extraImageUrls,
    meta: {
      ...toObject(input.meta),
      outboundImageInputAudit: {
        extraImageUrls: extraImageIssues,
      },
    },
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
  const locale = resolveRequiredTaskLocale(request, body)
  const type = isRecord(body) ? toTrimmedString(body.type) : ''
  const modifyPrompt = isRecord(body) ? toTrimmedString(body.modifyPrompt) : ''

  if (!type || !modifyPrompt) {
    throw new ApiError('INVALID_PARAMS')
  }

  if (type !== 'character' && type !== 'location') {
    throw new ApiError('INVALID_PARAMS')
  }

  const appearanceId = isRecord(body) ? toTrimmedString(body.appearanceId) : ''
  const characterId = isRecord(body) ? toTrimmedString(body.characterId || body.id) : ''
  const locationImageId = isRecord(body) ? toTrimmedString(body.locationImageId) : ''
  const locationId = isRecord(body) ? toTrimmedString(body.locationId || body.id) : ''

  const targetType = type === 'character' ? 'CharacterAppearance' : 'LocationImage'
  const targetId = type === 'character'
    ? (appearanceId || characterId)
    : (locationImageId || locationId)

  if (!targetId) {
    throw new ApiError('INVALID_PARAMS')
  }
  const appearanceIndex = isRecord(body) ? toInteger(body.appearanceIndex) : null
  const imageIndex = isRecord(body) ? toInteger(body.imageIndex) : null

  const hasOutputAtStart = type === 'character'
    ? await hasCharacterAppearanceOutput({
      appearanceId: appearanceId || null,
      characterId: characterId || null,
      appearanceIndex
    })
    : await hasLocationImageOutput({
      imageId: locationImageId || null,
      locationId: locationId || null,
      imageIndex
    })

  const extraImageAudit = sanitizeImageInputsForTaskPayload(
    isRecord(body) && Array.isArray(body.extraImageUrls) ? body.extraImageUrls : [],
  )
  const rejectedRelativePathCount = extraImageAudit.issues.filter(
    (issue) => issue.reason === 'relative_path_rejected',
  ).length
  if (rejectedRelativePathCount > 0) {
    throw new ApiError('INVALID_PARAMS')
  }

  const payload = buildModifyAssetTaskPayload(body, extraImageAudit.normalized, extraImageAudit.issues)

  const projectModelConfig = await getProjectModelConfig(projectId, session.user.id)
  const imageModel = projectModelConfig.editModel

  let billingPayload: Record<string, unknown>
  try {
    billingPayload = await buildImageBillingPayload({
      projectId,
      userId: session.user.id,
      imageModel,
      basePayload: payload,
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
    type: TASK_TYPE.MODIFY_ASSET_IMAGE,
    targetType,
    targetId,
    payload: withTaskUiPayload(billingPayload, {
      intent: 'modify',
      hasOutputAtStart
    }),
    dedupeKey: `modify_asset_image:${targetType}:${targetId}:${imageIndex ?? 'na'}`,
    billingInfo: buildDefaultTaskBillingInfo(TASK_TYPE.MODIFY_ASSET_IMAGE, billingPayload)
  })

  return NextResponse.json(result)
})
