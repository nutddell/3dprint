import { useEffect, useRef, useState } from 'react'
import Preview from './Preview'
import { FONTS, fontFamily, type FontOption } from './fonts'
import { buildKeychain, type KeychainModel } from './geometry'

const LOGO_URL = 'https://lh3.googleusercontent.com/d/1TCIgIjY4dLXY08wZIjGq2cNA7bv19rIx=h300'

const SIZE_MIN = 8
const SIZE_MAX = 40
const MAX_CHARS = 20

/** Common filament colours. */
const SWATCHES = [
  { hex: '#ffffff', name: 'ขาว' },
  { hex: '#1f1f1f', name: 'ดำ' },
  { hex: '#8c8c8c', name: 'เทา' },
  { hex: '#d62828', name: 'แดง' },
  { hex: '#e8731a', name: 'ส้ม' },
  { hex: '#f6c90e', name: 'เหลือง' },
  { hex: '#2a9d4b', name: 'เขียว' },
  { hex: '#2563eb', name: 'น้ำเงิน' },
  { hex: '#1e2f6b', name: 'กรมท่า' },
  { hex: '#f28bb5', name: 'ชมพู' },
  { hex: '#7b3fbf', name: 'ม่วง' },
  { hex: '#7a4a24', name: 'น้ำตาล' },
]

const TOOLS = [
  { id: 'keychain', label: 'การทำพวงกุญแจ 3D', icon: '🔑', ready: true },
  ...Array.from({ length: 5 }, (_, i) => ({ id: `soon-${i}`, label: 'เร็วๆ นี้', icon: '', ready: false })),
]

function readTheme(): boolean {
  try {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
  } catch {
    /* storage unavailable */
  }
  return false
}

export default function App() {
  const [dark, setDark] = useState(readTheme)
  const [text, setText] = useState('สวัสดี Hello')
  const [size, setSize] = useState(15)
  const [font, setFont] = useState<FontOption>(FONTS.find((f) => f.id === 'kanit')!)
  const [textColor, setTextColor] = useState('#e8731a')
  const [plateColor, setPlateColor] = useState('#1e2f6b')
  const [model, setModel] = useState<KeychainModel | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [logoOk, setLogoOk] = useState(true)
  const buildId = useRef(0)

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light')
    } catch {
      /* storage unavailable */
    }
  }, [dark])

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
    <div className="app">
      <header className="topbar">
        <div className="brand">
          {logoOk ? (
            <img className="brand-logo" src={LOGO_URL} alt="โลโก้ร้าน" onError={() => setLogoOk(false)} />
          ) : (
            <span className="brand-mark" aria-hidden="true">◆</span>
          )}
          <span className="brand-name">
            3D <span>Print</span>
          </span>
        </div>
        <div className="topbar-right">
          <span className="tagline">สร้างไฟล์งาน 3D Print</span>
          <button className="theme-btn" onClick={() => setDark(!dark)}>
            {dark ? '☀️ โหมดสว่าง' : '🌙 โหมดมืด'}
          </button>
        </div>
      </header>

      <nav className="tools" aria-label="ประเภทงาน">
        {TOOLS.map((t) => (
          <button key={t.id} className={`tool ${t.ready ? 'active' : 'soon'}`} disabled={!t.ready}>
            {t.icon && <span className="tool-icon">{t.icon}</span>}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <main className="workspace">
        <section className="preview card">
          <div className="dims">
            {model
              ? `ขนาดรวม กว้าง ${model.width.toFixed(1)} × ยาว ${model.length.toFixed(1)} × สูง ${model.height.toFixed(1)} mm`
              : 'พิมพ์ข้อความเพื่อดูตัวอย่าง'}
          </div>
          {busy && <div className="busy">กำลังสร้าง…</div>}
          <Preview model={model} textColor={textColor} plateColor={plateColor} dark={dark} />
          <div className="hint">ลากเพื่อหมุน · เลื่อนเพื่อซูม</div>
        </section>

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
        </section>
      </main>
    </div>
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

function ColorField(props: { label: string; value: string; onChange: (v: string) => void }) {
  const inSwatches = SWATCHES.some((s) => s.hex === props.value.toLowerCase())
  return (
    <div className="field">
      <div className="row">
        <label>{props.label}</label>
        <span className="value">{SWATCHES.find((s) => s.hex === props.value.toLowerCase())?.name ?? props.value}</span>
      </div>
      <div className="swatches">
        {SWATCHES.map((s) => (
          <button
            key={s.hex}
            className={`swatch ${props.value.toLowerCase() === s.hex ? 'selected' : ''}`}
            style={{ background: s.hex }}
            title={s.name}
            aria-label={s.name}
            onClick={() => props.onChange(s.hex)}
          />
        ))}
        <label className={`swatch custom ${inSwatches ? '' : 'selected'}`} title="เลือกสีเอง">
          <input type="color" value={props.value} onChange={(e) => props.onChange(e.target.value)} aria-label="เลือกสีเอง" />
          <span>+</span>
        </label>
      </div>
    </div>
  )
}
