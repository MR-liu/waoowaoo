import { logWarn as _ulogWarn } from '@/lib/logging/core'

type ReadResponseJsonArgs = {
  response: Response
  context: string
  requestUrl: string
  requestMethod?: string
}

type ReadResponseJsonResult = {
  payload: unknown | null
  parseError: string | null
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

export async function readResponseJsonSafely(args: ReadResponseJsonArgs): Promise<ReadResponseJsonResult> {
  const responseLike = args.response as Response & {
    clone?: () => Response
    json?: () => Promise<unknown>
  }
  const jsonReader =
    typeof responseLike.clone === 'function'
      ? responseLike.clone()
      : responseLike

  try {
    if (typeof jsonReader.json !== 'function') {
      throw new Error('response.json is not a function')
    }
    const payload = await jsonReader.json()
    return { payload, parseError: null }
  } catch (error) {
    const reason = toErrorMessage(error)
    const parseError = `${args.context}: invalid JSON response (${reason})`
    _ulogWarn('[RunStream] response json parse failed', {
      context: args.context,
      requestUrl: args.requestUrl,
      requestMethod: args.requestMethod || 'GET',
      status: args.response.status,
      error: reason,
    })
    return { payload: null, parseError }
  }
}
