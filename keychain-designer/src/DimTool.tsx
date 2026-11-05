import { useEffect, useRef, useState } from 'react'
import { FONTS, type FontOption } from './fonts'
import { buildDimensional, DEFAULT_RING, DIM_BASE_THICKNESS, DIM_LEVELS, type DimStyle, type KeychainModel, type RingOptions } from './geometry'
import { ColorField, DownloadField, PreviewCard, RingField } from './shared'
import { FontGroup } from './TextTool'

const MAX_CHARS = 16

/** Thick one-colour standing letters ("พวงกุญแจตัวอักษรมิติ"). */
export default function DimTool({ dark }: { dark: boolean }) {
  const [text, setText] = useState('Ava')
  const [size, setSize] = useState(25)
  const [font, setFont] = useState<FontOption>(FONTS.find((f) => f.id === 'poppins')!)
  const [color, setColor] = useState('#d9c9ef')
  const [style, setStyle] = useState<DimStyle>('joined')
  const [baseColor, setBaseColor] = useState('#ffffff')
  const [exploded, setExploded] = useState(false)
  const [ring, setRing] = useState<RingOptions>(DEFAULT_RING)
  const [model, setModel] = useState<KeychainModel | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const buildId = useRef(0)

  useEffect(() => {
    const id = ++buildId.current
    const t = setTimeout(async () => {
      if (!text.trim()) {
        setModel(null)
        setError('')
        return
      }
      setBusy(true)
      try {
        const m = await buildDimensional(text, font, size, ring, style)
        if (id !== buildId.current) return
        setModel(m)
        setError(m ? '' : 'ฟอนต์นี้ไม่มีตัวอักษรที่พิมพ์ ลองเปลี่ยนฟอนต์')
      } catch (e) {
        if (id === buildId.current) setError(e instanceof Error ? e.message : 'สร้างโมเดลไม่สำเร็จ')
      } finally {
        if (id === buildId.current) setBusy(false)
      }
    }, 150)
    return () => clearTimeout(t)
  }, [text, font, size, ring, style])

  return (
    <main className="workspace">
      <PreviewCard
        model={model}
        busy={busy}
        topColor={color}
        plateColor={style === 'base' ? baseColor : color}
        dark={dark}
        emptyText="พิมพ์ข้อความเพื่อดูตัวอย่าง"
        explode={style === 'base' ? { on: exploded, onToggle: () => setExploded(!exploded) } : undefined}
      />

      <section className="panel card">
        <div className="field">
          <label htmlFor="dim-text">ข้อความ</label>
          <input
            id="dim-text"
            className="text-input"
            value={text}
            maxLength={MAX_CHARS}
            placeholder="พิมพ์ชื่อ"
            onChange={(e) => setText(e.target.value)}
          />
          <div className="sub">
            {Array.from(text).length}/{MAX_CHARS} ตัวอักษร
          </div>
          {error && <div className="error">{error}</div>}
        </div>

        <div className="field">
          <label>รูปแบบ</label>
          <div className="segmented" role="group" aria-label="รูปแบบ">
            <button className={style === 'joined' ? 'selected' : ''} aria-pressed={style === 'joined'} onClick={() => setStyle('joined')}>
              ตัวอักษรติดกัน (1 ชิ้น)
            </button>
            <button className={style === 'base' ? 'selected' : ''} aria-pressed={style === 'base'} onClick={() => setStyle('base')}>
              มีฐานประกอบ (2 ชิ้น)
            </button>
          </div>
          <div className="sub">
            {style === 'joined'
              ? 'ตัวอักษรชิดซ้อนกันเองเป็นชิ้นเดียว ไม่มีฐาน'
              : `ฐานบาง ${DIM_BASE_THICKNESS} mm พร้อมห่วง มีขอบเป็นร่องตามรูปตัวอักษร แยกพิมพ์แล้ววางตัวอักษรลงร่องได้พอดี`}
          </div>
        </div>

        <Slider id="dim-size" label="ขนาดความสูงตัวอักษร" unit="mm" min={15} max={50} value={size} onChange={setSize} note="วัดจากความสูงตัวพิมพ์ใหญ่ (H)" />
        <div className="field">
          <label>ความหนา</label>
          <div className="sub">
            ตัวอักษรสูงไล่ระดับ {DIM_LEVELS.join(' / ')} mm สลับกันทีละตัว ทางร้านตั้งค่าไว้ให้พิมพ์ได้แข็งแรง
          </div>
        </div>

        <div className="field">
          <label>ฟอนต์ (ฟรี ใช้เชิงพาณิชย์ได้)</label>
          <FontGroup title="ภาษาไทย" fonts={FONTS.filter((f) => f.script === 'thai')} value={font} onChange={setFont} sample="กขค Ab" />
          <FontGroup title="ภาษาอังกฤษ" fonts={FONTS.filter((f) => f.script === 'latin')} value={font} onChange={setFont} sample="Abc 123" />
          <div className="sub">ฟอนต์หนา (Poppins, Kanit, Prompt) เหมาะกับงานนี้ที่สุด · เว้นวรรคจะถูกบีบให้ชิดกัน</div>
        </div>

        <RingField value={ring} onChange={setRing} />
        <ColorField label={style === 'base' ? 'สีตัวอักษร' : 'สีชิ้นงาน'} value={color} onChange={setColor} />
        {style === 'base' && <ColorField label="สีฐาน (โทนอ่อน)" value={baseColor} onChange={setBaseColor} lightOnly />}

        <DownloadField
          model={model}
          disabled={busy}
          name={text}
          topLabel="ตัวอักษร"
          topColor={color}
          plateColor={style === 'base' ? baseColor : color}
          onError={setError}
          single={style === 'joined'}
          plateLabel="ฐาน + ห่วง"
          note="แยกพิมพ์: โหลดไฟล์ฐานกับตัวอักษร พิมพ์แยกกันแล้วนำตัวอักษรมาติดบนฐาน (slicer จะวางแต่ละไฟล์ลงบนแผ่นพิมพ์ให้เอง) · ถ้าเครื่องพิมพ์หลายสีได้ ลากทั้ง 2 ไฟล์เข้า Creality Print พร้อมกันแล้วตอบ “ใช่” เมื่อถามว่าจะโหลดเป็นวัตถุเดียว"
        />
      </section>
    </main>
  )
}

function Slider(props: {
  id: string
  label: string
  unit: string
  min: number
  max: number
  value: number
  onChange: (v: number) => void
  note?: string
}) {
  return (
    <div className="field">
      <div className="row">
        <label htmlFor={props.id}>{props.label}</label>
        <span className="value">
          {props.value} {props.unit}
        </span>
      </div>
      <input
        id={props.id}
        type="range"
        min={props.min}
        max={props.max}
        step={1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
      {props.note && <div className="sub">{props.note}</div>}
    </div>
  )
}
