import { logError as _ulogError } from '@/lib/logging/core'

export type SideEffectWarningCode =
  | 'PROJECT_LAST_ACCESSED_UPDATE_FAILED'
  | 'PROJECT_LAST_EPISODE_UPDATE_FAILED'
  | 'PROJECT_DELETE_CANDIDATE_PARSE_FAILED'
  | 'NOVEL_ASSET_LABEL_UPDATE_FAILED'
  | 'ASSET_HUB_LABEL_UPDATE_FAILED'

export type SideEffectWarning = {
  code: SideEffectWarningCode
  target: string
  detail: string
}

type RunSideEffectWithWarningInput = {
  code: SideEffectWarningCode
  target: string
  logPrefix: string
  run: () => Promise<void>
}

const MAX_WARNING_DETAIL_LENGTH = 280

function normalizeErrorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

function trimDetail(detail: string): string {
  if (detail.length <= MAX_WARNING_DETAIL_LENGTH) {
    return detail
  }
  return `${detail.slice(0, MAX_WARNING_DETAIL_LENGTH)}...`
}

export async function runSideEffectWithWarning(
  input: RunSideEffectWithWarningInput,
): Promise<SideEffectWarning | null> {
  try {
    await input.run()
    return null
  } catch (error: unknown) {
    const detail = trimDetail(normalizeErrorDetail(error))
    _ulogError(`${input.logPrefix} target=${input.target} detail=${detail}`, error)
    return {
      code: input.code,
      target: input.target,
      detail,
    }
  }
}
