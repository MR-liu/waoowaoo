'use client'

import Image from 'next/image'
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
    // /m 路由已是稳定可缓存资源，避免再走 next/image 优化链路触发重复回源。
    const disableOptimization = shouldDisableNextImageOptimization(src)
    if (fill) {
      return (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes || '100vw'}
          unoptimized={disableOptimization}
          priority={priority}
          className={className}
          style={style}
          onClick={onClick}
          {...imgProps}
        />
      )
    }

    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        unoptimized={disableOptimization}
        priority={priority}
        className={className}
        style={style}
        onClick={onClick}
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
