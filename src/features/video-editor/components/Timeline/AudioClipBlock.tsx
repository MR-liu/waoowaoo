'use client'

import React, { useMemo } from 'react'
import type { ComputedClip } from '../../types/editor.types'

interface AudioClipBlockProps {
    clip: ComputedClip
    pixelsPerFrame: number
    isSelected: boolean
}

export const AudioClipBlock: React.FC<AudioClipBlockProps> = ({
    clip,
    pixelsPerFrame,
    isSelected,
}) => {
    const left = clip.startFrame * pixelsPerFrame
    const width = clip.durationInFrames * pixelsPerFrame
    const barCount = Math.max(4, Math.floor(width / 3))

    const bars = useMemo(() => generateWaveformBars(clip.id, barCount), [clip.id, barCount])

    return (
        <div
            className="absolute top-0.5 bottom-0.5 rounded overflow-hidden"
            style={{
                left,
                width,
                background: isSelected
                    ? 'rgba(34,197,94,0.2)'
                    : 'rgba(34,197,94,0.1)',
                border: isSelected
                    ? '1px solid rgba(34,197,94,0.5)'
                    : '1px solid rgba(34,197,94,0.2)',
            }}
        >
            {/* Waveform visualization */}
            <div className="flex items-end h-full px-0.5 gap-px">
                {bars.map((height, i) => (
                    <div
                        key={i}
                        className="flex-1 min-w-0 rounded-sm"
                        style={{
                            height: `${height * 80}%`,
                            background: isSelected
                                ? 'rgba(34,197,94,0.6)'
                                : 'rgba(34,197,94,0.35)',
                            maxWidth: 3,
                        }}
                    />
                ))}
            </div>
        </div>
    )
}

function generateWaveformBars(clipId: string, barCount: number): number[] {
    let seed = 0
    for (let i = 0; i < clipId.length; i++) {
        seed = ((seed << 5) - seed) + clipId.charCodeAt(i)
        seed |= 0
    }

    const bars: number[] = []
    for (let i = 0; i < barCount; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        const base = 0.15 + (seed % 100) / 100 * 0.85
        const envelope = Math.sin((i / barCount) * Math.PI) * 0.4 + 0.6
        bars.push(base * envelope)
    }
    return bars
}
