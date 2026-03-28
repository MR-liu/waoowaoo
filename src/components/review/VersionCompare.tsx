'use client'

import { useState } from 'react'
import { AppIcon } from '@/components/ui/icons'

type CompareMode = 'side-by-side' | 'overlay' | 'swipe'

interface VersionCompareProps {
  leftLabel: string
  rightLabel: string
  leftUrl: string
  rightUrl: string
  type: 'image' | 'video'
}

export function VersionCompare({
  leftLabel,
  rightLabel,
  leftUrl,
  rightUrl,
  type,
}: VersionCompareProps) {
  const [mode, setMode] = useState<CompareMode>('side-by-side')
  const [overlayOpacity, setOverlayOpacity] = useState(0.5)
  const [swipePosition, setSwipePosition] = useState(50)

  const MediaElement = ({ src, className }: { src: string; className?: string }) => {
    if (type === 'video') {
      return <video src={src} className={className} controls preload="metadata" />
    }
    return <img src={src} alt="" className={className} />
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {(['side-by-side', 'overlay', 'swipe'] as CompareMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`glass-btn-base px-3 py-1.5 text-xs rounded-lg ${
              mode === m ? 'glass-btn-tone-info' : 'glass-btn-ghost'
            }`}
          >
            {m === 'side-by-side' ? 'Side by Side' : m === 'overlay' ? 'Overlay' : 'Swipe'}
          </button>
        ))}
      </div>

      {mode === 'side-by-side' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold text-[var(--glass-text-tertiary)] mb-1">{leftLabel}</div>
            <div className="rounded-xl overflow-hidden bg-[var(--glass-bg-muted)]">
              <MediaElement src={leftUrl} className="w-full h-auto" />
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--glass-text-tertiary)] mb-1">{rightLabel}</div>
            <div className="rounded-xl overflow-hidden bg-[var(--glass-bg-muted)]">
              <MediaElement src={rightUrl} className="w-full h-auto" />
            </div>
          </div>
        </div>
      )}

      {mode === 'overlay' && (
        <div>
          <div className="relative rounded-xl overflow-hidden bg-[var(--glass-bg-muted)]">
            <MediaElement src={leftUrl} className="w-full h-auto" />
            <div className="absolute inset-0" style={{ opacity: overlayOpacity }}>
              <MediaElement src={rightUrl} className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-[var(--glass-text-tertiary)]">{leftLabel}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-[var(--glass-text-tertiary)]">{rightLabel}</span>
          </div>
        </div>
      )}

      {mode === 'swipe' && (
        <div>
          <div className="relative rounded-xl overflow-hidden bg-[var(--glass-bg-muted)]">
            <MediaElement src={rightUrl} className="w-full h-auto" />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${swipePosition}%` }}
            >
              <MediaElement src={leftUrl} className="w-full h-full object-cover" />
            </div>
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-col-resize"
              style={{ left: `${swipePosition}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={swipePosition}
            onChange={(e) => setSwipePosition(parseInt(e.target.value))}
            className="w-full mt-2"
          />
        </div>
      )}
    </div>
  )
}
