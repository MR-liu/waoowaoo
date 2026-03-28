import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'

interface StoryboardExportPanel {
  panelIndex: number
  shotType: string | null
  cameraMove: string | null
  description: string | null
  characters: string | null
  location: string | null
  imageUrl: string | null
  videoUrl: string | null
  imagePrompt: string | null
}

interface StoryboardExportData {
  projectName: string
  episodeName: string
  storyboards: Array<{
    id: string
    panelCount: number
    panels: StoryboardExportPanel[]
  }>
}

/**
 * GET /api/novel-promotion/[projectId]/export-storyboard
 * 导出分镜数据为 JSON 格式（可用于外部工具导入或 PDF 渲染）
 */
export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuth(projectId)
  if (isErrorResponse(authResult)) return authResult

  const episodeId = request.nextUrl.searchParams.get('episodeId')
  const format = request.nextUrl.searchParams.get('format') || 'json'

  if (!episodeId) {
    throw new ApiError('INVALID_PARAMS')
  }

  const episode = await prisma.novelPromotionEpisode.findFirst({
    where: {
      id: episodeId,
      novelPromotionProject: { projectId },
    },
    include: {
      storyboards: {
        include: {
          panels: {
            orderBy: { panelIndex: 'asc' },
          },
        },
      },
    },
  })

  if (!episode) {
    throw new ApiError('NOT_FOUND')
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  })

  const exportData: StoryboardExportData = {
    projectName: project?.name || 'Untitled',
    episodeName: episode.name,
    storyboards: episode.storyboards.map(sb => ({
      id: sb.id,
      panelCount: sb.panelCount,
      panels: sb.panels.map(p => ({
        panelIndex: p.panelIndex,
        shotType: p.shotType,
        cameraMove: p.cameraMove,
        description: p.description,
        characters: p.characters,
        location: p.location,
        imageUrl: p.imageUrl,
        videoUrl: p.videoUrl,
        imagePrompt: p.imagePrompt,
      })),
    })),
  }

  if (format === 'jianying') {
    const jianyingData = convertToJianyingDraft(exportData)
    return new NextResponse(JSON.stringify(jianyingData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(exportData.projectName)}_jianying.json"`,
      },
    })
  }

  return NextResponse.json(exportData)
})

/**
 * 简化的剪映 (CapCut/JianYing) 草稿格式
 * 生成基础的时间线数据，用户可在剪映中进一步编辑
 */
function convertToJianyingDraft(data: StoryboardExportData) {
  const allPanels = data.storyboards.flatMap(sb => sb.panels)
  const fps = 30
  const defaultDurationFrames = fps * 3

  let currentFrame = 0
  const videoTracks = allPanels
    .filter(p => p.videoUrl || p.imageUrl)
    .map((panel, index) => {
      const startFrame = currentFrame
      currentFrame += defaultDurationFrames

      return {
        index,
        source: panel.videoUrl || panel.imageUrl || '',
        type: panel.videoUrl ? 'video' : 'image',
        startFrame,
        durationFrames: defaultDurationFrames,
        description: panel.description,
        shotType: panel.shotType,
        cameraMove: panel.cameraMove,
      }
    })

  return {
    format: 'foldx-jianying-export',
    version: '1.0',
    project: {
      name: data.projectName,
      episode: data.episodeName,
      fps,
      totalFrames: currentFrame,
      totalDurationMs: (currentFrame / fps) * 1000,
    },
    tracks: {
      video: videoTracks,
    },
    panels: allPanels.map(p => ({
      panelIndex: p.panelIndex,
      description: p.description,
      imageUrl: p.imageUrl,
      videoUrl: p.videoUrl,
      imagePrompt: p.imagePrompt,
    })),
  }
}
