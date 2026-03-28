'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { AppIcon } from '@/components/ui/icons'
import { AnnotationCanvas } from './AnnotationCanvas'
import { Watermark } from '@/components/Watermark'

interface Point {
  x: number
  y: number
}

interface Annotation {
  id: string
  tool: 'pen' | 'arrow' | 'rect' | 'text' | 'eraser'
  points: Point[]
  color: string
  text?: string
  frameNumber?: number
}

type PlaybackSpeed = 0.25 | 0.5 | 1 | 1.5 | 2

const PLAYBACK_SPEEDS: PlaybackSpeed[] = [0.25, 0.5, 1, 1.5, 2]
const FRAME_RATE = 24

interface WebPlayerProps {
  src: string
  poster?: string
  annotations?: Annotation[]
  onAnnotate?: (annotations: Annotation[]) => void
  onApprove?: () => void
  onReject?: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function timeToFrame(time: number, fps: number): number {
  return Math.floor(time * fps)
}

export function WebPlayer({
  src,
  poster,
  annotations = [],
  onAnnotate,
  onApprove,
  onReject,
}: WebPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [videoSize, setVideoSize] = useState({ width: 1920, height: 1080 })
  const [isHlsSource, setIsHlsSource] = useState(false)
  const [hlsError, setHlsError] = useState<string | null>(null)

  const currentFrame = timeToFrame(currentTime, FRAME_RATE)
  const totalFrames = timeToFrame(duration, FRAME_RATE)
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  useEffect(() => {
    const isHls = src.endsWith('.m3u8')
    setIsHlsSource(isHls)

    if (!isHls) {
      setHlsError(null)
      return
    }

    const video = videoRef.current
    if (!video) return

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      setHlsError(null)
    } else {
      setHlsError(
        'HLS streaming requires HLS.js. Install hls.js and integrate it for non-Safari browsers.',
      )
    }
  }, [src])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onTimeUpdate = () => setCurrentTime(video.currentTime)
    const onLoadedMetadata = () => {
      setDuration(video.duration)
      setVideoSize({
        width: video.videoWidth || 1920,
        height: video.videoHeight || 1080,
      })
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => setIsPlaying(false)

    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('ended', onEnded)

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('ended', onEnded)
    }
  }, [])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void video.play()
    } else {
      video.pause()
    }
  }, [])

  const seek = useCallback((time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, Math.min(time, video.duration || 0))
  }, [])

  const stepFrame = useCallback(
    (direction: 1 | -1) => {
      const video = videoRef.current
      if (!video) return
      video.pause()
      const frameDuration = 1 / FRAME_RATE
      seek(video.currentTime + direction * frameDuration)
    },
    [seek],
  )

  const setSpeed = useCallback((speed: PlaybackSpeed) => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = speed
    setPlaybackSpeed(speed)
    setShowSpeedMenu(false)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    if (!document.fullscreenElement) {
      void container.requestFullscreen()
      setIsFullscreen(true)
    } else {
      void document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          stepFrame(-1)
          break
        case 'ArrowRight':
          e.preventDefault()
          stepFrame(1)
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, stepFrame, toggleFullscreen])

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const timeline = timelineRef.current
    if (!timeline || duration <= 0) return
    const rect = timeline.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seek(ratio * duration)
  }

  const currentAnnotations = annotations.filter(
    (a) => a.frameNumber === undefined || a.frameNumber === currentFrame,
  )

  return (
    <div
      ref={containerRef}
      className="glass-surface-elevated flex flex-col overflow-hidden"
    >
      {/* Video Area */}
      <Watermark>
      <div className="relative bg-black aspect-video">
        {hlsError ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="glass-surface p-4 text-center max-w-md">
              <AppIcon name="alert" className="w-8 h-8 text-[var(--glass-tone-warning-fg)] mx-auto mb-2" />
              <p className="text-sm text-[var(--glass-text-secondary)]">{hlsError}</p>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={isHlsSource ? undefined : src}
            poster={poster}
            className="w-full h-full object-contain"
            preload="metadata"
            onClick={togglePlay}
          />
        )}

        {showAnnotations && currentAnnotations.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            <AnnotationCanvas
              imageUrl=""
              width={videoSize.width}
              height={videoSize.height}
              annotations={currentAnnotations}
              readOnly
            />
          </div>
        )}

        {!isPlaying && !hlsError && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity hover:bg-black/30"
          >
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <AppIcon name="play" className="w-8 h-8 text-white ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="px-3 pt-2">
        <div
          ref={timelineRef}
          className="relative h-2 bg-[var(--glass-bg-muted)] rounded-full cursor-pointer group"
          onClick={handleTimelineClick}
        >
          <div
            className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-[var(--glass-accent-from)] to-[var(--glass-accent-to)]"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>
      </div>
      </Watermark>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          className="glass-icon-btn-sm"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          <AppIcon
            name={isPlaying ? 'pause' : 'play'}
            className="w-4 h-4"
          />
        </button>

        {/* Frame stepping */}
        <button
          onClick={() => stepFrame(-1)}
          className="glass-icon-btn-sm"
          title="Previous frame"
        >
          <AppIcon name="chevronLeft" className="w-4 h-4" />
        </button>
        <button
          onClick={() => stepFrame(1)}
          className="glass-icon-btn-sm"
          title="Next frame"
        >
          <AppIcon name="chevronRight" className="w-4 h-4" />
        </button>

        {/* Time / Frame display */}
        <span className="text-xs text-[var(--glass-text-tertiary)] font-mono tabular-nums min-w-[120px]">
          {formatTime(currentTime)} / {formatTime(duration)}
          <span className="ml-2 text-[var(--glass-text-tertiary)]">
            F{currentFrame}/{totalFrames}
          </span>
        </span>

        <div className="flex-1" />

        {/* Speed control */}
        <div className="relative">
          <button
            onClick={() => setShowSpeedMenu((v) => !v)}
            className="glass-btn-base glass-btn-ghost px-2 py-1 text-xs"
          >
            {playbackSpeed}x
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-full right-0 mb-1 glass-surface-modal p-1 min-w-[64px] z-50">
              {PLAYBACK_SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`block w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors ${
                    s === playbackSpeed
                      ? 'bg-[var(--glass-accent-from)] text-white'
                      : 'text-[var(--glass-text-secondary)] hover:bg-[var(--glass-bg-muted)]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Annotation toggle */}
        <button
          onClick={() => setShowAnnotations((v) => !v)}
          className={`glass-icon-btn-sm ${showAnnotations ? 'text-[var(--glass-accent-from)]' : ''}`}
          title="Toggle annotations"
        >
          <AppIcon name="edit" className="w-4 h-4" />
        </button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="glass-icon-btn-sm"
          title="Fullscreen"
        >
          <AppIcon name="monitor" className="w-4 h-4" />
        </button>

        {/* Approve / Reject */}
        {onApprove && (
          <button
            onClick={onApprove}
            className="glass-btn-base glass-btn-tone-success px-3 py-1 text-xs"
          >
            <AppIcon name="check" className="w-3.5 h-3.5" />
            Approve
          </button>
        )}
        {onReject && (
          <button
            onClick={onReject}
            className="glass-btn-base glass-btn-tone-danger px-3 py-1 text-xs"
          >
            <AppIcon name="close" className="w-3.5 h-3.5" />
            Reject
          </button>
        )}
      </div>
    </div>
  )
}
