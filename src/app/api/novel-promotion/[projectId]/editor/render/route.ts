import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'

/**
 * POST /api/novel-promotion/[projectId]/editor/render
 * 发起视频渲染任务
 */
export const POST = apiHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) => {
    const { projectId } = await params

    const authResult = await requireProjectAuthLight(projectId)
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const { editorProjectId, format, quality } = body as {
        editorProjectId: string
        format?: string
        quality?: string
    }

    if (!editorProjectId) {
        throw new ApiError('INVALID_PARAMS')
    }

    const editorProject = await prisma.videoEditorProject.findUnique({
        where: { id: editorProjectId }
    })

    if (!editorProject) {
        throw new ApiError('NOT_FOUND')
    }

    void format
    void quality

    throw new ApiError('NOT_IMPLEMENTED', {
        message: 'Server-side Remotion rendering is not yet available. Use the in-browser preview to export.',
    })
})

/**
 * GET /api/novel-promotion/[projectId]/editor/render
 * 查询渲染状态
 */
export const GET = apiHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) => {
    const { projectId } = await params

    const authResult = await requireProjectAuthLight(projectId)
    if (isErrorResponse(authResult)) return authResult

    const editorProjectId = request.nextUrl.searchParams.get('id')
    if (!editorProjectId) {
        throw new ApiError('INVALID_PARAMS')
    }

    const editorProject = await prisma.videoEditorProject.findUnique({
        where: { id: editorProjectId },
        select: {
            id: true,
            renderStatus: true,
            outputUrl: true,
            updatedAt: true,
        }
    })

    if (!editorProject) {
        throw new ApiError('NOT_FOUND')
    }

    return NextResponse.json({
        id: editorProject.id,
        renderStatus: editorProject.renderStatus,
        outputUrl: editorProject.outputUrl,
        updatedAt: editorProject.updatedAt,
    })
})
