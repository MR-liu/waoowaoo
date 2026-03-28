'use client'

import React from 'react'
import type { ComputedClip } from '../../types/editor.types'

interface SubtitleBlockProps {
    clip: ComputedClip
    pixelsPerFrame: number
    isSelected: boolean
}

export const SubtitleBlock: React.FC<SubtitleBlockProps> = ({
    clip,
    pixelsPerFrame,
    isSelected,
}) => {
    const left = clip.startFrame * pixelsPerFrame
    const width = clip.durationInFrames * pixelsPerFrame
    const text = clip.attachment?.subtitle?.text ?? ''

    return (
        <div
            className="absolute top-0.5 bottom-0.5 rounded overflow-hidden flex items-center px-1.5"
            style={{
                left,
                width,
                background: isSelected
                    ? 'rgba(245,158,11,0.2)'
                    : 'rgba(245,158,11,0.1)',
                border: isSelected
                    ? '1px solid rgba(245,158,11,0.5)'
                    : '1px solid rgba(245,158,11,0.2)',
            }}
        >
            <span
                className="truncate font-medium"
                style={{
                    fontSize: 9,
                    color: isSelected
                        ? 'rgba(245,158,11,0.9)'
                        : 'rgba(245,158,11,0.6)',
                    lineHeight: 1.2,
                }}
            >
                {text}
            </span>
        </div>
    )
}
