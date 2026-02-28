'use client'

import type { CSSProperties, ImgHTMLAttributes, MouseEventHandler } from 'react'

export type MediaImageProps = {
  src: string | null | undefined
  alt: string
  className?: string
  style?: CSSProperties
  onClick?: MouseEventHandler<HTMLImageElement>
  fill?: boolean
  width?: number
  height?: number
  sizes?: string
  priority?: boolean
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'width' | 'height'>

function isStableMediaRoute(src: string) {
  return src.startsWith('/m/')
}

export function shouldDisableNextImageOptimization(src: string): boolean {
  return isStableMediaRoute(src)
}

function mergeClassNames(...classNames: Array<string | undefined>): string | undefined {
  const merged = classNames.filter(Boolean).join(' ')
  return merged || undefined
}

export function MediaImage({
  src,
  alt,
  className,
  style,
  onClick,
  fill = false,
  width = 1200,
  height = 1200,
  sizes,
  priority = false,
  ...imgProps
}: MediaImageProps) {
  if (!src) return null

  if (isStableMediaRoute(src)) {
    const fillClassName = fill ? 'absolute inset-0 h-full w-full' : undefined
    return (
      // 对 /m 稳定媒体路由直接用原生 img，避免 next/image 的优化和 srcset 重算导致重复加载闪烁。
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        sizes={sizes}
        className={mergeClassNames(fillClassName, className)}
        style={style}
        onClick={onClick}
        loading={priority ? 'eager' : 'lazy'}
        {...imgProps}
      />
    )
  }

  return (
    // 外部 URL 兜底，避免 next/image 远程域名限制影响兼容链路
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onClick={onClick}
      loading={priority ? 'eager' : 'lazy'}
      {...imgProps}
    />
  )
}
