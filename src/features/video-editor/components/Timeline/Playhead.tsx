'use client'

import React from 'react'

interface PlayheadProps {
    x: number
    rulerHeight: number
    totalHeight: number
    onHeadMouseDown: (e: React.MouseEvent) => void
}

export const Playhead: React.FC<PlayheadProps> = ({
    x,
    rulerHeight,
    totalHeight,
    onHeadMouseDown,
}) => {
    return (
        <div
            className="absolute top-0 pointer-events-none"
            style={{
                left: x,
                height: totalHeight,
                zIndex: 50,
                transform: 'translateX(-50%)',
            }}
        >
            {/* Draggable triangle head */}
            <div
                className="absolute pointer-events-auto cursor-grab active:cursor-grabbing"
                style={{ top: rulerHeight - 14, left: '50%', transform: 'translateX(-50%)' }}
                onMouseDown={onHeadMouseDown}
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                        d="M2 0H12C12.5 0 13 0.3 13 0.8V6L7.7 12.6C7.3 13.1 6.7 13.1 6.3 12.6L1 6V0.8C1 0.3 1.5 0 2 0Z"
                        fill="#ff4444"
                    />
                </svg>
            </div>

            {/* Vertical line through all tracks */}
            <div
                style={{
                    position: 'absolute',
                    top: rulerHeight,
                    bottom: 0,
                    left: '50%',
                    width: 2,
                    transform: 'translateX(-1px)',
                    background: '#ff4444',
                    boxShadow: '0 0 6px rgba(255,68,68,0.4)',
                }}
            />
        </div>
    )
}
