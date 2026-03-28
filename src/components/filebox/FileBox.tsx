'use client'

import { useState, useRef, useCallback } from 'react'
import { AppIcon } from '@/components/ui/icons'
import { validateFileName, DEFAULT_NAMING_TEMPLATE } from '@/lib/vfs/naming'

type UploadStatus = 'idle' | 'validating' | 'uploading' | 'success' | 'error'
type DropzoneState = 'default' | 'valid' | 'invalid'

interface UploadedVersion {
  versionId: string
  versionNumber: number
  filePath: string
}

interface FileBoxProps {
  projectId: string
  taskId: string
  namingTemplate?: string
  onUploadComplete?: (version: UploadedVersion) => void
}

interface UploadProgress {
  loaded: number
  total: number
}

export function FileBox({
  projectId,
  taskId,
  namingTemplate = DEFAULT_NAMING_TEMPLATE,
  onUploadComplete,
}: FileBoxProps) {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [dropzoneState, setDropzoneState] = useState<DropzoneState>('default')
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  const resetState = useCallback(() => {
    setStatus('idle')
    setDropzoneState('default')
    setProgress(null)
    setErrorMessage(null)
  }, [])

  const validateAndUpload = useCallback(async (file: File) => {
    setErrorMessage(null)

    setStatus('validating')
    const validation = validateFileName(file.name, namingTemplate)

    if (!validation.valid) {
      setStatus('error')
      setDropzoneState('invalid')
      setErrorMessage(validation.errors.join('; '))
      return
    }

    setStatus('uploading')
    setDropzoneState('valid')
    setProgress({ loaded: 0, total: file.size })

    const formData = new FormData()
    formData.append('file', file)
    formData.append('productionTaskId', taskId)

    try {
      const xhr = new XMLHttpRequest()

      const uploadPromise = new Promise<UploadedVersion>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setProgress({ loaded: e.loaded, total: e.total })
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText) as { version: UploadedVersion }
            resolve(data.version)
          } else {
            const errorData = JSON.parse(xhr.responseText) as { message?: string; error?: { message?: string } }
            reject(new Error(errorData.error?.message || errorData.message || `Upload failed (${xhr.status})`))
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'))
        })

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload was aborted'))
        })

        xhr.open('POST', `/api/cg/${projectId}/filebox`)
        xhr.send(formData)
      })

      const version = await uploadPromise

      setStatus('success')
      setUploadedFile(file.name)
      setProgress(null)
      onUploadComplete?.(version)
    } catch (error: unknown) {
      setStatus('error')
      setDropzoneState('invalid')
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed')
    }
  }, [projectId, taskId, namingTemplate, onUploadComplete])

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current += 1

    if (status === 'uploading') return

    const items = e.dataTransfer.items
    if (items.length > 0) {
      const fileName = e.dataTransfer.items[0].type
        ? e.dataTransfer.items[0].type
        : undefined

      if (fileName) {
        setDropzoneState('default')
      } else {
        setDropzoneState('default')
      }
    }
  }, [status])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (status === 'uploading') return
    if (dropzoneState === 'default') {
      setDropzoneState('valid')
    }
  }, [status, dropzoneState])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current -= 1

    if (dragCounterRef.current === 0) {
      if (status !== 'uploading') {
        setDropzoneState('default')
      }
    }
  }, [status])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0

    if (status === 'uploading') return

    const files = e.dataTransfer.files
    if (files.length === 0) return

    void validateAndUpload(files[0])
  }, [status, validateAndUpload])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    void validateAndUpload(files[0])

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [validateAndUpload])

  const handleClick = useCallback(() => {
    if (status === 'uploading') return
    fileInputRef.current?.click()
  }, [status])

  const progressPercent = progress
    ? Math.round((progress.loaded / progress.total) * 100)
    : 0

  const borderClass =
    dropzoneState === 'valid'
      ? 'border-[var(--glass-tone-success-fg)]'
      : dropzoneState === 'invalid'
        ? 'border-[var(--glass-tone-danger-fg)]'
        : 'border-[var(--glass-stroke-base)]'

  const bgClass =
    dropzoneState === 'valid'
      ? 'bg-[var(--glass-tone-success-bg)]'
      : dropzoneState === 'invalid'
        ? 'bg-[var(--glass-tone-danger-bg)]'
        : 'bg-[var(--glass-bg-muted)]'

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
        className={`
          relative flex flex-col items-center justify-center gap-3
          rounded-[var(--glass-radius-lg)] border-2 border-dashed
          px-6 py-10 cursor-pointer
          transition-all duration-200 ease-[var(--motion-ease-standard)]
          backdrop-filter backdrop-blur-[var(--glass-blur-md)]
          ${borderClass} ${bgClass}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />

        {status === 'uploading' ? (
          <>
            <AppIcon name="loader" className="w-8 h-8 animate-spin" style={{ color: 'var(--glass-accent-from)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--glass-text-primary)' }}>
              Uploading... {progressPercent}%
            </p>
            <div className="w-full max-w-xs h-2 rounded-full overflow-hidden" style={{ background: 'var(--glass-bg-muted)' }}>
              <div
                className="h-full rounded-full transition-[width] duration-200"
                style={{
                  width: `${progressPercent}%`,
                  background: 'linear-gradient(90deg, var(--glass-accent-from), var(--glass-accent-to))',
                }}
              />
            </div>
          </>
        ) : status === 'success' ? (
          <>
            <AppIcon name="check" className="w-8 h-8" style={{ color: 'var(--glass-tone-success-fg)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--glass-tone-success-fg)' }}>
              {uploadedFile}
            </p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); resetState() }}
              className="glass-btn-base glass-btn-ghost text-xs px-3 py-1"
            >
              Upload another
            </button>
          </>
        ) : (
          <>
            <AppIcon name="cloudUpload" className="w-8 h-8" style={{ color: 'var(--glass-text-tertiary)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--glass-text-secondary)' }}>
              Drag files here or click to browse
            </p>
            <p className="text-xs" style={{ color: 'var(--glass-text-tertiary)' }}>
              Files must match naming convention
            </p>
          </>
        )}
      </div>

      {status === 'error' && errorMessage && (
        <div
          className="flex items-start gap-2 rounded-[var(--glass-radius-md)] px-3 py-2 text-xs"
          style={{
            background: 'var(--glass-tone-danger-bg)',
            color: 'var(--glass-tone-danger-fg)',
          }}
        >
          <AppIcon name="alert" className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  )
}
