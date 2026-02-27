import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError, getRequestId } from '@/lib/api-errors'
import { submitTask } from '@/lib/task/submitter'
import { resolveRequiredTaskLocale } from '@/lib/task/resolve-locale'
import { TASK_TYPE } from '@/lib/task/types'
import { buildDefaultTaskBillingInfo } from '@/lib/billing'
import { hasPanelLipSyncOutput } from '@/lib/task/has-output'
import { withTaskUiPayload } from '@/lib/task/ui-payload'
import { composeModelKey, parseModelKeyStrict } from '@/lib/model-config-contract'

const DEFAULT_LIPSYNC_MODEL_KEY = composeModelKey('fal', 'fal-ai/kling-video/lipsync/audio-to-video')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function buildLipSyncTaskPayload(input: unknown, lipSyncModel: string): Record<string, unknown> {
  if (!isRecord(input)) {
    return { lipSyncModel }
  }
  const storyboardId = typeof input.storyboardId === 'string' ? input.storyboardId.trim() : ''
  const panelIndex =
    typeof input.panelIndex === 'number' && Number.isFinite(input.panelIndex)
      ? Math.floor(input.panelIndex)
      : null
  const voiceLineId = typeof input.voiceLineId === 'string' ? input.voiceLineId.trim() : ''

  return {
    ...(storyboardId ? { storyboardId } : {}),
    ...(panelIndex !== null ? { panelIndex } : {}),
    ...(voiceLineId ? { voiceLineId } : {}),
    lipSyncModel,
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
  const storyboardId = isRecord(body) && typeof body.storyboardId === 'string' ? body.storyboardId : null
  const panelIndex = isRecord(body) ? body.panelIndex : null
  const voiceLineId = isRecord(body) && typeof body.voiceLineId === 'string' ? body.voiceLineId : null
  const requestedLipSyncModel =
    isRecord(body) && typeof body.lipSyncModel === 'string'
      ? body.lipSyncModel.trim()
      : ''

  if (!storyboardId || panelIndex === undefined || !voiceLineId) {
    throw new ApiError('INVALID_PARAMS')
  }
  if (requestedLipSyncModel && !parseModelKeyStrict(requestedLipSyncModel)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'MODEL_KEY_INVALID',
      field: 'lipSyncModel',
    })
  }

  const pref = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
    select: { lipSyncModel: true },
  })
  const preferredLipSyncModel = typeof pref?.lipSyncModel === 'string' ? pref.lipSyncModel.trim() : ''
  const resolvedLipSyncModel = requestedLipSyncModel || preferredLipSyncModel || DEFAULT_LIPSYNC_MODEL_KEY
  if (!parseModelKeyStrict(resolvedLipSyncModel)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'MODEL_KEY_INVALID',
      field: 'lipSyncModel',
    })
  }

  const panel = await prisma.novelPromotionPanel.findFirst({
    where: { storyboardId, panelIndex: Number(panelIndex) },
    select: { id: true },
  })

  if (!panel) {
    throw new ApiError('NOT_FOUND')
  }

  const payload = buildLipSyncTaskPayload(body, resolvedLipSyncModel)

  const result = await submitTask({
    userId: session.user.id,
    locale,
    requestId: getRequestId(request),
    projectId,
    type: TASK_TYPE.LIP_SYNC,
    targetType: 'NovelPromotionPanel',
    targetId: panel.id,
    payload: withTaskUiPayload(payload, {
      hasOutputAtStart: await hasPanelLipSyncOutput(panel.id),
    }),
    dedupeKey: `lip_sync:${panel.id}:${voiceLineId}`,
    billingInfo: buildDefaultTaskBillingInfo(TASK_TYPE.LIP_SYNC, payload),
  })

  return NextResponse.json(result)
})
