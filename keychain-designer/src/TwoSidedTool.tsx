import { useEffect, useRef, useState } from 'react'
import { downloadStl, type StlPart } from './exportStl'
import { FONTS, type FontOption } from './fonts'
import {
  buildTwoSided,
  DEFAULT_RING,
  textOutline,
  TWO_HALF_THICKNESS,
  TWO_RAISED,
  type BaseShape,
  type KeychainModel,
  type RingOptions,
} from './geometry'
import { inkField, loadImage, traceImage, type LoadedImage } from './imageTrace'
import { ColorField, PreviewCard, RingField } from './shared'
import { FontPicker } from './FontPicker'
import type { Path } from './units'

const MAX_CHARS = 16
const SHAPES: { id: BaseShape; label: string }[] = [
  { id: 'rounded', label: 'สี่เหลี่ยมมน' },
  { id: 'oval', label: 'วงรี' },
  { id: 'circle', label: 'วงกลม' },
  { id: 'fit', label: 'ตามลาย' },
]

/** Name on the front, logo on the back: two halves printed apart and glued back to back. */
export default function TwoSidedTool({ dark }: { dark: boolean }) {
  const [text, setText] = useState('Nawamin')
  const [size, setSize] = useState(14)
  const [font, setFont] = useState<FontOption>(FONTS.find((f) => f.id === 'poppins')!)
  const [img, setImg] = useState<LoadedImage | null>(null)
  const [logoWidth, setLogoWidth] = useState(45)
  const [level, setLevel] = useState(40)
  const [invert, setInvert] = useState(false)
  const [shape, setShape] = useState<BaseShape>('rounded')
  const [ring, setRing] = useState<RingOptions>(DEFAULT_RING)
  const [baseColor, setBaseColor] = useState('#ffffff')
  const [textColor, setTextColor] = useState('#6334e0')
  const [logoColor, setLogoColor] = useState('#e8731a')
  const [flip, setFlip] = useState(false)
  const [model, setModel] = useState<KeychainModel | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const maskRef = useRef<HTMLCanvasElement>(null)
  const buildId = useRef(0)

  const open = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('กรุณาเลือกไฟล์รูป (PNG, JPG, WEBP หรือ SVG)')
      return
    }
    try {
      const loaded = await loadImage(file)
      setInvert(loaded.darkBackground)
      setImg(loaded)
      setFlip(true) // show the side that just changed
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เปิดไฟล์รูปไม่สำเร็จ')
    }
  }

  useEffect(() => {
    const id = ++buildId.current
    const t = setTimeout(async () => {
      setBusy(true)
      try {
        const front: Path[] = text.trim() ? await textOutline(text, font, size) : []
        const back: Path[] = img ? (traceImage(img, invert, level / 100, logoWidth)?.paths ?? []) : []
        const m = buildTwoSided(front, back, shape, size, ring)
        if (id !== buildId.current) return
        setModel(m)
        setError(m ? '' : 'พิมพ์ชื่อหรือเลือกโลโก้เพื่อเริ่ม')
      } catch (e) {
        if (id === buildId.current) setError(e instanceof Error ? e.message : 'สร้างโมเดลไม่สำเร็จ')
      } finally {
        if (id === buildId.current) setBusy(false)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [text, font, size, img, invert, level, logoWidth, shape, ring])

  // 2D check of which logo pixels become raised.
  useEffect(() => {
    const canvas = maskRef.current
    if (!canvas || !img) return
    canvas.width = img.w
    canvas.height = img.h
    const ctx = canvas.getContext('2d')!
    const field = inkField(img, invert)
    const out = ctx.createImageData(img.w, img.h)
    const top = hexRgb(logoColor)
    const base = hexRgb(baseColor)
    const t = level / 100
    for (let p = 0, i = 0; p < field.length; p++, i += 4) {
      const c = field[p] >= t ? top : base
      out.data.set([c[0], c[1], c[2], 255], i)
    }
    ctx.putImageData(out, 0, 0)
  }, [img, invert, level, logoColor, baseColor])

  const save = (part: StlPart) => {
    if (!model) return
    try {
      downloadStl(model, part, text || 'logo')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้างไฟล์ STL ไม่สำเร็จ')
    }
  }
  const off = !model || busy

  return (
    <main className="workspace">
      <PreviewCard
        model={model}
        busy={busy}
        topColor={textColor}
        plateColor={baseColor}
        backColor={logoColor}
        dark={dark}
        emptyText="พิมพ์ชื่อและเลือกโลโก้เพื่อดูตัวอย่าง"
        flip={{ on: flip, onToggle: () => setFlip(!flip) }}
      />

      <section className="panel card">
        <div className="field">
          <div className="side-title">ด้านหน้า · ชื่อ</div>
          <label htmlFor="two-text">ข้อความ</label>
          <input
            id="two-text"
            className="text-input"
            value={text}
            maxLength={MAX_CHARS}
            placeholder="พิมพ์ชื่อ"
            onChange={(e) => {
              setText(e.target.value)
              setFlip(false)
            }}
          />
          {error && <div className="error">{error}</div>}
        </div>

        <Slider id="two-size" label="ขนาดความสูงตัวอักษร" unit="mm" min={8} max={30} value={size} onChange={setSize} />

        <div className="field">
          <label>ฟอนต์</label>
          <FontPicker value={font} onChange={setFont} />
        </div>

        <div className="field">
          <div className="side-title">ด้านหลัง · โลโก้</div>
          <div
            className={`dropzone ${dragging ? 'over' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              open(e.dataTransfer.files[0])
            }}
          >
            {img ? (
              <>
                <canvas ref={maskRef} className="mask" aria-label="ตัวอย่างการแยกลายโลโก้" />
                <span className="dz-name">{img.name} · คลิกเพื่อเปลี่ยนรูป</span>
              </>
            ) : (
              <>
                <span className="dz-icon">🖼️</span>
                <span>คลิกหรือลากโลโก้มาวางที่นี่</span>
                <span className="sub">PNG พื้นใส หรือรูปพื้นขาว ให้ผลดีที่สุด</span>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            hidden
            onChange={(e) => {
              open(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>

        {img && (
          <>
            <Slider id="two-logo" label="ความกว้างโลโก้" unit="mm" min={20} max={90} value={logoWidth} onChange={setLogoWidth} />
            <div className="field">
              <Slider id="two-level" label="ระดับการแยกลาย" unit="%" min={5} max={95} value={level} onChange={setLevel} />
              <label className="check">
                <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
                สลับลายกับพื้น (ใช้กับลายสีอ่อนบนพื้นเข้ม)
              </label>
            </div>
          </>
        )}

        <div className="field">
          <label>รูปทรงฐาน</label>
          <div className="segmented" role="group" aria-label="รูปทรงฐาน">
            {SHAPES.map((s) => (
              <button key={s.id} className={shape === s.id ? 'selected' : ''} aria-pressed={shape === s.id} onClick={() => setShape(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="sub">ฐานหน้าและหลังเป็นรูปเดียวกัน ประกบกันได้พอดี · "ตามลาย" รวมโครงร่างชื่อกับโลโก้</div>
        </div>

        <RingField value={ring} onChange={setRing} />

        <ColorField label="สีฐาน" value={baseColor} onChange={setBaseColor} />
        <ColorField label="สีชื่อ (ด้านหน้า)" value={textColor} onChange={setTextColor} />
        <ColorField label="สีโลโก้ (ด้านหลัง)" value={logoColor} onChange={setLogoColor} />

        <div className="field download">
          <label>ดาวน์โหลดไฟล์ STL (4 ไฟล์)</label>
          <div className="download-grid">
            <button className="dl-btn" disabled={off} onClick={() => save('plate')}>
              <span className="dl-dot" style={{ background: baseColor }} />
              ฐานหน้า
            </button>
            <button className="dl-btn" disabled={off} onClick={() => save('text')}>
              <span className="dl-dot" style={{ background: textColor }} />
              ชื่อ
            </button>
            <button className="dl-btn" disabled={off || !model?.back} onClick={() => save('backPlate')}>
              <span className="dl-dot" style={{ background: baseColor }} />
              ฐานหลัง
            </button>
            <button className="dl-btn" disabled={off || !img} onClick={() => save('backText')}>
              <span className="dl-dot" style={{ background: logoColor }} />
              โลโก้
            </button>
          </div>
          <div className="sub">
            แต่ละซีกพิมพ์คว่ำด้านเรียบลง: ลากไฟล์ฐานกับลายของซีกนั้นเข้า Creality Print พร้อมกัน ตอบ “ใช่”
            เมื่อถามว่าจะโหลดเป็นวัตถุเดียว แล้วเลือก filament ให้แต่ละชิ้น (หรือหยุดเปลี่ยนสีที่ {TWO_HALF_THICKNESS} mm) ·
            ประกอบ: ตัดเส้น filament 1.75 mm ยาว ~2 mm เป็นหมุด เสียบรูด้านเรียบของซีกหนึ่ง ทากาวแล้วประกบอีกซีก
            (ลายนูนข้างละ {TWO_RAISED} mm)
          </div>
        </div>
      </section>
    </main>
  )
}

function Slider(props: { id: string; label: string; unit: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <div className="row">
        <label htmlFor={props.id}>{props.label}</label>
        <span className="value">
          {props.value} {props.unit}
        </span>
      </div>
      <input id={props.id} type="range" min={props.min} max={props.max} step={1} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </div>
  )
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
