import type { AppIconName } from '@/components/ui/icons/registry'

export type TrackId = 'video' | 'voice' | 'subtitle' | 'effect' | 'bgm'

export interface TrackConfig {
    id: TrackId
    icon: AppIconName
    height: number
    color: string
    colorDim: string
    canMute: boolean
}

export interface TrackState {
    locked: boolean
    hidden: boolean
    muted: boolean
}

export type TrackStates = Record<TrackId, TrackState>

export interface TrimDragState {
    clipId: string
    side: 'start' | 'end'
    startX: number
    currentDeltaFrames: number
}

export type ContextAction = 'split' | 'delete' | 'copy' | 'paste' | 'reverse' | 'freeze'

export interface ContextMenuState {
    clipId: string
    x: number
    y: number
}
