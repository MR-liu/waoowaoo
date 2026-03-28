import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-errors'

/**
 * GET /api/share/[shareCode]
 * 公开获取分享的项目数据（无需登录）
 */
export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) => {
  const { shareCode } = await params

  const share = await prisma.projectShare.findUnique({
    where: { shareCode },
    include: {
      project: {
        include: {
          novelPromotionData: {
            include: {
              characters: { include: { appearances: true } },
              locations: { include: { images: true } },
              episodes: {
                include: {
                  storyboards: { include: { panels: true } },
                },
                orderBy: { episodeNumber: 'asc' },
              },
            },
          },
        },
      },
    },
  })

  if (!share) {
    throw new ApiError('NOT_FOUND')
  }

  if (share.expiresAt && share.expiresAt < new Date()) {
    throw new ApiError('FORBIDDEN', { message: 'Share link has expired' })
  }

  if (share.password) {
    const inputPassword = request.nextUrl.searchParams.get('password')
    if (inputPassword !== share.password) {
      return NextResponse.json(
        { requiresPassword: true, error: 'Password required' },
        { status: 401 }
      )
    }
  }

  const project = share.project

  return NextResponse.json({
    project: {
      name: project.name,
      description: project.description,
      mode: project.projectType,
      characters: project.novelPromotionData?.characters ?? [],
      locations: project.novelPromotionData?.locations ?? [],
      episodes: (project.novelPromotionData?.episodes ?? []).map(ep => ({
        id: ep.id,
        name: ep.name,
        episodeNumber: ep.episodeNumber,
        storyboards: ep.storyboards.map(sb => ({
          id: sb.id,
          panelCount: sb.panelCount,
          panels: sb.panels.map(p => ({
            panelIndex: p.panelIndex,
            description: p.description,
            imageUrl: p.imageUrl,
            videoUrl: p.videoUrl,
          })),
        })),
      })),
    },
  })
})
