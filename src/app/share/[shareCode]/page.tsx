'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface SharedPanel {
  panelIndex: number
  description: string | null
  imageUrl: string | null
  videoUrl: string | null
}

interface SharedStoryboard {
  id: string
  panelCount: number
  panels: SharedPanel[]
}

interface SharedEpisode {
  id: string
  name: string
  episodeNumber: number
  storyboards: SharedStoryboard[]
}

interface SharedCharacter {
  name: string
  appearances: Array<{
    imageUrl: string | null
    changeReason: string
  }>
}

interface SharedProject {
  name: string
  description: string | null
  mode: string
  characters: SharedCharacter[]
  locations: Array<{ name: string; images: Array<{ imageUrl: string | null }> }>
  episodes: SharedEpisode[]
}

type LoadState =
  | { status: 'loading' }
  | { status: 'password_required' }
  | { status: 'loaded'; project: SharedProject }
  | { status: 'error'; message: string }

export default function SharePage() {
  const params = useParams<{ shareCode: string }>()
  const shareCode = params?.shareCode
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [password, setPassword] = useState('')
  const [selectedEpisode, setSelectedEpisode] = useState<string | null>(null)

  useEffect(() => {
    if (!shareCode) return
    fetchProject()
  }, [shareCode])

  async function fetchProject(pwd?: string) {
    setState({ status: 'loading' })
    try {
      const url = pwd
        ? `/api/share/${shareCode}?password=${encodeURIComponent(pwd)}`
        : `/api/share/${shareCode}`
      const res = await fetch(url)

      if (res.status === 401) {
        setState({ status: 'password_required' })
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Not found' }))
        setState({ status: 'error', message: data.error || 'Not found' })
        return
      }

      const data = await res.json()
      setState({ status: 'loaded', project: data.project })
      if (data.project.episodes?.length > 0) {
        setSelectedEpisode(data.project.episodes[0].id)
      }
    } catch {
      setState({ status: 'error', message: 'Failed to load' })
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white/60 text-lg">Loading...</div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="text-white/40 text-6xl mb-4">404</div>
          <div className="text-white/60">{state.message}</div>
        </div>
      </div>
    )
  }

  if (state.status === 'password_required') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4">
          <h2 className="text-white text-lg font-semibold mb-4 text-center">Password Required</h2>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 mb-4"
            onKeyDown={(e) => e.key === 'Enter' && fetchProject(password)}
          />
          <button
            onClick={() => fetchProject(password)}
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          >
            View Project
          </button>
        </div>
      </div>
    )
  }

  const { project } = state
  const currentEpisode = project.episodes.find(ep => ep.id === selectedEpisode)

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{project.name}</h1>
            {project.description && (
              <p className="text-white/50 text-sm mt-1">{project.description}</p>
            )}
          </div>
          <div className="text-white/30 text-xs">
            Shared via fold-x
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {project.characters.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-white/80">Characters</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {project.characters.map((char, i) => (
                <div key={i} className="flex-shrink-0 w-32 text-center">
                  {char.appearances[0]?.imageUrl ? (
                    <img
                      src={char.appearances[0].imageUrl}
                      alt={char.name}
                      className="w-24 h-24 rounded-full object-cover mx-auto mb-2 border-2 border-white/10"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-white/5 mx-auto mb-2 flex items-center justify-center text-white/20 text-2xl">
                      {char.name[0]}
                    </div>
                  )}
                  <div className="text-sm font-medium truncate">{char.name}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {project.episodes.length > 1 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {project.episodes.map(ep => (
              <button
                key={ep.id}
                onClick={() => setSelectedEpisode(ep.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
                  selectedEpisode === ep.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {ep.name}
              </button>
            ))}
          </div>
        )}

        {currentEpisode && (
          <section>
            <h2 className="text-lg font-semibold mb-4 text-white/80">
              {currentEpisode.name} - Storyboard
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentEpisode.storyboards.flatMap(sb =>
                sb.panels.map((panel, i) => (
                  <div
                    key={`${sb.id}-${i}`}
                    className="bg-white/5 rounded-xl overflow-hidden border border-white/5 hover:border-white/15 transition-colors"
                  >
                    {panel.videoUrl ? (
                      <video
                        src={panel.videoUrl}
                        className="w-full aspect-video object-cover"
                        controls
                        preload="metadata"
                      />
                    ) : panel.imageUrl ? (
                      <img
                        src={panel.imageUrl}
                        alt={panel.description || `Panel ${panel.panelIndex + 1}`}
                        className="w-full aspect-video object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-video bg-white/3 flex items-center justify-center text-white/20">
                        No media
                      </div>
                    )}
                    {panel.description && (
                      <div className="p-3">
                        <p className="text-xs text-white/50 line-clamp-2">{panel.description}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
