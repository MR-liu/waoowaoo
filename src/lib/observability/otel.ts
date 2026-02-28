import { context, SpanStatusCode, trace, type Attributes, type Span } from '@opentelemetry/api'
import type { TaskTelemetryContextInput } from '@/lib/task/metrics'

const tracer = trace.getTracer('waoowaoo.observability')

type SpanAttributeValue = string | number | boolean | null | undefined

function normalizeAttributeValue(value: SpanAttributeValue): string | number | boolean {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'boolean') return value
  if (typeof value === 'string' && value.trim()) return value.trim()
  return 'unknown'
}

function buildIdentityAttributes(input: TaskTelemetryContextInput): Attributes {
  return {
    'waoowaoo.request_id': normalizeAttributeValue(input.requestId),
    'waoowaoo.task_id': normalizeAttributeValue(input.taskId),
    'waoowaoo.project_id': normalizeAttributeValue(input.projectId),
    'waoowaoo.user_id': normalizeAttributeValue(input.userId),
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

export function startObservedSpan(params: {
  name: string
  context: TaskTelemetryContextInput
  attributes?: Record<string, SpanAttributeValue>
}): Span {
  const span = tracer.startSpan(params.name)
  span.setAttributes(buildIdentityAttributes(params.context))
  if (params.attributes) {
    const normalized: Attributes = {}
    for (const [key, value] of Object.entries(params.attributes)) {
      normalized[key] = normalizeAttributeValue(value)
    }
    span.setAttributes(normalized)
  }
  return span
}

export function markObservedSpanSuccess(span: Span): void {
  span.setStatus({
    code: SpanStatusCode.OK,
  })
}

export function markObservedSpanError(span: Span, error: unknown): void {
  if (error instanceof Error) {
    span.recordException(error)
  } else {
    span.recordException({
      name: typeof error,
      message: String(error),
    })
  }
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: toErrorMessage(error),
  })
}

export async function withObservedSpan<T>(params: {
  name: string
  context: TaskTelemetryContextInput
  attributes?: Record<string, SpanAttributeValue>
  run: (span: Span) => Promise<T>
}): Promise<T> {
  const span = startObservedSpan({
    name: params.name,
    context: params.context,
    attributes: params.attributes,
  })
  const spanContext = trace.setSpan(context.active(), span)
  try {
    const result = await context.with(spanContext, async () => await params.run(span))
    markObservedSpanSuccess(span)
    return result
  } catch (error) {
    markObservedSpanError(span, error)
    throw error
  } finally {
    span.end()
  }
}
