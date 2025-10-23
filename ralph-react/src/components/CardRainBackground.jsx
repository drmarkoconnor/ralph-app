import { useEffect, useRef } from 'react'
import useIsIPhone from '../hooks/useIsIPhone'

// Matrix-like falling suits background, rendered on a canvas behind the UI.
// Notes:
// - Respects prefers-reduced-motion (reduces effect dramatically on request)
// - Caps devicePixelRatio for perf
// - Pointer-events disabled so it never blocks UI
export default function CardRainBackground({
  fontSize = 18,
  baseSpeed = 0.8,
  density = 1.3,
  trailOpacity = 0.1,
  maxAlpha = 0.9,
  zIndex = 0,
  disableOnMobile = true,
}) {
  const canvasRef = useRef(null)
  const isIPhone = useIsIPhone()

  useEffect(() => {
    const prefersReduce = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    const disableEffect = prefersReduce || (disableOnMobile && isIPhone)

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let raf = 0
    let width = 0
    let height = 0
    let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))

    const suits = [
      { ch: '♠', rgb: '17,17,17' },    // near-black
      { ch: '♥', rgb: '204,31,26' },   // red
      { ch: '♦', rgb: '204,31,26' },
      { ch: '♣', rgb: '17,17,17' },
    ]

    // Each column tracks its own y position and speed
    let columns = []
    let colWidth = Math.max(12, fontSize)
    let colCount = 0

    const resize = () => {
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
      width = Math.floor(window.innerWidth)
      height = Math.floor(window.innerHeight)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      colWidth = Math.max(12, fontSize)
      colCount = Math.max(1, Math.floor((width / colWidth) * density))
      columns = Array.from({ length: colCount }).map((_, i) => {
        const x = i * (width / colCount)
        return {
          x,
          y: Math.random() * height,
          speed: (0.6 + Math.random() * 1.2) * baseSpeed * (disableEffect ? 0.4 : 1),
        }
      })
      ctx.font = `bold ${fontSize}px ui-monospace, Menlo, Monaco, Consolas, monospace`
      ctx.textBaseline = 'top'
    }

    const pickSuit = () => suits[(Math.random() * suits.length) | 0]

    let lastTime = performance.now()
    const tick = (t) => {
      const dt = Math.min(50, t - lastTime)
      lastTime = t

      // Trail wipe for the Matrix effect
      ctx.fillStyle = `rgba(255,255,255,${trailOpacity})`
      ctx.fillRect(0, 0, width, height)

      for (let i = 0; i < columns.length; i++) {
        const col = columns[i]
        const { ch, rgb } = pickSuit()
        const alpha = (0.4 + Math.random() * 0.6) * maxAlpha
        ctx.fillStyle = `rgba(${rgb},${alpha})`
        ctx.fillText(ch, col.x, col.y)

        col.y += (fontSize + 4) * col.speed * (dt / 16.7)
        if (col.y > height + 40) {
          col.y = -Math.random() * (height * 0.2)
        }
      }

      raf = requestAnimationFrame(tick)
    }

    const start = () => {
      resize()
      // Prime background white for consistent trail look against app bg
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      raf = requestAnimationFrame(tick)
    }

    const onResize = () => resize()
    window.addEventListener('resize', onResize, { passive: true })
    start()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [fontSize, baseSpeed, density, trailOpacity, maxAlpha, zIndex, disableOnMobile, isIPhone])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex, pointerEvents: 'none' }}
    />
  )
}
