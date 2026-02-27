import { NextRequest, NextResponse } from 'next/server'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError, getRequestId } from '@/lib/api-errors'
import { prisma } from '@/lib/prisma'
import { submitTask } from '@/lib/task/submitter'
import { resolveRequiredTaskLocale } from '@/lib/task/resolve-locale'
import { TASK_TYPE } from '@/lib/task/types'
import { buildDefaultTaskBillingInfo } from '@/lib/billing'
import { hasPanelImageOutput } from '@/lib/task/has-output'
import { withTaskUiPayload } from '@/lib/task/ui-payload'
import { getProjectModelConfig, buildImageBillingPayload } from '@/lib/config-service'
import { sanitizeImageInputsForTaskPayload } from '@/lib/media/outbound-image'

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

function toObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function buildModifyStoryboardTaskPayload(input: {
  body: unknown
  panelId: string
  panelIndex: number
  extraImageUrls: string[]
  selectedAssets: Array<Record<string, unknown>>
  extraImageIssues: Array<Record<string, unknown>>
  selectedAssetIssues: Array<Record<string, unknown>>
}): Record<string, unknown> {
  const body = isRecord(input.body) ? input.body : {}
  const storyboardId = toTrimmedString(body.storyboardId)
  const modifyPrompt = toTrimmedString(body.modifyPrompt)

  return {
    type: 'storyboard',
    panelId: input.panelId,
    panelIndex: input.panelIndex,
    ...(storyboardId ? { storyboardId } : {}),
    ...(modifyPrompt ? { modifyPrompt } : {}),
    extraImageUrls: input.extraImageUrls,
    selectedAssets: input.selectedAssets,
    meta: {
      ...toObject(body.meta),
      outboundImageInputAudit: {
        extraImageUrls: input.extraImageIssues,
        selectedAssets: input.selectedAssetIssues,
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
  const storyboardId = isRecord(body) ? toTrimmedString(body.storyboardId) : ''
  const panelIndex = isRecord(body) ? toInteger(body.panelIndex) : null
  const modifyPrompt = isRecord(body) ? toTrimmedString(body.modifyPrompt) : ''

  if (!storyboardId || panelIndex === null || !modifyPrompt) {
    throw new ApiError('INVALID_PARAMS')
  }

  const panel = await prisma.novelPromotionPanel.findFirst({
    where: {
      storyboardId,
      panelIndex
    },
    select: {
      id: true
    }
  })
  if (!panel) {
    throw new ApiError('NOT_FOUND')
  }

  const extraImageAudit = sanitizeImageInputsForTaskPayload(
    isRecord(body) && Array.isArray(body.extraImageUrls) ? body.extraImageUrls : [],
  )
  const selectedAssetsRaw = isRecord(body) && Array.isArray(body.selectedAssets) ? body.selectedAssets : []
  const selectedAssetIssues: Array<Record<string, unknown>> = []
  const normalizedSelectedAssets: Array<Record<string, unknown>> = []
  for (let assetIndex = 0; assetIndex < selectedAssetsRaw.length; assetIndex++) {
    const asset = selectedAssetsRaw[assetIndex]
    if (!isRecord(asset)) continue
    const imageUrl = asset.imageUrl
    const audit = sanitizeImageInputsForTaskPayload([imageUrl])
    for (const issue of audit.issues) {
      selectedAssetIssues.push({
        assetIndex,
        ...issue
      })
    }
    const normalizedAsset: Record<string, unknown> = {}
    const assetId = toTrimmedString(asset.id)
    const assetType = toTrimmedString(asset.type)
    const normalizedUrl = audit.normalized[0]
    if (assetId) normalizedAsset.id = assetId
    if (assetType) normalizedAsset.type = assetType
    if (normalizedUrl) normalizedAsset.imageUrl = normalizedUrl
    if (Object.keys(normalizedAsset).length > 0) {
      normalizedSelectedAssets.push(normalizedAsset)
    }
  }

  const rejectedRelativePathCount = [
    ...extraImageAudit.issues,
    ...selectedAssetIssues,
  ].filter((issue) => issue.reason === 'relative_path_rejected').length
  if (rejectedRelativePathCount > 0) {
    throw new ApiError('INVALID_PARAMS')
  }

  const payload = buildModifyStoryboardTaskPayload({
    body,
    panelId: panel.id,
    panelIndex,
    extraImageUrls: extraImageAudit.normalized,
    selectedAssets: normalizedSelectedAssets,
    extraImageIssues: extraImageAudit.issues,
    selectedAssetIssues,
  })
  const hasOutputAtStart = await hasPanelImageOutput(panel.id)

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
    targetType: 'NovelPromotionPanel',
    targetId: panel.id,
    payload: withTaskUiPayload(billingPayload, {
      intent: 'modify',
      hasOutputAtStart
    }),
    dedupeKey: `modify_storyboard_image:${panel.id}`,
    billingInfo: buildDefaultTaskBillingInfo(TASK_TYPE.MODIFY_ASSET_IMAGE, billingPayload)
  })

  return NextResponse.json(result)
})
