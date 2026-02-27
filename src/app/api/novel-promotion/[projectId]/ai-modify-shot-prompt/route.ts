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

function sanitizeReferencedAssets(value: unknown): unknown[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => !!item && typeof item === 'object')
    .slice(0, 20)
}

function buildModifyShotPromptTaskPayload(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) return {}

  const panelId = toTrimmedString(input.panelId)
  const episodeId = toTrimmedString(input.episodeId)
  const currentPrompt = toTrimmedString(input.currentPrompt)
  const currentVideoPrompt = toTrimmedString(input.currentVideoPrompt)
  const modifyInstruction = toTrimmedString(input.modifyInstruction)
  const referencedAssets = sanitizeReferencedAssets(input.referencedAssets)

  return {
    ...(panelId ? { panelId } : {}),
    ...(episodeId ? { episodeId } : {}),
    ...(currentPrompt ? { currentPrompt } : {}),
    ...(currentVideoPrompt ? { currentVideoPrompt } : {}),
    ...(modifyInstruction ? { modifyInstruction } : {}),
    ...(referencedAssets.length > 0 ? { referencedAssets } : {}),
  }
}

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params
  const authResult = await requireProjectAuth(projectId)
  if (isErrorResponse(authResult)) return authResult
  const { session, project } = authResult

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
  const taskPayload = buildModifyShotPromptTaskPayload(body)
  if (parsedRuntimeOptions.options.model) {
    taskPayload.analysisModel = parsedRuntimeOptions.options.model
  }
  const currentPrompt = typeof taskPayload.currentPrompt === 'string' ? taskPayload.currentPrompt : ''
  const modifyInstruction =
    typeof taskPayload.modifyInstruction === 'string' ? taskPayload.modifyInstruction : ''
  if (!currentPrompt || !modifyInstruction) {
    throw new ApiError('INVALID_PARAMS')
  }
  if (project.mode !== 'novel-promotion') {
    throw new ApiError('INVALID_PARAMS')
  }

  const panelId = typeof taskPayload.panelId === 'string' ? taskPayload.panelId : ''
  const episodeId = typeof taskPayload.episodeId === 'string' ? taskPayload.episodeId : ''

  const asyncTaskResponse = await maybeSubmitLLMTask({
    request,
    userId: session.user.id,
    projectId,
    episodeId: episodeId || null,
    type: TASK_TYPE.AI_MODIFY_SHOT_PROMPT,
    targetType: panelId ? 'NovelPromotionPanel' : 'NovelPromotionProject',
    targetId: panelId || projectId,
    routePath: `/api/novel-promotion/${projectId}/ai-modify-shot-prompt`,
    body: taskPayload,
    dedupeKey: panelId ? `ai_modify_shot_prompt:${panelId}` : `ai_modify_shot_prompt:${projectId}`})
  if (asyncTaskResponse) return asyncTaskResponse

  throw new ApiError('INVALID_PARAMS')
})
