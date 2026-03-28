'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/icons'
import type { TrackConfig, TrackState } from './timeline-types'
import { TRACK_HEADER_WIDTH } from './timeline-constants'

interface TrackHeaderProps {
    config: TrackConfig
    state: TrackState
    onToggleLock: () => void
    onToggleHide: () => void
    onToggleMute: () => void
}

export const TrackHeader: React.FC<TrackHeaderProps> = ({
    config,
    state,
    onToggleLock,
    onToggleHide,
    onToggleMute,
}) => {
    return (
        <div
            className="flex items-center gap-1.5 px-2 border-b flex-shrink-0"
            style={{
                width: TRACK_HEADER_WIDTH,
                height: config.height,
                borderColor: 'rgba(255,255,255,0.06)',
                opacity: state.hidden ? 0.4 : 1,
            }}
        >
            <AppIcon
                name={config.icon}
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: config.color }}
            />
            <span
                className="text-[11px] font-medium truncate flex-1"
                style={{ color: 'rgba(255,255,255,0.6)' }}
            >
                {config.id.charAt(0).toUpperCase() + config.id.slice(1)}
            </span>

            <div className="flex items-center gap-0.5">
                <HeaderButton
                    active={state.locked}
                    icon={state.locked ? 'lock' : 'lock'}
                    activeColor="rgba(255,255,255,0.7)"
                    onClick={onToggleLock}
                    title={state.locked ? 'Unlock' : 'Lock'}
                />
                <HeaderButton
                    active={!state.hidden}
                    icon={state.hidden ? 'eyeOff' : 'eye'}
                    activeColor="rgba(255,255,255,0.5)"
                    onClick={onToggleHide}
                    title={state.hidden ? 'Show' : 'Hide'}
                />
                {config.canMute && (
                    <HeaderButton
                        active={state.muted}
                        icon={state.muted ? 'volumeOff' : 'audioWave'}
                        activeColor="#ff6b6b"
                        onClick={onToggleMute}
                        title={state.muted ? 'Unmute' : 'Mute'}
                    />
                )}
            </div>
        </div>
    )
}

function HeaderButton({
    active,
    icon,
    activeColor,
    onClick,
    title,
}: {
    active: boolean
    icon: Parameters<typeof AppIcon>[0]['name']
    activeColor: string
    onClick: () => void
    title: string
}) {
    return (
        <button
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
            onClick={onClick}
            title={title}
        >
            <AppIcon
                name={icon}
                className="w-3 h-3"
                style={{ color: active ? activeColor : 'rgba(255,255,255,0.2)' }}
            />
        </button>
    )
}
