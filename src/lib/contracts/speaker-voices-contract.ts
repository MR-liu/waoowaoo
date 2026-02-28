export type SpeakerVoiceConfig = {
  voiceType?: string
  voiceId?: string
  audioUrl: string
}

export class SpeakerVoicesContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SpeakerVoicesContractError'
  }
}

function assertSpeakerVoiceConfig(value: unknown, fieldName: string): asserts value is SpeakerVoiceConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SpeakerVoicesContractError(`${fieldName} must be an object`)
  }

  const maybeConfig = value as Record<string, unknown>
  const audioUrl = maybeConfig.audioUrl
  if (typeof audioUrl !== 'string' || !audioUrl.trim()) {
    throw new SpeakerVoicesContractError(`${fieldName}.audioUrl must be a non-empty string`)
  }

  if (maybeConfig.voiceType !== undefined && typeof maybeConfig.voiceType !== 'string') {
    throw new SpeakerVoicesContractError(`${fieldName}.voiceType must be a string`)
  }
  if (maybeConfig.voiceId !== undefined && typeof maybeConfig.voiceId !== 'string') {
    throw new SpeakerVoicesContractError(`${fieldName}.voiceId must be a string`)
  }
}

export function decodeSpeakerVoicesFromDb(
  raw: string | null | undefined,
  fieldName = 'speakerVoices',
): Record<string, SpeakerVoiceConfig> {
  if (typeof raw !== 'string' || !raw.trim()) {
    return {}
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new SpeakerVoicesContractError(`${fieldName} must be valid JSON`)
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SpeakerVoicesContractError(`${fieldName} must be a JSON object`)
  }

  const entries = Object.entries(parsed as Record<string, unknown>)
  for (const [speaker, config] of entries) {
    assertSpeakerVoiceConfig(config, `${fieldName}.${speaker}`)
  }
  return parsed as Record<string, SpeakerVoiceConfig>
}
