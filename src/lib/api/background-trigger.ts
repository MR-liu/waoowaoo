import { logError as _ulogError } from '@/lib/logging/core'

export type BackgroundTriggerWarning = {
  code: 'BACKGROUND_TRIGGER_FAILED'
  target: string
  detail: string
  status?: number
}

type TriggerBackgroundJsonRequestInput = {
  url: string
  init: RequestInit
  target: string
  logPrefix: string
}

const MAX_ERROR_DETAIL_LENGTH = 280

function trimDetail(detail: string): string {
  if (detail.length <= MAX_ERROR_DETAIL_LENGTH) {
    return detail
  }
  return `${detail.slice(0, MAX_ERROR_DETAIL_LENGTH)}...`
}

function normalizeErrorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

async function readResponseDetail(response: Response): Promise<string | null> {
  try {
    const raw = await response.text()
    const normalized = raw.trim()
    if (!normalized) {
      return null
    }
    return trimDetail(normalized)
  } catch (error: unknown) {
    return `failed_to_read_response_body:${normalizeErrorDetail(error)}`
  }
}

export async function triggerBackgroundJsonRequest(
  input: TriggerBackgroundJsonRequestInput,
): Promise<BackgroundTriggerWarning | null> {
  try {
    const response = await fetch(input.url, input.init)
    if (response.ok) {
      return null
    }

    const responseDetail = await readResponseDetail(response)
    const detail = responseDetail
      ? `trigger returned status=${response.status}, body=${responseDetail}`
      : `trigger returned status=${response.status}`
    _ulogError(`${input.logPrefix} target=${input.target} detail=${detail}`)
    return {
      code: 'BACKGROUND_TRIGGER_FAILED',
      target: input.target,
      status: response.status,
      detail,
    }
  } catch (error: unknown) {
    const detail = normalizeErrorDetail(error)
    _ulogError(`${input.logPrefix} target=${input.target} detail=${detail}`, error)
    return {
      code: 'BACKGROUND_TRIGGER_FAILED',
      target: input.target,
      detail,
    }
  }
}
