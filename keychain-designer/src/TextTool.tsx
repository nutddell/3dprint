import { useEffect, useRef, useState } from 'react'
import { FONTS, fontFamily, type FontOption } from './fonts'
import { buildKeychain, type KeychainModel } from './geometry'
import { ColorField, DownloadField, PreviewCard } from './shared'

const SIZE_MIN = 8
const SIZE_MAX = 40
const MAX_CHARS = 20

export default function TextTool({ dark }: { dark: boolean }) {
  const [text, setText] = useState('สวัสดี Hello')
  const [size, setSize] = useState(15)
  const [font, setFont] = useState<FontOption>(FONTS.find((f) => f.id === 'kanit')!)
  const [textColor, setTextColor] = useState('#e8731a')
  const [plateColor, setPlateColor] = useState('#1e2f6b')
  const [model, setModel] = useState<KeychainModel | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const buildId = useRef(0)

  // Rebuild the model shortly after the user stops typing / dragging.
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
        const m = await buildKeychain(text, font, size)
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
  }, [text, font, size])

  const thaiFonts = FONTS.filter((f) => f.script === 'thai')
  const latinFonts = FONTS.filter((f) => f.script === 'latin')

  return (
    <main className="workspace">
      <PreviewCard
        model={model}
        busy={busy}
        topColor={textColor}
        plateColor={plateColor}
        dark={dark}
        emptyText="พิมพ์ข้อความเพื่อดูตัวอย่าง"
      />

      <section className="panel card">
        <div className="field">
          <label htmlFor="text">ข้อความ</label>
          <input
            id="text"
            className="text-input"
            value={text}
            maxLength={MAX_CHARS}
            placeholder="พิมพ์ชื่อหรือข้อความ"
            onChange={(e) => setText(e.target.value)}
          />
          <div className="sub">
            {Array.from(text).length}/{MAX_CHARS} ตัวอักษร
          </div>
          {error && <div className="error">{error}</div>}
        </div>

        <div className="field">
          <div className="row">
            <label htmlFor="size">ขนาดความสูงตัวอักษร</label>
            <span className="value">{size} mm</span>
          </div>
          <input
            id="size"
            type="range"
            min={SIZE_MIN}
            max={SIZE_MAX}
            step={1}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
          <div className="sub">วัดจากความสูงตัวพิมพ์ใหญ่ (H)</div>
        </div>

        <div className="field">
          <label>ฟอนต์ (ฟรี ใช้เชิงพาณิชย์ได้)</label>
          <FontGroup title="ภาษาไทย" fonts={thaiFonts} value={font} onChange={setFont} sample="กขค Ab" />
          <FontGroup title="ภาษาอังกฤษ" fonts={latinFonts} value={font} onChange={setFont} sample="Abc 123" />
          <div className="sub">ฟอนต์ภาษาอังกฤษจะใช้ Kanit กับตัวอักษรไทย</div>
        </div>

        <ColorField label="สีตัวอักษร" value={textColor} onChange={setTextColor} />
        <ColorField label="สีพื้นหลัง" value={plateColor} onChange={setPlateColor} />

        <DownloadField
          model={model}
          disabled={busy}
          name={text}
          topLabel="ตัวอักษร"
          topColor={textColor}
          plateColor={plateColor}
          onError={setError}
        />
      </section>
    </main>
  )
}

function FontGroup(props: {
  title: string
  fonts: FontOption[]
  value: FontOption
  onChange: (f: FontOption) => void
  sample: string
}) {
  return (
    <div className="font-group">
      <div className="font-group-title">{props.title}</div>
      <div className="font-grid">
        {props.fonts.map((f) => (
          <button
            key={f.id}
            className={`font-btn ${props.value.id === f.id ? 'selected' : ''}`}
            onClick={() => props.onChange(f)}
            aria-pressed={props.value.id === f.id}
          >
            <span className="font-sample" style={{ fontFamily: `'${fontFamily(f)}', sans-serif` }}>
              {props.sample}
            </span>
            <span className="font-name">{f.name}</span>
            <span className={`font-tag ${f.style === 'ทางการ' ? 'formal' : 'casual'}`}>{f.style}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
