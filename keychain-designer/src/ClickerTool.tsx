import { useEffect, useRef, useState } from 'react'
import { fileStem, saveStl } from './exportStl'
import { FONTS, type FontOption } from './fonts'
import { buildClicker, CLICKER_LENGTH, CLICKER_WIDTH, MX_DEFAULTS, type ClickerModel, type ClickerParams } from './geometry'
import { ColorField, PreviewCard } from './shared'
import { FontPicker } from './FontPicker'

const MAX_CHARS = 12
const SETTINGS_KEY = 'clicker-switch'

const FIELDS: { key: keyof ClickerParams; label: string; hint: string }[] = [
  { key: 'hole', label: 'รูเพลท (ด้าน)', hint: 'MX = 14.0' },
  { key: 'plate', label: 'ความหนาเพลท', hint: 'MX = 1.5' },
  { key: 'below', label: 'ความลึกใต้เพลท (ตัวสวิตช์ + ขา)', hint: 'ตัวล่าง ~5 + ขา ~3.3 + เผื่อ' },
  { key: 'undercut', label: 'ช่องใต้เพลท (ให้คลิปล็อก)', hint: 'ใหญ่กว่ารูเล็กน้อย' },
  { key: 'stemTop', label: 'ปลายก้านสูงจากเพลท', hint: 'วัดจากผิวบนเพลทถึงปลายก้าน' },
  { key: 'crossArm', label: 'รูกากบาท: ความยาวแขน', hint: 'ก้าน MX ~4.0 + เผื่อ' },
  { key: 'crossWidth', label: 'รูกากบาท: ความกว้างแขน', hint: 'ก้าน MX ~1.2 + เผื่อ' },
  { key: 'socketDepth', label: 'ความลึกรูกากบาท', hint: '~3.6' },
  { key: 'boss', label: 'แกนรอบรูกากบาท (Ø)', hint: '~5.6' },
]

function loadSettings(): ClickerParams {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY)
    if (saved) return { ...MX_DEFAULTS, ...JSON.parse(saved) }
  } catch {
    /* storage unavailable */
  }
  return MX_DEFAULTS
}

/** Name clicker keychain: housing for a keyboard (MX-style) switch + keycap lid with the name. */
export default function ClickerTool({ dark }: { dark: boolean }) {
  const [text, setText] = useState('Nora')
  const [font, setFont] = useState<FontOption>(FONTS.find((f) => f.id === 'poppins')!)
  const [bodyColor, setBodyColor] = useState('#f6e7a6')
  const [nameColor, setNameColor] = useState('#d62828')
  const [params, setParams] = useState<ClickerParams>(loadSettings)
  const [exploded, setExploded] = useState(false)
  const [model, setModel] = useState<ClickerModel | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const buildId = useRef(0)

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(params))
    } catch {
      /* storage unavailable */
    }
  }, [params])

  useEffect(() => {
    const id = ++buildId.current
    const t = setTimeout(async () => {
      setBusy(true)
      try {
        const m = await buildClicker(text, font, params)
        if (id !== buildId.current) return
        setModel(m)
        setError('')
      } catch (e) {
        if (id === buildId.current) setError(e instanceof Error ? e.message : 'สร้างโมเดลไม่สำเร็จ')
      } finally {
        if (id === buildId.current) setBusy(false)
      }
    }, 150)
    return () => clearTimeout(t)
  }, [text, font, params])

  const off = !model || busy
  const stem = fileStem(text ? `clicker-${text}` : 'clicker')
  const hasName = !!model && model.nameHeight > 0

  return (
    <main className="workspace">
      <PreviewCard
        model={model}
        busy={busy}
        topColor={bodyColor}
        partColors={[bodyColor, nameColor]}
        plateColor={bodyColor}
        dark={dark}
        emptyText="พิมพ์ชื่อเพื่อดูตัวอย่าง"
        explode={{ on: exploded, onToggle: () => setExploded(!exploded) }}
      />

      <section className="panel card">
        <div className="field">
          <label htmlFor="clk-text">ชื่อบนฝา</label>
          <input id="clk-text" className="text-input" value={text} maxLength={MAX_CHARS} placeholder="พิมพ์ชื่อ" onChange={(e) => setText(e.target.value)} />
          <div className="sub">
            {Array.from(text).length}/{MAX_CHARS} ตัวอักษร · ขนาดชิ้นงานคงที่ {CLICKER_LENGTH} × {CLICKER_WIDTH} mm ตัวอักษรย่อขยายให้พอดีฝา
            {hasName && ` (สูง ~${model!.nameHeight.toFixed(1)} mm)`}
          </div>
          {error && <div className="error">{error}</div>}
        </div>

        <div className="field">
          <label>ฟอนต์</label>
          <FontPicker value={font} onChange={setFont} />
        </div>

        <ColorField label="สีตัวเรือนและฝา" value={bodyColor} onChange={setBodyColor} />
        <ColorField label="สีชื่อ" value={nameColor} onChange={setNameColor} />

        <div className="field download">
          <label>ดาวน์โหลดไฟล์ STL (3 ชิ้น)</label>
          <div className="download-grid">
            <button className="dl-btn" disabled={off} onClick={() => model && saveStl(model.print.base, `${stem}-housing.stl`)}>
              <span className="dl-dot" style={{ background: bodyColor }} />
              ตัวเรือน + ห่วง
            </button>
            <button className="dl-btn" disabled={off} onClick={() => model && saveStl(model.print.lid, `${stem}-cap.stl`)}>
              <span className="dl-dot" style={{ background: bodyColor }} />
              ฝา (keycap)
            </button>
            <button className="dl-btn primary" disabled={off || !hasName} onClick={() => model && saveStl(model.print.name, `${stem}-name.stl`)}>
              <span className="dl-dot" style={{ background: nameColor }} />
              ชื่อ
            </button>
          </div>
          <div className="sub">
            ไฟล์วางตามท่าพิมพ์แล้ว: ตัวเรือนตั้งตามปกติ, ฝาคว่ำหน้าลง (ไม่ต้องใช้ support), ชื่อวางราบ · ประกอบ: กดสวิตช์ลงรูเพลทจนคลิปล็อก
            เสียบฝาลงบนก้านกากบาท แล้ววางชื่อลงร่องบนฝา (ทากาว)
          </div>
        </div>

        <details className="field shop-settings">
          <summary>ตั้งค่าสวิตช์ (สำหรับร้าน)</summary>
          <div className="sub">
            ค่าเริ่มต้นเป็นขนาด Cherry MX โดยประมาณ วัดสวิตช์ที่ใช้จริงด้วยเวอร์เนียแล้วปรับ ค่าจะจำไว้ในเครื่องนี้ (mm)
          </div>
          <div className="settings-grid">
            {FIELDS.map((f) => (
              <label key={f.key} className="setting">
                <span>{f.label}</span>
                <input
                  type="number"
                  step={0.05}
                  value={params[f.key]}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (Number.isFinite(v) && v > 0) setParams({ ...params, [f.key]: v })
                  }}
                />
                <small>{f.hint}</small>
              </label>
            ))}
          </div>
          <button className="dl-btn" onClick={() => setParams(MX_DEFAULTS)}>
            คืนค่าเริ่มต้น
          </button>
        </details>
      </section>
    </main>
  )
}
