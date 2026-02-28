import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { resolveTaskLocale } from '@/lib/task/resolve-locale'
import { logWarn } from '@/lib/logging/core'

function toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message
    return String(error)
}

async function readJsonRecordSafely(response: Response): Promise<{
    result: Record<string, unknown> | null
    parseError: string | null
}> {
    try {
        const payload = await response.json()
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return { result: null, parseError: 'response JSON is not an object' }
        }
        return { result: payload as Record<string, unknown>, parseError: null }
    } catch (error) {
        return {
            result: null,
            parseError: `invalid JSON response (${toErrorMessage(error)})`,
        }
    }
}

/**
 * POST /api/novel-promotion/[projectId]/generate-character-image
 * 专门用于后台触发角色图片生成的简化 API
 * 内部调用 generate-image API
 */
export const POST = apiHandler(async (
    request: NextRequest,
    context: { params: Promise<{ projectId: string }> }
) => {
    const { projectId } = await context.params

    // 🔐 统一权限验证
    const authResult = await requireProjectAuthLight(projectId)
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const taskLocale = resolveTaskLocale(request, body)
    const acceptLanguage = request.headers.get('accept-language') || ''
    const { characterId, appearanceId, artStyle } = body

    if (!characterId) {
        throw new ApiError('INVALID_PARAMS')
    }

    // 如果没有传 appearanceId，获取第一个 appearance 的 id
    let targetAppearanceId = appearanceId
    if (!targetAppearanceId) {
        const character = await prisma.novelPromotionCharacter.findUnique({
            where: { id: characterId },
            include: { appearances: { orderBy: { appearanceIndex: 'asc' } } }
        })
        if (!character) {
            throw new ApiError('NOT_FOUND')
        }
        const firstAppearance = character.appearances?.[0]
        if (!firstAppearance) {
            throw new ApiError('NOT_FOUND')
        }
        targetAppearanceId = firstAppearance.id
    }

    // 如果设置了 artStyle，需要更新到 novelPromotionProject 中（供 generate-image 使用）
    if (artStyle) {
        const novelData = await prisma.novelPromotionProject.findUnique({ where: { projectId } })
        if (novelData) {
            // 将风格转换为提示词
            const ART_STYLES = [
                { value: 'american-comic', prompt: '美式漫画风格' },
                { value: 'chinese-comic', prompt: '精致国漫风格' },
                { value: 'anime', prompt: '日系动漫风格' },
                { value: 'realistic', prompt: '真人照片写实风格' }
            ]
            const style = ART_STYLES.find(s => s.value === artStyle)
            if (style) {
                await prisma.novelPromotionProject.update({
                    where: { id: novelData.id },
                    data: { artStylePrompt: style.prompt }
                })
            }
        }
    }

    // 调用 generate-image API
    const { getBaseUrl } = await import('@/lib/env')
    const baseUrl = getBaseUrl()
    const generateRes = await fetch(`${baseUrl}/api/novel-promotion/${projectId}/generate-image`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
            ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {})
        },
        body: JSON.stringify({
            type: 'character',
            id: characterId,
            appearanceId: targetAppearanceId,  // 使用真正的 UUID
            locale: taskLocale || undefined,
        })
    })

    const parsed = await readJsonRecordSafely(generateRes)
    const result = parsed.result

    if (!generateRes.ok) {
        const upstreamErrorMessage =
            typeof result?.error === 'string' && result.error.trim()
                ? result.error.trim()
                : typeof result?.message === 'string' && result.message.trim()
                    ? result.message.trim()
                    : parsed.parseError
                        ? `downstream generate-image failed: ${parsed.parseError}`
                    : `downstream generate-image failed with status ${generateRes.status}`
        throw new ApiError('GENERATION_FAILED', {
            message: upstreamErrorMessage,
            upstreamStatus: generateRes.status,
            upstreamCode: typeof result?.code === 'string' ? result.code : undefined,
            upstreamParseError: parsed.parseError || undefined,
        })
    }

    if (parsed.parseError) {
        logWarn('[generate-character-image] downstream success response is not valid JSON object', {
            projectId,
            characterId,
            upstreamStatus: generateRes.status,
            parseError: parsed.parseError,
        })
    }

    return NextResponse.json(result || { success: true })
})
