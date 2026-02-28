'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

interface AdminUserItem {
  id: string
  name: string
  isAdmin: boolean
  createdAt: string
  updatedAt: string
}

interface UsersApiResponse {
  users?: AdminUserItem[]
}

function extractErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'Operation failed'
  const obj = payload as Record<string, unknown>
  const errorObj = obj.error
  if (errorObj && typeof errorObj === 'object') {
    const message = (errorObj as Record<string, unknown>).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  const message = obj.message
  if (typeof message === 'string' && message.trim()) return message.trim()
  return 'Operation failed'
}

function isUsersApiResponse(payload: unknown): payload is UsersApiResponse {
  if (!payload || typeof payload !== 'object') return false
  const users = (payload as { users?: unknown }).users
  if (users === undefined) return true
  return Array.isArray(users)
}

function formatDate(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString()
}

export default function AdminUsersClient() {
  const t = useTranslations('common')
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetPasswordByUserId, setResetPasswordByUserId] = useState<Record<string, string>>({})

  const clearFeedback = useCallback(() => {
    setError('')
    setSuccess('')
  }, [])

  const loadUsers = useCallback(async () => {
    clearFeedback()
    setLoading(true)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'GET',
        cache: 'no-store',
      })
      const payload: unknown = await response.json()
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload))
      }
      if (!isUsersApiResponse(payload) || !Array.isArray(payload.users)) {
        throw new Error(t('adminUsers.invalidPayload'))
      }
      setUsers(payload.users)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : t('operationFailed')
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [clearFeedback, t])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const orderedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [users])

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()

    const trimmedUsername = newUsername.trim()
    if (!trimmedUsername) {
      setError(t('adminUsers.usernameRequired'))
      return
    }
    if (newPassword.length < 8) {
      setError(t('adminUsers.passwordTooShort'))
      return
    }

    setBusy(true)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedUsername,
          password: newPassword,
        }),
      })
      const payload: unknown = await response.json()
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload))
      }
      setNewUsername('')
      setNewPassword('')
      setSuccess(t('adminUsers.createSuccess'))
      await loadUsers()
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : t('operationFailed')
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleResetPassword(userId: string) {
    clearFeedback()
    const nextPassword = resetPasswordByUserId[userId] || ''
    if (nextPassword.length < 8) {
      setError(t('adminUsers.passwordTooShort'))
      return
    }

    setBusy(true)
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          password: nextPassword,
        }),
      })
      const payload: unknown = await response.json()
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload))
      }
      setResetPasswordByUserId((prev) => ({
        ...prev,
        [userId]: '',
      }))
      setSuccess(t('adminUsers.resetSuccess'))
    } catch (resetError) {
      const message = resetError instanceof Error ? resetError.message : t('operationFailed')
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass-page min-h-screen">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <div className="glass-surface-modal p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-semibold text-[var(--glass-text-primary)]">
            {t('adminUsers.title')}
          </h1>
          <p className="mt-2 text-sm md:text-base text-[var(--glass-text-secondary)]">
            {t('adminUsers.subtitle')}
          </p>

          <form onSubmit={handleCreateUser} className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <input
              type="text"
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
              placeholder={t('adminUsers.usernamePlaceholder')}
              className="glass-input-base w-full px-4 py-3"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder={t('adminUsers.passwordPlaceholder')}
              className="glass-input-base w-full px-4 py-3"
            />
            <button
              type="submit"
              disabled={busy}
              className="glass-btn-base glass-btn-primary px-4 py-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('adminUsers.createUser')}
            </button>
          </form>

          {error ? (
            <div className="mt-4 rounded-xl border border-[color:color-mix(in_srgb,var(--glass-tone-danger-fg)_22%,transparent)] bg-[var(--glass-tone-danger-bg)] px-4 py-3 text-sm text-[var(--glass-tone-danger-fg)]">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-4 rounded-xl border border-[color:color-mix(in_srgb,var(--glass-tone-info-fg)_22%,transparent)] bg-[var(--glass-tone-info-bg)] px-4 py-3 text-sm text-[var(--glass-tone-info-fg)]">
              {success}
            </div>
          ) : null}

          <div className="mt-8 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--glass-text-secondary)]">
                  <th className="py-2 pr-4 font-medium">{t('adminUsers.username')}</th>
                  <th className="py-2 pr-4 font-medium">{t('adminUsers.role')}</th>
                  <th className="py-2 pr-4 font-medium">{t('adminUsers.createdAt')}</th>
                  <th className="py-2 pr-4 font-medium">{t('adminUsers.resetPassword')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-[var(--glass-text-secondary)]">
                      {t('loading')}
                    </td>
                  </tr>
                ) : orderedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-[var(--glass-text-secondary)]">
                      {t('adminUsers.empty')}
                    </td>
                  </tr>
                ) : (
                  orderedUsers.map((user) => (
                    <tr key={user.id} className="border-t border-[var(--glass-stroke-soft)] align-top">
                      <td className="py-4 pr-4 text-[var(--glass-text-primary)]">{user.name}</td>
                      <td className="py-4 pr-4 text-[var(--glass-text-secondary)]">
                        {user.isAdmin ? t('adminUsers.roleAdmin') : t('adminUsers.roleUser')}
                      </td>
                      <td className="py-4 pr-4 text-[var(--glass-text-secondary)]">{formatDate(user.createdAt)}</td>
                      <td className="py-4 pr-0">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            type="password"
                            value={resetPasswordByUserId[user.id] || ''}
                            onChange={(event) =>
                              setResetPasswordByUserId((prev) => ({
                                ...prev,
                                [user.id]: event.target.value,
                              }))
                            }
                            placeholder={t('adminUsers.newPasswordPlaceholder')}
                            className="glass-input-base w-full px-3 py-2 sm:min-w-[220px]"
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              void handleResetPassword(user.id)
                            }}
                            className="glass-btn-base glass-btn-secondary px-4 py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {t('adminUsers.resetPasswordAction')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
