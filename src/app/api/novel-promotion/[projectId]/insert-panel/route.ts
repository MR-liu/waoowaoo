import { NextRequest, NextResponse } from 'next/server'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError, getRequestId } from '@/lib/api-errors'
import { submitTask } from '@/lib/task/submitter'
import { resolveRequiredTaskLocale } from '@/lib/task/resolve-locale'
import { TASK_TYPE } from '@/lib/task/types'
import { buildDefaultTaskBillingInfo } from '@/lib/billing'
import { getProjectModelConfig } from '@/lib/config-service'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function buildInsertPanelTaskPayload(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) return {}

  const storyboardId = toTrimmedString(input.storyboardId)
  const insertAfterPanelId = toTrimmedString(input.insertAfterPanelId)
  const userInputRaw = toTrimmedString(input.userInput)
  const promptRaw = toTrimmedString(input.prompt)
  const userInput = userInputRaw || promptRaw

  return {
    ...(storyboardId ? { storyboardId } : {}),
    ...(insertAfterPanelId ? { insertAfterPanelId } : {}),
    ...(userInput ? { userInput } : {}),
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
  const taskPayload = buildInsertPanelTaskPayload(body)
  const locale = resolveRequiredTaskLocale(request, body)
  const storyboardId = typeof taskPayload.storyboardId === 'string' ? taskPayload.storyboardId : ''
  const insertAfterPanelId = typeof taskPayload.insertAfterPanelId === 'string' ? taskPayload.insertAfterPanelId : ''
  const userInput = typeof taskPayload.userInput === 'string' ? taskPayload.userInput : ''

  if (!storyboardId || !insertAfterPanelId || !userInput) {
    throw new ApiError('INVALID_PARAMS', {
    })
  }

  const projectModelConfig = await getProjectModelConfig(projectId, session.user.id)
  const billingPayload = {
    ...taskPayload,
    ...(projectModelConfig.analysisModel ? { analysisModel: projectModelConfig.analysisModel } : {}),
  }

  const result = await submitTask({
    userId: session.user.id,
    locale,
    requestId: getRequestId(request),
    projectId,
    type: TASK_TYPE.INSERT_PANEL,
    targetType: 'NovelPromotionStoryboard',
    targetId: storyboardId,
    payload: billingPayload,
    dedupeKey: `insert_panel:${storyboardId}:${insertAfterPanelId}`,
    billingInfo: buildDefaultTaskBillingInfo(TASK_TYPE.INSERT_PANEL, billingPayload),
  })

  return NextResponse.json(result)
})
