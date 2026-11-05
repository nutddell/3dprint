import * as hb from 'harfbuzzjs'
import ClipperLib from 'clipper-lib'
import * as THREE from 'three'
import { FONTS, THAI_FALLBACK_ID, fontUrl, type FontOption } from './fonts'

/** Clipper works on integers: 1 unit = 1 µm. */
const S = 1000

export const PLATE_THICKNESS = 3 // mm
export const TEXT_THICKNESS = 2 // mm, raised above the plate
export const PLATE_MARGIN = 4 // mm around the letters
const RING_OUTER = 4.5 // mm radius of the keyring loop
const RING_HOLE = 2 // mm radius of the hole

type Pt = { X: number; Y: number }
type Path = Pt[]

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

/** Shape the text with HarfBuzz (correct Thai vowel/tone mark placement) and return its outlines. */
async function textOutlines(text: string, fontOpt: FontOption, sizeMm: number): Promise<Path[]> {
  const primary = await loadFont(fontOpt)
  const needFallback = fontOpt.script === 'latin' && Array.from(text).some(isThai)
  const fallback = needFallback ? await loadFont(FONTS.find((f) => f.id === THAI_FALLBACK_ID)!) : null

  const paths: Path[] = []
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
      const cmds = lf.font.glyphToJson(info.codepoint)
      paths.push(...glyphPaths(cmds, pen + pos.xOffset * k, pos.yOffset * k, k))
      pen += pos.xAdvance * k
    })
  }
  return paths
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

/** Plate = letters grown by the margin (holes filled) + keyring loop on the left, minus the ring hole. */
function plateOutline(textPaths: Path[], sizeMm: number): ClipperLib.PolyTree {
  const off = new ClipperLib.ClipperOffset(2, 0.02 * S)
  off.AddPaths(textPaths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon)
  const grown: Path[] = []
  off.Execute(grown, PLATE_MARGIN * S)
  const outers = grown.filter((p) => ClipperLib.Clipper.Orientation(p))

  const tb = ClipperLib.Clipper.GetBounds(textPaths)
  const pb = ClipperLib.Clipper.GetBounds(outers)
  const cx = pb.left / S - RING_HOLE - 1.2
  const cy = sizeMm / 2
  const bridge = rect(cx, cy - RING_OUTER, tb.left / S + 0.5, cy + RING_OUTER)

  const c = new ClipperLib.Clipper()
  c.AddPaths([...outers, circle(cx, cy, RING_OUTER), bridge], ClipperLib.PolyType.ptSubject, true)
  c.AddPath(circle(cx, cy, RING_HOLE), ClipperLib.PolyType.ptClip, true)
  const tree = new ClipperLib.PolyTree()
  c.Execute(ClipperLib.ClipType.ctDifference, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)
  return tree
}

function treeFromPaths(paths: Path[]): ClipperLib.PolyTree {
  const c = new ClipperLib.Clipper()
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true)
  const tree = new ClipperLib.PolyTree()
  c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)
  return tree
}

const toV2 = (p: Path) => p.map((q) => new THREE.Vector2(q.X / S, q.Y / S))

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
  text: THREE.BufferGeometry
  /** Overall size in mm. */
  width: number
  length: number
  height: number
}

export async function buildKeychain(text: string, fontOpt: FontOption, sizeMm: number): Promise<KeychainModel | null> {
  const raw = await textOutlines(text, fontOpt, sizeMm)
  const letters = union(raw)
  if (letters.length === 0) return null

  const plateTree = plateOutline(letters, sizeMm)
  const plateShapes = treeToShapes(plateTree)
  const textShapes = treeToShapes(treeFromPaths(letters))

  const plate = new THREE.ExtrudeGeometry(plateShapes, { depth: PLATE_THICKNESS, bevelEnabled: false })
  const textGeo = new THREE.ExtrudeGeometry(textShapes, { depth: TEXT_THICKNESS, bevelEnabled: false })
  textGeo.translate(0, 0, PLATE_THICKNESS)

  plate.computeBoundingBox()
  const bb = plate.boundingBox!
  const cx = (bb.min.x + bb.max.x) / 2
  const cy = (bb.min.y + bb.max.y) / 2
  plate.translate(-cx, -cy, 0)
  textGeo.translate(-cx, -cy, 0)

  return {
    plate,
    text: textGeo,
    width: bb.max.x - bb.min.x,
    length: bb.max.y - bb.min.y,
    height: PLATE_THICKNESS + TEXT_THICKNESS,
  }
}
