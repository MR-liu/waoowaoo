'use client'

import React, { useMemo } from 'react'
import { RULER_HEIGHT } from './timeline-constants'

interface TimeRulerProps {
    totalDurationFrames: number
    pixelsPerFrame: number
    fps: number
    totalWidth: number
    onSeek: (frame: number) => void
}

interface TickInterval {
    majorFrames: number
    minorFrames: number
}

function calculateTickIntervals(pixelsPerFrame: number, fps: number): TickInterval {
    const candidates = [
        1, 2, 5, 10,
        Math.round(fps / 4),
        Math.round(fps / 2),
        fps,
        fps * 2,
        fps * 5,
        fps * 10,
        fps * 30,
        fps * 60,
    ]
        .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
        .sort((a, b) => a - b)

    const MIN_MAJOR_PX = 80
    const MIN_MINOR_PX = 15

    let majorFrames = candidates[candidates.length - 1]
    for (const c of candidates) {
        if (c * pixelsPerFrame >= MIN_MAJOR_PX) {
            majorFrames = c
            break
        }
    }

    let minorFrames = 0
    for (const c of candidates) {
        if (c * pixelsPerFrame >= MIN_MINOR_PX && c < majorFrames) {
            minorFrames = c
            break
        }
    }

    return { majorFrames, minorFrames }
}

function formatTickLabel(frame: number, fps: number, showFrames: boolean): string {
    const totalSeconds = frame / fps
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = Math.floor(totalSeconds % 60)
    const remainingFrames = Math.round(frame % fps)

    if (showFrames && remainingFrames !== 0) {
        return `${minutes}:${seconds.toString().padStart(2, '0')}:${remainingFrames.toString().padStart(2, '0')}f`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

interface TickData {
    frame: number
    isMajor: boolean
    x: number
}

export const TimeRuler: React.FC<TimeRulerProps> = ({
    totalDurationFrames,
    pixelsPerFrame,
    fps,
    totalWidth,
    onSeek,
}) => {
    const { majorFrames, minorFrames } = useMemo(
        () => calculateTickIntervals(pixelsPerFrame, fps),
        [pixelsPerFrame, fps],
    )

    const showFrameLabels = majorFrames < fps

    const ticks = useMemo(() => {
        const result: TickData[] = []
        const maxFrame = totalDurationFrames + fps * 2
        const tickStep = minorFrames || majorFrames

        for (let frame = 0; frame <= maxFrame; frame += tickStep) {
            result.push({
                frame,
                isMajor: frame % majorFrames === 0,
                x: frame * pixelsPerFrame,
            })
            if (result.length > 1500) break
        }
        return result
    }, [totalDurationFrames, majorFrames, minorFrames, pixelsPerFrame, fps])

    const handleClick = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const frame = Math.max(0, Math.round(x / pixelsPerFrame))
        onSeek(Math.min(frame, totalDurationFrames))
    }

    return (
        <div
            className="relative cursor-pointer select-none border-b"
            style={{
                height: RULER_HEIGHT,
                width: totalWidth,
                borderColor: 'rgba(255,255,255,0.06)',
            }}
            onClick={handleClick}
        >
            {ticks.map(({ frame, isMajor, x }) => (
                <div
                    key={frame}
                    className="absolute"
                    style={{ left: x, bottom: 0 }}
                >
                    <div
                        style={{
                            width: 1,
                            height: isMajor ? 14 : 7,
                            background: isMajor
                                ? 'rgba(255,255,255,0.3)'
                                : 'rgba(255,255,255,0.12)',
                        }}
                    />
                    {isMajor && (
                        <span
                            className="absolute whitespace-nowrap font-mono"
                            style={{
                                fontSize: 9,
                                color: 'rgba(255,255,255,0.4)',
                                bottom: 15,
                                left: 3,
                            }}
                        >
                            {formatTickLabel(frame, fps, showFrameLabels)}
                        </span>
                    )}
                </div>
            ))}
        </div>
    )
}
