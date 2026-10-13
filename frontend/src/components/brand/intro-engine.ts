/**
 * Motor de la animación de bienvenida (canvas 2D, sin dependencias).
 *
 * Línea de tiempo:
 *  1. Destellos: pantalla negra con partículas azul/blanco titilando.
 *  2. "App hecha por el grupo": las partículas se ensamblan, el texto se enciende y se dispersa.
 *  3. "GPT-6 AURA": nuevo ensamblaje con brillo y un barrido de luz.
 *  4. Cenizas: el texto y la pantalla negra se desintegran de izquierda a derecha
 *     y revelan la página de destino (que ya se cargó detrás).
 */

type Rgb = [number, number, number]

interface Particle {
  x: number
  y: number
  sx: number
  sy: number
  tx: number
  ty: number
  vx: number
  vy: number
  size: number
  color: Rgb
  alpha: number
  delay: number
  seed: number
  ashAt: number
  ash: boolean
  ember: boolean
}

interface Star {
  x: number
  y: number
  r: number
  phase: number
  speed: number
  drift: number
  blue: boolean
}

interface Cell {
  x: number
  y: number
  at: number
  spawned: boolean
}

interface TextSpec {
  parts: { text: string; color: string }[]
  size: number
  weight: number
  tracking: number
  y: number
  left: number
  right: number
  splitX: number
  font: string
}

export const INTRO_TIMELINE = {
  aIn: 400,
  aAssemble: 1100,
  aOut: 2650,
  bIn: 3150,
  bAssemble: 1200,
  navigate: 3400,
  ash: 5500,
  sweep: 1500,
  cellFade: 380,
  end: 7900,
}
const T = INTRO_TIMELINE

const WHITE: Rgb = [255, 255, 255]
const ICE: Rgb = [214, 228, 255]
const BLUES: Rgb[] = [
  [96, 165, 250],
  [59, 130, 246],
  [147, 197, 253],
  [191, 219, 254],
]
const ASH: Rgb[] = [
  [156, 163, 175],
  [107, 114, 128],
  [209, 213, 219],
  [120, 113, 108],
]
const SOOT: Rgb[] = [
  [24, 28, 38],
  [44, 50, 62],
  [70, 76, 88],
]

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <V,>(arr: V[]) => arr[Math.floor(Math.random() * arr.length)]
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

function setTracking(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx) {
    ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`
  }
}

function layoutText(
  ctx: CanvasRenderingContext2D,
  W: number,
  y: number,
  size: number,
  weight: number,
  tracking: number,
  family: string,
  parts: { text: string; color: string }[]
): TextSpec {
  const font = `${weight} ${size}px ${family}`
  ctx.font = font
  setTracking(ctx, tracking)
  const full = ctx.measureText(parts.map((p) => p.text).join("")).width
  const left = W / 2 - full / 2
  const splitX = parts.length > 1 ? left + ctx.measureText(parts[0].text).width : left + full
  return { parts, size, weight, tracking, y, left, right: left + full, splitX, font }
}

/** Muestra los píxeles del texto para obtener las posiciones destino de las partículas. */
function sampleText(spec: TextSpec, W: number, H: number, gap: number, palette: (x: number) => Rgb) {
  const off = document.createElement("canvas")
  off.width = W
  off.height = H
  const ctx = off.getContext("2d", { willReadFrequently: true })
  if (!ctx) return []
  ctx.font = spec.font
  setTracking(ctx, spec.tracking)
  ctx.textBaseline = "middle"
  ctx.fillStyle = "#fff"
  ctx.fillText(spec.parts.map((p) => p.text).join(""), spec.left, spec.y)
  const top = Math.max(0, Math.floor(spec.y - spec.size))
  const bottom = Math.min(H, Math.ceil(spec.y + spec.size))
  const x0 = Math.max(0, Math.floor(spec.left) - 4)
  const x1 = Math.min(W, Math.ceil(spec.right) + 4)
  const data = ctx.getImageData(0, top, W, bottom - top).data
  const out: { x: number; y: number; color: Rgb }[] = []
  for (let y = 0; y < bottom - top; y += gap) {
    for (let x = x0; x < x1; x += gap) {
      if (data[(y * W + x) * 4 + 3] > 120) {
        out.push({ x: x + rand(-0.6, 0.6) * gap, y: y + top + rand(-0.6, 0.6) * gap, color: palette(x) })
      }
    }
  }
  return out
}

export interface IntroEngine {
  stop: () => void
  skip: () => void
}

export function startIntro(
  canvas: HTMLCanvasElement,
  opts: { onNavigate: () => void; onDone: () => void; onFirstFrame: () => void }
): IntroEngine {
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    opts.onNavigate()
    opts.onDone()
    return { stop: () => {}, skip: () => {} }
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const W = Math.floor(window.innerWidth * dpr)
  const H = Math.floor(window.innerHeight * dpr)
  canvas.width = W
  canvas.height = H
  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif"
  const base = Math.min(window.innerWidth, 1600)
  const gap = Math.max(2, Math.round(3 * dpr))

  // ---------- escena ----------
  const starCount = Math.round((window.innerWidth * window.innerHeight) / 7000)
  const stars: Star[] = Array.from({ length: starCount }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: rand(0.4, 1.7) * dpr,
    phase: Math.random() * Math.PI * 2,
    speed: rand(0.0012, 0.0045),
    drift: rand(-0.05, 0.05) * dpr,
    blue: Math.random() < 0.35,
  }))

  const aSpec = layoutText(ctx, W, H / 2, Math.max(28, Math.min(base * 0.052, 68)) * dpr, 600, -0.6 * dpr, family, [
    { text: "App hecha por el grupo", color: "#ffffff" },
  ])
  const bSpec = layoutText(ctx, W, H / 2, Math.max(52, Math.min(base * 0.135, 200)) * dpr, 800, -3 * dpr, family, [
    { text: "GPT-6 ", color: "#ffffff" },
    { text: "AURA", color: "#7fb2ff" },
  ])

  const toParticles = (targets: { x: number; y: number; color: Rgb }[], from: "random" | "ring") =>
    targets.map<Particle>((t) => {
      const ang = Math.random() * Math.PI * 2
      const radius = rand(0.45, 0.95) * Math.max(W, H)
      const sx = from === "random" ? Math.random() * W : W / 2 + Math.cos(ang) * radius
      const sy = from === "random" ? Math.random() * H : H / 2 + Math.sin(ang) * radius
      return {
        x: sx,
        y: sy,
        sx,
        sy,
        tx: t.x,
        ty: t.y,
        vx: 0,
        vy: 0,
        size: rand(0.8, 1.35) * gap,
        color: t.color,
        alpha: 0,
        delay: Math.random() * 420,
        seed: Math.random() * 1000,
        ashAt: 0,
        ash: false,
        ember: Math.random() < 0.14,
      }
    })

  const A = toParticles(
    sampleText(aSpec, W, H, gap, () => (Math.random() < 0.75 ? WHITE : ICE)),
    "random"
  )
  const B = toParticles(
    sampleText(bSpec, W, H, Math.round(gap * 1.25), (x) =>
      x >= bSpec.splitX ? pick(BLUES) : Math.random() < 0.8 ? WHITE : ICE
    ),
    "ring"
  )
  const span = Math.max(1, bSpec.right - bSpec.left)
  for (const p of B) {
    p.ashAt = T.ash + 80 + ((p.tx - bSpec.left) / span) * T.sweep * 0.75 + Math.random() * 180
  }

  const cellSize = Math.round(14 * dpr)
  const cells: Cell[] = []
  for (let y = 0; y < H; y += cellSize) {
    for (let x = 0; x < W; x += cellSize) {
      const noise = Math.sin(x * 0.011 + y * 0.017) * 140 + Math.sin(y * 0.031) * 90 + Math.random() * 260
      cells.push({ x, y, at: T.ash + (x / W) * T.sweep + noise, spawned: false })
    }
  }
  const debris: Particle[] = []
  const spawnDebris = (x: number, y: number) => {
    debris.push({
      x: x + Math.random() * cellSize,
      y: y + Math.random() * cellSize,
      sx: 0,
      sy: 0,
      tx: 0,
      ty: 0,
      vx: rand(0.5, 2) * dpr,
      vy: -rand(0.4, 1.7) * dpr,
      size: rand(1.2, 3.4) * dpr,
      color: pick(SOOT),
      alpha: rand(0.7, 1),
      delay: 0,
      seed: Math.random() * 1000,
      ashAt: 0,
      ash: true,
      ember: Math.random() < 0.05,
    })
  }

  // ---------- dibujo ----------
  const drawText = (spec: TextSpec, alpha: number, glow: number, clipFrom?: number) => {
    if (alpha <= 0.01) return
    ctx.save()
    if (clipFrom !== undefined) {
      ctx.beginPath()
      ctx.rect(clipFrom, 0, W - clipFrom, H)
      ctx.clip()
    }
    ctx.font = spec.font
    setTracking(ctx, spec.tracking)
    ctx.textBaseline = "middle"
    ctx.globalAlpha = alpha
    ctx.shadowColor = `rgba(96,165,250,${0.55 * glow})`
    ctx.shadowBlur = 28 * dpr * glow
    let x = spec.left
    for (const part of spec.parts) {
      ctx.fillStyle = part.color
      ctx.fillText(part.text, x, spec.y)
      x += ctx.measureText(part.text).width
    }
    ctx.restore()
  }

  const drawParticle = (p: Particle, boost = 0) => {
    const a = Math.min(1, p.alpha + boost)
    if (a <= 0.01) return
    ctx.fillStyle = `rgba(${p.color[0] | 0},${p.color[1] | 0},${p.color[2] | 0},${a})`
    const s = p.size * (1 + boost * 0.8)
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s)
  }

  // ---------- bucle ----------
  let start = performance.now()
  let raf = 0
  let navigated = false
  let finished = false
  let first = true

  const frame = (now: number) => {
    const t = now - start
    ctx.clearRect(0, 0, W, H)
    ctx.globalCompositeOperation = "source-over"

    // Fondo negro; durante las cenizas se desvanece por celdas soltando hollín.
    if (t < T.ash) {
      ctx.fillStyle = "#04060b"
      ctx.fillRect(0, 0, W, H)
    } else {
      for (const c of cells) {
        const k = (t - c.at) / T.cellFade
        if (k >= 1) continue
        if (k > 0 && !c.spawned) {
          c.spawned = true
          if (Math.random() < 0.5) spawnDebris(c.x, c.y)
        }
        ctx.fillStyle = k <= 0 ? "#04060b" : `rgba(4,6,11,${1 - k})`
        ctx.fillRect(c.x, c.y, cellSize + 1, cellSize + 1)
      }
    }
    if (first) {
      first = false
      opts.onFirstFrame()
    }

    // Destellos.
    ctx.globalCompositeOperation = "lighter"
    const starFade = t < T.ash ? clamp01(t / 500) : clamp01(1 - (t - T.ash) / 800)
    const band = t >= T.bIn - 300 ? bSpec : aSpec
    const bandTop = band.y - band.size * 0.75
    const bandBottom = band.y + band.size * 0.75
    for (const s of stars) {
      s.y += s.drift
      s.x += s.drift * 0.6
      if (s.y > bandTop && s.y < bandBottom && s.x > band.left - 40 * dpr && s.x < band.right + 40 * dpr) {
        continue
      }
      const tw = 0.3 + 0.7 * Math.abs(Math.sin(s.phase + t * s.speed))
      ctx.fillStyle = s.blue
        ? `rgba(120,170,255,${tw * starFade})`
        : `rgba(255,255,255,${tw * starFade * 0.85})`
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Texto A.
    if (t >= T.aIn && t < T.bIn + 500) {
      const lit = t < T.aOut ? clamp01((t - T.aIn - 650) / 600) : clamp01(1 - (t - T.aOut) / 260)
      ctx.globalCompositeOperation = "source-over"
      drawText(aSpec, lit * 0.95, lit)
      ctx.globalCompositeOperation = "lighter"
      for (const p of A) {
        if (t < T.aOut) {
          const local = clamp01((t - T.aIn - p.delay) / T.aAssemble)
          const e = easeOutCubic(local)
          p.x = p.sx + (p.tx - p.sx) * e
          p.y = p.sy + (p.ty - p.sy) * e
          p.alpha = Math.min(1, local * 1.6) * (0.6 + 0.4 * Math.abs(Math.sin(t * 0.004 + p.seed))) * (1 - lit)
        } else {
          if (p.vx === 0 && p.vy === 0) {
            p.alpha = 0.9
            const ang = Math.atan2(p.y - H / 2, p.x - W / 2) + rand(-0.7, 0.7)
            const sp = rand(2, 7) * dpr
            p.vx = Math.cos(ang) * sp
            p.vy = Math.sin(ang) * sp
          }
          p.x += p.vx
          p.y += p.vy
          p.vx *= 0.965
          p.vy *= 0.965
          p.alpha *= 0.93
        }
        drawParticle(p)
      }
    }

    // Texto B.
    if (t >= T.bIn) {
      const lit = clamp01((t - T.bIn - 700) / 650)
      const ashFront =
        t < T.ash ? undefined : bSpec.left + clamp01((t - T.ash - 80) / (T.sweep * 0.75)) * span
      ctx.globalCompositeOperation = "source-over"
      drawText(bSpec, lit, lit, ashFront)
      ctx.globalCompositeOperation = "lighter"
      for (const p of B) {
        if (t < p.ashAt) {
          const local = clamp01((t - T.bIn - p.delay) / T.bAssemble)
          const e = easeOutCubic(local)
          p.x = p.sx + (p.tx - p.sx) * e
          p.y = p.sy + (p.ty - p.sy) * e
          p.alpha = Math.min(1, local * 1.5) * (0.6 + 0.4 * Math.abs(Math.sin(t * 0.004 + p.seed))) * (1 - lit)
          drawParticle(p)
        } else {
          if (!p.ash) {
            p.ash = true
            p.alpha = 1
            p.vx = rand(0.4, 1.8) * dpr
            p.vy = -rand(0.3, 1.5) * dpr
          }
          const k = clamp01((t - p.ashAt) / 600)
          p.color = mix(p.color, p.ember ? pick(BLUES) : pick(ASH), 0.06 + k * 0.12)
          p.vx += Math.sin(t * 0.004 + p.seed) * 0.05 * dpr + 0.012 * dpr
          p.vy -= 0.014 * dpr
          p.x += p.vx
          p.y += p.vy
          p.alpha = Math.max(0, p.alpha - (p.ember ? 0.005 : 0.01))
          p.size *= 0.995
          drawParticle(p)
        }
      }
    }

    // Hollín del fondo desintegrado.
    ctx.globalCompositeOperation = "source-over"
    for (const d of debris) {
      d.vx += Math.sin(t * 0.004 + d.seed) * 0.05 * dpr + 0.01 * dpr
      d.vy -= 0.011 * dpr
      d.x += d.vx
      d.y += d.vy
      d.alpha = Math.max(0, d.alpha - 0.011)
      d.size *= 0.995
      drawParticle(d)
    }

    if (!navigated && t >= T.navigate) {
      navigated = true
      opts.onNavigate()
    }
    if (t >= T.end) {
      finished = true
      opts.onDone()
      return
    }
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return {
    stop: () => cancelAnimationFrame(raf),
    skip: () => {
      if (finished) return
      const now = performance.now()
      if (now - start < T.ash - 60) {
        // Salta a las cenizas: navega ya y adelanta el reloj de la animación.
        if (!navigated) {
          navigated = true
          opts.onNavigate()
        }
        start = now - (T.ash - 60)
        for (const p of B) {
          p.x = p.tx
          p.y = p.ty
          p.delay = 0
        }
      }
    },
  }
}
