import * as hb from 'harfbuzzjs'
import ClipperLib from 'clipper-lib'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { FONTS, THAI_FALLBACK_ID, fontUrl, type FontOption } from './fonts'

import { CLIPPER_SCALE as S, type Path } from './units'

export const PLATE_THICKNESS = 3 // mm
export const TEXT_THICKNESS = 2 // mm, raised above the plate
export const PLATE_MARGIN = 4 // mm around the letters
const RING_WALL = 2.5 // mm of plastic around the hole
const RING_GAP = 1.2 // mm between the hole and the plate edge

export type RingSide = 'left' | 'right' | 'top' | 'bottom'
export interface RingOptions {
  side: RingSide
  /** Hole diameter in mm. */
  holeDiameter: number
}
export const DEFAULT_RING: RingOptions = { side: 'left', holeDiameter: 5 }


interface LoadedFont {
  font: hb.Font
  /** Height of the capital "H" in font units: the reference for "letter height". */
  capHeight: number
}

const fontCache = new Map<string, Promise<LoadedFont>>()

export function loadFont(opt: FontOption): Promise<LoadedFont> {
  let p = fontCache.get(opt.id)
  if (!p) {
    p = fetch(fontUrl(opt))
      .then((r) => {
        if (!r.ok) throw new Error(`โหลดฟอนต์ ${opt.name} ไม่สำเร็จ`)
        return r.arrayBuffer()
      })
      .then((data) => {
        const face = new hb.Face(new hb.Blob(data))
        const font = new hb.Font(face)
        return { font, capHeight: measureCapHeight(font, face.upem) }
      })
    p.catch(() => fontCache.delete(opt.id))
    fontCache.set(opt.id, p)
  }
  return p
}

function measureCapHeight(font: hb.Font, upem: number): number {
  const buf = new hb.Buffer()
  buf.addText('H')
  buf.guessSegmentProperties()
  hb.shape(font, buf)
  const gid = buf.getGlyphInfos()[0]?.codepoint
  const ext = gid !== undefined ? font.glyphExtents(gid) : undefined
  return ext && ext.yBearing > 0 ? ext.yBearing : upem * 0.7
}

const isThai = (ch: string) => {
  const cp = ch.codePointAt(0)!
  return cp >= 0x0e00 && cp <= 0x0e7f
}

/** Split text into runs that use the same font (Thai falls back to Kanit for English-only fonts). */
function splitRuns(text: string, needFallback: boolean): { text: string; fallback: boolean }[] {
  const runs: { text: string; fallback: boolean }[] = []
  for (const ch of Array.from(text)) {
    const last = runs[runs.length - 1]
    // Spaces stay with whatever run they are in so they do not break shaping.
    const fallback = needFallback && (ch === ' ' && last ? last.fallback : isThai(ch))
    if (last && last.fallback === fallback) last.text += ch
    else runs.push({ text: ch, fallback })
  }
  return runs
}

/** Turn one glyph outline (font units) into closed polylines in Clipper units. */
function glyphPaths(cmds: hb.SvgPathCommand[], ox: number, oy: number, k: number): Path[] {
  const paths: Path[] = []
  let cur: Path = []
  let x = 0
  let y = 0
  const put = (px: number, py: number) => {
    cur.push({ X: Math.round((ox + px * k) * S), Y: Math.round((oy + py * k) * S) })
  }
  const close = () => {
    if (cur.length > 2) paths.push(cur)
    cur = []
  }
  for (const { type, values: v } of cmds) {
    switch (type) {
      case 'M':
        close()
        ;[x, y] = v
        put(x, y)
        break
      case 'L':
        ;[x, y] = v
        put(x, y)
        break
      case 'Q': {
        const n = 8
        for (let i = 1; i <= n; i++) {
          const t = i / n
          const a = (1 - t) * (1 - t)
          const b = 2 * (1 - t) * t
          const c = t * t
          put(a * x + b * v[0] + c * v[2], a * y + b * v[1] + c * v[3])
        }
        ;[x, y] = [v[2], v[3]]
        break
      }
      case 'C': {
        const n = 10
        for (let i = 1; i <= n; i++) {
          const t = i / n
          const mt = 1 - t
          const a = mt * mt * mt
          const b = 3 * mt * mt * t
          const c = 3 * mt * t * t
          const d = t * t * t
          put(a * x + b * v[0] + c * v[2] + d * v[4], a * y + b * v[1] + c * v[3] + d * v[5])
        }
        ;[x, y] = [v[4], v[5]]
        break
      }
      case 'Z':
        close()
        break
    }
  }
  close()
  return paths
}

/**
 * Shape the text with HarfBuzz (correct Thai vowel/tone mark placement) and return the outlines
 * grouped per letter: each spacing glyph together with the zero-width marks that follow it.
 */
async function textClusters(text: string, fontOpt: FontOption, sizeMm: number, trackingMm = 0): Promise<Path[][]> {
  const primary = await loadFont(fontOpt)
  const needFallback = fontOpt.script === 'latin' && Array.from(text).some(isThai)
  const fallback = needFallback ? await loadFont(FONTS.find((f) => f.id === THAI_FALLBACK_ID)!) : null

  const clusters: Path[][] = []
  let pen = 0 // mm
  for (const run of splitRuns(text, needFallback)) {
    const lf = run.fallback && fallback ? fallback : primary
    const k = sizeMm / lf.capHeight // mm per font unit
    const buf = new hb.Buffer()
    buf.addText(run.text)
    buf.guessSegmentProperties()
    hb.shape(lf.font, buf)
    const infos = buf.getGlyphInfos()
    const positions = buf.getGlyphPositions()
    infos.forEach((info, i) => {
      const pos = positions[i]
      // A glyph that takes up space starts a new letter; zero-width glyphs (Thai vowel/tone marks,
      // the split-off tail of ฎ/ฏ in some fonts) stay with the letter before them.
      if (pos.xAdvance > 0 || clusters.length === 0) clusters.push([])
      const cmds = lf.font.glyphToJson(info.codepoint)
      clusters[clusters.length - 1].push(...glyphPaths(cmds, pen + pos.xOffset * k, pos.yOffset * k, k))
      // Extra spacing only between letters, never after zero-width Thai marks.
      pen += pos.xAdvance * k + (pos.xAdvance > 0 ? trackingMm : 0)
    })
  }
  return clusters.filter((c) => c.length > 0) // spaces have no outline
}

async function textOutlines(text: string, fontOpt: FontOption, sizeMm: number, trackingMm = 0): Promise<Path[]> {
  return (await textClusters(text, fontOpt, sizeMm, trackingMm)).flat()
}

function union(paths: Path[]): Path[] {
  const c = new ClipperLib.Clipper()
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true)
  const out: Path[] = []
  c.Execute(ClipperLib.ClipType.ctUnion, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)
  return out
}

function circle(cx: number, cy: number, r: number, n = 64): Path {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return { X: Math.round((cx + Math.cos(a) * r) * S), Y: Math.round((cy + Math.sin(a) * r) * S) }
  })
}

function rect(x0: number, y0: number, x1: number, y1: number): Path {
  return [
    { X: x0 * S, Y: y0 * S },
    { X: x1 * S, Y: y0 * S },
    { X: x1 * S, Y: y1 * S },
    { X: x0 * S, Y: y1 * S },
  ].map((p) => ({ X: Math.round(p.X), Y: Math.round(p.Y) }))
}

/**
 * Plate = letters grown by the margin (holes filled) + keyring loop on the chosen side, minus the hole.
 * `anchor` is where the loop lines up along that side: a y (mm) for left/right, an x (mm) for top/bottom.
 */
interface PlateStyle {
  /** mm the outline is grown by. */
  grow: number
  /** mm radius of a morphological closing first: joins letters/marks closer than twice this. */
  close: number
  /** Fill the inside of letters (a flat plate) or keep their holes. */
  fillHoles: boolean
  /** Only the loop and its bridge, no plate under the design. */
  ringOnly?: boolean
}
const FLAT_PLATE: PlateStyle = { grow: PLATE_MARGIN, close: 0, fillHoles: true }

function offset(paths: Path[], mm: number): Path[] {
  const off = new ClipperLib.ClipperOffset(2, 0.02 * S)
  off.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon)
  const out: Path[] = []
  off.Execute(out, mm * S)
  return out
}

function plateOutline(raised: Path[], ring: RingOptions, anchor: number, style: PlateStyle = FLAT_PLATE): ClipperLib.PolyTree {
  let base = raised
  if (style.close > 0) base = offset(offset(base, style.close), -style.close)
  if (style.grow > 0) base = offset(base, style.grow)
  const outers = style.fillHoles ? base.filter((p) => ClipperLib.Clipper.Orientation(p)) : base

  // Our Y axis points up, so Clipper's "top" is the lowest y and "bottom" the highest.
  const rb = ClipperLib.Clipper.GetBounds(raised)
  const pb = ClipperLib.Clipper.GetBounds(outers)
  const r = { minX: rb.left / S, maxX: rb.right / S, minY: rb.top / S, maxY: rb.bottom / S }
  const p = { minX: pb.left / S, maxX: pb.right / S, minY: pb.top / S, maxY: pb.bottom / S }

  const hole = ring.holeDiameter / 2
  const outer = hole + RING_WALL
  const reach = hole + RING_GAP // ring centre distance beyond the plate edge
  let cx: number
  let cy: number
  let bridge: Path
  // The bridge joins the loop to the plate and runs a little way into the design so it always connects.
  switch (ring.side) {
    case 'left':
      cx = p.minX - reach
      cy = anchor
      bridge = rect(cx, cy - outer, r.minX + outer, cy + outer)
      break
    case 'right':
      cx = p.maxX + reach
      cy = anchor
      bridge = rect(r.maxX - outer, cy - outer, cx, cy + outer)
      break
    case 'top':
      cx = anchor
      cy = p.maxY + reach
      bridge = rect(cx - outer, r.maxY - outer, cx + outer, cy)
      break
    case 'bottom':
      cx = anchor
      cy = p.minY - reach
      bridge = rect(cx - outer, cy, cx + outer, r.minY + outer)
      break
  }

  const c = new ClipperLib.Clipper()
  c.AddPaths([...(style.ringOnly ? [] : outers), circle(cx, cy, outer), bridge], ClipperLib.PolyType.ptSubject, true)
  c.AddPath(circle(cx, cy, hole), ClipperLib.PolyType.ptClip, true)
  c.StrictlySimple = true
  const tree = new ClipperLib.PolyTree()
  c.Execute(ClipperLib.ClipType.ctDifference, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)
  return tree
}

function treeFromPaths(paths: Path[]): ClipperLib.PolyTree {
  const c = new ClipperLib.Clipper()
  // No outlines that touch themselves at a point: the triangulator would leave a gap in the mesh there.
  c.StrictlySimple = true
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true)
  const tree = new ClipperLib.PolyTree()
  c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)
  return tree
}

// Drop near-duplicate and collinear points first: they can make the triangulation leave tiny gaps.
const toV2 = (p: Path) => ClipperLib.Clipper.CleanPolygon(p, 5).map((q) => new THREE.Vector2(q.X / S, q.Y / S))

function treeToShapes(tree: ClipperLib.PolyNode): THREE.Shape[] {
  const shapes: THREE.Shape[] = []
  const visit = (node: ClipperLib.PolyNode) => {
    for (const outer of node.Childs()) {
      const shape = new THREE.Shape(toV2(outer.Contour()))
      for (const hole of outer.Childs()) {
        shape.holes.push(new THREE.Path(toV2(hole.Contour())))
        visit(hole) // islands inside a hole are new outers
      }
      shapes.push(shape)
    }
  }
  visit(tree)
  return shapes
}

export interface KeychainModel {
  plate: THREE.BufferGeometry
  /** The raised part in the second colour (letters or traced image). */
  text: THREE.BufferGeometry
  /** Overall size in mm. */
  width: number
  length: number
  height: number
}

export async function buildKeychain(
  text: string,
  fontOpt: FontOption,
  sizeMm: number,
  ring: RingOptions = DEFAULT_RING,
): Promise<KeychainModel | null> {
  const letters = union(await textOutlines(text, fontOpt, sizeMm))
  // On the left/right the loop sits halfway up the capitals so it looks centred on the word
  // (Thai marks above/below would otherwise pull it off-centre).
  const sideAnchor = ring.side === 'left' || ring.side === 'right' ? sizeMm / 2 : undefined
  return buildFromRaised(letters, ring, sideAnchor)
}

/**
 * Raised part (already a clean union, Clipper units) on a plate grown by the margin,
 * with a keyring loop. `anchor` overrides where the loop lines up along its side (mm);
 * by default it is centred on the design.
 */
export function buildFromRaised(raised: Path[], ring: RingOptions = DEFAULT_RING, anchor?: number): KeychainModel | null {
  if (raised.length === 0) return null
  if (anchor === undefined) {
    const b = ClipperLib.Clipper.GetBounds(raised)
    anchor = ring.side === 'left' || ring.side === 'right' ? (b.top + b.bottom) / 2 / S : (b.left + b.right) / 2 / S
  }

  const plateShapes = treeToShapes(plateOutline(raised, ring, anchor))
  const raisedShapes = treeToShapes(treeFromPaths(raised))

  const plate = new THREE.ExtrudeGeometry(plateShapes, { depth: PLATE_THICKNESS, bevelEnabled: false })
  const top = new THREE.ExtrudeGeometry(raisedShapes, { depth: TEXT_THICKNESS, bevelEnabled: false })
  top.translate(0, 0, PLATE_THICKNESS)
  return centred(plate, top, PLATE_THICKNESS + TEXT_THICKNESS)
}

/** Move both parts so the plate is centred on the origin (bottom stays at z = 0) and measure it. */
function centred(plate: THREE.BufferGeometry, top: THREE.BufferGeometry, height: number): KeychainModel {
  plate.computeBoundingBox()
  top.computeBoundingBox()
  const bb = plate.boundingBox!.clone().union(top.boundingBox!)
  const cx = (bb.min.x + bb.max.x) / 2
  const cy = (bb.min.y + bb.max.y) / 2
  plate.translate(-cx, -cy, 0)
  top.translate(-cx, -cy, 0)
  return { plate, text: top, width: bb.max.x - bb.min.x, length: bb.max.y - bb.min.y, height }
}

/** Letter heights (mm) for dimensional keychains, cycled letter by letter so neighbours always differ. */
export const DIM_LEVELS = [8, 7, 6]
const DIM_RING_THICKNESS = 4 // mm: the loop is lower than the shortest letter

function shift(paths: Path[], dxMm: number): Path[] {
  const d = Math.round(dxMm * S)
  return paths.map((p) => p.map((q) => ({ X: q.X + d, Y: q.Y })))
}

function clip(a: Path[], b: Path[], type: number): Path[] {
  const c = new ClipperLib.Clipper()
  c.AddPaths(a, ClipperLib.PolyType.ptSubject, true)
  c.AddPaths(b, ClipperLib.PolyType.ptClip, true)
  const out: Path[] = []
  c.Execute(type, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)
  return out
}

/** Net area in mm² (holes subtract). */
const areaMm2 = (paths: Path[]) => paths.reduce((sum, p) => sum + ClipperLib.Clipper.Area(p), 0) / (S * S)

/**
 * Join pieces of one letter that float apart (Thai vowels/tone marks above or below, the dot of i/j)
 * with a short vertical stem, so nothing falls off when there is no base plate.
 */
function joinLetterPieces(letter: Path[], sizeMm: number): Path[] {
  let shape = union(letter)
  const stem = Math.max(1.6, sizeMm * 0.1)
  for (let guard = 0; guard < 6; guard++) {
    const tree = treeFromPaths(shape)
    const pieces = tree.Childs()
    if (pieces.length < 2) break
    // Keep the biggest piece, connect the next one to it.
    const sized = pieces
      .map((n) => ({ n, area: Math.abs(ClipperLib.Clipper.Area(n.Contour())) }))
      .sort((x, y) => y.area - x.area)
    const main = sized[0].n
    const loose = sized[1].n
    const mb = ClipperLib.Clipper.GetBounds([main.Contour()])
    const lb = ClipperLib.Clipper.GetBounds([loose.Contour()])
    const others = union(sized.filter((p) => p.n !== loose).map((p) => p.n.Contour()))
    const dx = (mb.left + mb.right - lb.left - lb.right) / 2 / S
    const dy = (mb.top + mb.bottom - lb.top - lb.bottom) / 2 / S
    // Grow a stem from the loose piece towards the rest of the letter until it really bites into it:
    // up/down for marks above/below, sideways for pieces beside it (e.g. the two halves of แ).
    const lx = (lb.left + lb.right) / 2 / S
    const ly = (lb.top + lb.bottom) / 2 / S
    const loosePaths = [loose.Contour()]
    const need = stem * 0.8 // mm² the stem must share with each side
    const bites = (bar: Path) =>
      areaMm2(clip([bar], others, ClipperLib.ClipType.ctIntersection)) > need &&
      areaMm2(clip([bar], loosePaths, ClipperLib.ClipType.ctIntersection)) > need
    // Try the stem at several spots across the piece and keep the shortest one that reaches.
    const across = (from: number, to: number) => {
      const spots = [(from + to) / 2, from + stem / 2, to - stem / 2, from + (to - from) / 4, to - (to - from) / 4]
      return spots.filter((v, i, all) => all.indexOf(v) === i)
    }
    // Each stem starts in the middle of the loose piece so it is anchored in it, then reaches out.
    const grow = (dir: 'up' | 'down' | 'left' | 'right'): Path | null => {
      for (let len = 0.5; len <= sizeMm * 1.2; len += 0.5) {
        const spots = dir === 'up' || dir === 'down' ? across(lb.left / S, lb.right / S) : across(lb.top / S, lb.bottom / S)
        for (const c of spots) {
          const bar =
            dir === 'down'
              ? rect(c - stem / 2, lb.top / S - len, c + stem / 2, ly)
              : dir === 'up'
                ? rect(c - stem / 2, ly, c + stem / 2, lb.bottom / S + len)
                : dir === 'left'
                  ? rect(lb.left / S - len, c - stem / 2, lx, c + stem / 2)
                  : rect(lx, c - stem / 2, lb.right / S + len, c + stem / 2)
          if (bites(bar)) return bar
        }
      }
      return null
    }
    const vertical: 'up' | 'down' = dy < 0 ? 'down' : 'up'
    const sideways: 'left' | 'right' = dx < 0 ? 'left' : 'right'
    const order = Math.abs(dy) >= Math.abs(dx) ? [vertical, sideways] : [sideways, vertical]
    const bar = grow(order[0]) ?? grow(order[1])
    if (!bar) break // cannot reach: leave it rather than add a stray pole
    shape = union([...shape, bar])
  }
  return shape
}

/**
 * Dimensional letters: one colour, no base plate. Each letter is pushed against the one before it
 * so they always overlap, and letter heights step through DIM_LEVELS so the letters stay readable.
 */
export async function buildDimensional(
  text: string,
  fontOpt: FontOption,
  sizeMm: number,
  ring: RingOptions = DEFAULT_RING,
): Promise<KeychainModel | null> {
  const clusters = await textClusters(text, fontOpt, sizeMm)
  if (clusters.length === 0) return null

  const baseOverlap = 0.025 * sizeMm * sizeMm // mm² each letter should share with the previous ones
  const letters: Path[][] = []
  let placed: Path[] = []
  let carry = 0 // mm every following letter is moved by
  for (const raw of clusters) {
    let letter = joinLetterPieces(shift(raw, carry), sizeMm)
    if (letters.length > 0) {
      // Thin letters (เ, ไ, i, punctuation) cannot share much area: cap the overlap at 12% of the
      // smaller of the two neighbours so neither one gets swallowed and the word stays readable.
      const prev = letters[letters.length - 1]
      const minOverlap = Math.min(baseOverlap, 0.12 * Math.min(Math.abs(areaMm2(letter)), Math.abs(areaMm2(prev))))
      const overlapAt = (dx: number) => areaMm2(clip(shift(letter, dx), placed, ClipperLib.ClipType.ctIntersection))
      // Letters that already touch firmly (script fonts, tight kerning) stay where the font put them.
      const contact = Math.min(minOverlap, Math.max(2, 0.004 * sizeMm * sizeMm))
      if (overlapAt(0) < contact) {
        // Slide left in coarse steps and stop at the FIRST position that overlaps enough (overlap is not
        // monotonic for slanted/thin letters, so never jump past it), then refine between the last two steps.
        // If the target is never met, fall back to the first firm contact, else the best overlap seen.
        const far = -sizeMm * 1.2
        const step = 0.5
        let dx = 0
        let firstContact: number | null = null
        let best = { dx: 0, o: overlapAt(0) }
        let found = false
        for (let x = -step; x >= far; x -= step) {
          const o = overlapAt(x)
          if (o > best.o) best = { dx: x, o }
          if (firstContact === null && o >= contact) firstContact = x
          if (o >= minOverlap) {
            let lo = x
            let hi = x + step
            for (let i = 0; i < 8; i++) {
              const mid = (lo + hi) / 2
              if (overlapAt(mid) >= minOverlap) lo = mid
              else hi = mid
            }
            dx = lo
            found = true
            break
          }
        }
        if (!found) dx = firstContact ?? best.dx
        letter = shift(letter, dx)
        carry += dx
      }
    }
    letters.push(letter)
    placed = union([...placed, ...letter])
  }

  const all = union(letters.flat())
  const b = ClipperLib.Clipper.GetBounds(all)
  const anchor = ring.side === 'left' || ring.side === 'right' ? sizeMm / 2 : (b.left + b.right) / 2 / S
  // Loop + bridge only (no plate); the bridge reaches into the first/last letter to hold on.
  const loopTree = plateOutline(all, ring, anchor, { grow: 0, close: 0, fillHoles: false, ringOnly: true })
  const loop = new THREE.ExtrudeGeometry(treeToShapes(loopTree), { depth: DIM_RING_THICKNESS, bevelEnabled: false })

  const parts = letters.map(
    (l, i) =>
      new THREE.ExtrudeGeometry(treeToShapes(treeFromPaths(l)), {
        depth: DIM_LEVELS[i % DIM_LEVELS.length],
        bevelEnabled: false,
      }),
  )
  const body = parts.length === 1 ? parts[0] : mergeGeometries(parts)!
  return centred(loop, body, Math.max(...DIM_LEVELS.slice(0, letters.length)))
}
