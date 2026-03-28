'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { AppIcon } from '@/components/ui/icons'

type AnnotationTool = 'pen' | 'arrow' | 'rect' | 'text' | 'eraser'

interface Point {
  x: number
  y: number
}

interface Annotation {
  id: string
  tool: AnnotationTool
  points: Point[]
  color: string
  text?: string
}

interface AnnotationCanvasProps {
  imageUrl: string
  width: number
  height: number
  annotations?: Annotation[]
  onAnnotationsChange?: (annotations: Annotation[]) => void
  readOnly?: boolean
}

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#ffffff']

export function AnnotationCanvas({
  imageUrl,
  width,
  height,
  annotations = [],
  onAnnotationsChange,
  readOnly = false,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [activeTool, setActiveTool] = useState<AnnotationTool>('pen')
  const [activeColor, setActiveColor] = useState(COLORS[0])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPoints, setCurrentPoints] = useState<Point[]>([])
  const [localAnnotations, setLocalAnnotations] = useState<Annotation[]>(annotations)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)

    for (const ann of localAnnotations) {
      ctx.strokeStyle = ann.color
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (ann.tool === 'pen' && ann.points.length > 1) {
        ctx.beginPath()
        ctx.moveTo(ann.points[0].x, ann.points[0].y)
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i].x, ann.points[i].y)
        }
        ctx.stroke()
      } else if (ann.tool === 'rect' && ann.points.length === 2) {
        const [p1, p2] = ann.points
        ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y)
      } else if (ann.tool === 'arrow' && ann.points.length === 2) {
        const [start, end] = ann.points
        ctx.beginPath()
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(end.x, end.y)
        ctx.stroke()

        const angle = Math.atan2(end.y - start.y, end.x - start.x)
        const headLen = 12
        ctx.beginPath()
        ctx.moveTo(end.x, end.y)
        ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6))
        ctx.moveTo(end.x, end.y)
        ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6))
        ctx.stroke()
      } else if (ann.tool === 'text' && ann.text && ann.points.length === 1) {
        ctx.fillStyle = ann.color
        ctx.font = '14px sans-serif'
        ctx.fillText(ann.text, ann.points[0].x, ann.points[0].y)
      }
    }
  }, [localAnnotations, width, height])

  useEffect(() => {
    redraw()
  }, [redraw])

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: ((e.clientX - rect.left) / rect.width) * width,
      y: ((e.clientY - rect.top) / rect.height) * height,
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) return
    setIsDrawing(true)
    setCurrentPoints([getCanvasPoint(e)])
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || readOnly) return
    const point = getCanvasPoint(e)
    if (activeTool === 'pen') {
      setCurrentPoints(prev => [...prev, point])
    } else {
      setCurrentPoints(prev => [prev[0], point])
    }
  }

  const handleMouseUp = () => {
    if (!isDrawing || readOnly) return
    setIsDrawing(false)

    if (currentPoints.length < 2 && activeTool !== 'text') return

    const newAnnotation: Annotation = {
      id: `ann_${Date.now()}`,
      tool: activeTool,
      points: currentPoints,
      color: activeColor,
    }

    const updated = [...localAnnotations, newAnnotation]
    setLocalAnnotations(updated)
    onAnnotationsChange?.(updated)
    setCurrentPoints([])
  }

  const handleClear = () => {
    setLocalAnnotations([])
    onAnnotationsChange?.([])
  }

  const tools: Array<{ id: AnnotationTool; icon: string; label: string }> = [
    { id: 'pen', icon: 'edit', label: 'Pen' },
    { id: 'arrow', icon: 'arrowRight', label: 'Arrow' },
    { id: 'rect', icon: 'monitor', label: 'Rectangle' },
  ]

  return (
    <div className="relative">
      <div className="relative rounded-xl overflow-hidden">
        <img src={imageUrl} alt="" className="w-full h-auto" style={{ aspectRatio: `${width}/${height}` }} />
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2 mt-3">
          <div className="flex gap-1 glass-surface rounded-lg p-1">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                  activeTool === tool.id
                    ? 'bg-[var(--glass-accent-from)] text-white'
                    : 'text-[var(--glass-text-tertiary)] hover:bg-[var(--glass-bg-muted)]'
                }`}
                title={tool.label}
              >
                <AppIcon name={tool.icon as Parameters<typeof AppIcon>[0]['name']} className="w-4 h-4" />
              </button>
            ))}
          </div>

          <div className="flex gap-1 glass-surface rounded-lg p-1">
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setActiveColor(color)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  activeColor === color ? 'border-[var(--glass-text-primary)] scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <button
            onClick={handleClear}
            className="glass-btn-base glass-btn-ghost px-3 py-1.5 text-xs"
          >
            <AppIcon name="trash" className="w-3 h-3 mr-1" />
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
