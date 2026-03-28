'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ComputedClip } from '../../types/editor.types'
import { framesToTime } from '../../utils/time-utils'
import type { TrimDragState } from './timeline-types'
import { TRIM_HANDLE_WIDTH, MIN_CLIP_WIDTH_PX } from './timeline-constants'

interface ClipBlockProps {
    clip: ComputedClip
    clipIndex: number
    pixelsPerFrame: number
    isSelected: boolean
    isMultiSelected: boolean
    fps: number
    trackLocked: boolean
    trimDrag: TrimDragState | null
    onClick: (e: React.MouseEvent) => void
    onContextMenu: (e: React.MouseEvent) => void
    onTrimMouseDown: (clipId: string, side: 'start' | 'end', startX: number) => void
}

export const ClipBlock: React.FC<ClipBlockProps> = ({
    clip,
    clipIndex,
    pixelsPerFrame,
    isSelected,
    isMultiSelected,
    fps,
    trackLocked,
    trimDrag,
    onClick,
    onContextMenu,
    onTrimMouseDown,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: clip.id, disabled: trackLocked })

    const isBeingTrimmed = trimDrag?.clipId === clip.id
    let visualLeft = clip.startFrame * pixelsPerFrame
    let visualWidth = clip.durationInFrames * pixelsPerFrame

    if (isBeingTrimmed && trimDrag) {
        const deltaPx = trimDrag.currentDeltaFrames * pixelsPerFrame
        if (trimDrag.side === 'start') {
            visualLeft += deltaPx
            visualWidth -= deltaPx
        } else {
            visualWidth += deltaPx
        }
    }
    visualWidth = Math.max(MIN_CLIP_WIDTH_PX, visualWidth)

    const speed = clip.speed ?? 1
    const hasSpeedChange = speed !== 1
    const isFrozen = !!clip.frozen
    const isReversed = !!clip.reversed
    const hasTransition = clip.transition && clip.transition.type !== 'none'

    const highlighted = isSelected || isMultiSelected
    const borderColor = isSelected
        ? 'rgba(59,130,246,0.7)'
        : isMultiSelected
            ? 'rgba(59,130,246,0.4)'
            : 'rgba(255,255,255,0.1)'

    const sortableStyle: React.CSSProperties = {
        position: 'absolute',
        left: visualLeft,
        width: visualWidth,
        height: '100%',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 100 : isSelected ? 10 : 1,
    }

    const handleLeftTrim = (e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        if (trackLocked) return
        onTrimMouseDown(clip.id, 'start', e.clientX)
    }

    const handleRightTrim = (e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        if (trackLocked) return
        onTrimMouseDown(clip.id, 'end', e.clientX)
    }

    return (
        <div
            ref={setNodeRef}
            style={sortableStyle}
            onClick={onClick}
            onContextMenu={onContextMenu}
            className="group"
        >
            <div
                className="relative h-full rounded overflow-hidden"
                style={{
                    background: highlighted
                        ? 'linear-gradient(135deg, rgba(59,130,246,0.35), rgba(59,130,246,0.2))'
                        : 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
                    border: `${isSelected ? 1.5 : 1}px solid ${borderColor}`,
                    cursor: isDragging ? 'grabbing' : trackLocked ? 'default' : 'pointer',
                }}
                {...attributes}
                {...listeners}
            >
                {/* Thumbnail placeholder */}
                <div
                    className="absolute inset-0"
                    style={{
                        background: `linear-gradient(90deg, ${thumbnailGradient(clipIndex)})`,
                        opacity: 0.3,
                    }}
                />

                {/* Clip index */}
                <div
                    className="absolute top-1 left-1.5 font-mono font-bold"
                    style={{ fontSize: 11, color: highlighted ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)' }}
                >
                    {clipIndex + 1}
                </div>

                {/* Duration label */}
                <div
                    className="absolute bottom-1 left-1.5 font-mono"
                    style={{ fontSize: 9, color: highlighted ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)' }}
                >
                    {framesToTime(clip.durationInFrames, fps)}
                </div>

                {/* Badges */}
                <div className="absolute top-1 right-1.5 flex gap-0.5">
                    {hasSpeedChange && <Badge color="#f59e0b" label={`${speed}x`} />}
                    {isFrozen && <Badge color="#3b82f6" label="F" title="Frozen" />}
                    {isReversed && <Badge color="#a855f7" label="R" title="Reversed" />}
                </div>

                {/* Transition indicator */}
                {hasTransition && (
                    <div
                        className="absolute right-0 top-0 bottom-0 flex items-center justify-center"
                        style={{
                            width: Math.max(12, (clip.transition?.durationInFrames ?? 0) * pixelsPerFrame),
                            background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.25))',
                        }}
                    >
                        <span style={{ fontSize: 8, color: '#f59e0b' }}>
                            {clip.transition?.type?.charAt(0).toUpperCase()}
                        </span>
                    </div>
                )}

                {/* Left trim handle */}
                <div
                    className="absolute left-0 top-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                        width: TRIM_HANDLE_WIDTH,
                        cursor: trackLocked ? 'default' : 'col-resize',
                        background: isBeingTrimmed && trimDrag?.side === 'start' ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.2)',
                        borderRadius: '4px 0 0 4px',
                        zIndex: 20,
                    }}
                    onMouseDown={handleLeftTrim}
                />

                {/* Right trim handle */}
                <div
                    className="absolute right-0 top-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                        width: TRIM_HANDLE_WIDTH,
                        cursor: trackLocked ? 'default' : 'col-resize',
                        background: isBeingTrimmed && trimDrag?.side === 'end' ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.2)',
                        borderRadius: '0 4px 4px 0',
                        zIndex: 20,
                    }}
                    onMouseDown={handleRightTrim}
                />
            </div>
        </div>
    )
}

function Badge({ color, label, title }: { color: string; label: string; title?: string }) {
    return (
        <span
            className="px-1 rounded font-mono font-semibold"
            style={{ fontSize: 8, lineHeight: '14px', background: `${color}33`, color, border: `1px solid ${color}55` }}
            title={title}
        >
            {label}
        </span>
    )
}

function thumbnailGradient(index: number): string {
    const palettes = [
        'hsl(220,50%,25%) 0%, hsl(220,40%,18%) 100%',
        'hsl(200,50%,25%) 0%, hsl(200,40%,18%) 100%',
        'hsl(260,50%,25%) 0%, hsl(260,40%,18%) 100%',
        'hsl(180,50%,22%) 0%, hsl(180,40%,16%) 100%',
        'hsl(300,40%,22%) 0%, hsl(300,30%,16%) 100%',
        'hsl(340,50%,25%) 0%, hsl(340,40%,18%) 100%',
    ]
    return palettes[index % palettes.length]
}
