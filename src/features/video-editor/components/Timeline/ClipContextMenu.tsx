'use client'

import React, { useEffect, useRef } from 'react'
import { AppIcon } from '@/components/ui/icons'
import type { AppIconName } from '@/components/ui/icons/registry'
import type { ContextAction, ContextMenuState } from './timeline-types'

interface ClipContextMenuProps {
    state: ContextMenuState
    onAction: (action: ContextAction) => void
    onClose: () => void
}

interface MenuItem {
    action: ContextAction
    label: string
    icon: AppIconName
    shortcut?: string
    danger?: boolean
}

const MENU_ITEMS: MenuItem[] = [
    { action: 'split', label: 'Split at Playhead', icon: 'minus', shortcut: '⌘B' },
    { action: 'copy', label: 'Copy', icon: 'copy', shortcut: '⌘C' },
    { action: 'paste', label: 'Paste After', icon: 'clipboard', shortcut: '⌘V' },
    { action: 'reverse', label: 'Reverse', icon: 'undo' },
    { action: 'freeze', label: 'Freeze Frame', icon: 'pause' },
    { action: 'delete', label: 'Delete', icon: 'trash', shortcut: 'Del', danger: true },
]

export const ClipContextMenu: React.FC<ClipContextMenuProps> = ({ state, onAction, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
        }
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('mousedown', handleClickOutside, true)
        window.addEventListener('keydown', handleEsc)
        return () => {
            window.removeEventListener('mousedown', handleClickOutside, true)
            window.removeEventListener('keydown', handleEsc)
        }
    }, [onClose])

    const clampedX = Math.min(state.x, window.innerWidth - 200)
    const clampedY = Math.min(state.y, window.innerHeight - MENU_ITEMS.length * 32 - 16)

    return (
        <div
            ref={menuRef}
            className="fixed z-[200] rounded-lg overflow-hidden shadow-2xl"
            style={{
                left: clampedX,
                top: clampedY,
                background: 'rgba(22,22,40,0.95)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)',
                minWidth: 180,
            }}
        >
            {MENU_ITEMS.map((item, i) => (
                <React.Fragment key={item.action}>
                    {item.danger && i > 0 && (
                        <div className="h-px mx-2" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    )}
                    <button
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-white/8"
                        style={{ color: item.danger ? '#f87171' : 'rgba(255,255,255,0.8)' }}
                        onClick={() => { onAction(item.action); onClose() }}
                    >
                        <AppIcon name={item.icon} className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="flex-1 text-[11px] font-medium">{item.label}</span>
                        {item.shortcut && (
                            <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
                                {item.shortcut}
                            </span>
                        )}
                    </button>
                </React.Fragment>
            ))}
        </div>
    )
}
