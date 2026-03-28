'use client'

import { useCallback } from 'react'
import { VideoClip, VideoEditorProject } from '../types/editor.types'

interface UseEditorActionsProps {
    projectId: string
    episodeId: string
}

/**
 * 面板数据类型（灵活接受各种格式）
 */
interface PanelData {
    id?: string
    panelIndex?: number
    storyboardId: string
    videoUrl?: string
    description?: string
    duration?: number
}

interface VoiceLineData {
    id: string
    speaker: string
    content: string
    audioUrl?: string | null
    matchedPanelId?: string | null
    matchedStoryboardId?: string | null
    matchedPanelIndex?: number | null
}

/**
 * 从已生成的视频面板创建编辑器项目
 */
function resolveResolution(videoRatio?: string): { width: number; height: number } {
    switch (videoRatio) {
        case '9:16': return { width: 1080, height: 1920 }
        case '1:1':  return { width: 1080, height: 1080 }
        case '4:5':  return { width: 1080, height: 1350 }
        case '3:4':  return { width: 1080, height: 1440 }
        case '2:3':  return { width: 1080, height: 1620 }
        case '4:3':  return { width: 1440, height: 1080 }
        case '3:2':  return { width: 1620, height: 1080 }
        case '21:9': return { width: 2520, height: 1080 }
        case '16:9':
        default:     return { width: 1920, height: 1080 }
    }
}

export function createProjectFromPanels(
    episodeId: string,
    panels: PanelData[],
    voiceLines?: VoiceLineData[],
    videoRatio?: string,
): VideoEditorProject {
    const videoPanels = panels.filter(p => p.videoUrl)

    const voiceLookup = new Map<string, VoiceLineData>()
    if (voiceLines) {
        for (const vl of voiceLines) {
            if (vl.matchedPanelId) {
                voiceLookup.set(vl.matchedPanelId, vl)
            } else if (vl.matchedStoryboardId != null && vl.matchedPanelIndex != null) {
                voiceLookup.set(`${vl.matchedStoryboardId}:${vl.matchedPanelIndex}`, vl)
            }
        }
    }

    const timeline: VideoClip[] = videoPanels.map((panel, index) => {
        const panelId = panel.id || `${panel.storyboardId}-${panel.panelIndex ?? index}`
        const compositeKey = `${panel.storyboardId}:${panel.panelIndex ?? index}`
        const matchedVoice = voiceLookup.get(panelId) ?? voiceLookup.get(compositeKey)

        return {
            id: `clip_${panel.id || panel.storyboardId}_${panel.panelIndex ?? index}`,
            src: panel.videoUrl!,
            durationInFrames: Math.round((panel.duration || 3) * 30),
            attachment: {
                audio: matchedVoice?.audioUrl ? {
                    src: matchedVoice.audioUrl,
                    volume: 1,
                    voiceLineId: matchedVoice.id
                } : undefined,
                subtitle: matchedVoice ? {
                    text: matchedVoice.content,
                    style: 'default' as const
                } : undefined
            },
            transition: index < videoPanels.length - 1 ? {
                type: 'dissolve' as const,
                durationInFrames: 15
            } : undefined,
            metadata: {
                panelId,
                storyboardId: panel.storyboardId,
                description: panel.description || undefined
            }
        }
    })

    const { width, height } = resolveResolution(videoRatio)

    return {
        id: `editor_${episodeId}_${Date.now()}`,
        episodeId,
        schemaVersion: '1.0',
        config: {
            fps: 30,
            width,
            height,
        },
        timeline,
        bgmTrack: []
    }
}

export function useEditorActions({ projectId, episodeId }: UseEditorActionsProps) {
    /**
     * 保存项目到服务器
     */
    const saveProject = useCallback(async (project: VideoEditorProject) => {
        const response = await fetch(`/api/novel-promotion/${projectId}/editor`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectData: project })
        })

        if (!response.ok) {
            throw new Error('Failed to save project')
        }

        return response.json()
    }, [projectId])

    /**
     * 加载项目
     */
    const loadProject = useCallback(async (): Promise<VideoEditorProject | null> => {
        const response = await fetch(`/api/novel-promotion/${projectId}/editor?episodeId=${episodeId}`)

        if (!response.ok) {
            if (response.status === 404) return null
            throw new Error('Failed to load project')
        }

        const data = await response.json()
        return data.projectData
    }, [projectId, episodeId])

    /**
     * 发起渲染导出
     */
    const startRender = useCallback(async (editorProjectId: string) => {
        const response = await fetch(`/api/novel-promotion/${projectId}/editor/render`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                editorProjectId,
                format: 'mp4',
                quality: 'high'
            })
        })

        if (!response.ok) {
            throw new Error('Failed to start render')
        }

        return response.json()
    }, [projectId])

    /**
     * 获取渲染状态
     */
    const getRenderStatus = useCallback(async (editorProjectId: string) => {
        const response = await fetch(
            `/api/novel-promotion/${projectId}/editor/render?id=${editorProjectId}`
        )

        if (!response.ok) {
            throw new Error('Failed to get render status')
        }

        return response.json()
    }, [projectId])

    return {
        saveProject,
        loadProject,
        startRender,
        getRenderStatus
    }
}
