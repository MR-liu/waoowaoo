'use client'

import React, { useCallback } from 'react'
import type { ComputedClip, BgmClip } from '../../types/editor.types'
import { MINIMAP_HEIGHT } from './timeline-constants'

interface TimelineMinimapProps {
    totalDuration: number
    computedClips: ComputedClip[]
    bgmClips: BgmClip[]
    currentFrame: number
    scrollLeft: number
    viewportWidth: number
    totalWidth: number
    onNavigate: (scrollLeft: number) => void
}

export const TimelineMinimap: React.FC<TimelineMinimapProps> = ({
    totalDuration,
    computedClips,
    bgmClips,
    currentFrame,
    scrollLeft,
    viewportWidth,
    totalWidth,
    onNavigate,
}) => {
    const safeTotal = totalDuration || 1

    const vpLeftPct = (scrollLeft / Math.max(totalWidth, 1)) * 100
    const vpWidthPct = Math.max((viewportWidth / Math.max(totalWidth, 1)) * 100, 2)
    const playheadPct = (currentFrame / safeTotal) * 100

    const handleClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const clickPct = (e.clientX - rect.left) / rect.width
            const targetScroll = clickPct * totalWidth - viewportWidth / 2
            onNavigate(Math.max(0, targetScroll))
        },
        [totalWidth, viewportWidth, onNavigate],
    )

    const handleDrag = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault()
            e.stopPropagation()
            const container = e.currentTarget.parentElement
            if (!container) return

            const startX = e.clientX
            const startScroll = scrollLeft

            const onMove = (ev: MouseEvent) => {
                const rect = container.getBoundingClientRect()
                const deltaPct = (ev.clientX - startX) / rect.width
                const deltaScroll = deltaPct * totalWidth
                onNavigate(Math.max(0, startScroll + deltaScroll))
            }
            const onUp = () => {
                window.removeEventListener('mousemove', onMove)
                window.removeEventListener('mouseup', onUp)
            }
            window.addEventListener('mousemove', onMove)
            window.addEventListener('mouseup', onUp)
        },
        [scrollLeft, totalWidth, onNavigate],
    )

    return (
        <div
            className="relative flex-shrink-0 cursor-pointer"
            style={{
                height: MINIMAP_HEIGHT,
                background: '#08081a',
                borderTop: '1px solid rgba(255,255,255,0.05)',
            }}
            onClick={handleClick}
        >
            {/* Video clips */}
            {computedClips.map(clip => (
                <div
                    key={clip.id}
                    className="absolute rounded-sm"
                    style={{
                        left: `${(clip.startFrame / safeTotal) * 100}%`,
                        width: `${Math.max((clip.durationInFrames / safeTotal) * 100, 0.3)}%`,
                        top: 3,
                        height: 6,
                        background: 'rgba(59,130,246,0.5)',
                    }}
                />
            ))}

            {/* BGM clips */}
            {bgmClips.map(clip => (
                <div
                    key={clip.id}
                    className="absolute rounded-sm"
                    style={{
                        left: `${(clip.startFrame / safeTotal) * 100}%`,
                        width: `${Math.max((clip.durationInFrames / safeTotal) * 100, 0.3)}%`,
                        bottom: 3,
                        height: 4,
                        background: 'rgba(236,72,153,0.4)',
                    }}
                />
            ))}

            {/* Viewport indicator */}
            <div
                className="absolute top-0 bottom-0 cursor-grab active:cursor-grabbing"
                style={{
                    left: `${vpLeftPct}%`,
                    width: `${vpWidthPct}%`,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 2,
                    minWidth: 8,
                }}
                onMouseDown={handleDrag}
                onClick={e => e.stopPropagation()}
            />

            {/* Playhead */}
            <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                    left: `${playheadPct}%`,
                    width: 1,
                    background: '#ff4444',
                }}
            />
        </div>
    )
}
