import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { resolveTaskErrorMessage } from '@/lib/task/error-message'

export type MutationRequestError = Error & {
  status?: number
  payload?: Record<string, unknown>
  detail?: string
}

type ParsedJsonRecord = {
  payload: Record<string, unknown>
  parseError: string | null
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

export async function readResponseJsonRecord(response: Response, context: string): Promise<ParsedJsonRecord> {
  const responseReader = response as Response & { clone?: () => Response; json?: () => Promise<unknown> }
  const jsonReader = typeof responseReader.clone === 'function' ? responseReader.clone() : responseReader
  try {
    if (typeof jsonReader.json !== 'function') {
      return {
        payload: {},
        parseError: `${context}: response.json is not a function`,
      }
    }
    const data = await jsonReader.json()
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return {
        payload: data as Record<string, unknown>,
        parseError: null,
      }
    }
    return {
      payload: {},
      parseError: `${context}: response JSON is not an object`,
    }
  } catch (error) {
    return {
      payload: {},
      parseError: `${context}: invalid JSON response (${toErrorMessage(error)})`,
    }
  }
}

function createRequestError(
  status: number,
  payload: Record<string, unknown>,
  fallbackMessage: string,
  parseError: string | null = null,
): MutationRequestError {
  const baseMessage = resolveTaskErrorMessage(payload, fallbackMessage)
  const message = parseError ? `${baseMessage}; ${parseError}` : baseMessage
  const error = new Error(message) as MutationRequestError
  error.status = status
  error.payload = parseError
    ? {
      ...payload,
      parseError,
    }
    : payload
  if (typeof payload.detail === 'string') {
    error.detail = payload.detail
  } else if (parseError) {
    error.detail = parseError
  }
  return error
}

export async function requestJsonWithError<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  const response = await fetch(input, init)
  const parsed = await readResponseJsonRecord(response, 'query mutation response payload')
  if (!response.ok) {
    throw createRequestError(response.status, parsed.payload, fallbackMessage, parsed.parseError)
  }
  if (parsed.parseError) {
    throw createRequestError(response.status, parsed.payload, fallbackMessage, parsed.parseError)
  }
  return parsed.payload as T
}

export async function requestVoidWithError(
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackMessage: string,
): Promise<void> {
  const response = await fetch(input, init)
  if (response.ok) return
  const parsed = await readResponseJsonRecord(response, 'query mutation error payload')
  throw createRequestError(response.status, parsed.payload, fallbackMessage, parsed.parseError)
}

export async function requestTaskResponseWithError(
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackMessage: string,
): Promise<Response> {
  const response = await fetch(input, init)
  if (response.ok) return response
  const parsed = await readResponseJsonRecord(response, 'query mutation task response error payload')
  throw createRequestError(response.status, parsed.payload, fallbackMessage, parsed.parseError)
}

export async function requestBlobWithError(
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackMessage: string,
): Promise<Blob> {
  const response = await fetch(input, init)
  if (response.ok) {
    return await response.blob()
  }

  const parsed = await readResponseJsonRecord(response, 'query mutation blob error payload')
  throw createRequestError(response.status, parsed.payload, fallbackMessage, parsed.parseError)
}

export async function invalidateQueryTemplates(
  queryClient: QueryClient,
  templates: QueryKey[],
): Promise<void> {
  await Promise.all(
    templates.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  )
}
