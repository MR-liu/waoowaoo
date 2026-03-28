'use client'

import { AppIcon } from '@/components/ui/icons'

interface IMPanelCollapsedProps {
  onExpand: () => void
  unreadCount: number
}

export default function IMPanelCollapsed({ onExpand, unreadCount }: IMPanelCollapsedProps) {
  return (
    <div className="flex flex-col items-center py-3 gap-4 w-full">
      <button
        onClick={onExpand}
        className="relative w-10 h-10 rounded-xl bg-[var(--glass-bg-surface-strong)] hover:bg-[var(--glass-tone-info-bg)] flex items-center justify-center transition-colors group"
      >
        <AppIcon
          name="message"
          className="w-5 h-5 text-[var(--glass-text-tertiary)] group-hover:text-[var(--glass-tone-info-fg)] transition-colors"
        />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-[var(--glass-tone-danger-fg)] text-white text-[10px] font-bold flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  )
}
