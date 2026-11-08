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
  // Chunky English fonts pair with the chunky Thai one; the rest with Kanit.
  const fallbackId = fontOpt.style === 'อ้วนกลม' ? 'mitr' : THAI_FALLBACK_ID
  const fallback = needFallback ? await loadFont(FONTS.find((f) => f.id === fallbackId)!) : null

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
  let cx = 0
  let cy = 0
  // The bridge joins the loop to the design. It starts a little way in and keeps reaching further
  // until it really overlaps the design: under a word with descenders (j, y, Thai tails) the
  // middle of the bottom edge can be far from the nearest letter.
  const bridgeTo = (depth: number): Path => {
    switch (ring.side) {
      case 'left':
        return rect(cx, cy - outer, r.minX + depth, cy + outer)
      case 'right':
        return rect(r.maxX - depth, cy - outer, cx, cy + outer)
      case 'top':
        return rect(cx - outer, r.maxY - depth, cx + outer, cy)
      case 'bottom':
        return rect(cx - outer, cy, cx + outer, r.minY + depth)
    }
  }
  switch (ring.side) {
    case 'left':
      cx = p.minX - reach
      cy = anchor
      break
    case 'right':
      cx = p.maxX + reach
      cy = anchor
      break
    case 'top':
      cx = anchor
      cy = p.maxY + reach
      break
    case 'bottom':
      cx = anchor
      cy = p.minY - reach
      break
  }
  const span = ring.side === 'left' || ring.side === 'right' ? r.maxX - r.minX : r.maxY - r.minY
  let bridge = bridgeTo(outer)
  for (let depth = outer + 0.5; depth <= span; depth += 0.5) {
    if (areaMm2(clip([bridge], raised, ClipperLib.ClipType.ctIntersection)) >= outer * 1.5) break
    bridge = bridgeTo(depth)
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
  // A microscopic closing merges edges that run exactly along each other (a stem lined up with an
  // outline edge), which would otherwise become T-junctions in the mesh. 2 µm is invisible in print.
  c.AddPaths(offset(offset(paths, 0.002), -0.002), ClipperLib.PolyType.ptSubject, true)
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
  /** Separately coloured pieces of the top part (e.g. one per griptok line); `text` is all of them merged. */
  parts?: THREE.BufferGeometry[]
  /** Two-sided keychains: the back half, assembled under the front (for the preview) and as printed. */
  back?: {
    plate: THREE.BufferGeometry
    text: THREE.BufferGeometry
    printPlate: THREE.BufferGeometry
    printText: THREE.BufferGeometry
  }
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
    const need = stem * 0.8 // mm² the stem must share with the letter
    // A thin mark cannot share that much with a stem; a quarter of its own area is enough to hold it.
    const needLoose = Math.min(need, 0.25 * Math.abs(areaMm2(loosePaths)))
    const bites = (bar: Path) =>
      areaMm2(clip([bar], others, ClipperLib.ClipType.ctIntersection)) > need &&
      areaMm2(clip([bar], loosePaths, ClipperLib.ClipType.ctIntersection)) > needLoose
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
/**
 * Letters (one Path[] each, floating pieces already joined). With `joined`, each letter slides left
 * until it overlaps the ones before it; otherwise the font's own spacing is kept.
 */
async function layoutLetters(text: string, fontOpt: FontOption, sizeMm: number, joined: boolean, overlapScale = 1): Promise<Path[][]> {
  const clusters = await textClusters(text, fontOpt, sizeMm)
  const style = joined ? 'joined' : 'base'
  const baseOverlap = 0.025 * sizeMm * sizeMm * overlapScale // mm² each letter should share with the previous ones
  const letters: Path[][] = []
  let placed: Path[] = []
  let carry = 0 // mm every following letter is moved by
  for (const raw of clusters) {
    let letter = joinLetterPieces(shift(raw, carry), sizeMm)
    if (style === 'joined' && letters.length > 0) {
      // Thin letters (เ, ไ, i, punctuation) cannot share much area: cap the overlap at 12% of the
      // smaller of the two neighbours so neither one gets swallowed and the word stays readable.
      const prev = letters[letters.length - 1]
      const minOverlap = Math.min(baseOverlap, 0.12 * overlapScale * Math.min(Math.abs(areaMm2(letter)), Math.abs(areaMm2(prev))))
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
  return letters
}

/**
 * 'joined': one piece, letters pushed into each other, no base.
 * 'base': letters at the font's own spacing on a separate thin base (with the loop) that follows
 *         their outline; two pieces printed apart and glued together, or printed in two colours.
 */
export type DimStyle = 'joined' | 'base'
export const DIM_BASE_THICKNESS = 0.5 // mm
const DIM_BASE_MARGIN = 1.5 // mm the base shows around the letters
const DIM_LIP_HEIGHT = 1.5 // mm the locating rim stands above the base
const DIM_FIT_CLEARANCE = 0.2 // mm per side between a letter and its pocket (FDM press fit)
const DIM_BASE_RING_THICKNESS = 3 // mm: the loop is thicker than the base so it does not snap

export async function buildDimensional(
  text: string,
  fontOpt: FontOption,
  sizeMm: number,
  ring: RingOptions = DEFAULT_RING,
  style: DimStyle = 'joined',
): Promise<KeychainModel | null> {
  const letters = await layoutLetters(text, fontOpt, sizeMm, style === 'joined')
  if (letters.length === 0) return null

  const all = union(letters.flat())
  const b = ClipperLib.Clipper.GetBounds(all)
  const anchor = ring.side === 'left' || ring.side === 'right' ? sizeMm / 2 : (b.left + b.right) / 2 / S
  const extrudeLetters = (lift: number) => {
    const parts = letters.map((l, i) => {
      const g = new THREE.ExtrudeGeometry(treeToShapes(treeFromPaths(l)), {
        depth: DIM_LEVELS[i % DIM_LEVELS.length],
        bevelEnabled: false,
      })
      if (lift) g.translate(0, 0, lift)
      return g
    })
    return parts.length === 1 ? parts[0] : mergeGeometries(parts)!
  }
  const tallest = Math.max(...DIM_LEVELS.slice(0, letters.length))

  if (style === 'joined') {
    // Loop + bridge only (no plate); the bridge reaches into the first/last letter to hold on.
    const loopTree = plateOutline(all, ring, anchor, { grow: 0, close: 0, fillHoles: false, ringOnly: true })
    const loop = new THREE.ExtrudeGeometry(treeToShapes(loopTree), { depth: DIM_RING_THICKNESS, bevelEnabled: false })
    return centred(loop, extrudeLetters(0), tallest)
  }

  // Base: letters with gaps closed, grown by a small margin, counters filled, any leftover islands
  // (wide spaces) tied together, so it is one flat piece that follows the word.
  const close = Math.max(2, sizeMm * 0.22)
  let base = offset(offset(offset(all, close), -close), DIM_BASE_MARGIN)
  base = joinLetterPieces(base.filter((p) => ClipperLib.Clipper.Orientation(p)), sizeMm)
  const plate = new THREE.ExtrudeGeometry(treeToShapes(treeFromPaths(base)), { depth: DIM_BASE_THICKNESS, bevelEnabled: false })
  // Locating rim: everything on the base except a pocket shaped like the letters (plus clearance),
  // so the letters drop in straight and stay put. Slivers too thin to print are removed.
  const pocket = offset(all, DIM_FIT_CLEARANCE)
  let rim = clip(base, pocket, ClipperLib.ClipType.ctDifference)
  rim = offset(offset(rim, -0.25), 0.25)
  const lip = new THREE.ExtrudeGeometry(treeToShapes(treeFromPaths(rim)), {
    depth: DIM_BASE_THICKNESS + DIM_LIP_HEIGHT, // from the bed up, so it fuses with the plate
    bevelEnabled: false,
  })
  // The thicker loop must stay clear of the letters' footprint so they still sit flat on the base.
  const loopTree = plateOutline(base, ring, anchor, { grow: 0, close: 0, fillHoles: true, ringOnly: true })
  const loopPaths = clip(ClipperLib.Clipper.PolyTreeToPaths(loopTree), offset(all, 0.4), ClipperLib.ClipType.ctDifference)
  const loop = new THREE.ExtrudeGeometry(treeToShapes(treeFromPaths(loopPaths)), {
    depth: DIM_BASE_RING_THICKNESS,
    bevelEnabled: false,
  })
  return centred(mergeGeometries([plate, lip, loop])!, extrudeLetters(DIM_BASE_THICKNESS), DIM_BASE_THICKNESS + tallest)
}

// ---------------------------------------------------------------------------------------------
// Two-sided keychain: name on the front, logo on the back. Two halves with the same outline are
// printed flat side down (base colour, then a filament change for the raised design) and glued
// back to back, lined up by two pins cut from 1.75 mm filament.

export type BaseShape = 'fit' | 'rounded' | 'circle' | 'oval'

export const TWO_HALF_THICKNESS = 2 // mm per base half
export const TWO_RAISED = 1.5 // mm the design stands on each face
const TWO_MARGIN = 3 // mm between the designs and the edge
export const TWO_PIN_DIAMETER = 2 // mm hole for a 1.75 mm filament pin
export const TWO_PIN_DEPTH = 1.2 // mm into each half

function mirrorX(paths: Path[]): Path[] {
  // Mirroring flips the winding, so reverse each path to keep outers/holes the same way round.
  return paths.map((p) => p.map((q) => ({ X: -q.X, Y: q.Y })).reverse())
}

function centreOn(paths: Path[], cx: number, cy: number): Path[] {
  const dx = Math.round(cx * S)
  const dy = Math.round(cy * S)
  return paths.map((p) => p.map((q) => ({ X: q.X - dx, Y: q.Y - dy })))
}

function boundsMm(paths: Path[]) {
  const b = ClipperLib.Clipper.GetBounds(paths)
  return { minX: b.left / S, maxX: b.right / S, minY: b.top / S, maxY: b.bottom / S }
}

function ellipse(cx: number, cy: number, a: number, b: number, n = 120): Path {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2
    return { X: Math.round((cx + Math.cos(t) * a) * S), Y: Math.round((cy + Math.sin(t) * b) * S) }
  })
}

/** One outline that covers both faces' designs (front coordinates). */
function twoSidedOutline(design: Path[], shape: BaseShape, sizeMm: number): Path[] {
  const b = boundsMm(design)
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  const hw = (b.maxX - b.minX) / 2
  const hh = (b.maxY - b.minY) / 2
  const pts = design.flat().map((q) => [q.X / S, q.Y / S])
  switch (shape) {
    case 'fit': {
      const close = Math.max(2, sizeMm * 0.22)
      const grown = offset(offset(offset(design, close), -close), TWO_MARGIN)
      return joinLetterPieces(grown.filter((p) => ClipperLib.Clipper.Orientation(p)), sizeMm)
    }
    case 'rounded': {
      const r = Math.min(6, hh + TWO_MARGIN)
      const inner = rect(b.minX - TWO_MARGIN + r, b.minY - TWO_MARGIN + r, b.maxX + TWO_MARGIN - r, b.maxY + TWO_MARGIN - r)
      return offset([inner], r)
    }
    case 'circle': {
      const r = Math.max(...pts.map(([x, y]) => Math.hypot(x - cx, y - cy)))
      return [circle(cx, cy, r + TWO_MARGIN, 120)]
    }
    case 'oval': {
      // Smallest ellipse with the design's proportions that still contains every point.
      const k = Math.max(1, ...pts.map(([x, y]) => Math.hypot((x - cx) / Math.max(hw, 1e-6), (y - cy) / Math.max(hh, 1e-6))))
      return [ellipse(cx, cy, hw * k + TWO_MARGIN, hh * k + TWO_MARGIN)]
    }
  }
}

/** Two pin spots on the horizontal centre line, well inside the outline (away from the edge and the loop). */
function pinSpots(outline: Path[]): [number, number][] {
  const inner = offset(outline, -(TWO_PIN_DIAMETER / 2 + 2))
  if (inner.length === 0) return []
  const b = boundsMm(inner)
  const y = (b.minY + b.maxY) / 2
  const inside = (x: number) => inner.some((p) => ClipperLib.Clipper.PointInPolygon({ X: Math.round(x * S), Y: Math.round(y * S) }, p) === 1)
  let left: number | null = null
  let right: number | null = null
  for (let x = b.minX; x <= b.maxX; x += 0.25) if (inside(x)) { left = x; break }
  for (let x = b.maxX; x >= b.minX; x -= 0.25) if (inside(x)) { right = x; break }
  if (left === null || right === null) return []
  if (right - left < TWO_PIN_DIAMETER * 3) return [[(left + right) / 2, y]]
  // Pull the pins in a little from the extremes so they sit in solid plastic.
  const inset = Math.min(3, (right - left) / 6)
  return [
    [left + inset, y],
    [right - inset, y],
  ]
}

/** One half as printed: plate (with blind pin holes from the bed side) and the raised design on top. */
function half(outline: Path[], design: Path[], pins: [number, number][]) {
  const holes = pins.map(([x, y]) => circle(x, y, TWO_PIN_DIAMETER / 2, 32))
  const lower = new THREE.ExtrudeGeometry(treeToShapes(treeFromPaths(holes.length ? clip(outline, holes, ClipperLib.ClipType.ctDifference) : outline)), {
    depth: TWO_PIN_DEPTH + 0.3,
    bevelEnabled: false,
  })
  // Upper layer overlaps the lower one so the two fuse; it closes the holes at TWO_PIN_DEPTH.
  const upper = new THREE.ExtrudeGeometry(treeToShapes(treeFromPaths(outline)), {
    depth: TWO_HALF_THICKNESS - TWO_PIN_DEPTH,
    bevelEnabled: false,
  })
  upper.translate(0, 0, TWO_PIN_DEPTH)
  const top = new THREE.ExtrudeGeometry(treeToShapes(treeFromPaths(design)), { depth: TWO_RAISED, bevelEnabled: false })
  top.translate(0, 0, TWO_HALF_THICKNESS)
  return { plate: mergeGeometries([lower, upper])!, top }
}

/**
 * `front`: raised outline for the front (text), `back`: raised outline for the back (logo) as it
 * reads on the back face. Both are centred on each other.
 */
export function buildTwoSided(
  front: Path[],
  back: Path[],
  shape: BaseShape,
  sizeMm: number,
  ring: RingOptions = DEFAULT_RING,
): KeychainModel | null {
  if (front.length === 0 && back.length === 0) return null
  const centre = (p: Path[]) => {
    if (p.length === 0) return p
    const b = boundsMm(p)
    return centreOn(p, (b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2)
  }
  const f = centre(front)
  const bk = centre(back)
  // Seen from the front, the back design is mirrored.
  const backSeenFromFront = mirrorX(bk)
  const both = union([...f, ...backSeenFromFront])
  const base = twoSidedOutline(both, shape, sizeMm)
  const bb = boundsMm(base)
  const anchor = ring.side === 'left' || ring.side === 'right' ? (bb.minY + bb.maxY) / 2 : (bb.minX + bb.maxX) / 2
  const outline = ClipperLib.Clipper.PolyTreeToPaths(plateOutline(base, ring, anchor, { grow: 0, close: 0, fillHoles: true }))
  const pins = pinSpots(base)

  const frontHalf = half(outline, f, pins)
  // The back half is printed face up too, so it is the mirror image of the outline with the logo reading normally.
  const backHalf = half(mirrorX(outline), bk, pins.map(([x, y]) => [-x, y] as [number, number]))

  // Assembled: the back half turned over (rotate about Y) under the front half.
  const turn = new THREE.Matrix4().makeRotationY(Math.PI)
  const backPlate = backHalf.plate.clone().applyMatrix4(turn)
  const backTop = backHalf.top.clone().applyMatrix4(turn)

  frontHalf.plate.computeBoundingBox()
  const box = frontHalf.plate.boundingBox!
  const cx = (box.min.x + box.max.x) / 2
  const cy = (box.min.y + box.max.y) / 2
  for (const g of [frontHalf.plate, frontHalf.top, backPlate, backTop]) g.translate(-cx, -cy, 0)
  // Printed back half is mirrored in x, so its centring shift is mirrored too.
  for (const g of [backHalf.plate, backHalf.top]) g.translate(cx, -cy, 0)

  return {
    plate: frontHalf.plate,
    text: frontHalf.top,
    width: box.max.x - box.min.x,
    length: box.max.y - box.min.y,
    height: 2 * (TWO_HALF_THICKNESS + TWO_RAISED),
    back: { plate: backPlate, text: backTop, printPlate: backHalf.plate, printText: backHalf.top },
  }
}

/** Front text outline for the two-sided keychain (merged letters, font units already in mm). */
export async function textOutline(text: string, fontOpt: FontOption, sizeMm: number): Promise<Path[]> {
  return union(await textOutlines(text, fontOpt, sizeMm))
}

// ---------------------------------------------------------------------------------------------
// Griptok top: one line of dimensional letters warped to fill the whole disc, like a fisheye:
// the middle letters stretch from the top of the circle to the bottom, the end letters bow
// to follow its left and right edges. The letters sit in the locating pocket of a round base
// that is glued onto a ready-made Ø35 mm grip.

export const GRIP_DIAMETER = 35 // mm, the grip it is glued on
export const GRIP_LETTER_HEIGHT = 4 // mm, all letters the same: reads clearer at this size
export const GRIP_MAX_LETTERS = 12
export const GRIP_MAX_LINES = 3
const GRIP_FLOOR = 1 // mm base floor
const GRIP_LIP = 1.2 // mm rim above the floor
const GRIP_WALL = 1.5 // mm from the disc edge to the letters (rim wall + fit clearance)
const GRIP_OVERLAP_SCALE = 0.35 // letters on a griptok only need to hold, not sink into each other
const GRIP_OVERFLOW = 1.04 // the warp reaches slightly past the circle; the round trim cuts it off
// How far across the circle the word reaches (1 = edge to edge). Below 1 the end letters keep
// some height instead of being squeezed to a point at the far left and right.
const GRIP_SPREAD = 0.9

const THAI_MARK = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/

/** Spacing (non-mark) characters: Thai vowel/tone marks above or below do not count as letters. */
export function countLetters(text: string): number {
  return Array.from(text.replace(/\s/g, '')).filter((ch) => !THAI_MARK.test(ch)).length
}

/** Add points so no edge is longer than maxMm (needed before warping straight edges). */
function densify(paths: Path[], maxMm: number): Path[] {
  const max = maxMm * S
  return paths.map((p) => {
    const out: Path = []
    p.forEach((a, i) => {
      const b = p[(i + 1) % p.length]
      const n = Math.max(1, Math.ceil(Math.hypot(b.X - a.X, b.Y - a.Y) / max))
      for (let k = 0; k < n; k++) out.push({ X: Math.round(a.X + ((b.X - a.X) * k) / n), Y: Math.round(a.Y + ((b.Y - a.Y) * k) / n) })
    })
    return out
  })
}

export interface GriptokModel extends KeychainModel {
  diameter: number
  lineCount: number
}

const GRIP_LINE_GAP = 1.2 // mm between lines on a multi-line griptok (a rim wall stands in it)
const GRIP_BAND_SPREAD = 0.97 // share of the band's widest row a line spans

/**
 * Vertical position inside a line: the letter body (baseline to capital height) gets the room,
 * whatever sits above (Thai marks, ascenders) or below (descenders, tails) is squeezed to half scale.
 * Returns 0..1 from the bottom of the line to the top.
 */
function lineHeightMap(lb: ReturnType<typeof boundsMm>, cap: number) {
  const below = Math.max(0, -lb.minY)
  const above = Math.max(0, lb.maxY - cap)
  const weight = below * 0.5 + cap + above * 0.5
  return (y: number) =>
    y < 0 ? ((y - lb.minY) * 0.5) / weight : y <= cap ? (below * 0.5 + y) / weight : (below * 0.5 + cap + (y - cap) * 0.5) / weight
}

export async function buildGriptok(text: string, fontOpt: FontOption): Promise<GriptokModel | null> {
  // One word: fisheye over the whole disc. Several words (space or Enter): one line each, every
  // line warped to fill its own band of the circle, like a stamp.
  const lines = text.split(/\s+/).filter(Boolean).slice(0, GRIP_MAX_LINES)
  if (lines.length === 0) return null
  const REF = 20 // lay out at 20 mm (same joining rules as the keychains), then warp
  const laid = (await Promise.all(lines.map((l) => layoutLetters(l, fontOpt, REF, true, GRIP_OVERLAP_SCALE)))).filter((l) => l.length > 0)
  if (laid.length === 0) return null

  const R = GRIP_DIAMETER / 2 - GRIP_WALL
  const Re = R * GRIP_OVERFLOW
  const arc = (x: number) => Math.sqrt(Math.max(Re * Re - x * x, 0)) // circle's half height at x
  const chord = (y: number) => Math.sqrt(Math.max(Re * Re - y * y, 0)) // circle's half width at y
  const n = laid.length
  const bandH = (2 * Re - (n - 1) * GRIP_LINE_GAP) / n

  const warpLine = (line: Path[][], i: number): Path[][] => {
    const lb = boundsMm(union(line.flat()))
    const w = lb.maxX - lb.minX
    const vOf = lineHeightMap(lb, REF)
    const top = Re - i * (bandH + GRIP_LINE_GAP)
    const bottom = top - bandH
    const map = (x: number, y: number): [number, number] => {
      const u = (x - lb.minX) / w
      const v = vOf(y)
      if (n === 1) {
        // Fisheye: x spreads linearly across the circle, the full height maps onto the circle's
        // height at that x (end letters keep some height thanks to GRIP_SPREAD).
        const X = (2 * u - 1) * Re * GRIP_SPREAD
        return [X, (2 * v - 1) * arc(X)]
      }
      // Band: the line keeps upright letters and spans the circle's width at the band's widest
      // row; each column is then stretched between the band edges, which follow the circle where
      // the band meets it (top line: curved top, bottom line: curved bottom).
      const widest = Math.min(Math.max(0, bottom), top) // band row closest to the centre
      const X = (2 * u - 1) * chord(widest) * GRIP_BAND_SPREAD
      const lo = Math.max(bottom, -arc(X))
      const hi = Math.min(top, arc(X))
      return [X, lo + v * (hi - lo)]
    }
    return line.map((l) =>
      densify(l, Math.min(w, lb.maxY - lb.minY) / 60).map((p) =>
        p.map((q) => {
          const [X, Y] = map(q.X / S, q.Y / S)
          return { X: Math.round(X * S), Y: Math.round(Y * S) }
        }),
      ),
    )
  }

  const disc = [circle(0, 0, R, 160)]
  const band = Math.min(R, bandH) // stem sizes for joining pieces
  const letters: Path[][] = []
  const lineOfLetter: number[] = []
  laid.forEach((line, i) => {
    for (const l of warpLine(line, i)) {
      // Trim to the circle, drop crumbs the trim leaves, re-join what is left of the letter.
      const kept = clip(union(l), disc, ClipperLib.ClipType.ctIntersection).filter(
        (p) => Math.abs(ClipperLib.Clipper.Area(p)) / (S * S) >= 0.6 || !ClipperLib.Clipper.Orientation(p),
      )
      if (kept.some((p) => ClipperLib.Clipper.Orientation(p))) {
        // Remove hair-thin spikes the trim can leave (too thin to print anyway).
        const clean = offset(offset(kept, -0.1), 0.1)
        letters.push(joinLetterPieces(clean.length ? clean : kept, band / 2))
        lineOfLetter.push(i)
      }
    }
  })
  if (letters.length === 0) return null

  // Each line must print as one piece: a letter that touches none of the ones before it on its line
  // gets a stem. (Lines are separate pieces; each sits in its own pocket.)
  let placed: Path[] = []
  let lineSoFar: Path[] = []
  letters.forEach((l, i) => {
    if (i > 0 && lineOfLetter[i] !== lineOfLetter[i - 1]) lineSoFar = []
    if (lineSoFar.length && areaMm2(clip(l, lineSoFar, ClipperLib.ClipType.ctIntersection)) < 0.3) {
      const joined = joinLetterPieces([...lineSoFar, ...l], band / 2)
      letters[i] = union([...l, ...clip(clip(joined, lineSoFar, ClipperLib.ClipType.ctDifference), disc, ClipperLib.ClipType.ctIntersection)])
    }
    lineSoFar = union([...lineSoFar, ...letters[i]])
    placed = union([...placed, ...letters[i]])
  })
  const word = placed

  const base = [circle(0, 0, GRIP_DIAMETER / 2, 160)]
  let rim = clip(base, offset(word, DIM_FIT_CLEARANCE), ClipperLib.ClipType.ctDifference)
  rim = offset(offset(rim, -0.25), 0.25)
  const floor = new THREE.ExtrudeGeometry(treeToShapes(treeFromPaths(base)), { depth: GRIP_FLOOR, bevelEnabled: false })
  const lip = new THREE.ExtrudeGeometry(treeToShapes(treeFromPaths(rim)), { depth: GRIP_FLOOR + GRIP_LIP, bevelEnabled: false })
  // One solid per line (lines can take different colours and be printed separately).
  const lineCount = Math.max(...lineOfLetter) + 1
  const lineParts = Array.from({ length: lineCount }, (_, li) => {
    const outline = union(letters.filter((_, j) => lineOfLetter[j] === li).flat())
    const g = new THREE.ExtrudeGeometry(treeToShapes(treeFromPaths(outline)), { depth: GRIP_LETTER_HEIGHT, bevelEnabled: false })
    g.translate(0, 0, GRIP_FLOOR)
    return g
  })
  const body = lineParts.length === 1 ? lineParts[0].clone() : mergeGeometries(lineParts)!
  // The disc is centred on the origin and the letters lie inside it, so centred() moves nothing
  // and the per-line copies stay aligned with the merged letters.
  const model = centred(mergeGeometries([floor, lip])!, body, GRIP_FLOOR + GRIP_LETTER_HEIGHT)
  return { ...model, parts: lineParts, diameter: GRIP_DIAMETER, lineCount }
}

// ---------------------------------------------------------------------------------------------
// Clicker name keychain: a housing that holds a keyboard switch (Cherry MX style) and a keycap-
// like lid with the name. Housing: floor, cavity for the switch body, a 1.5 mm "plate" with the
// 14 mm hole the switch clips into, and a low wall around the lid; a big round loop on the left.
// Lid: plate with a cross socket underneath (printed upside down, no supports) and a shallow
// name-shaped pocket on top; the name is its own piece that sits in the pocket.

export interface ClickerParams {
  /** Square hole the switch clips into, mm (MX: 14). */
  hole: number
  /** Plate thickness at the hole, mm (MX: 1.5). */
  plate: number
  /** Room below the plate top for the switch body + pins, mm. */
  below: number
  /** Clip undercut: square cavity under the plate, mm. */
  undercut: number
  /** Stem top above the plate top, mm. */
  stemTop: number
  /** Cross socket: arm length / arm width / depth, and the boss around it, mm. */
  crossArm: number
  crossWidth: number
  socketDepth: number
  boss: number
}

/** Usual Cherry MX figures; the shop measures its switches and adjusts. */
export const MX_DEFAULTS: ClickerParams = {
  hole: 14.0,
  plate: 1.5,
  below: 8.8,
  undercut: 15.2,
  stemTop: 10.2,
  crossArm: 4.15,
  crossWidth: 1.35,
  socketDepth: 3.6,
  boss: 5.6,
}

export const CLICKER_LENGTH = 40 // mm, fixed body length
export const CLICKER_WIDTH = 21 // mm
const CLICKER_RADIUS = 6
const CLICKER_FLOOR = 1.2
const CLICKER_WALL = 1.6 // wall around the lid
const CLICKER_WALL_ABOVE = 6 // wall height above the plate
const CLICKER_LID_CLEAR = 0.4 // gap between lid and wall
const CLICKER_LID = 3 // lid plate thickness
const CLICKER_NAME_POCKET = 0.6 // name pocket depth in the lid
const CLICKER_NAME = 1.6 // name piece thickness (stands 1 mm proud)
const CLICKER_NAME_MARGIN = 2 // mm between the name and the lid edge
const CLICKER_RING_OUTER = 5 // loop radius (2.5 mm of plastic around the hole)
const CLICKER_RING_INNER = 2.5 // Ø5 mm hole
const CLICKER_RING_THICK = 4

export interface ClickerModel extends KeychainModel {
  /** Print-ready pieces: housing as is, lid upside down, name flat. */
  print: { base: THREE.BufferGeometry; lid: THREE.BufferGeometry; name: THREE.BufferGeometry }
  nameHeight: number
}

function scaleAbout(paths: Path[], k: number, cx: number, cy: number): Path[] {
  return paths.map((p) => p.map((q) => ({ X: Math.round((q.X / S - cx) * k * S), Y: Math.round((q.Y / S - cy) * k * S) })))
}

function slab(paths: Path[], z0: number, z1: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(treeToShapes(treeFromPaths(paths)), { depth: z1 - z0, bevelEnabled: false })
  g.translate(0, 0, z0)
  return g
}

function square(side: number): Path {
  return rect(-side / 2, -side / 2, side / 2, side / 2)
}

export async function buildClicker(text: string, fontOpt: FontOption, p: ClickerParams = MX_DEFAULTS): Promise<ClickerModel | null> {
  const L = CLICKER_LENGTH
  const W = CLICKER_WIDTH
  const body = offset([rect(-L / 2 + CLICKER_RADIUS, -W / 2 + CLICKER_RADIUS, L / 2 - CLICKER_RADIUS, W / 2 - CLICKER_RADIUS)], CLICKER_RADIUS)
  const lidOutline = offset(body, -(CLICKER_WALL + CLICKER_LID_CLEAR))

  // Housing
  const P = CLICKER_FLOOR + p.below // plate top
  const cx = -L / 2 - CLICKER_RING_OUTER + 1.5
  const ring = clip(
    [circle(cx, 0, CLICKER_RING_OUTER, 96), rect(cx, -2.5, -L / 2 + 3, 2.5)],
    [circle(cx, 0, CLICKER_RING_INNER, 96)],
    ClipperLib.ClipType.ctDifference,
  )
  const housing = mergeGeometries([
    slab(body, 0, CLICKER_FLOOR),
    slab(clip(body, [square(p.undercut)], ClipperLib.ClipType.ctDifference), CLICKER_FLOOR, P - p.plate),
    slab(clip(body, [square(p.hole)], ClipperLib.ClipType.ctDifference), P - p.plate, P),
    slab(clip(body, offset(body, -CLICKER_WALL), ClipperLib.ClipType.ctDifference), P, P + CLICKER_WALL_ABOVE),
    slab(union(ring), 0, CLICKER_RING_THICK),
  ])!

  // Name, fitted to the lid face
  let name: Path[] = []
  if (text.trim()) {
    const raw = await textOutline(text.trim(), fontOpt, 10)
    if (raw.length) {
      const nb = boundsMm(raw)
      const lb = boundsMm(lidOutline)
      const k = Math.min(
        (lb.maxX - lb.minX - 2 * CLICKER_NAME_MARGIN) / (nb.maxX - nb.minX),
        (lb.maxY - lb.minY - 2 * CLICKER_NAME_MARGIN) / (nb.maxY - nb.minY),
      )
      name = scaleAbout(raw, k, (nb.minX + nb.maxX) / 2, (nb.minY + nb.maxY) / 2)
    }
  }
  const nameHeight = name.length ? boundsMm(name).maxY - boundsMm(name).minY : 0

  // Lid (assembled position: its underside rests on the stem top)
  const c0 = P + p.stemTop
  const top = c0 + CLICKER_LID
  const cross = union([
    rect(-p.crossArm / 2, -p.crossWidth / 2, p.crossArm / 2, p.crossWidth / 2),
    rect(-p.crossWidth / 2, -p.crossArm / 2, p.crossWidth / 2, p.crossArm / 2),
  ])
  const bossRing = clip([circle(0, 0, p.boss / 2, 48)], cross, ClipperLib.ClipType.ctDifference)
  const lidParts = [
    slab(bossRing, c0 - p.socketDepth, c0),
    slab(lidOutline, c0, top - CLICKER_NAME_POCKET),
    slab(name.length ? clip(lidOutline, offset(name, DIM_FIT_CLEARANCE), ClipperLib.ClipType.ctDifference) : lidOutline, top - CLICKER_NAME_POCKET, top),
  ]
  const lid = mergeGeometries(lidParts)!
  const nameGeo = name.length ? slab(name, top - CLICKER_NAME_POCKET, top - CLICKER_NAME_POCKET + CLICKER_NAME) : new THREE.BufferGeometry()

  // Print-ready copies
  const flip = new THREE.Matrix4().makeRotationX(Math.PI)
  const lidPrint = lid.clone().applyMatrix4(flip)
  lidPrint.computeBoundingBox()
  lidPrint.translate(0, 0, -lidPrint.boundingBox!.min.z)
  const namePrint = nameGeo.clone()
  if (name.length) {
    namePrint.computeBoundingBox()
    namePrint.translate(0, 0, -namePrint.boundingBox!.min.z)
  }

  housing.computeBoundingBox()
  const hb = housing.boundingBox!
  const height = (name.length ? top - CLICKER_NAME_POCKET + CLICKER_NAME : top)
  return {
    plate: housing,
    text: name.length ? mergeGeometries([lid, nameGeo])! : lid,
    parts: name.length ? [lid, nameGeo] : [lid],
    width: hb.max.x - hb.min.x,
    length: hb.max.y - hb.min.y,
    height,
    print: { base: housing, lid: lidPrint, name: namePrint },
    nameHeight,
  }
}

// ---------------------------------------------------------------------------------------------
// Big letter keychain: one chunky initial, fixed size, with the full name raised along its
// longest straight stroke (found automatically), and the loop at the top of the letter.

export const BIG_CAP = 55 // mm capital height of the big letter
export const BIG_THICK = 7 // mm
const BIG_NAME_RAISE = 1.2 // mm the name stands on the letter
const BIG_NAME_INSET = 1.6 // mm the name keeps from the letter's edges
const BIG_PX = 0.5 // mm raster step for the stroke search

/**
 * The longest straight band inside the shape for text of the given width/height ratio:
 * tries every direction (text never upside down) and every band height, returns the band
 * centre, direction and the text height that fits best.
 */
function longestStrip(shape: Path[], aspect: number) {
  let best = { size: 0, theta: 0, cx: 0, cy: 0 }
  for (let deg = -90; deg <= 90; deg += 5) {
    const t = (deg * Math.PI) / 180
    const c = Math.cos(t)
    const s = Math.sin(t)
    // Rotate the shape by -t so the candidate direction becomes horizontal.
    const rot = shape.map((p) => p.map((q) => ({ x: (q.X / S) * c + (q.Y / S) * s, y: -(q.X / S) * s + (q.Y / S) * c })))
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const p of rot)
      for (const q of p) {
        minX = Math.min(minX, q.x)
        maxX = Math.max(maxX, q.x)
        minY = Math.min(minY, q.y)
        maxY = Math.max(maxY, q.y)
      }
    const cols = Math.ceil((maxX - minX) / BIG_PX) + 1
    const rows = Math.ceil((maxY - minY) / BIG_PX) + 1
    // Scanline fill (even-odd) of the rotated shape.
    const inside = new Uint8Array(cols * rows)
    for (let r = 0; r < rows; r++) {
      const y = minY + (r + 0.5) * BIG_PX
      const xs: number[] = []
      for (const p of rot)
        for (let i = 0; i < p.length; i++) {
          const a = p[i]
          const b = p[(i + 1) % p.length]
          if (a.y <= y !== b.y <= y) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x))
        }
      xs.sort((u, v) => u - v)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k] - minX) / BIG_PX - 0.5))
        const c1 = Math.min(cols - 1, Math.floor((xs[k + 1] - minX) / BIG_PX - 0.5))
        for (let col = c0; col <= c1; col++) inside[r * cols + col] = 1
      }
    }
    // up[r][c] = how many inside pixels in a row from r downwards (a vertical run).
    const run = new Uint16Array(cols * rows)
    for (let r = rows - 1; r >= 0; r--)
      for (let col = 0; col < cols; col++) run[r * cols + col] = inside[r * cols + col] ? 1 + (r + 1 < rows ? run[(r + 1) * cols + col] : 0) : 0
    for (let hPx = 6; hPx <= rows; hPx += 2) {
      for (let r = 0; r + hPx <= rows; r++) {
        let len = 0
        for (let col = 0; col <= cols; col++) {
          if (col < cols && run[r * cols + col] >= hPx) {
            len++
            continue
          }
          if (len > 0) {
            const h = hPx * BIG_PX
            const w = len * BIG_PX
            const size = Math.min(h, w / aspect) // text height that fits this band
            if (size > best.size) {
              const bx = minX + (col - len / 2) * BIG_PX
              const by = minY + (r + hPx / 2) * BIG_PX
              best = { size, theta: t, cx: bx * c - by * s, cy: bx * s + by * c }
            }
          }
          len = 0
        }
      }
    }
  }
  return best
}

function transform(paths: Path[], f: (x: number, y: number) => [number, number]): Path[] {
  return paths.map((p) =>
    p.map((q) => {
      const [x, y] = f(q.X / S, q.Y / S)
      return { X: Math.round(x * S), Y: Math.round(y * S) }
    }),
  )
}

export interface BigLetterModel extends KeychainModel {
  nameHeight: number
}

export async function buildBigLetter(
  letter: string,
  fontOpt: FontOption,
  name: string,
  ring: RingOptions = { side: 'top', holeDiameter: 5 },
): Promise<BigLetterModel | null> {
  const raw = union(await textOutlines(letter, fontOpt, BIG_CAP))
  if (raw.length === 0) return null
  const lb = boundsMm(raw)
  const shape = centreOn(raw, (lb.minX + lb.maxX) / 2, (lb.minY + lb.maxY) / 2)
  const b = boundsMm(shape)

  // Name along the longest stroke.
  let namePaths: Path[] = []
  let nameHeight = 0
  if (name.trim()) {
    const kanit = FONTS.find((f) => f.id === 'kanit')!
    const nraw = await textOutline(name.trim(), kanit, 10)
    if (nraw.length) {
      const nb = boundsMm(nraw)
      const nw = nb.maxX - nb.minX
      const nh = nb.maxY - nb.minY
      const room = offset(shape, -BIG_NAME_INSET)
      const strip = longestStrip(room, nw / nh)
      if (strip.size > 0) {
        const k = (strip.size * 0.92) / nh
        const c = Math.cos(strip.theta)
        const s = Math.sin(strip.theta)
        const ncx = (nb.minX + nb.maxX) / 2
        const ncy = (nb.minY + nb.maxY) / 2
        const placed = transform(nraw, (x, y) => {
          const u = (x - ncx) * k
          const v = (y - ncy) * k
          return [strip.cx + u * c - v * s, strip.cy + u * s + v * c]
        })
        namePaths = clip(placed, room, ClipperLib.ClipType.ctIntersection)
        nameHeight = nh * k
      }
    }
  }

  // Loop: on top, over the top of the left-most arm (like the photo); centred otherwise.
  let anchor: number | undefined
  if (ring.side === 'top' || ring.side === 'bottom') {
    const band = ring.side === 'top' ? rect(b.minX - 1, b.maxY - 6, b.maxX + 1, b.maxY + 1) : rect(b.minX - 1, b.minY - 1, b.maxX + 1, b.minY + 6)
    const pieces = treeFromPaths(clip(shape, [band], ClipperLib.ClipType.ctIntersection)).Childs()
    if (pieces.length) {
      const leftmost = pieces
        .map((n) => ClipperLib.Clipper.GetBounds([n.Contour()]))
        .sort((x, y) => x.left - y.left)[0]
      anchor = (leftmost.left + leftmost.right) / 2 / S
    }
  }
  if (anchor === undefined) anchor = ring.side === 'left' || ring.side === 'right' ? (b.minY + b.maxY) / 2 : (b.minX + b.maxX) / 2
  const body = ClipperLib.Clipper.PolyTreeToPaths(plateOutline(shape, ring, anchor, { grow: 0, close: 0, fillHoles: false }))
  const plate = slab(body, 0, BIG_THICK)
  const top = namePaths.length ? slab(namePaths, BIG_THICK, BIG_THICK + BIG_NAME_RAISE) : new THREE.BufferGeometry()
  const model = centred(plate, namePaths.length ? top : plate.clone(), BIG_THICK + (namePaths.length ? BIG_NAME_RAISE : 0))
  if (!namePaths.length) model.text = new THREE.BufferGeometry()
  return { ...model, nameHeight }
}

// ---------------------------------------------------------------------------------------------
// Sign letters ("channel letters"): one big hollow letter per piece for an LED sign. Each piece
// is only the wall around the letter (and around its counters), open top and bottom, sized so
// every letter of the word fits a 260 × 260 mm print bed at one shared scale.

export const SIGN_BED = 260 // mm, each letter fits in this square
export const SIGN_PITCH = 280 // mm between letters in the combined file (one letter per plate)

export const SIGN_LIP = 8 // mm inner mounting lip at the bottom
const SIGN_LIP_THICK = 2.5
const SIGN_HOLE = 4 // mm screw holes in the lip
const SIGN_HOLE_SPACING = 80 // mm between screw holes along the lip
export const SIGN_FACE = 2.5 // mm face panel thickness
const SIGN_LEDGE = 2.5 // mm ledge the face rests on
const SIGN_LEDGE_THICK = 1.5
const SIGN_FACE_CLEAR = 0.3 // mm per side between face and wall

export type SignMount = 'screw' | 'glue'

export interface SignLetter {
  label: string
  /** Frame (walls + inner lip + ledge), assembled position. */
  frame: THREE.BufferGeometry
  /** Face panel, assembled position (sitting in the top of the frame). */
  face: THREE.BufferGeometry
  width: number
  length: number
}

export interface SignModel extends KeychainModel {
  letters: SignLetter[]
  /** Capital height after fitting, mm. */
  capHeight: number
  holes: number
}

/** Screw hole centres spaced along each loop of the lip's centre line. */
function holeSpots(centre: Path[]): [number, number][] {
  const spots: [number, number][] = []
  for (const loop of centre) {
    const pts = loop.map((q) => [q.X / S, q.Y / S])
    const seg = pts.map((p, i) => Math.hypot(pts[(i + 1) % pts.length][0] - p[0], pts[(i + 1) % pts.length][1] - p[1]))
    const total = seg.reduce((a, b) => a + b, 0)
    const n = total < SIGN_HOLE_SPACING * 0.6 ? (total > 25 ? 1 : 0) : Math.max(2, Math.round(total / SIGN_HOLE_SPACING))
    for (let k = 0; k < n; k++) {
      let d = ((k + 0.5) / n) * total
      for (let i = 0; i < pts.length; i++) {
        if (d <= seg[i]) {
          const t = seg[i] ? d / seg[i] : 0
          const nx = pts[(i + 1) % pts.length]
          spots.push([pts[i][0] + (nx[0] - pts[i][0]) * t, pts[i][1] + (nx[1] - pts[i][1]) * t])
          break
        }
        d -= seg[i]
      }
    }
  }
  return spots
}

export async function buildSignLetters(
  text: string,
  fontOpt: FontOption,
  heightMm: number,
  wallMm: number,
  mount: SignMount = 'screw',
): Promise<SignModel | null> {
  const chars = Array.from(text.replace(/\s+/g, ''))
  if (chars.length === 0) return null
  const REF = 100
  const clusters = await textClusters(text.replace(/\s+/g, ''), fontOpt, REF)
  if (clusters.length === 0) return null
  // Labels for the download buttons: each spacing character with the marks that follow it.
  const labels: string[] = []
  for (const ch of chars) {
    if (/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(ch) && labels.length) labels[labels.length - 1] += ch
    else labels.push(ch)
  }

  const shapes = clusters.map((c) => union(c))
  const boxes = shapes.map((sh) => boundsMm(sh))
  const maxW = Math.max(...boxes.map((b) => b.maxX - b.minX))
  const maxH = Math.max(...boxes.map((b) => b.maxY - b.minY))
  const k = Math.min(SIGN_BED / maxW, SIGN_BED / maxH)
  const H = heightMm
  const faceBottom = H - SIGN_FACE

  const letters: SignLetter[] = []
  let holeCount = 0
  shapes.forEach((shape, i) => {
    const b = boxes[i]
    const cx = (b.minX + b.maxX) / 2
    // Same baseline for every letter (they read as a word in the preview), each in its own slot.
    const L = scaleAbout(shape, k, cx, 0).map((p) => p.map((q) => ({ X: q.X + Math.round(i * SIGN_PITCH * S), Y: q.Y })))
    const clean = (paths: Path[]) => offset(offset(paths, -0.3), 0.3) // drop slivers too thin to print
    const inside = offset(L, -wallMm) // the hollow inside the walls
    const wall = clean(clip(L, inside, ClipperLib.ClipType.ctDifference))
    if (wall.length === 0) return
    const intoWall = offset(L, -(wallMm - 0.5)) // inner bands reach 0.5 mm into the wall so they fuse

    // Bottom lip, inside the frame (hidden), with screw holes along its middle.
    let lip = clean(clip(intoWall, offset(L, -(wallMm + SIGN_LIP)), ClipperLib.ClipType.ctDifference))
    if (mount === 'screw' && lip.length) {
      const spots = holeSpots(offset(L, -(wallMm + SIGN_LIP / 2)))
      holeCount += spots.length
      if (spots.length) lip = clip(lip, spots.map(([x, y]) => circle(x, y, SIGN_HOLE / 2, 32)), ClipperLib.ClipType.ctDifference)
    }

    // Ledge for the face, with a 45° chamfer underneath (printable upright without supports).
    const parts = [slab(wall, 0, H)]
    if (lip.length) parts.push(slab(lip, 0, SIGN_LIP_THICK))
    const ledgeTop = faceBottom
    const ledge = clean(clip(intoWall, offset(L, -(wallMm + SIGN_LEDGE)), ClipperLib.ClipType.ctDifference))
    if (ledge.length) parts.push(slab(ledge, ledgeTop - SIGN_LEDGE_THICK, ledgeTop))
    const steps = 5
    for (let s2 = 1; s2 < steps; s2++) {
      const w = SIGN_LEDGE * (1 - s2 / steps)
      const band = clean(clip(intoWall, offset(L, -(wallMm + w)), ClipperLib.ClipType.ctDifference))
      const z1 = ledgeTop - SIGN_LEDGE_THICK - (s2 - 1) * (SIGN_LEDGE / steps)
      if (band.length) parts.push(slab(band, z1 - SIGN_LEDGE / steps, z1))
    }
    const frame = mergeGeometries(parts)!

    // Face panel: the hollow's shape minus a small clearance, flush with the top of the frame.
    const faceOutline = clean(offset(L, -(wallMm + SIGN_FACE_CLEAR)))
    const face = faceOutline.length ? slab(faceOutline, faceBottom, H) : new THREE.BufferGeometry()

    const wb = boundsMm(wall)
    letters.push({ label: labels[i] ?? '?', frame, face, width: wb.maxX - wb.minX, length: wb.maxY - wb.minY })
  })
  if (letters.length === 0) return null

  const frames = letters.length === 1 ? letters[0].frame.clone() : mergeGeometries(letters.map((l) => l.frame))!
  const faces = letters.length === 1 ? letters[0].face.clone() : mergeGeometries(letters.map((l) => l.face).filter((g) => g.getAttribute('position')))!
  frames.computeBoundingBox()
  const bb = frames.boundingBox!
  // Centre the whole word for the preview; the per-letter copies move the same way.
  const dx = -(bb.min.x + bb.max.x) / 2
  const dy = -(bb.min.y + bb.max.y) / 2
  for (const g of [frames, faces, ...letters.flatMap((l) => [l.frame, l.face])]) if (g.getAttribute('position')) g.translate(dx, dy, 0)
  return {
    plate: frames,
    text: faces,
    width: bb.max.x - bb.min.x,
    length: bb.max.y - bb.min.y,
    height: H,
    letters,
    capHeight: REF * k,
    holes: holeCount,
  }
}
