'use client'

import { useState, useCallback, useRef } from 'react'
import {
    VideoEditorProject,
    VideoClip,
    BgmClip,
    TimelineState,
    createDefaultProject,
    generateClipId
} from '../index'

interface UseEditorStateProps {
    episodeId: string
    initialProject?: VideoEditorProject
}

const MAX_HISTORY = 50

export function useEditorState({ episodeId, initialProject }: UseEditorStateProps) {
    const [project, setProject] = useState<VideoEditorProject>(
        initialProject || createDefaultProject(episodeId)
    )

    const [timelineState, setTimelineState] = useState<TimelineState>({
        currentFrame: 0,
        playing: false,
        selectedClipId: null,
        zoom: 1
    })

    const [isDirty, setIsDirty] = useState(false)

    const historyRef = useRef<VideoEditorProject[]>([])
    const futureRef = useRef<VideoEditorProject[]>([])
    const clipboardRef = useRef<VideoClip | null>(null)

    const pushHistory = useCallback((prev: VideoEditorProject) => {
        historyRef.current = [...historyRef.current.slice(-MAX_HISTORY + 1), prev]
        futureRef.current = []
    }, [])

    const mutateProject = useCallback((mutator: (prev: VideoEditorProject) => VideoEditorProject) => {
        setProject(prev => {
            pushHistory(prev)
            const next = mutator(prev)
            setIsDirty(true)
            return next
        })
    }, [pushHistory])

    // ═══════════════════════════════════════
    // 撤销 / 重做
    // ═══════════════════════════════════════

    const undo = useCallback(() => {
        if (historyRef.current.length === 0) return
        const prev = historyRef.current[historyRef.current.length - 1]
        historyRef.current = historyRef.current.slice(0, -1)
        setProject(current => {
            futureRef.current = [...futureRef.current, current]
            return prev
        })
        setIsDirty(true)
    }, [])

    const redo = useCallback(() => {
        if (futureRef.current.length === 0) return
        const next = futureRef.current[futureRef.current.length - 1]
        futureRef.current = futureRef.current.slice(0, -1)
        setProject(current => {
            historyRef.current = [...historyRef.current, current]
            return next
        })
        setIsDirty(true)
    }, [])

    const canUndo = historyRef.current.length > 0
    const canRedo = futureRef.current.length > 0

    // ═══════════════════════════════════════
    // 片段 CRUD
    // ═══════════════════════════════════════

    const addClip = useCallback((clip: Omit<VideoClip, 'id'>) => {
        const newClip: VideoClip = { ...clip, id: generateClipId() }
        mutateProject(prev => ({ ...prev, timeline: [...prev.timeline, newClip] }))
        return newClip.id
    }, [mutateProject])

    const removeClip = useCallback((clipId: string) => {
        mutateProject(prev => ({ ...prev, timeline: prev.timeline.filter(c => c.id !== clipId) }))
    }, [mutateProject])

    const updateClip = useCallback((clipId: string, updates: Partial<VideoClip>) => {
        mutateProject(prev => ({
            ...prev,
            timeline: prev.timeline.map(c => c.id === clipId ? { ...c, ...updates } : c)
        }))
    }, [mutateProject])

    const reorderClips = useCallback((fromIndex: number, toIndex: number) => {
        mutateProject(prev => {
            const newTimeline = [...prev.timeline]
            const [removed] = newTimeline.splice(fromIndex, 1)
            newTimeline.splice(toIndex, 0, removed)
            return { ...prev, timeline: newTimeline }
        })
    }, [mutateProject])

    // ═══════════════════════════════════════
    // 分割 (Split)
    // ═══════════════════════════════════════

    const splitAtPlayhead = useCallback(() => {
        const { currentFrame } = timelineState

        let accumFrames = 0
        let targetIndex = -1
        let splitOffset = 0

        for (let i = 0; i < project.timeline.length; i++) {
            const clip = project.timeline[i]
            if (currentFrame > accumFrames && currentFrame < accumFrames + clip.durationInFrames) {
                targetIndex = i
                splitOffset = currentFrame - accumFrames
                break
            }
            accumFrames += clip.durationInFrames
        }

        if (targetIndex === -1 || splitOffset <= 0) return

        const original = project.timeline[targetIndex]
        const trimFrom = original.trim?.from ?? 0

        const clipA: VideoClip = {
            ...original,
            id: generateClipId(),
            durationInFrames: splitOffset,
            trim: { from: trimFrom, to: trimFrom + splitOffset },
            transition: undefined,
        }

        const clipB: VideoClip = {
            ...original,
            id: generateClipId(),
            durationInFrames: original.durationInFrames - splitOffset,
            trim: { from: trimFrom + splitOffset, to: trimFrom + original.durationInFrames },
        }

        mutateProject(prev => {
            const newTimeline = [...prev.timeline]
            newTimeline.splice(targetIndex, 1, clipA, clipB)
            return { ...prev, timeline: newTimeline }
        })

        setTimelineState(prev => ({ ...prev, selectedClipId: clipA.id }))
    }, [timelineState, project.timeline, mutateProject])

    // ═══════════════════════════════════════
    // 复制 / 粘贴
    // ═══════════════════════════════════════

    const copyClip = useCallback(() => {
        const clip = project.timeline.find(c => c.id === timelineState.selectedClipId)
        if (clip) clipboardRef.current = { ...clip }
    }, [project.timeline, timelineState.selectedClipId])

    const pasteClip = useCallback(() => {
        if (!clipboardRef.current) return
        const pasted: VideoClip = {
            ...clipboardRef.current,
            id: generateClipId(),
            metadata: { ...clipboardRef.current.metadata },
        }

        const selectedIdx = project.timeline.findIndex(c => c.id === timelineState.selectedClipId)
        const insertIdx = selectedIdx >= 0 ? selectedIdx + 1 : project.timeline.length

        mutateProject(prev => {
            const newTimeline = [...prev.timeline]
            newTimeline.splice(insertIdx, 0, pasted)
            return { ...prev, timeline: newTimeline }
        })

        setTimelineState(prev => ({ ...prev, selectedClipId: pasted.id }))
    }, [project.timeline, timelineState.selectedClipId, mutateProject])

    // ═══════════════════════════════════════
    // 变速 (Speed)
    // ═══════════════════════════════════════

    const setClipSpeed = useCallback((clipId: string, speed: number) => {
        const clip = project.timeline.find(c => c.id === clipId)
        if (!clip) return
        const clamped = Math.max(0.1, Math.min(10, speed))
        const originalDur = clip.originalDurationInFrames ?? clip.durationInFrames
        const newDur = Math.round(originalDur / clamped)
        updateClip(clipId, {
            speed: clamped,
            durationInFrames: Math.max(1, newDur),
            originalDurationInFrames: originalDur,
        })
    }, [project.timeline, updateClip])

    // ═══════════════════════════════════════
    // 定格 (Freeze Frame)
    // ═══════════════════════════════════════

    const freezeFrame = useCallback((clipId: string, frameNumber: number, durationInFrames: number) => {
        updateClip(clipId, {
            frozen: { frameNumber, durationInFrames },
        })
    }, [updateClip])

    // ═══════════════════════════════════════
    // 倒放 (Reverse)
    // ═══════════════════════════════════════

    const toggleReverse = useCallback((clipId: string) => {
        const clip = project.timeline.find(c => c.id === clipId)
        if (!clip) return
        updateClip(clipId, { reversed: !clip.reversed })
    }, [project.timeline, updateClip])

    // ═══════════════════════════════════════
    // 裁切手柄 (Trim)
    // ═══════════════════════════════════════

    const trimClipStart = useCallback((clipId: string, deltaFrames: number) => {
        const clip = project.timeline.find(c => c.id === clipId)
        if (!clip) return
        const currentFrom = clip.trim?.from ?? 0
        const currentTo = clip.trim?.to ?? clip.durationInFrames
        const newFrom = Math.max(0, currentFrom + deltaFrames)
        if (newFrom >= currentTo) return
        mutateProject(prev => ({
            ...prev,
            timeline: prev.timeline.map(c => c.id === clipId ? {
                ...c,
                trim: { from: newFrom, to: currentTo },
                durationInFrames: currentTo - newFrom,
            } : c)
        }))
    }, [project.timeline, mutateProject])

    const trimClipEnd = useCallback((clipId: string, deltaFrames: number) => {
        const clip = project.timeline.find(c => c.id === clipId)
        if (!clip) return
        const currentFrom = clip.trim?.from ?? 0
        const currentTo = clip.trim?.to ?? clip.durationInFrames
        const newTo = Math.max(currentFrom + 1, currentTo + deltaFrames)
        mutateProject(prev => ({
            ...prev,
            timeline: prev.timeline.map(c => c.id === clipId ? {
                ...c,
                trim: { from: currentFrom, to: newTo },
                durationInFrames: newTo - currentFrom,
            } : c)
        }))
    }, [project.timeline, mutateProject])

    // ═══════════════════════════════════════
    // BGM
    // ═══════════════════════════════════════

    const addBgm = useCallback((bgm: Omit<BgmClip, 'id'>) => {
        const newBgm: BgmClip = { ...bgm, id: `bgm_${Date.now()}` }
        mutateProject(prev => ({ ...prev, bgmTrack: [...prev.bgmTrack, newBgm] }))
    }, [mutateProject])

    const removeBgm = useCallback((bgmId: string) => {
        mutateProject(prev => ({ ...prev, bgmTrack: prev.bgmTrack.filter(b => b.id !== bgmId) }))
    }, [mutateProject])

    // ═══════════════════════════════════════
    // 播放控制
    // ═══════════════════════════════════════

    const play = useCallback(() => setTimelineState(prev => ({ ...prev, playing: true })), [])
    const pause = useCallback(() => setTimelineState(prev => ({ ...prev, playing: false })), [])
    const seek = useCallback((frame: number) => setTimelineState(prev => ({ ...prev, currentFrame: frame })), [])
    const selectClip = useCallback((clipId: string | null) => setTimelineState(prev => ({ ...prev, selectedClipId: clipId })), [])
    const setZoom = useCallback((zoom: number) => setTimelineState(prev => ({ ...prev, zoom: Math.max(0.1, Math.min(5, zoom)) })), [])

    // ═══════════════════════════════════════
    // 项目操作
    // ═══════════════════════════════════════

    const resetProject = useCallback(() => {
        setProject(createDefaultProject(episodeId))
        setIsDirty(false)
        historyRef.current = []
        futureRef.current = []
    }, [episodeId])

    const loadProject = useCallback((data: VideoEditorProject) => {
        setProject(data)
        setIsDirty(false)
        historyRef.current = []
        futureRef.current = []
    }, [])

    const markSaved = useCallback(() => setIsDirty(false), [])

    return {
        project,
        timelineState,
        isDirty,
        canUndo,
        canRedo,

        addClip,
        removeClip,
        updateClip,
        reorderClips,

        splitAtPlayhead,
        copyClip,
        pasteClip,
        undo,
        redo,

        setClipSpeed,
        freezeFrame,
        toggleReverse,
        trimClipStart,
        trimClipEnd,

        addBgm,
        removeBgm,

        play,
        pause,
        seek,
        selectClip,
        setZoom,

        resetProject,
        loadProject,
        markSaved,
        setProject,
    }
}
