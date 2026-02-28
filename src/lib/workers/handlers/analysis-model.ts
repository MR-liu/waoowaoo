type TaskPayload = Record<string, unknown>

function readOptionalString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function resolveTaskAnalysisModel(payload: TaskPayload, configuredModel: string | null | undefined): string {
  const payloadModel = readOptionalString(payload.model)
  const payloadAnalysisModel = readOptionalString(payload.analysisModel)

  if (payloadModel && payloadAnalysisModel && payloadModel !== payloadAnalysisModel) {
    throw new Error('TASK_PAYLOAD_MODEL_MISMATCH: payload.model must equal payload.analysisModel when both are provided')
  }

  const normalizedConfiguredModel = readOptionalString(configuredModel)
  return payloadAnalysisModel || payloadModel || normalizedConfiguredModel
}
