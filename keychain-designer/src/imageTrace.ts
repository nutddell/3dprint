import ClipperLib from 'clipper-lib'
import { CLIPPER_SCALE as S, type Path } from './units'

/** Longest side the picture is resampled to before tracing. */
const MAX_SIDE = 900
const PAD = 2 // transparent border so every outline closes
const MIN_AREA_MM2 = 0.4 // drop specks too small to print

export interface LoadedImage {
  w: number
  h: number
  /** RGBA pixels, padded. */
  rgba: Uint8ClampedArray
  /** True when the border is dark/opaque, i.e. the design is probably light on a dark background. */
  darkBackground: boolean
  name: string
}

export async function loadImage(file: File): Promise<LoadedImage> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const iw = img.naturalWidth || 800
    const ih = img.naturalHeight || 800
    const k = Math.min(1, MAX_SIDE / Math.max(iw, ih))
    const w = Math.max(1, Math.round(iw * k)) + PAD * 2
    const h = Math.max(1, Math.round(ih * k)) + PAD * 2
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, PAD, PAD, w - PAD * 2, h - PAD * 2)
    const rgba = ctx.getImageData(0, 0, w, h).data
    return { w, h, rgba, darkBackground: borderIsDark(rgba, w, h), name: file.name }
  } catch {
    throw new Error('เปิดไฟล์รูปนี้ไม่ได้ ลองใช้ PNG หรือ JPG')
  } finally {
    URL.revokeObjectURL(url)
  }
}

function borderIsDark(px: Uint8ClampedArray, w: number, h: number): boolean {
  let sum = 0
  let n = 0
  const take = (x: number, y: number) => {
    const i = (y * w + x) * 4
    sum += (px[i + 3] / 255) * (1 - lum(px, i))
    n++
  }
  for (let x = PAD; x < w - PAD; x += 3) {
    take(x, PAD)
    take(x, h - PAD - 1)
  }
  for (let y = PAD; y < h - PAD; y += 3) {
    take(PAD, y)
    take(w - PAD - 1, y)
  }
  return n > 0 && sum / n > 0.5
}

const lum = (px: Uint8ClampedArray, i: number) => (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255

/**
 * "Ink" per pixel, 0..1: opaque dark/colourful pixels are ink, transparent or white pixels are background.
 * With invert, light pixels count as ink instead (for light designs on a dark photo).
 */
export function inkField(img: LoadedImage, invert: boolean): Float32Array {
  const { w, h, rgba } = img
  const raw = new Float32Array(w * h)
  for (let i = 0, p = 0; p < raw.length; i += 4, p++) {
    const a = rgba[i + 3] / 255
    const l = lum(rgba, i)
    raw[p] = a * (invert ? l : 1 - l)
  }
  // Light 3x3 blur so traced edges come out smooth instead of pixel-stepped.
  const out = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let s = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += raw[(y + dy) * w + x + dx]
      out[y * w + x] = s / 9
    }
  }
  return out
}

// Marching squares: for each corner pattern, which cell edges (0 top, 1 right, 2 bottom, 3 left) are joined.
const SEGMENTS: number[][][] = [
  [], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
  [[2, 3]], [[2, 0]], [[0, 1], [2, 3]], [[2, 1]], [[1, 3]], [[1, 0]], [[0, 3]], [],
]

/** Closed outlines (pixel units, y down) of the region where field >= level. */
function marchingSquares(f: Float32Array, w: number, h: number, level: number): [number, number][][] {
  // Edge ids: horizontal edge from (x,y) to (x+1,y) = 2*(y*w+x); vertical edge (x,y)-(x,y+1) = 2*(y*w+x)+1.
  const point = new Map<number, [number, number]>()
  const links = new Map<number, number[]>()
  const edgePoint = (id: number): [number, number] => {
    let p = point.get(id)
    if (!p) {
      const cell = id >> 1
      const x = cell % w
      const y = (cell - x) / w
      const a = f[cell]
      const b = id & 1 ? f[cell + w] : f[cell + 1]
      const t = b === a ? 0.5 : (level - a) / (b - a)
      p = id & 1 ? [x, y + t] : [x + t, y]
      point.set(id, p)
    }
    return p
  }
  const link = (a: number, b: number) => {
    const la = links.get(a)
    if (la) la.push(b)
    else links.set(a, [b])
    const lb = links.get(b)
    if (lb) lb.push(a)
    else links.set(b, [a])
  }
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x
      const c =
        (f[i] >= level ? 1 : 0) | (f[i + 1] >= level ? 2 : 0) | (f[i + w + 1] >= level ? 4 : 0) | (f[i + w] >= level ? 8 : 0)
      if (c === 0 || c === 15) continue
      const edges = [2 * i, 2 * (i + 1) + 1, 2 * (i + w), 2 * i + 1] // top, right, bottom, left
      for (const [a, b] of SEGMENTS[c]) link(edges[a], edges[b])
    }
  }

  const loops: [number, number][][] = []
  const seen = new Set<number>()
  for (const start of links.keys()) {
    if (seen.has(start)) continue
    const loop: [number, number][] = []
    let prev = -1
    let cur = start
    while (!seen.has(cur)) {
      seen.add(cur)
      loop.push(edgePoint(cur))
      const next = links.get(cur)!.find((n) => n !== prev && !seen.has(n))
      if (next === undefined) break
      prev = cur
      cur = next
    }
    if (loop.length > 2) loops.push(loop)
  }
  return loops
}

/** Douglas–Peucker on a closed loop. */
function simplify(loop: [number, number][], tol: number): [number, number][] {
  if (loop.length < 8) return loop
  const keep = new Uint8Array(loop.length)
  const pts = [...loop, loop[0]]
  // A closed loop starts and ends on the same point, so split it at the point farthest from
  // the start first; otherwise the first chord has zero length and everything collapses.
  let far = 1
  for (let i = 2; i < loop.length; i++) {
    if (Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]) > Math.hypot(loop[far][0] - loop[0][0], loop[far][1] - loop[0][1]))
      far = i
  }
  const stack: [number, number][] = [
    [0, far],
    [far, pts.length - 1],
  ]
  keep[0] = 1
  keep[far] = 1
  while (stack.length) {
    const [a, b] = stack.pop()!
    const [ax, ay] = pts[a]
    const [bx, by] = pts[b]
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    let best = -1
    let bestD = tol
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len
      if (d > bestD) {
        bestD = d
        best = i
      }
    }
    if (best >= 0) {
      keep[best % loop.length] = 1
      stack.push([a, best], [best, b])
    }
  }
  return loop.filter((_, i) => keep[i])
}

export interface TraceResult {
  /** Raised part in Clipper units (mm * S), y up. */
  paths: Path[]
  /** Height of the traced design in mm (width is the requested width). */
  heightMm: number
}

export function traceImage(img: LoadedImage, invert: boolean, level: number, widthMm: number): TraceResult | null {
  const field = inkField(img, invert)
  const loops = marchingSquares(field, img.w, img.h, level).map((l) => simplify(l, 0.35))
  if (loops.length === 0) return null

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const l of loops)
    for (const [x, y] of l) {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  const k = widthMm / Math.max(maxX - minX, 1e-6) // mm per pixel
  const paths: Path[] = loops.map((l) => l.map(([x, y]) => ({ X: Math.round((x - minX) * k * S), Y: Math.round((maxY - y) * k * S) })))

  // Even-odd: nested outlines alternate solid / hole, whatever direction they were traced in.
  const c = new ClipperLib.Clipper()
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true)
  const merged: Path[] = []
  c.Execute(ClipperLib.ClipType.ctUnion, merged, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd)
  const minArea = MIN_AREA_MM2 * S * S
  const clean = merged.filter((p) => Math.abs(ClipperLib.Clipper.Area(p)) >= minArea)
  if (!clean.some((p) => ClipperLib.Clipper.Orientation(p))) return null
  return { paths: clean, heightMm: (maxY - minY) * k }
}
