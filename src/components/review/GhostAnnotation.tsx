'use client'

import { useRef, useEffect } from 'react'

interface Point {
  x: number
  y: number
}

interface Annotation {
  id: string
  tool: 'pen' | 'arrow' | 'rect' | 'text' | 'eraser'
  points: Point[]
  color: string
  text?: string
}

interface GhostAnnotationProps {
  currentAnnotations: Annotation[]
  previousAnnotations: Annotation[]
  visible: boolean
  width?: number
  height?: number
}

const GHOST_OPACITY = 0.3

function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  annotation: Annotation,
  opacity: number,
) {
  ctx.globalAlpha = opacity
  ctx.strokeStyle = annotation.color
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (annotation.tool === 'pen' && annotation.points.length > 1) {
    ctx.beginPath()
    ctx.moveTo(annotation.points[0].x, annotation.points[0].y)
    for (let i = 1; i < annotation.points.length; i++) {
      ctx.lineTo(annotation.points[i].x, annotation.points[i].y)
    }
    ctx.stroke()
  } else if (annotation.tool === 'rect' && annotation.points.length === 2) {
    const [p1, p2] = annotation.points
    ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y)
  } else if (annotation.tool === 'arrow' && annotation.points.length === 2) {
    const [start, end] = annotation.points
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()

    const angle = Math.atan2(end.y - start.y, end.x - start.x)
    const headLen = 12
    ctx.beginPath()
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(
      end.x - headLen * Math.cos(angle - Math.PI / 6),
      end.y - headLen * Math.sin(angle - Math.PI / 6),
    )
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(
      end.x - headLen * Math.cos(angle + Math.PI / 6),
      end.y - headLen * Math.sin(angle + Math.PI / 6),
    )
    ctx.stroke()
  } else if (
    annotation.tool === 'text' &&
    annotation.text &&
    annotation.points.length === 1
  ) {
    ctx.fillStyle = annotation.color
    ctx.font = '14px sans-serif'
    ctx.fillText(annotation.text, annotation.points[0].x, annotation.points[0].y)
  }

  ctx.globalAlpha = 1
}

export function GhostAnnotation({
  currentAnnotations,
  previousAnnotations,
  visible,
  width = 1920,
  height = 1080,
}: GhostAnnotationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)

    if (visible) {
      for (const ann of previousAnnotations) {
        ctx.setLineDash([6, 4])
        drawAnnotation(ctx, ann, GHOST_OPACITY)
        ctx.setLineDash([])
      }
    }

    for (const ann of currentAnnotations) {
      drawAnnotation(ctx, ann, 1)
    }
  }, [currentAnnotations, previousAnnotations, visible, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  )
}
