'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AppIcon } from '@/components/ui/icons'
import IMChatView from './IMChatView'
import IMMemberList from './IMMemberList'
import IMMessageInput from './IMMessageInput'

type IMTab = 'chat' | 'members'

interface IMPanelProps {
  projectId: string
  projectName?: string
}

export default function IMPanel({ projectId, projectName }: IMPanelProps) {
  const t = useTranslations('im')
  const [activeTab, setActiveTab] = useState<IMTab>('chat')

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-stroke-soft)]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--glass-accent-from)] to-[var(--glass-accent-to)] flex items-center justify-center flex-shrink-0">
            <AppIcon name="message" className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[var(--glass-text-primary)] truncate">
              {projectName || t('teamChat')}
            </div>
            <div className="text-xs text-[var(--glass-text-tertiary)]">
              {t('onlineCount', { count: 0 })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex border-b border-[var(--glass-stroke-soft)]">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors relative ${
            activeTab === 'chat'
              ? 'text-[var(--glass-tone-info-fg)]'
              : 'text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-secondary)]'
          }`}
        >
          {t('tabs.chat')}
          {activeTab === 'chat' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[var(--glass-accent-from)]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors relative ${
            activeTab === 'members'
              ? 'text-[var(--glass-tone-info-fg)]'
              : 'text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-secondary)]'
          }`}
        >
          {t('tabs.members')}
          {activeTab === 'members' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[var(--glass-accent-from)]" />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'chat' ? (
          <>
            <IMChatView projectId={projectId} />
            <IMMessageInput projectId={projectId} />
          </>
        ) : (
          <IMMemberList projectId={projectId} />
        )}
      </div>
    </div>
  )
}
