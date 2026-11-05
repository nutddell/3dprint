import Preview from './Preview'
import { downloadStl, type StlPart } from './exportStl'
import type { KeychainModel } from './geometry'

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

export function PreviewCard(props: {
  model: KeychainModel | null
  busy: boolean
  topColor: string
  plateColor: string
  dark: boolean
  emptyText: string
}) {
  const { model } = props
  return (
    <section className="preview card">
      <div className="dims">
        {model
          ? `ขนาดรวม กว้าง ${model.width.toFixed(1)} × ยาว ${model.length.toFixed(1)} × สูง ${model.height.toFixed(1)} mm`
          : props.emptyText}
      </div>
      {props.busy && <div className="busy">กำลังสร้าง…</div>}
      <Preview model={model} textColor={props.topColor} plateColor={props.plateColor} dark={props.dark} />
      <div className="hint">ลากเพื่อหมุน · เลื่อนเพื่อซูม</div>
    </section>
  )
}

export function ColorField(props: { label: string; value: string; onChange: (v: string) => void }) {
  const current = props.value.toLowerCase()
  const named = SWATCHES.find((s) => s.hex === current)
  return (
    <div className="field">
      <div className="row">
        <label>{props.label}</label>
        <span className="value">{named?.name ?? props.value}</span>
      </div>
      <div className="swatches">
        {SWATCHES.map((s) => (
          <button
            key={s.hex}
            className={`swatch ${current === s.hex ? 'selected' : ''}`}
            style={{ background: s.hex }}
            title={s.name}
            aria-label={s.name}
            onClick={() => props.onChange(s.hex)}
          />
        ))}
        <label className={`swatch custom ${named ? '' : 'selected'}`} title="เลือกสีเอง">
          <input type="color" value={props.value} onChange={(e) => props.onChange(e.target.value)} aria-label="เลือกสีเอง" />
          <span>+</span>
        </label>
      </div>
    </div>
  )
}

export function DownloadField(props: {
  model: KeychainModel | null
  disabled: boolean
  name: string
  topLabel: string
  topColor: string
  plateColor: string
  onError: (msg: string) => void
}) {
  const off = !props.model || props.disabled
  const save = (part: StlPart) => {
    if (!props.model) return
    try {
      downloadStl(props.model, part, props.name)
    } catch (e) {
      props.onError(e instanceof Error ? e.message : 'สร้างไฟล์ STL ไม่สำเร็จ')
    }
  }
  return (
    <div className="field download">
      <label>ดาวน์โหลดไฟล์ STL</label>
      <div className="download-grid">
        <button className="dl-btn" disabled={off} onClick={() => save('plate')}>
          <span className="dl-dot" style={{ background: props.plateColor }} />
          ฐาน
        </button>
        <button className="dl-btn" disabled={off} onClick={() => save('text')}>
          <span className="dl-dot" style={{ background: props.topColor }} />
          {props.topLabel}
        </button>
        <button className="dl-btn primary" disabled={off} onClick={() => save('all')}>
          รวมชิ้นเดียว (สีเดียว)
        </button>
      </div>
      <div className="sub">
        พิมพ์ 2 สี: โหลดไฟล์ฐานกับ{props.topLabel} แล้วลากทั้ง 2 ไฟล์เข้า Creality Print พร้อมกัน
        เมื่อถามว่าจะโหลดเป็นวัตถุเดียวหลายชิ้นส่วนไหม ให้ตอบ "ใช่" แล้วเลือก filament ให้แต่ละชิ้น
      </div>
    </div>
  )
}
