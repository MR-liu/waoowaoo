import { createScopedLogger } from '@/lib/logging/core'

const logger = createScopedLogger({ module: 'ai.semantic-search' })

/**
 * Use LLM vision to generate descriptive tags from an image.
 * This is the only AI-powered function; text search is handled
 * directly via Prisma queries in the search route.
 */
export async function autoTagFromImage(imageUrl: string): Promise<string[]> {
  logger.info({
    action: 'search.autotag.start',
    message: 'Auto-tagging from image',
    details: { imageUrl },
  })

  try {
    const { chatCompletionWithVision, getCompletionContent } = await import('@/lib/llm-client')

    const content = getCompletionContent(
      await chatCompletionWithVision(
        'system',
        'openrouter::anthropic/claude-sonnet-4',
        'Analyze this image and return ONLY a JSON array of descriptive tags (strings). Focus on: objects, colors, mood, style, composition, characters, props, environment. Return 5-15 tags. Example: ["sunset","forest","character","sword","dramatic lighting"]',
        [imageUrl],
        { temperature: 0.3 },
      ),
    )

    if (!content) return []

    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const parsed: unknown = JSON.parse(cleaned)

    if (!Array.isArray(parsed)) return []
    return parsed.filter((t: unknown): t is string => typeof t === 'string')
  } catch (error) {
    logger.error({
      action: 'search.autotag.failed',
      message: 'Auto-tagging failed',
      error: error instanceof Error
        ? { name: error.name, message: error.message }
        : { message: String(error) },
    })
    throw error
  }
}
