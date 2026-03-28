'use client'

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import {
    DndContext,
    closestCenter,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { VideoClip, BgmClip, TimelineState, EditorConfig, ComputedClip } from '../../types/editor.types'
import { computeClipPositions, calculateTimelineDuration } from '../../utils/time-utils'
import type { TrackId, TrackStates, TrimDragState, ContextAction, ContextMenuState } from './timeline-types'
import {
    BASE_PIXELS_PER_SECOND,
    RULER_HEIGHT,
    TIMELINE_END_PADDING,
    TRACK_CONFIGS,
    TRACK_BORDER,
    TRACK_HEADER_WIDTH,
    SNAP_THRESHOLD_PX,
    MIN_TRACK_HEIGHT,
    MAX_TRACK_HEIGHT,
    MINIMAP_HEIGHT,
    createDefaultTrackStates,
} from './timeline-constants'
import { TimeRuler } from './TimeRuler'
import { Playhead } from './Playhead'
import { TrackHeader } from './TrackHeader'
import { ClipBlock } from './ClipBlock'
import { AudioClipBlock } from './AudioClipBlock'
import { SubtitleBlock } from './SubtitleBlock'
import { BgmClipBlock } from './BgmClipBlock'
import { ClipContextMenu } from './ClipContextMenu'
import { TimelineMinimap } from './TimelineMinimap'

export interface TimelineProps {
    clips: VideoClip[]
    bgmClips: BgmClip[]
    timelineState: TimelineState
    config: EditorConfig
    splitIndicatorFrame: number | null
    onReorder: (fromIndex: number, toIndex: number) => void
    onSelectClip: (clipId: string | null) => void
    onZoomChange: (zoom: number) => void
    onSeek: (frame: number) => void
    onTrimStart: (clipId: string, deltaFrames: number) => void
    onTrimEnd: (clipId: string, deltaFrames: number) => void
    onContextAction: (action: ContextAction, clipId: string) => void
}

export const Timeline: React.FC<TimelineProps> = ({
    clips,
    bgmClips,
    timelineState,
    config,
    splitIndicatorFrame,
    onReorder,
    onSelectClip,
    onZoomChange,
    onSeek,
    onTrimStart,
    onTrimEnd,
    onContextAction,
}) => {
    const [trackStates, setTrackStates] = useState<TrackStates>(createDefaultTrackStates)
    const [trimDrag, setTrimDrag] = useState<TrimDragState | null>(null)
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [trackHeights, setTrackHeights] = useState<Record<TrackId, number>>(() =>
        Object.fromEntries(TRACK_CONFIGS.map(tc => [tc.id, tc.height])) as Record<TrackId, number>,
    )
    const [splitFlash, setSplitFlash] = useState<number | null>(null)
    const [scrollInfo, setScrollInfo] = useState({ left: 0, width: 0 })

    const scrollRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const trimDragRef = useRef(trimDrag)
    trimDragRef.current = trimDrag

    // ═══ Computed ═══

    const pixelsPerFrame = useMemo(
        () => (BASE_PIXELS_PER_SECOND * timelineState.zoom) / config.fps,
        [timelineState.zoom, config.fps],
    )
    const computedClips = useMemo(() => computeClipPositions(clips), [clips])
    const totalDuration = useMemo(() => calculateTimelineDuration(clips), [clips])
    const totalWidth = Math.max(totalDuration * pixelsPerFrame + TIMELINE_END_PADDING, 800)
    const totalTracksHeight = Object.values(trackHeights).reduce((s, h) => s + h, 0)

    const snapPoints = useMemo(() => {
        const pts: number[] = [0]
        for (const c of computedClips) { pts.push(c.startFrame, c.endFrame) }
        pts.push(totalDuration)
        return [...new Set(pts)].sort((a, b) => a - b)
    }, [computedClips, totalDuration])

    const audioClips = useMemo(() => computedClips.filter(c => c.attachment?.audio), [computedClips])
    const subtitleClips = useMemo(() => computedClips.filter(c => c.attachment?.subtitle), [computedClips])

    // ═══ Snap helper ═══

    const snapFrame = useCallback(
        (frame: number): number => {
            const thresholdFrames = SNAP_THRESHOLD_PX / pixelsPerFrame
            let closest = frame
            let minDist = Infinity
            for (const sp of snapPoints) {
                const dist = Math.abs(frame - sp)
                if (dist < minDist && dist <= thresholdFrames) {
                    minDist = dist
                    closest = sp
                }
            }
            return closest
        },
        [snapPoints, pixelsPerFrame],
    )

    // ═══ DnD ═══

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event
            if (over && active.id !== over.id) {
                const oldIndex = clips.findIndex(c => c.id === active.id)
                const newIndex = clips.findIndex(c => c.id === over.id)
                if (oldIndex !== -1 && newIndex !== -1) onReorder(oldIndex, newIndex)
            }
        },
        [clips, onReorder],
    )

    // ═══ Auto-scroll playhead ═══

    useEffect(() => {
        if (!timelineState.playing || !scrollRef.current) return
        const el = scrollRef.current
        const px = timelineState.currentFrame * pixelsPerFrame
        const margin = el.clientWidth * 0.15
        if (px > el.scrollLeft + el.clientWidth - margin) el.scrollLeft = px - el.clientWidth * 0.3
        else if (px < el.scrollLeft + margin) el.scrollLeft = px - el.clientWidth * 0.7
    }, [timelineState.currentFrame, timelineState.playing, pixelsPerFrame])

    // ═══ Ctrl+Wheel zoom ═══

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        const onWheel = (e: WheelEvent) => {
            if (!(e.ctrlKey || e.metaKey)) return
            e.preventDefault()
            const rect = el.getBoundingClientRect()
            const mouseXInContent = e.clientX - rect.left + el.scrollLeft
            const frameAtMouse = mouseXInContent / pixelsPerFrame
            const delta = e.deltaY > 0 ? -0.15 : 0.15
            const newZoom = Math.max(0.1, Math.min(5, timelineState.zoom + delta))
            onZoomChange(newZoom)
            const newPpf = (BASE_PIXELS_PER_SECOND * newZoom) / config.fps
            requestAnimationFrame(() => { el.scrollLeft = frameAtMouse * newPpf - (e.clientX - rect.left) })
        }
        el.addEventListener('wheel', onWheel, { passive: false })
        return () => el.removeEventListener('wheel', onWheel)
    }, [pixelsPerFrame, timelineState.zoom, config.fps, onZoomChange])

    // ═══ Trim drag with snapping ═══

    const handleTrimMouseDown = useCallback(
        (clipId: string, side: 'start' | 'end', startX: number) => {
            setTrimDrag({ clipId, side, startX, currentDeltaFrames: 0 })
        },
        [],
    )

    useEffect(() => {
        if (!trimDrag) return
        const ppf = pixelsPerFrame
        const { startX, side, clipId } = trimDrag
        const clip = computedClips.find(c => c.id === clipId)
        if (!clip) return

        let lastDelta = 0
        const onMove = (e: MouseEvent) => {
            let rawDelta = Math.round((e.clientX - startX) / ppf)
            const edgeFrame = side === 'start' ? clip.startFrame + rawDelta : clip.endFrame + rawDelta
            const snapped = snapFrame(edgeFrame)
            if (snapped !== edgeFrame) rawDelta += snapped - edgeFrame
            if (rawDelta !== lastDelta) {
                lastDelta = rawDelta
                setTrimDrag(prev => (prev ? { ...prev, currentDeltaFrames: rawDelta } : null))
            }
        }
        const onUp = () => {
            const finalDelta = trimDragRef.current?.currentDeltaFrames ?? 0
            if (finalDelta !== 0) {
                if (side === 'start') onTrimStart(clipId, finalDelta)
                else onTrimEnd(clipId, finalDelta)
            }
            setTrimDrag(null)
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        return () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trimDrag?.clipId, trimDrag?.side, trimDrag?.startX, pixelsPerFrame, computedClips, snapFrame, onTrimStart, onTrimEnd])

    // ═══ Playhead drag with snapping ═══

    const handlePlayheadMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault()
            const content = contentRef.current
            if (!content) return
            const seekAt = (ev: MouseEvent) => {
                const rect = content.getBoundingClientRect()
                const x = ev.clientX - rect.left
                const rawFrame = Math.max(0, Math.min(totalDuration, Math.round(x / pixelsPerFrame)))
                onSeek(snapFrame(rawFrame))
            }
            seekAt(e.nativeEvent)
            const up = () => { window.removeEventListener('mousemove', seekAt); window.removeEventListener('mouseup', up) }
            window.addEventListener('mousemove', seekAt)
            window.addEventListener('mouseup', up)
        },
        [totalDuration, pixelsPerFrame, onSeek, snapFrame],
    )

    // ═══ Multi-select + click-to-seek ═══

    const handleClipClick = useCallback(
        (clip: ComputedClip, e: React.MouseEvent) => {
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                setSelectedIds(prev => {
                    const next = new Set(prev)
                    if (next.has(clip.id)) next.delete(clip.id)
                    else next.add(clip.id)
                    return next
                })
            } else {
                setSelectedIds(new Set([clip.id]))
            }
            onSelectClip(clip.id)
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const xInClip = e.clientX - rect.left
            const frame = clip.startFrame + Math.round(xInClip / pixelsPerFrame)
            onSeek(snapFrame(Math.max(0, Math.min(totalDuration, frame))))
        },
        [onSelectClip, pixelsPerFrame, onSeek, snapFrame, totalDuration],
    )

    // ═══ Context menu ═══

    const handleClipContextMenu = useCallback(
        (clipId: string, e: React.MouseEvent) => {
            e.preventDefault()
            setContextMenu({ clipId, x: e.clientX, y: e.clientY })
        },
        [],
    )

    const handleContextAction = useCallback(
        (action: ContextAction) => {
            if (!contextMenu) return
            onContextAction(action, contextMenu.clipId)
            setContextMenu(null)
        },
        [contextMenu, onContextAction],
    )

    // ═══ Split flash ═══

    useEffect(() => {
        if (splitIndicatorFrame == null) return
        setSplitFlash(splitIndicatorFrame)
        const timer = setTimeout(() => setSplitFlash(null), 600)
        return () => clearTimeout(timer)
    }, [splitIndicatorFrame])

    // ═══ Track toggles ═══

    const toggleTrack = useCallback(
        (trackId: keyof TrackStates, prop: 'locked' | 'hidden' | 'muted') => {
            setTrackStates(prev => ({
                ...prev,
                [trackId]: { ...prev[trackId], [prop]: !prev[trackId][prop] },
            }))
        },
        [],
    )

    // ═══ Track resize ═══

    const handleTrackResizeStart = useCallback(
        (trackId: TrackId, e: React.MouseEvent) => {
            e.preventDefault()
            let lastY = e.clientY
            const onMove = (ev: MouseEvent) => {
                const delta = ev.clientY - lastY
                lastY = ev.clientY
                setTrackHeights(prev => ({
                    ...prev,
                    [trackId]: Math.max(MIN_TRACK_HEIGHT, Math.min(MAX_TRACK_HEIGHT, prev[trackId] + delta)),
                }))
            }
            const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
            window.addEventListener('mousemove', onMove)
            window.addEventListener('mouseup', onUp)
        },
        [],
    )

    // ═══ Scroll tracking for minimap ═══

    const handleScroll = useCallback(() => {
        if (scrollRef.current) {
            setScrollInfo({ left: scrollRef.current.scrollLeft, width: scrollRef.current.clientWidth })
        }
    }, [])

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        setScrollInfo({ left: el.scrollLeft, width: el.clientWidth })
        el.addEventListener('scroll', handleScroll, { passive: true })
        return () => el.removeEventListener('scroll', handleScroll)
    }, [handleScroll])

    const handleMinimapNavigate = useCallback((scrollLeft: number) => {
        if (scrollRef.current) scrollRef.current.scrollLeft = scrollLeft
    }, [])

    // ═══ Track row renderer ═══

    const trackOrder: TrackId[] = ['video', 'voice', 'subtitle', 'effect', 'bgm']
    const playheadX = timelineState.currentFrame * pixelsPerFrame

    function renderTrackContent(trackId: TrackId) {
        switch (trackId) {
            case 'video':
                return !trackStates.video.hidden ? (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={clips.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                            {computedClips.map((clip, i) => (
                                <ClipBlock
                                    key={clip.id}
                                    clip={clip}
                                    clipIndex={i}
                                    pixelsPerFrame={pixelsPerFrame}
                                    isSelected={timelineState.selectedClipId === clip.id}
                                    isMultiSelected={selectedIds.has(clip.id) && timelineState.selectedClipId !== clip.id}
                                    fps={config.fps}
                                    trackLocked={trackStates.video.locked}
                                    trimDrag={trimDrag}
                                    onClick={e => handleClipClick(clip, e)}
                                    onContextMenu={e => handleClipContextMenu(clip.id, e)}
                                    onTrimMouseDown={handleTrimMouseDown}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                ) : null
            case 'voice':
                return !trackStates.voice.hidden ? audioClips.map(c => (
                    <AudioClipBlock key={`a-${c.id}`} clip={c} pixelsPerFrame={pixelsPerFrame} isSelected={timelineState.selectedClipId === c.id} />
                )) : null
            case 'subtitle':
                return !trackStates.subtitle.hidden ? subtitleClips.map(c => (
                    <SubtitleBlock key={`s-${c.id}`} clip={c} pixelsPerFrame={pixelsPerFrame} isSelected={timelineState.selectedClipId === c.id} />
                )) : null
            case 'effect':
                return null
            case 'bgm':
                return !trackStates.bgm.hidden ? bgmClips.map(c => (
                    <BgmClipBlock key={c.id} clip={c} pixelsPerFrame={pixelsPerFrame} fps={config.fps} />
                )) : null
        }
    }

    return (
        <div className="flex flex-col h-full bg-[#0d0d1a] select-none">
            {/* Main area */}
            <div className="flex flex-1 min-h-0">
                {/* Track headers */}
                <div className="flex flex-col flex-shrink-0 bg-[#111122] border-r" style={{ width: TRACK_HEADER_WIDTH, borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex-shrink-0 border-b" style={{ height: RULER_HEIGHT, borderColor: 'rgba(255,255,255,0.06)' }} />
                    {trackOrder.map(tid => {
                        const tc = TRACK_CONFIGS.find(c => c.id === tid)!
                        return (
                            <React.Fragment key={tid}>
                                <TrackHeader
                                    config={{ ...tc, height: trackHeights[tid] }}
                                    state={trackStates[tid]}
                                    onToggleLock={() => toggleTrack(tid, 'locked')}
                                    onToggleHide={() => toggleTrack(tid, 'hidden')}
                                    onToggleMute={() => toggleTrack(tid, 'muted')}
                                />
                                {/* Resize handle */}
                                <div
                                    className="h-[3px] cursor-row-resize hover:bg-blue-500/30 transition-colors flex-shrink-0"
                                    style={{ background: TRACK_BORDER }}
                                    onMouseDown={e => handleTrackResizeStart(tid, e)}
                                />
                            </React.Fragment>
                        )
                    })}
                </div>

                {/* Scrollable timeline */}
                <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden">
                    <div ref={contentRef} className="relative" style={{ width: totalWidth, minWidth: '100%' }}>
                        <TimeRuler totalDurationFrames={totalDuration} pixelsPerFrame={pixelsPerFrame} fps={config.fps} totalWidth={totalWidth} onSeek={f => onSeek(snapFrame(f))} />

                        {trackOrder.map(tid => (
                            <React.Fragment key={tid}>
                                <div
                                    className="relative"
                                    style={{
                                        height: trackHeights[tid],
                                        borderBottom: `1px solid ${TRACK_BORDER}`,
                                        background: trackStates[tid].hidden ? 'transparent' : TRACK_CONFIGS.find(c => c.id === tid)!.colorDim,
                                    }}
                                >
                                    {renderTrackContent(tid)}
                                    {tid === 'video' && clips.length === 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>
                                            Drop clips here
                                        </div>
                                    )}
                                </div>
                                {/* Resize handle (content side) */}
                                <div
                                    className="h-[3px] cursor-row-resize hover:bg-blue-500/30 transition-colors flex-shrink-0"
                                    style={{ background: TRACK_BORDER }}
                                    onMouseDown={e => handleTrackResizeStart(tid, e)}
                                />
                            </React.Fragment>
                        ))}

                        {/* Playhead */}
                        <Playhead x={playheadX} rulerHeight={RULER_HEIGHT} totalHeight={RULER_HEIGHT + totalTracksHeight + trackOrder.length * 3} onHeadMouseDown={handlePlayheadMouseDown} />

                        {/* Split flash */}
                        {splitFlash != null && (
                            <div
                                className="absolute pointer-events-none"
                                style={{
                                    left: splitFlash * pixelsPerFrame,
                                    top: RULER_HEIGHT,
                                    bottom: 0,
                                    width: 2,
                                    background: '#22d3ee',
                                    boxShadow: '0 0 12px 3px rgba(34,211,238,0.6)',
                                    animation: 'split-flash 0.6s ease-out forwards',
                                    transform: 'translateX(-1px)',
                                    zIndex: 60,
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Minimap */}
            <TimelineMinimap
                totalDuration={totalDuration}
                computedClips={computedClips}
                bgmClips={bgmClips}
                currentFrame={timelineState.currentFrame}
                scrollLeft={scrollInfo.left}
                viewportWidth={scrollInfo.width}
                totalWidth={totalWidth}
                onNavigate={handleMinimapNavigate}
            />

            {/* Context menu */}
            {contextMenu && (
                <ClipContextMenu
                    state={contextMenu}
                    onAction={handleContextAction}
                    onClose={() => setContextMenu(null)}
                />
            )}

            {/* Split flash keyframe (injected once) */}
            <style>{`
                @keyframes split-flash {
                    0% { opacity: 1; box-shadow: 0 0 12px 3px rgba(34,211,238,0.6); }
                    100% { opacity: 0; box-shadow: 0 0 0 0 transparent; }
                }
            `}</style>
        </div>
    )
}

export default Timeline
