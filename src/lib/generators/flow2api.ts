import { BaseImageGenerator, BaseVideoGenerator, type GenerateResult, type ImageGenerateParams, type VideoGenerateParams } from './base'
import { getProviderConfig } from '@/lib/api-config'
import { getImageBase64Cached } from '@/lib/image-cache'
import { imageUrlToBase64 } from '@/lib/cos'

const FLOW2API_TIMEOUT_MS = Number.parseInt(
    process.env.FLOW2API_TIMEOUT_MS || String(20 * 60 * 1000),
    10,
)

type Flow2ApiAspectVariant = 'landscape' | 'portrait' | 'square' | 'four-three' | 'three-four'

type Flow2ApiMultimodalPart = {
    type: 'text'
    text: string
} | {
    type: 'image_url'
    image_url: {
        url: string
    }
}

interface Flow2ApiChatCompletionPayload {
    model: string
    messages: Array<{
        role: 'user'
        content: string | Flow2ApiMultimodalPart[]
    }>
    stream: boolean
}

interface Flow2ApiChatCompletionResponse {
    choices?: Array<{
        message?: {
            content?: string | null
        }
    }>
    error?: {
        message?: string
    }
}

interface Flow2ApiVideoOptions {
    modelId?: string
    aspectRatio?: string
    generationMode?: 'normal' | 'firstlastframe'
    lastFrameImageUrl?: string
}

function normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, '')
}

function resolveAspectVariant(
    aspectRatio: string | undefined,
    supported: ReadonlyArray<Flow2ApiAspectVariant>,
): Flow2ApiAspectVariant {
    const normalized = (aspectRatio || '').trim().toLowerCase()
    let candidate: Flow2ApiAspectVariant = 'landscape'

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

function resolveFlow2ApiImageModel(
    modelId: string,
    aspectRatio: string | undefined,
    resolution: string | undefined,
): string {
    if (
        /^gemini-2\.5-flash-image-(landscape|portrait)$/.test(modelId)
        || /^gemini-3\.0-pro-image-(landscape|portrait|square|four-three|three-four)(-2k|-4k)?$/.test(modelId)
        || /^gemini-3\.1-flash-image-(landscape|portrait|square|four-three|three-four)(-2k|-4k)?$/.test(modelId)
        || /^imagen-4\.0-generate-preview-(landscape|portrait)$/.test(modelId)
    ) {
        return modelId
    }

    if (modelId === 'gemini-2.5-flash-image') {
        const variant = resolveAspectVariant(aspectRatio, ['landscape', 'portrait'])
        return `gemini-2.5-flash-image-${variant}`
    }

    if (modelId === 'gemini-3-pro-image-preview') {
        const variant = resolveAspectVariant(aspectRatio, ['landscape', 'portrait', 'square', 'four-three', 'three-four'])
        const suffix = normalizeImageResolutionSuffix(resolution)
        return `gemini-3.0-pro-image-${variant}${suffix}`
    }

    if (modelId === 'gemini-3.1-flash-image-preview') {
        const variant = resolveAspectVariant(aspectRatio, ['landscape', 'portrait', 'square', 'four-three', 'three-four'])
        const suffix = normalizeImageResolutionSuffix(resolution)
        return `gemini-3.1-flash-image-${variant}${suffix}`
    }

    if (
        modelId === 'imagen-4.0-generate-001'
        || modelId === 'imagen-4.0-fast-generate-001'
        || modelId === 'imagen-4.0-ultra-generate-001'
    ) {
        const variant = resolveAspectVariant(aspectRatio, ['landscape', 'portrait'])
        return `imagen-4.0-generate-preview-${variant}`
    }

    return modelId
}

function resolveFlow2ApiVideoModel(
    modelId: string,
    aspectRatio: string | undefined,
): string {
    if (modelId.startsWith('veo_')) {
        return modelId
    }

    const isPortrait = resolveAspectVariant(aspectRatio, ['landscape', 'portrait']) === 'portrait'

    if (modelId === 'veo-3.1-fast-generate-preview' || modelId === 'veo-3.0-fast-generate-001') {
        return isPortrait
            ? 'veo_3_1_i2v_s_fast_portrait_fl'
            : 'veo_3_1_i2v_s_fast_fl'
    }

    if (modelId === 'veo-3.1-generate-preview' || modelId === 'veo-3.0-generate-001') {
        return isPortrait
            ? 'veo_3_1_i2v_s_portrait'
            : 'veo_3_1_i2v_s_landscape'
    }

    if (modelId === 'veo-2.0-generate-001') {
        return isPortrait
            ? 'veo_2_0_i2v_portrait'
            : 'veo_2_0_i2v_landscape'
    }

    return modelId
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
    if (!normalized) throw new Error('FLOW2API_VIDEO_IMAGE_REQUIRED')
    if (normalized.startsWith('data:')) return normalized
    return await imageUrlToBase64(normalized)
}

async function requestFlow2ApiCompletion(input: {
    baseUrl: string
    apiKey: string
    payload: Flow2ApiChatCompletionPayload
}): Promise<string> {
    const response = await fetch(`${normalizeBaseUrl(input.baseUrl)}/chat/completions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${input.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(input.payload),
        signal: AbortSignal.timeout(FLOW2API_TIMEOUT_MS),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`FLOW2API_REQUEST_FAILED: ${response.status} ${errorText.slice(0, 200)}`)
    }

    const data = await response.json() as Flow2ApiChatCompletionResponse
    if (data.error?.message) {
        throw new Error(`FLOW2API_ERROR: ${data.error.message}`)
    }

    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
        throw new Error('FLOW2API_EMPTY_RESPONSE')
    }
    return content
}

export class Flow2ApiImageGenerator extends BaseImageGenerator {
    private providerId: string

    constructor(providerId?: string) {
        super()
        this.providerId = providerId || 'flow2api'
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
                throw new Error(`FLOW2API_IMAGE_OPTION_UNSUPPORTED: ${key}`)
            }
        }

        const modelId = typeof options.modelId === 'string' && options.modelId.trim()
            ? options.modelId.trim()
            : 'gemini-3.1-flash-image-preview'
        const aspectRatio = typeof options.aspectRatio === 'string' ? options.aspectRatio : undefined
        const resolution = typeof options.resolution === 'string' ? options.resolution : undefined
        const requestModel = resolveFlow2ApiImageModel(modelId, aspectRatio, resolution)

        const normalizedPrompt = prompt.trim()
        if (!normalizedPrompt) {
            throw new Error('FLOW2API_IMAGE_PROMPT_REQUIRED')
        }

        const normalizedReferences = (await Promise.all(
            referenceImages.slice(0, 14).map(async (item) => await normalizeImageInputToDataUrl(item)),
        )).filter((item): item is string => typeof item === 'string' && item.length > 0)

        const content: string | Flow2ApiMultimodalPart[] = normalizedReferences.length === 0
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

        const responseContent = await requestFlow2ApiCompletion({
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            payload: {
                model: requestModel,
                messages: [{ role: 'user', content }],
                stream: false,
            },
        })

        const imageUrl = extractMarkdownImageUrl(responseContent) || extractPlainUrl(responseContent)
        if (!imageUrl) {
            throw new Error('FLOW2API_IMAGE_URL_MISSING')
        }

        return {
            success: true,
            imageUrl: toAbsoluteUrlIfRelative(imageUrl, config.baseUrl),
        }
    }
}

export class Flow2ApiVideoGenerator extends BaseVideoGenerator {
    private providerId: string

    constructor(providerId?: string) {
        super()
        this.providerId = providerId || 'flow2api'
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
                throw new Error(`FLOW2API_VIDEO_OPTION_UNSUPPORTED: ${key}`)
            }
        }

        const typedOptions = options as Flow2ApiVideoOptions
        const modelId = typeof typedOptions.modelId === 'string' && typedOptions.modelId.trim()
            ? typedOptions.modelId.trim()
            : 'veo-3.1-fast-generate-preview'
        const requestModel = resolveFlow2ApiVideoModel(modelId, typedOptions.aspectRatio)

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

        const content: Flow2ApiMultimodalPart[] = [
            { type: 'text', text: promptText },
            ...images.map((item) => ({
                type: 'image_url' as const,
                image_url: {
                    url: item,
                },
            })),
        ]

        const responseContent = await requestFlow2ApiCompletion({
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            payload: {
                model: requestModel,
                messages: [{ role: 'user', content }],
                stream: false,
            },
        })

        const videoUrl = extractHtmlVideoUrl(responseContent) || extractPlainUrl(responseContent)
        if (!videoUrl) {
            throw new Error('FLOW2API_VIDEO_URL_MISSING')
        }

        return {
            success: true,
            videoUrl: toAbsoluteUrlIfRelative(videoUrl, config.baseUrl),
        }
    }
}
