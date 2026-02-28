import { BaseImageGenerator, BaseVideoGenerator, type GenerateResult, type ImageGenerateParams, type VideoGenerateParams } from './base'
import { getProviderConfig } from '@/lib/api-config'
import { getImageBase64Cached } from '@/lib/image-cache'
import { imageUrlToBase64 } from '@/lib/cos'

const NEWAPI_TIMEOUT_MS = Number.parseInt(
    process.env.NEWAPI_TIMEOUT_MS || String(20 * 60 * 1000),
    10,
)

type NewApiAspectVariant = 'landscape' | 'portrait' | 'square' | 'four-three' | 'three-four'
type NewApiImageResponseFormat = 'url' | 'b64_json'
type NewApiVideoGenerationMode = 'normal' | 'firstlastframe'

interface NewApiImagePayload {
    model: string
    prompt: string
    size?: string
    quality?: 'hd'
    response_format?: NewApiImageResponseFormat
    n?: number
}

interface NewApiImageItem {
    url?: string | null
    b64_json?: string | null
}

interface NewApiImageResponse {
    data?: NewApiImageItem[]
    error?: {
        message?: string
    }
    message?: string
}

interface NewApiVideoPayload {
    model: string
    prompt: string
    image: string
    size?: string
    quality?: 'hd'
    duration?: number
    with_audio?: boolean
    response_format?: 'url'
}

interface NewApiVideoResponse {
    task_id?: string
    id?: string
    status?: string
    data?: unknown
    error?: {
        message?: string
    }
    message?: string
}

interface NewApiVideoOptions {
    modelId?: string
    aspectRatio?: string
    resolution?: string
    duration?: number
    generateAudio?: boolean
    generationMode?: NewApiVideoGenerationMode
    lastFrameImageUrl?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readTrimmedString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
}

function normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, '')
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

function resolveImageSize(input: {
    size?: string
    aspectRatio?: string
}): string | undefined {
    const directSize = readTrimmedString(input.size)
    if (directSize) return directSize

    const variant = resolveAspectVariant(input.aspectRatio, ['landscape', 'portrait', 'square', 'four-three', 'three-four'])
    if (variant === 'portrait') return '1024x1792'
    if (variant === 'square') return '1024x1024'
    if (variant === 'four-three') return '1536x1152'
    if (variant === 'three-four') return '1152x1536'
    return '1792x1024'
}

function resolveImageQuality(resolution: string | undefined): 'hd' | undefined {
    const normalized = readTrimmedString(resolution).toUpperCase()
    if (normalized === '2K' || normalized === '4K') return 'hd'
    return undefined
}

function resolveVideoQuality(resolution: string | undefined): 'hd' | undefined {
    const normalized = readTrimmedString(resolution).toLowerCase()
    if (normalized === '1080p' || normalized === '2k' || normalized === '4k') return 'hd'
    return undefined
}

function pickImageResponseFormat(outputFormat: string | undefined): NewApiImageResponseFormat | undefined {
    const normalized = readTrimmedString(outputFormat).toLowerCase()
    if (normalized === 'url') return 'url'
    if (normalized === 'b64_json' || normalized === 'base64') return 'b64_json'
    return undefined
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

function dataUrlToBlob(dataUrl: string): Blob {
    const matched = dataUrl.match(/^data:([^;,]+);base64,(.+)$/)
    if (!matched) {
        throw new Error('NEWAPI_IMAGE_DATAURL_INVALID')
    }
    const mimeType = matched[1]
    const rawBase64 = matched[2]
    const buffer = Buffer.from(rawBase64, 'base64')
    return new Blob([buffer], { type: mimeType })
}

function extractResponseErrorMessage(payload: unknown): string | null {
    if (!isRecord(payload)) return null
    const error = payload.error
    if (isRecord(error)) {
        const message = readTrimmedString(error.message)
        if (message) return message
    }
    const message = readTrimmedString(payload.message)
    if (message) return message
    return null
}

async function requestNewApiJson<T>(input: {
    baseUrl: string
    apiKey: string
    path: string
    method?: 'GET' | 'POST'
    jsonBody?: unknown
    formBody?: FormData
}): Promise<T> {
    const response = await fetch(`${normalizeBaseUrl(input.baseUrl)}${input.path}`, {
        method: input.method || 'POST',
        headers: input.formBody
            ? {
                Authorization: `Bearer ${input.apiKey}`,
            }
            : {
                Authorization: `Bearer ${input.apiKey}`,
                'Content-Type': 'application/json',
            },
        body: input.formBody || (input.jsonBody !== undefined ? JSON.stringify(input.jsonBody) : undefined),
        signal: AbortSignal.timeout(NEWAPI_TIMEOUT_MS),
    })

    const responseText = await response.text()
    let parsed: unknown = {}
    if (responseText.trim()) {
        try {
            parsed = JSON.parse(responseText)
        } catch {
            if (!response.ok) {
                throw new Error(`NEWAPI_REQUEST_FAILED: ${response.status} ${responseText.slice(0, 200)}`)
            }
            throw new Error(`NEWAPI_RESPONSE_INVALID_JSON: ${responseText.slice(0, 200)}`)
        }
    }

    const errorMessage = extractResponseErrorMessage(parsed)
    if (!response.ok) {
        if (errorMessage) {
            throw new Error(`NEWAPI_REQUEST_FAILED: ${response.status} ${errorMessage}`)
        }
        throw new Error(`NEWAPI_REQUEST_FAILED: ${response.status} ${responseText.slice(0, 200)}`)
    }
    if (errorMessage) {
        throw new Error(`NEWAPI_ERROR: ${errorMessage}`)
    }

    return parsed as T
}

function extractImageResult(
    response: NewApiImageResponse,
    providerBaseUrl: string,
): { imageUrl: string; imageBase64?: string } {
    const items = Array.isArray(response.data) ? response.data : []
    for (const item of items) {
        const url = readTrimmedString(item?.url)
        if (url) {
            return { imageUrl: toAbsoluteUrlIfRelative(url, providerBaseUrl) }
        }
        const imageBase64 = readTrimmedString(item?.b64_json)
        if (imageBase64) {
            return {
                imageUrl: `data:image/png;base64,${imageBase64}`,
                imageBase64,
            }
        }
    }
    throw new Error('NEWAPI_IMAGE_DATA_MISSING')
}

function extractVideoTaskId(response: NewApiVideoResponse): string {
    const directTaskId = readTrimmedString(response.task_id)
    if (directTaskId) return directTaskId

    const directId = readTrimmedString(response.id)
    if (directId) return directId

    if (isRecord(response.data)) {
        const nestedTaskId = readTrimmedString(response.data.task_id)
        if (nestedTaskId) return nestedTaskId
        const nestedId = readTrimmedString(response.data.id)
        if (nestedId) return nestedId
    }

    throw new Error('NEWAPI_VIDEO_TASK_ID_MISSING')
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

        const modelId = readTrimmedString(options.modelId) || 'gpt-image-1'
        const aspectRatio = readTrimmedString(options.aspectRatio) || undefined
        const resolution = readTrimmedString(options.resolution) || undefined
        const outputFormat = readTrimmedString(options.outputFormat) || undefined
        const size = resolveImageSize({
            size: readTrimmedString(options.size) || undefined,
            aspectRatio,
        })
        const quality = resolveImageQuality(resolution)
        const responseFormat = pickImageResponseFormat(outputFormat)

        const normalizedPrompt = prompt.trim()
        if (!normalizedPrompt) {
            throw new Error('NEWAPI_IMAGE_PROMPT_REQUIRED')
        }

        const basePayload: NewApiImagePayload = {
            model: modelId,
            prompt: normalizedPrompt,
            ...(size ? { size } : {}),
            ...(quality ? { quality } : {}),
            ...(responseFormat ? { response_format: responseFormat } : {}),
            n: 1,
        }

        let responseData: NewApiImageResponse
        if (referenceImages.length === 0) {
            responseData = await requestNewApiJson<NewApiImageResponse>({
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                path: '/images/generations',
                method: 'POST',
                jsonBody: basePayload,
            })
        } else {
            const normalizedReferences = (await Promise.all(
                referenceImages.slice(0, 8).map(async (item) => await normalizeImageInputToDataUrl(item)),
            )).filter((item): item is string => typeof item === 'string' && item.length > 0)

            if (normalizedReferences.length === 0) {
                throw new Error('NEWAPI_IMAGE_REFERENCE_REQUIRED')
            }

            const form = new FormData()
            form.append('model', modelId)
            form.append('prompt', normalizedPrompt)
            if (size) form.append('size', size)
            if (quality) form.append('quality', quality)
            if (responseFormat) form.append('response_format', responseFormat)

            const blobs = normalizedReferences.map((item) => dataUrlToBlob(item))
            if (blobs.length === 1) {
                form.append('image', blobs[0], 'reference-1.png')
            } else {
                blobs.forEach((blob, index) => {
                    form.append('image[]', blob, `reference-${index + 1}.png`)
                })
            }

            responseData = await requestNewApiJson<NewApiImageResponse>({
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                path: '/images/edits',
                method: 'POST',
                formBody: form,
            })
        }

        const parsed = extractImageResult(responseData, config.baseUrl)
        return {
            success: true,
            imageUrl: parsed.imageUrl,
            ...(parsed.imageBase64 ? { imageBase64: parsed.imageBase64 } : {}),
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

        const typedOptions = options as NewApiVideoOptions
        if (typedOptions.generationMode === 'firstlastframe') {
            throw new Error('NEWAPI_VIDEO_OPTION_UNSUPPORTED: generationMode=firstlastframe')
        }
        if (readTrimmedString(typedOptions.lastFrameImageUrl)) {
            throw new Error('NEWAPI_VIDEO_OPTION_UNSUPPORTED: lastFrameImageUrl')
        }

        const modelId = readTrimmedString(typedOptions.modelId) || 'kling-v1'
        const promptText = prompt.trim() || 'Generate a cinematic video.'
        const firstFrame = await normalizeVideoImageToDataUrl(imageUrl)
        const size = resolveImageSize({
            aspectRatio: readTrimmedString(typedOptions.aspectRatio) || undefined,
        })
        const quality = resolveVideoQuality(readTrimmedString(typedOptions.resolution) || undefined)

        const payload: NewApiVideoPayload = {
            model: modelId,
            prompt: promptText,
            image: firstFrame,
            response_format: 'url',
            ...(size ? { size } : {}),
            ...(quality ? { quality } : {}),
            ...(typeof typedOptions.duration === 'number' && Number.isFinite(typedOptions.duration) && typedOptions.duration > 0
                ? { duration: typedOptions.duration }
                : {}),
            ...(typeof typedOptions.generateAudio === 'boolean'
                ? { with_audio: typedOptions.generateAudio }
                : {}),
        }

        const response = await requestNewApiJson<NewApiVideoResponse>({
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            path: '/video/generations',
            method: 'POST',
            jsonBody: payload,
        })

        const taskId = extractVideoTaskId(response)
        return {
            success: true,
            async: true,
            requestId: taskId,
            externalId: `NEWAPI:VIDEO:${taskId}`,
        }
    }
}
