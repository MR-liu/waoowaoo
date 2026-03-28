'use client'
import { logError as _ulogError } from '@/lib/logging/core'
import { useTranslations } from 'next-intl'

import React, { useState, useEffect, useCallback } from 'react'
import { AppIcon } from '@/components/ui/icons'
import { useEditorState } from '../hooks/useEditorState'
import { useEditorActions } from '../hooks/useEditorActions'
import { VideoEditorProject } from '../types/editor.types'
import { calculateTimelineDuration, framesToTime } from '../utils/time-utils'
import { RemotionPreview } from './Preview'
import { Timeline } from './Timeline'
import { TransitionPicker, TransitionType } from './TransitionPicker'

interface VideoEditorStageProps {
    projectId: string
    episodeId: string
    initialProject?: VideoEditorProject
    onBack?: () => void
}

type MediaTab = 'media' | 'audio' | 'text' | 'effects' | 'transitions' | 'filters' | 'stickers'

const MEDIA_TABS: Array<{ id: MediaTab; icon: string; label: string }> = [
    { id: 'media', icon: 'film', label: 'editor.tabs.media' },
    { id: 'audio', icon: 'audioWave', label: 'editor.tabs.audio' },
    { id: 'text', icon: 'fileText', label: 'editor.tabs.text' },
    { id: 'effects', icon: 'sparkles', label: 'editor.tabs.effects' },
    { id: 'transitions', icon: 'arrowRight', label: 'editor.tabs.transitions' },
    { id: 'filters', icon: 'image', label: 'editor.tabs.filters' },
    { id: 'stickers', icon: 'diamond', label: 'editor.tabs.stickers' },
]

export function VideoEditorStage({
    projectId,
    episodeId,
    initialProject,
    onBack
}: VideoEditorStageProps) {
    const t = useTranslations('video')
    const editor = useEditorState({ episodeId, initialProject })
    const {
        project,
        timelineState,
        isDirty,
        canUndo,
        canRedo,
        removeClip,
        updateClip,
        reorderClips,
        splitAtPlayhead,
        copyClip,
        pasteClip,
        undo,
        redo,
        setClipSpeed,
        freezeFrame,
        toggleReverse,
        trimClipStart,
        trimClipEnd,
        play,
        pause,
        seek,
        selectClip,
        setZoom,
        markSaved,
    } = editor


    const { saveProject, startRender } = useEditorActions({ projectId, episodeId })

    const [activeMediaTab, setActiveMediaTab] = useState<MediaTab>('media')
    const [splitIndicatorFrame, setSplitIndicatorFrame] = useState<number | null>(null)

    const totalDuration = calculateTimelineDuration(project.timeline)
    const totalTime = framesToTime(totalDuration, project.config.fps)
    const currentTime = framesToTime(timelineState.currentFrame, project.config.fps)
    const currentFrameNum = timelineState.currentFrame

    const handleSave = async () => {
        try {
            await saveProject(project)
            markSaved()
        } catch (error) {
            _ulogError('Save failed:', error)
        }
    }

    const handleExport = async () => {
        try {
            await startRender(project.id)
        } catch (error) {
            _ulogError('Export failed:', error)
        }
    }

    const selectedClip = project.timeline.find(c => c.id === timelineState.selectedClipId)

    const handleSplitWithFeedback = useCallback(() => {
        splitAtPlayhead()
        setSplitIndicatorFrame(timelineState.currentFrame)
    }, [splitAtPlayhead, timelineState.currentFrame])

    const handleContextAction = useCallback((action: string, clipId: string) => {
        selectClip(clipId)
        switch (action) {
            case 'split': handleSplitWithFeedback(); break
            case 'delete': removeClip(clipId); selectClip(null); break
            case 'copy': copyClip(); break
            case 'paste': pasteClip(); break
            case 'reverse': toggleReverse(clipId); break
            case 'freeze': freezeFrame(clipId, timelineState.currentFrame, 30); break
        }
    }, [handleSplitWithFeedback, removeClip, selectClip, copyClip, pasteClip, toggleReverse, freezeFrame, timelineState.currentFrame])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

            const ctrl = e.ctrlKey || e.metaKey

            if (ctrl && e.key === 'b') { e.preventDefault(); handleSplitWithFeedback() }
            else if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
            else if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
            else if (ctrl && e.key === 'c') { e.preventDefault(); copyClip() }
            else if (ctrl && e.key === 'v') { e.preventDefault(); pasteClip() }
            else if (ctrl && e.key === 's') { e.preventDefault(); handleSave() }
            else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedClip) { removeClip(selectedClip.id); selectClip(null) }
            }
            else if (e.key === ' ') { e.preventDefault(); timelineState.playing ? pause() : play() }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(Math.max(0, timelineState.currentFrame - 1)) }
            else if (e.key === 'ArrowRight') { e.preventDefault(); seek(timelineState.currentFrame + 1) }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleSplitWithFeedback, undo, redo, copyClip, pasteClip, handleSave, selectedClip, removeClip, selectClip, timelineState.playing, timelineState.currentFrame, pause, play, seek])

    return (
        <div className="flex flex-col h-screen bg-[#1a1a2e] text-white">
            {/* ═══ 顶部菜单栏 ═══ */}
            <div className="flex items-center h-12 px-3 bg-[#0f0f1a] border-b border-white/10 gap-2 flex-shrink-0">
                <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm">
                    <AppIcon name="chevronLeft" className="w-4 h-4" />
                    {t('editor.toolbar.back')}
                </button>

                <div className="h-5 w-px bg-white/10 mx-1" />

                <div className="flex items-center gap-1">
                    <button className="px-2.5 py-1 rounded text-xs text-white/50 hover:text-white hover:bg-white/5">{t('editor.menu.file')}</button>
                    <button className="px-2.5 py-1 rounded text-xs text-white/50 hover:text-white hover:bg-white/5">{t('editor.menu.edit')}</button>
                </div>

                <div className="flex-1" />

                <span className="text-xs text-white/40 font-mono">
                    {currentTime} / {totalTime} · F{currentFrameNum}
                </span>

                <div className="flex items-center gap-2 ml-4">
                    <button onClick={handleSave} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isDirty ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-white/5 text-white/40'}`}>
                        {isDirty ? t('editor.toolbar.saveDirty') : t('editor.toolbar.saved')}
                    </button>
                    <button onClick={handleExport} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white">
                        {t('editor.toolbar.export')}
                    </button>
                </div>
            </div>

            {/* ═══ 主编辑区（三栏） ═══ */}
            <div className="flex flex-1 overflow-hidden">

                {/* ── 左侧：素材面板 ── */}
                <div className="w-72 flex flex-col bg-[#141425] border-r border-white/5 flex-shrink-0">
                    {/* 素材分类 Tab */}
                    <div className="flex border-b border-white/5 overflow-x-auto">
                        {MEDIA_TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveMediaTab(tab.id)}
                                className={`flex flex-col items-center gap-0.5 px-3 py-2.5 text-[10px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                                    activeMediaTab === tab.id
                                        ? 'text-blue-400 border-b-2 border-blue-400'
                                        : 'text-white/40 hover:text-white/60'
                                }`}
                            >
                                <AppIcon name={tab.icon as Parameters<typeof AppIcon>[0]['name']} className="w-4 h-4" />
                                {t(tab.label)}
                            </button>
                        ))}
                    </div>

                    {/* 素材内容区 */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {activeMediaTab === 'media' && (
                            <div className="space-y-2">
                                <div className="text-xs text-white/30 font-semibold uppercase tracking-wider mb-2">{t('editor.left.clips')}</div>
                                {project.timeline.map((clip, i) => (
                                    <div
                                        key={clip.id}
                                        onClick={() => selectClip(clip.id)}
                                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                                            timelineState.selectedClipId === clip.id ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-white/5 border border-transparent'
                                        }`}
                                    >
                                        <div className="w-16 h-10 rounded bg-white/10 flex items-center justify-center text-xs text-white/40 flex-shrink-0">
                                            {i + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs text-white/70 truncate">{clip.metadata?.description || `Clip ${i + 1}`}</div>
                                            <div className="text-[10px] text-white/30">{framesToTime(clip.durationInFrames, project.config.fps)}</div>
                                        </div>
                                    </div>
                                ))}
                                {project.timeline.length === 0 && (
                                    <div className="text-center py-8 text-white/20 text-xs">{t('editor.left.description')}</div>
                                )}
                            </div>
                        )}
                        {activeMediaTab === 'transitions' && (
                            <div className="space-y-2">
                                <div className="text-xs text-white/30 font-semibold uppercase tracking-wider mb-2">{t('editor.right.transitionLabel')}</div>
                                {selectedClip ? (
                                    <TransitionPicker
                                        value={(selectedClip.transition?.type as TransitionType) || 'none'}
                                        duration={selectedClip.transition?.durationInFrames || 15}
                                        onChange={(type, duration) => {
                                            updateClip(selectedClip.id, {
                                                transition: type === 'none' ? undefined : { type, durationInFrames: duration }
                                            })
                                        }}
                                    />
                                ) : (
                                    <p className="text-xs text-white/30">{t('editor.right.selectClipHint')}</p>
                                )}
                            </div>
                        )}
                        {activeMediaTab !== 'media' && activeMediaTab !== 'transitions' && (
                            <div className="text-center py-12 text-white/20 text-xs">
                                {t('editor.tabs.comingSoon')}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── 中间：预览区 ── */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* 预览画面 */}
                    <div className="flex-1 flex items-center justify-center bg-[#0a0a15] p-4">
                        <RemotionPreview
                            project={project}
                            currentFrame={timelineState.currentFrame}
                            playing={timelineState.playing}
                            onFrameChange={seek}
                            onPlayingChange={(playing) => playing ? play() : pause()}
                        />
                    </div>

                    {/* 播放控制条 */}
                    <div className="flex items-center justify-center gap-4 py-2.5 bg-[#141425] border-t border-white/5">
                        <button onClick={() => seek(Math.max(0, timelineState.currentFrame - 1))} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5">
                            <AppIcon name="chevronLeft" className="w-4 h-4" />
                        </button>
                        <button onClick={() => seek(0)} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5">
                            <AppIcon name="chevronLeft" className="w-3 h-3" />
                            <AppIcon name="chevronLeft" className="w-3 h-3 -ml-1.5" />
                        </button>
                        <button
                            onClick={() => timelineState.playing ? pause() : play()}
                            className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center transition-colors"
                        >
                            <AppIcon name={timelineState.playing ? 'pause' : 'play'} className="w-5 h-5 text-white" />
                        </button>
                        <button onClick={() => seek(Math.min(totalDuration, timelineState.currentFrame + 1))} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5">
                            <AppIcon name="chevronRight" className="w-4 h-4" />
                        </button>
                        <button onClick={() => seek(totalDuration)} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5">
                            <AppIcon name="chevronRight" className="w-3 h-3" />
                            <AppIcon name="chevronRight" className="w-3 h-3 -ml-1.5" />
                        </button>
                    </div>
                </div>

                {/* ── 右侧：属性检查器 ── */}
                <div className="w-72 bg-[#141425] border-l border-white/5 flex-shrink-0 overflow-y-auto">
                    <div className="p-3">
                        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">{t('editor.right.title')}</h3>

                        {selectedClip ? (
                            <div className="space-y-4">
                                {/* 基础信息 */}
                                <div className="bg-white/5 rounded-lg p-3 space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-[11px] text-white/40">{t('editor.right.clipLabel')}</span>
                                        <span className="text-[11px] text-white/70">{selectedClip.metadata?.description || `Clip ${project.timeline.findIndex(c => c.id === selectedClip.id) + 1}`}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[11px] text-white/40">{t('editor.right.durationLabel')}</span>
                                        <span className="text-[11px] text-white/70">{framesToTime(selectedClip.durationInFrames, project.config.fps)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[11px] text-white/40">{t('editor.right.resolution')}</span>
                                        <span className="text-[11px] text-white/70">{project.config.width}×{project.config.height}</span>
                                    </div>
                                </div>

                                {/* 音频 */}
                                {selectedClip.attachment?.audio && (
                                    <div className="bg-white/5 rounded-lg p-3">
                                        <div className="text-[11px] text-white/40 mb-2">{t('editor.right.audio')}</div>
                                        <div className="flex items-center gap-2">
                                            <AppIcon name="audioWave" className="w-3.5 h-3.5 text-green-400" />
                                            <span className="text-xs text-white/60">{t('editor.right.voiceAttached')}</span>
                                        </div>
                                    </div>
                                )}

                                {/* 字幕 */}
                                {selectedClip.attachment?.subtitle && (
                                    <div className="bg-white/5 rounded-lg p-3">
                                        <div className="text-[11px] text-white/40 mb-2">{t('editor.right.subtitle')}</div>
                                        <p className="text-xs text-white/60 leading-relaxed">{selectedClip.attachment.subtitle.text}</p>
                                    </div>
                                )}

                                {/* 转场 */}
                                <div className="bg-white/5 rounded-lg p-3">
                                    <div className="text-[11px] text-white/40 mb-2">{t('editor.right.transitionLabel')}</div>
                                    <TransitionPicker
                                        value={(selectedClip.transition?.type as TransitionType) || 'none'}
                                        duration={selectedClip.transition?.durationInFrames || 15}
                                        onChange={(type, duration) => {
                                            updateClip(selectedClip.id, {
                                                transition: type === 'none' ? undefined : { type, durationInFrames: duration }
                                            })
                                        }}
                                    />
                                </div>

                                {/* 变速 */}
                                <div className="bg-white/5 rounded-lg p-3">
                                    <div className="text-[11px] text-white/40 mb-2">{t('editor.right.speed')}</div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range" min="0.25" max="4" step="0.25"
                                            value={selectedClip.speed ?? 1}
                                            onChange={e => setClipSpeed(selectedClip.id, parseFloat(e.target.value))}
                                            className="flex-1 accent-blue-500"
                                        />
                                        <span className="text-xs text-white/60 w-10 text-right">{(selectedClip.speed ?? 1).toFixed(2)}x</span>
                                    </div>
                                </div>

                                {/* 倒放 + 定格 */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => toggleReverse(selectedClip.id)}
                                        className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-semibold transition-colors ${
                                            selectedClip.reversed ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-white/40 hover:text-white/60'
                                        }`}
                                    >
                                        <AppIcon name="undo" className="w-3.5 h-3.5" />
                                        {t('editor.right.reverse')}
                                    </button>
                                    <button
                                        onClick={() => freezeFrame(selectedClip.id, timelineState.currentFrame, 30)}
                                        className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-white/5 text-white/40 hover:text-white/60 text-xs font-semibold transition-colors"
                                    >
                                        <AppIcon name="pause" className="w-3.5 h-3.5" />
                                        {t('editor.right.freeze')}
                                    </button>
                                </div>

                                {/* 删除 */}
                                <button
                                    onClick={() => {
                                        removeClip(selectedClip.id)
                                        selectClip(null)
                                    }}
                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-semibold transition-colors"
                                >
                                    <AppIcon name="trash" className="w-3.5 h-3.5" />
                                    {t('editor.right.deleteClip')}
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <AppIcon name="monitor" className="w-8 h-8 text-white/10 mx-auto mb-2" />
                                <p className="text-xs text-white/30">{t('editor.right.selectClipHint')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ 工具栏 ═══ */}
            <div className="flex items-center gap-1 px-3 py-1.5 bg-[#0f0f1a] border-t border-white/5 border-b border-white/5 flex-shrink-0">
                <ToolButton icon="minus" label={`${t('editor.tools.split')} (Ctrl+B)`} onClick={splitAtPlayhead} />
                <ToolButton icon="trash" label={t('editor.tools.delete')} onClick={() => {
                    if (selectedClip) { removeClip(selectedClip.id); selectClip(null) }
                }} />
                <div className="h-4 w-px bg-white/10 mx-1" />
                <ToolButton icon="copy" label={`${t('editor.tools.copy')} (Ctrl+C)`} onClick={copyClip} />
                <ToolButton icon="clipboard" label={`Paste (Ctrl+V)`} onClick={pasteClip} />
                <div className="h-4 w-px bg-white/10 mx-1" />
                <ToolButton icon="undo" label={`${t('editor.tools.undo')} (Ctrl+Z)`} onClick={undo} disabled={!canUndo} />
                <ToolButton icon="redo" label={`Redo (Ctrl+Y)`} onClick={redo} disabled={!canRedo} />
                <div className="flex-1" />
                <span className="text-[10px] text-white/30 mr-2">{t('editor.timeline.zoomLabel')}</span>
                <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={timelineState.zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-24 accent-blue-500"
                />
                <span className="text-[10px] text-white/40 ml-1 w-8">{Math.round(timelineState.zoom * 100)}%</span>
            </div>

            {/* ═══ 时间线（多轨道） ═══ */}
            <div className="flex-shrink-0" style={{ height: 270 }}>
                <Timeline
                    clips={project.timeline}
                    bgmClips={project.bgmTrack}
                    timelineState={timelineState}
                    config={project.config}
                    splitIndicatorFrame={splitIndicatorFrame}
                    onReorder={reorderClips}
                    onSelectClip={selectClip}
                    onZoomChange={setZoom}
                    onSeek={seek}
                    onTrimStart={trimClipStart}
                    onTrimEnd={trimClipEnd}
                    onContextAction={handleContextAction}
                />
            </div>
        </div>
    )
}

function ToolButton({ icon, label, onClick, disabled }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
                disabled ? 'text-white/15 cursor-not-allowed' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
            title={label}
        >
            <AppIcon name={icon as Parameters<typeof AppIcon>[0]['name']} className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{label.split(' (')[0]}</span>
        </button>
    )
}

export default VideoEditorStage
