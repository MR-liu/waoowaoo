import type { TrackConfig, TrackStates } from './timeline-types'

export const TRACK_HEADER_WIDTH = 140
export const BASE_PIXELS_PER_SECOND = 100
export const RULER_HEIGHT = 28
export const TRIM_HANDLE_WIDTH = 6
export const MIN_CLIP_WIDTH_PX = 20
export const TIMELINE_END_PADDING = 200
export const TRACK_BORDER = 'rgba(255,255,255,0.06)'
export const SNAP_THRESHOLD_PX = 8
export const MIN_TRACK_HEIGHT = 24
export const MAX_TRACK_HEIGHT = 120
export const MINIMAP_HEIGHT = 22

export const TRACK_CONFIGS: TrackConfig[] = [
    { id: 'video', icon: 'film', height: 56, color: '#3b82f6', colorDim: 'rgba(59,130,246,0.15)', canMute: true },
    { id: 'voice', icon: 'mic', height: 36, color: '#22c55e', colorDim: 'rgba(34,197,94,0.12)', canMute: true },
    { id: 'subtitle', icon: 'fileText', height: 32, color: '#f59e0b', colorDim: 'rgba(245,158,11,0.12)', canMute: false },
    { id: 'effect', icon: 'sparkles', height: 28, color: '#a855f7', colorDim: 'rgba(168,85,247,0.12)', canMute: false },
    { id: 'bgm', icon: 'audioWave', height: 36, color: '#ec4899', colorDim: 'rgba(236,72,153,0.12)', canMute: true },
]

export function createDefaultTrackStates(): TrackStates {
    return {
        video: { locked: false, hidden: false, muted: false },
        voice: { locked: false, hidden: false, muted: false },
        subtitle: { locked: false, hidden: false, muted: false },
        effect: { locked: false, hidden: false, muted: false },
        bgm: { locked: false, hidden: false, muted: false },
    }
}
