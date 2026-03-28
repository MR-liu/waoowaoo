'use client'

import React from 'react'
import type { BgmClip } from '../../types/editor.types'
import { framesToTime } from '../../utils/time-utils'

interface BgmClipBlockProps {
    clip: BgmClip
    pixelsPerFrame: number
    fps: number
}

export const BgmClipBlock: React.FC<BgmClipBlockProps> = ({
    clip,
    pixelsPerFrame,
    fps,
}) => {
    const left = clip.startFrame * pixelsPerFrame
    const width = clip.durationInFrames * pixelsPerFrame

    const fadeInWidth = (clip.fadeIn ?? 0) * pixelsPerFrame
    const fadeOutWidth = (clip.fadeOut ?? 0) * pixelsPerFrame

    return (
        <div
            className="absolute top-0.5 bottom-0.5 rounded overflow-hidden"
            style={{
                left,
                width,
                background: 'rgba(236,72,153,0.12)',
                border: '1px solid rgba(236,72,153,0.25)',
            }}
        >
            {/* Fade-in gradient */}
            {fadeInWidth > 0 && (
                <div
                    className="absolute left-0 top-0 bottom-0"
                    style={{
                        width: fadeInWidth,
                        background: 'linear-gradient(90deg, transparent, rgba(236,72,153,0.2))',
                    }}
                />
            )}

            {/* Fade-out gradient */}
            {fadeOutWidth > 0 && (
                <div
                    className="absolute right-0 top-0 bottom-0"
                    style={{
                        width: fadeOutWidth,
                        background: 'linear-gradient(90deg, rgba(236,72,153,0.2), transparent)',
                    }}
                />
            )}

            {/* Label */}
            <div className="flex items-center h-full px-1.5 gap-1">
                <span
                    className="font-medium truncate"
                    style={{ fontSize: 10, color: 'rgba(236,72,153,0.7)' }}
                >
                    BGM
                </span>
                <span
                    className="font-mono"
                    style={{ fontSize: 8, color: 'rgba(236,72,153,0.45)' }}
                >
                    {framesToTime(clip.durationInFrames, fps)}
                </span>
            </div>
        </div>
    )
}
