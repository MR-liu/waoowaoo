import { BaseImageGenerator, BaseVideoGenerator, type GenerateResult, type ImageGenerateParams, type VideoGenerateParams } from './base'
import { getProviderConfig } from '@/lib/api-config'
import { getImageBase64Cached } from '@/lib/image-cache'
import { imageUrlToBase64 } from '@/lib/cos'

const NEWAPI_TIMEOUT_MS = Number.parseInt(
    process.env.NEWAPI_TIMEOUT_MS || String(20 * 60 * 1000),
    10,
)

type NewApiAspectVariant = 'landscape' | 'portrait' | 'square' | 'four-three' | 'three-four'

type NewApiMultimodalPart = {
    type: 'text'
    text: string
} | {
    type: 'image_url'
    image_url: {
        url: string
    }
}

interface NewApiChatCompletionPayload {
    model: string
    messages: Array<{
        role: 'user'
        content: string | NewApiMultimodalPart[]
    }>
    stream: boolean
}

interface NewApiChatCompletionResponse {
    choices?: Array<{
        message?: {
            content?: string | null
        }
    }>
    error?: {
        message?: string
    }
}

function normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, '')
}

function resolveAspectVariant(
    aspectRatio: string | undefined,
    supported: ReadonlyArray<NewApiAspectVariant>,
): NewApiAspectVariant {
    const normalized = (aspectRatio || '').trim().toLowerCase()
    let candidate: NewApiAspectVariant = 'landscape'

    if (normalized === '9:16' || normalized === '2:3' || normalized === '3:5') {
        candidate = 'portrait'
    } else if (normalized === '1:1') {
        candidate = 'square'
    } else if (normalized === '4:3') {
        candidate = 'four-three'
    } else if (normalized === '3:4') {
        candidate = 'three-four'
    }

    if (supported.includes(candidate)) {
        return candidate
    }
    if (candidate === 'square' || candidate === 'four-three' || candidate === 'three-four') {
        if (supported.includes('portrait')) return 'portrait'
        if (supported.includes('landscape')) return 'landscape'
    }
    return supported[0] || 'landscape'
}

function normalizeImageResolutionSuffix(resolution: string | undefined): string {
    const normalized = (resolution || '').trim().toUpperCase()
    if (normalized === '2K') return '-2k'
    if (normalized === '4K') return '-4k'
    return ''
}

function extractMarkdownImageUrl(content: string): string | null {
    const markdownMatch = content.match(/!\[[^\]]*]\(([^)\s]+)\)/)
    if (markdownMatch && markdownMatch[1]) {
        return markdownMatch[1]
    }
    return null
}

function extractHtmlVideoUrl(content: string): string | null {
    const htmlMatch = content.match(/<video[^>]*\bsrc=['"]([^'"]+)['"][^>]*>/i)
    if (htmlMatch && htmlMatch[1]) {
        return htmlMatch[1]
    }
    return null
}

function extractPlainUrl(content: string): string | null {
    const urlMatch = content.match(/https?:\/\/[^\s'"`)<]+/i)
    if (urlMatch && urlMatch[0]) return urlMatch[0]
    return null
}

function toAbsoluteUrlIfRelative(candidate: string, providerBaseUrl: string): string {
    if (!candidate.startsWith('/')) return candidate
    try {
        const origin = new URL(providerBaseUrl).origin
        return `${origin}${candidate}`
    } catch {
        return candidate
    }
}

async function normalizeImageInputToDataUrl(input: string): Promise<string | null> {
    const normalized = input.trim()
    if (!normalized) return null
    if (normalized.startsWith('data:')) return normalized

    if (
        normalized.startsWith('http://')
        || normalized.startsWith('https://')
        || normalized.startsWith('/')
    ) {
        return await getImageBase64Cached(normalized)
    }

    return `data:image/png;base64,${normalized}`
}

async function normalizeVideoImageToDataUrl(input: string): Promise<string> {
    const normalized = input.trim()
    if (!normalized) throw new Error('NEWAPI_VIDEO_IMAGE_REQUIRED')
    if (normalized.startsWith('data:')) return normalized
    return await imageUrlToBase64(normalized)
}

async function requestNewApiCompletion(input: {
    baseUrl: string
    apiKey: string
    payload: NewApiChatCompletionPayload
}): Promise<string> {
    const response = await fetch(`${normalizeBaseUrl(input.baseUrl)}/chat/completions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${input.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(input.payload),
        signal: AbortSignal.timeout(NEWAPI_TIMEOUT_MS),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`NEWAPI_REQUEST_FAILED: ${response.status} ${errorText.slice(0, 200)}`)
    }

    const data = await response.json() as NewApiChatCompletionResponse
    if (data.error?.message) {
        throw new Error(`NEWAPI_ERROR: ${data.error.message}`)
    }

    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
        throw new Error('NEWAPI_EMPTY_RESPONSE')
    }
    return content
}

export class NewApiImageGenerator extends BaseImageGenerator {
    private providerId: string

    constructor(providerId?: string) {
        super()
        this.providerId = providerId || 'newapi'
    }

    protected async doGenerate(params: ImageGenerateParams): Promise<GenerateResult> {
        const { userId, prompt, referenceImages = [], options = {} } = params
        const config = await getProviderConfig(userId, this.providerId)
        if (!config.baseUrl) {
            throw new Error(`PROVIDER_BASE_URL_MISSING: ${config.id}`)
        }

        const allowedOptionKeys = new Set([
            'provider',
            'modelId',
            'modelKey',
            'aspectRatio',
            'resolution',
            'outputFormat',
            'size',
            'keepOriginalAspectRatio',
        ])
        for (const [key, value] of Object.entries(options)) {
            if (value === undefined) continue
            if (!allowedOptionKeys.has(key)) {
                throw new Error(`NEWAPI_IMAGE_OPTION_UNSUPPORTED: ${key}`)
            }
        }

        const modelId = typeof options.modelId === 'string' && options.modelId.trim()
            ? options.modelId.trim()
            : 'gpt-4o-image-preview'
        const aspectRatio = typeof options.aspectRatio === 'string' ? options.aspectRatio : undefined
        const resolution = typeof options.resolution === 'string' ? options.resolution : undefined

        const normalizedPrompt = prompt.trim()
        if (!normalizedPrompt) {
            throw new Error('NEWAPI_IMAGE_PROMPT_REQUIRED')
        }

        const normalizedReferences = (await Promise.all(
            referenceImages.slice(0, 14).map(async (item) => await normalizeImageInputToDataUrl(item)),
        )).filter((item): item is string => typeof item === 'string' && item.length > 0)

        const content: string | NewApiMultimodalPart[] = normalizedReferences.length === 0
            ? normalizedPrompt
            : [
                { type: 'text', text: normalizedPrompt },
                ...normalizedReferences.map((item) => ({
                    type: 'image_url' as const,
                    image_url: {
                        url: item,
                    },
                })),
            ]

        const responseContent = await requestNewApiCompletion({
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            payload: {
                model: modelId,
                messages: [{ role: 'user', content }],
                stream: false,
            },
        })

        const imageUrl = extractMarkdownImageUrl(responseContent) || extractPlainUrl(responseContent)
        if (!imageUrl) {
            throw new Error('NEWAPI_IMAGE_URL_MISSING')
        }

        return {
            success: true,
            imageUrl: toAbsoluteUrlIfRelative(imageUrl, config.baseUrl),
        }
    }
}

export class NewApiVideoGenerator extends BaseVideoGenerator {
    private providerId: string

    constructor(providerId?: string) {
        super()
        this.providerId = providerId || 'newapi'
    }

    protected async doGenerate(params: VideoGenerateParams): Promise<GenerateResult> {
        const { userId, imageUrl, prompt = '', options = {} } = params
        const config = await getProviderConfig(userId, this.providerId)
        if (!config.baseUrl) {
            throw new Error(`PROVIDER_BASE_URL_MISSING: ${config.id}`)
        }

        const allowedOptionKeys = new Set([
            'provider',
            'modelId',
            'modelKey',
            'aspectRatio',
            'resolution',
            'duration',
            'fps',
            'seed',
            'generateAudio',
            'generationMode',
            'lastFrameImageUrl',
        ])
        for (const [key, value] of Object.entries(options)) {
            if (value === undefined) continue
            if (!allowedOptionKeys.has(key)) {
                throw new Error(`NEWAPI_VIDEO_OPTION_UNSUPPORTED: ${key}`)
            }
        }

        const typedOptions = options as {
            modelId?: string
            aspectRatio?: string
            generationMode?: 'normal' | 'firstlastframe'
            lastFrameImageUrl?: string
        }
        const modelId = typeof typedOptions.modelId === 'string' && typedOptions.modelId.trim()
            ? typedOptions.modelId.trim()
            : 'kling-video-generate'
        const aspectRatio = typedOptions.aspectRatio

        const promptText = prompt.trim() || 'Generate a cinematic video.'

        const firstFrame = await normalizeVideoImageToDataUrl(imageUrl)
        const images: string[] = [firstFrame]

        if (
            typedOptions.generationMode === 'firstlastframe'
            && typeof typedOptions.lastFrameImageUrl === 'string'
            && typedOptions.lastFrameImageUrl.trim()
        ) {
            images.push(await normalizeVideoImageToDataUrl(typedOptions.lastFrameImageUrl))
        }

        const content: NewApiMultimodalPart[] = [
            { type: 'text', text: promptText },
            ...images.map((item) => ({
                type: 'image_url' as const,
                image_url: {
                    url: item,
                },
            })),
        ]

        const responseContent = await requestNewApiCompletion({
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            payload: {
                model: modelId,
                messages: [{ role: 'user', content }],
                stream: false,
            },
        })

        const videoUrl = extractHtmlVideoUrl(responseContent) || extractPlainUrl(responseContent)
        if (!videoUrl) {
            throw new Error('NEWAPI_VIDEO_URL_MISSING')
        }

        return {
            success: true,
            videoUrl: toAbsoluteUrlIfRelative(videoUrl, config.baseUrl),
        }
    }
}
