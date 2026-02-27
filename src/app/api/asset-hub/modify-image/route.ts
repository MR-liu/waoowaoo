import { NextRequest, NextResponse } from 'next/server'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError, getRequestId } from '@/lib/api-errors'
import { submitTask } from '@/lib/task/submitter'
import { resolveRequiredTaskLocale } from '@/lib/task/resolve-locale'
import { TASK_TYPE } from '@/lib/task/types'
import { buildDefaultTaskBillingInfo } from '@/lib/billing'
import { getUserModelConfig, buildImageBillingPayloadFromUserConfig } from '@/lib/config-service'
import {
  hasGlobalCharacterAppearanceOutput,
  hasGlobalLocationImageOutput
} from '@/lib/task/has-output'
import { withTaskUiPayload } from '@/lib/task/ui-payload'
import { sanitizeImageInputsForTaskPayload } from '@/lib/media/outbound-image'
import { PRIMARY_APPEARANCE_INDEX } from '@/lib/constants'

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

function buildAssetHubModifyTaskPayload(
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
  const id = toTrimmedString(input.id)
  const modifyPrompt = toTrimmedString(input.modifyPrompt)
  const appearanceIndex = toInteger(input.appearanceIndex)
  const imageIndex = toInteger(input.imageIndex)

  return {
    ...(type ? { type } : {}),
    ...(id ? { id } : {}),
    ...(modifyPrompt ? { modifyPrompt } : {}),
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

export const POST = apiHandler(async (request: NextRequest) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = await request.json()
  const locale = resolveRequiredTaskLocale(request, body)
  const type = isRecord(body) ? toTrimmedString(body.type) : ''
  const modifyPrompt = isRecord(body) ? toTrimmedString(body.modifyPrompt) : ''
  const id = isRecord(body) ? toTrimmedString(body.id) : ''
  const appearanceIndex = isRecord(body) ? toInteger(body.appearanceIndex) : null
  const imageIndex = isRecord(body) ? toInteger(body.imageIndex) : null

  if (!type || !modifyPrompt || !id) {
    throw new ApiError('INVALID_PARAMS')
  }

  if (type !== 'character' && type !== 'location') {
    throw new ApiError('INVALID_PARAMS')
  }

  const extraImageAudit = sanitizeImageInputsForTaskPayload(
    isRecord(body) && Array.isArray(body.extraImageUrls) ? body.extraImageUrls : [],
  )
  const rejectedRelativePathCount = extraImageAudit.issues.filter(
    (issue) => issue.reason === 'relative_path_rejected',
  ).length
  if (rejectedRelativePathCount > 0) {
    throw new ApiError('INVALID_PARAMS')
  }

  const normalizedAppearanceIndex = appearanceIndex ?? PRIMARY_APPEARANCE_INDEX
  const normalizedImageIndex = imageIndex ?? 0
  const targetType = type === 'character' ? 'GlobalCharacterAppearance' : 'GlobalLocationImage'
  const targetId = type === 'character'
    ? `${id}:${normalizedAppearanceIndex}:${normalizedImageIndex}`
    : `${id}:${normalizedImageIndex}`
  const hasOutputAtStart = type === 'character'
    ? await hasGlobalCharacterAppearanceOutput({
      targetId,
      characterId: id,
      appearanceIndex: normalizedAppearanceIndex,
      imageIndex: normalizedImageIndex
    })
    : await hasGlobalLocationImageOutput({
      targetId,
      locationId: id,
      imageIndex: normalizedImageIndex
    })

  const payload = buildAssetHubModifyTaskPayload(body, extraImageAudit.normalized, extraImageAudit.issues)

  const userModelConfig = await getUserModelConfig(session.user.id)
  const imageModel = userModelConfig.editModel

  let billingPayload: Record<string, unknown>
  try {
    billingPayload = buildImageBillingPayloadFromUserConfig({
      userModelConfig,
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
    projectId: 'global-asset-hub',
    type: TASK_TYPE.ASSET_HUB_MODIFY,
    targetType,
    targetId,
    payload: withTaskUiPayload(billingPayload, {
      intent: 'modify',
      hasOutputAtStart
    }),
    dedupeKey: `${TASK_TYPE.ASSET_HUB_MODIFY}:${targetId}`,
    billingInfo: buildDefaultTaskBillingInfo(TASK_TYPE.ASSET_HUB_MODIFY, billingPayload)
  })

  return NextResponse.json(result)
})
