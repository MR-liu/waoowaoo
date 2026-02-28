'use client'

import { useEffect, useState } from 'react'
import { MediaImage, type MediaImageProps } from './MediaImage'

type MediaImageWithLoadingProps = MediaImageProps & {
  containerClassName?: string
  skeletonClassName?: string
  keepSkeletonOnError?: boolean
  showLoadingIndicator?: boolean
  loadingIndicatorClassName?: string
}

function mergeClassNames(...classNames: Array<string | undefined | false>): string {
  return classNames.filter(Boolean).join(' ')
}

const LOCAL_ORIGIN = 'http://localhost'
const COS_SIGN_PATH = '/api/cos/sign'
const SIGNATURE_QUERY_KEYS = [
  'q-sign-algorithm',
  'q-ak',
  'q-sign-time',
  'q-key-time',
  'q-signature',
  'x-cos-security-token',
  'X-Amz-Algorithm',
  'X-Amz-Credential',
  'X-Amz-Date',
  'X-Amz-Expires',
  'X-Amz-SignedHeaders',
  'X-Amz-Signature',
  'AWSAccessKeyId',
  'Signature',
  'Expires',
] as const
const loadedImageSourceKeySet = new Set<string>()

function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value, LOCAL_ORIGIN)
  } catch {
    return null
  }
}

function normalizeCosSignKey(raw: string | null): string | null {
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function buildStableImageSourceKey(input: string): string {
  const raw = input.trim()
  if (!raw) return ''
  const parsed = tryParseUrl(raw)
  if (!parsed) return raw

  if (parsed.pathname.startsWith('/m/')) {
    return parsed.pathname
  }

  if (parsed.pathname === COS_SIGN_PATH) {
    const normalizedKey = normalizeCosSignKey(parsed.searchParams.get('key'))
    if (normalizedKey) {
      return `${COS_SIGN_PATH}?key=${encodeURIComponent(normalizedKey)}`
    }
  }

  const hasSignedQuery = SIGNATURE_QUERY_KEYS.some((key) => parsed.searchParams.has(key))
  if (hasSignedQuery) {
    if (parsed.origin === LOCAL_ORIGIN) {
      return parsed.pathname
    }
    return `${parsed.origin}${parsed.pathname}`
  }

  return raw
}

export function MediaImageWithLoading({
  src,
  alt,
  className,
  containerClassName,
  skeletonClassName,
  keepSkeletonOnError = false,
  showLoadingIndicator = true,
  loadingIndicatorClassName,
  onLoad,
  onError,
  ...restProps
}: MediaImageWithLoadingProps) {
  const normalizedSrc = typeof src === 'string' ? src.trim() : ''
  const stableSourceKey = normalizedSrc ? buildStableImageSourceKey(normalizedSrc) : ''
  const [isLoaded, setIsLoaded] = useState(() =>
    stableSourceKey ? loadedImageSourceKeySet.has(stableSourceKey) : false,
  )
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    if (!stableSourceKey) {
      setIsLoaded(false)
      setIsError(false)
      return
    }

    // 同一资源（例如签名参数变化）保持已加载态，避免重复闪烁。
    setIsLoaded(loadedImageSourceKeySet.has(stableSourceKey))
    setIsError(false)
  }, [stableSourceKey])

  if (!normalizedSrc) return null

  const shouldShowSkeleton = !isLoaded && (!isError || keepSkeletonOnError)

  const imageClassName = mergeClassNames(
    className,
    'transition-opacity duration-200',
    shouldShowSkeleton ? 'opacity-0' : 'opacity-100',
  )

  const handleLoad: NonNullable<MediaImageProps['onLoad']> = (event) => {
    if (stableSourceKey) {
      loadedImageSourceKeySet.add(stableSourceKey)
    }
    setIsLoaded(true)
    onLoad?.(event)
  }

  const handleError: NonNullable<MediaImageProps['onError']> = (event) => {
    setIsError(true)
    setIsLoaded(true)
    onError?.(event)
  }

  return (
    <div className={mergeClassNames('relative overflow-hidden bg-[var(--glass-bg-muted)]', containerClassName)}>
      {shouldShowSkeleton && (
        <div
          className={mergeClassNames(
            'pointer-events-none absolute inset-0 z-0 animate-pulse bg-[var(--glass-bg-muted)]',
            skeletonClassName,
          )}
        />
      )}
      {shouldShowSkeleton && showLoadingIndicator && (
        <div
          className={mergeClassNames(
            'pointer-events-none absolute inset-0 z-[1] flex items-center justify-center',
            loadingIndicatorClassName,
          )}
        >
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--glass-stroke-strong)] border-t-[var(--glass-tone-info-fg)]" />
          <span className="sr-only">Loading</span>
        </div>
      )}
      <MediaImage
        src={normalizedSrc}
        alt={alt}
        className={imageClassName}
        onLoad={handleLoad}
        onError={handleError}
        {...restProps}
      />
    </div>
  )
}
