import { ApiError } from '@/lib/api-errors'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export async function readRequestJsonObject(request: Request): Promise<Record<string, unknown>> {
  let parsed: unknown
  try {
    parsed = await request.json()
  } catch {
    throw new ApiError('INVALID_PARAMS', {
      code: 'INVALID_JSON_BODY',
      message: '请求体必须是合法 JSON 对象',
    })
  }

  if (!isRecord(parsed)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'INVALID_JSON_BODY',
      message: '请求体必须是 JSON 对象',
    })
  }

  return parsed
}
