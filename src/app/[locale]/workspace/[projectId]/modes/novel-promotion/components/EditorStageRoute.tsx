'use client'

import { useWorkspaceStageRuntime } from '../WorkspaceStageRuntimeContext'
import { useWorkspaceProvider } from '../WorkspaceProvider'
import { useWorkspaceEpisodeStageData } from '../hooks/useWorkspaceEpisodeStageData'
import { VideoEditorStage } from '@/features/video-editor/components/VideoEditorStage'
import { createProjectFromPanels } from '@/features/video-editor/hooks/useEditorActions'
import { useMatchedVoiceLines } from '@/lib/query/hooks'
import { useMemo } from 'react'

export default function EditorStageRoute() {
  const runtime = useWorkspaceStageRuntime()
  const { projectId, episodeId } = useWorkspaceProvider()
  const { storyboards } = useWorkspaceEpisodeStageData()
  const { data: voiceLinesData } = useMatchedVoiceLines(projectId, episodeId)

  const initialProject = useMemo(() => {
    if (!episodeId) return undefined

    const allPanels = storyboards.flatMap(sb =>
      (sb.panels ?? []).map(panel => ({
        id: panel.id,
        panelIndex: panel.panelIndex,
        storyboardId: sb.id,
        videoUrl: panel.videoUrl ?? undefined,
        description: panel.description ?? undefined,
        duration: panel.duration ?? undefined,
      }))
    )

    const normalizedVoiceLines = (voiceLinesData?.voiceLines ?? []).map(vl => ({
      id: vl.id,
      speaker: vl.speaker,
      content: vl.content,
      audioUrl: vl.audioUrl,
      matchedStoryboardId: vl.matchedStoryboardId ?? null,
      matchedPanelIndex: vl.matchedPanelIndex ?? null,
    }))

    if (allPanels.some(p => p.videoUrl)) {
      return createProjectFromPanels(episodeId, allPanels, normalizedVoiceLines, runtime.videoRatio ?? undefined)
    }
    return undefined
  }, [episodeId, storyboards, voiceLinesData, runtime.videoRatio])

  if (!episodeId) return null

  return (
    <VideoEditorStage
      projectId={projectId}
      episodeId={episodeId}
      initialProject={initialProject}
      onBack={() => runtime.onStageChange('videos')}
    />
  )
}
