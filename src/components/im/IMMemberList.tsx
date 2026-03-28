'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AppIcon } from '@/components/ui/icons'

interface MemberData {
  id: string
  userId: string
  role: string
  joinedAt: string
  user: {
    id: string
    name: string
    email: string | null
    image: string | null
  }
}

interface IMMemberListProps {
  projectId: string
}

export default function IMMemberList({ projectId }: IMMemberListProps) {
  const t = useTranslations('im')
  const queryClient = useQueryClient()
  const [inviteUsername, setInviteUsername] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviting, setInviting] = useState(false)

  const { data } = useQuery<{ members: MemberData[] }>({
    queryKey: ['members', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/members`)
      if (!res.ok) throw new Error('Failed to fetch members')
      return res.json()
    },
  })

  const handleInvite = async () => {
    if (!inviteUsername.trim() || inviting) return
    setInviting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: inviteUsername.trim() }),
      })
      if (res.ok) {
        setInviteUsername('')
        setShowInvite(false)
        queryClient.invalidateQueries({ queryKey: ['members', projectId] })
      }
    } finally {
      setInviting(false)
    }
  }

  const members = data?.members ?? []

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-3 py-3">
        {showInvite ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              placeholder={t('members.usernamePlaceholder') ?? 'Username'}
              className="glass-input-base flex-1 px-3 py-2 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleInvite()
                if (e.key === 'Escape') setShowInvite(false)
              }}
            />
            <button
              onClick={handleInvite}
              disabled={!inviteUsername.trim() || inviting}
              className="glass-btn-base glass-btn-primary px-3 py-2 text-sm rounded-lg disabled:opacity-50"
            >
              <AppIcon name="check" className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowInvite(true)}
            className="w-full glass-btn-base glass-btn-soft flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm"
          >
            <AppIcon name="userPlus" className="w-4 h-4" />
            {t('members.invite')}
          </button>
        )}
      </div>

      <div className="px-3 pb-2">
        <div className="text-xs font-semibold text-[var(--glass-text-tertiary)] uppercase tracking-wider mb-2">
          {t('members.online')} ({members.length})
        </div>
        {members.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-[var(--glass-text-tertiary)]">
              {t('members.empty')}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[var(--glass-bg-muted)] transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--glass-accent-from)] to-[var(--glass-accent-to)] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">
                    {member.user.name?.[0]?.toUpperCase() ?? '?'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[var(--glass-text-primary)] truncate">
                    {member.user.name}
                  </div>
                  <div className="text-[10px] text-[var(--glass-text-tertiary)] capitalize">
                    {member.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
