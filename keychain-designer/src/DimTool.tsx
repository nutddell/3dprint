import { useEffect, useRef, useState } from 'react'
import { FONTS, type FontOption } from './fonts'
import { buildDimensional, DEFAULT_RING, DIM_LEVELS, type KeychainModel, type RingOptions } from './geometry'
import { ColorField, DownloadField, PreviewCard, RingField } from './shared'
import { FontGroup } from './TextTool'

const MAX_CHARS = 16

/** Thick one-colour standing letters ("พวงกุญแจตัวอักษรมิติ"). */
export default function DimTool({ dark }: { dark: boolean }) {
  const [text, setText] = useState('Ava')
  const [size, setSize] = useState(25)
  const [font, setFont] = useState<FontOption>(FONTS.find((f) => f.id === 'poppins')!)
  const [color, setColor] = useState('#d9c9ef')
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
        const m = await buildDimensional(text, font, size, ring)
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
  }, [text, font, size, ring])

  return (
    <main className="workspace">
      <PreviewCard model={model} busy={busy} topColor={color} plateColor={color} dark={dark} emptyText="พิมพ์ข้อความเพื่อดูตัวอย่าง" />

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
            {Array.from(text).length}/{MAX_CHARS} ตัวอักษร · ทั้งชิ้นเป็นสีเดียว
          </div>
          {error && <div className="error">{error}</div>}
        </div>

        <Slider id="dim-size" label="ขนาดความสูงตัวอักษร" unit="mm" min={15} max={50} value={size} onChange={setSize} note="วัดจากความสูงตัวพิมพ์ใหญ่ (H)" />
        <div className="field">
          <label>ความหนา</label>
          <div className="sub">
            ตัวอักษรสูงไล่ระดับ {DIM_LEVELS.join(' / ')} mm สลับกันทีละตัว และชิดซ้อนกันเองโดยไม่มีฐาน
            ทางร้านตั้งค่าไว้ให้พิมพ์ได้แข็งแรง
          </div>
        </div>

        <div className="field">
          <label>ฟอนต์ (ฟรี ใช้เชิงพาณิชย์ได้)</label>
          <FontGroup title="ภาษาไทย" fonts={FONTS.filter((f) => f.script === 'thai')} value={font} onChange={setFont} sample="กขค Ab" />
          <FontGroup title="ภาษาอังกฤษ" fonts={FONTS.filter((f) => f.script === 'latin')} value={font} onChange={setFont} sample="Abc 123" />
          <div className="sub">ฟอนต์หนา (Poppins, Kanit, Prompt) เหมาะกับงานนี้ที่สุด · เว้นวรรคจะถูกบีบให้ชิดกัน</div>
        </div>

        <RingField value={ring} onChange={setRing} />
        <ColorField label="สีชิ้นงาน" value={color} onChange={setColor} />

        <DownloadField
          model={model}
          disabled={busy}
          name={text}
          topLabel="ตัวอักษร"
          topColor={color}
          plateColor={color}
          onError={setError}
          single
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
