import Preview from './Preview'
import { downloadStl, type StlPart } from './exportStl'
import type { KeychainModel, RingOptions, RingSide } from './geometry'

/** Common filament colours. */
const STANDARD = [
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

/** Soft pastel filament colours. */
const PASTEL = [
  { hex: '#f6c6d6', name: 'ชมพูพาสเทล' },
  { hex: '#f6b8a8', name: 'พีชพาสเทล' },
  { hex: '#f9d9b8', name: 'ส้มพาสเทล' },
  { hex: '#f6e7a6', name: 'เหลืองพาสเทล' },
  { hex: '#f4ecdc', name: 'ครีม' },
  { hex: '#cfe3b4', name: 'เขียวพาสเทล' },
  { hex: '#c8d3ad', name: 'เขียวเซจ' },
  { hex: '#bfe6d6', name: 'มิ้นต์' },
  { hex: '#bcdcf2', name: 'ฟ้าพาสเทล' },
  { hex: '#c4cede', name: 'เทาฟ้า' },
  { hex: '#d9c9ef', name: 'ม่วงลาเวนเดอร์' },
  { hex: '#e6d0e8', name: 'ม่วงไลแลค' },
]

const SWATCHES = [...STANDARD, ...PASTEL]
const GROUPS = [
  { title: 'สีมาตรฐาน', items: STANDARD },
  { title: 'สีพาสเทล', items: PASTEL },
]
/** Light colours only (white + pastels), e.g. for a base that should stay soft behind the letters. */
const LIGHT_GROUPS = [{ title: 'สีโทนอ่อน', items: [STANDARD[0], ...PASTEL] }]

export function PreviewCard(props: {
  model: KeychainModel | null
  busy: boolean
  topColor: string
  plateColor: string
  dark: boolean
  emptyText: string
  /** Optional "exploded view" switch: lifts the top part so the base underneath is visible. */
  explode?: { on: boolean; onToggle: () => void }
  /** Two-sided keychains: back design colour and a switch to turn the model over. */
  backColor?: string
  flip?: { on: boolean; onToggle: () => void }
  partColors?: string[]
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
      {props.explode && model && (
        <button className={`explode-btn ${props.explode.on ? 'on' : ''}`} onClick={props.explode.onToggle} aria-pressed={props.explode.on}>
          {props.explode.on ? '⬇ ประกอบชิ้นงาน' : '⬆ ดูแยกชิ้น'}
        </button>
      )}
      {props.flip && model && (
        <button className={`explode-btn ${props.flip.on ? 'on' : ''}`} onClick={props.flip.onToggle} aria-pressed={props.flip.on}>
          {props.flip.on ? '↻ ดูด้านหน้า' : '↻ ดูด้านหลัง'}
        </button>
      )}
      <Preview
        model={model}
        backColor={props.backColor}
        flip={props.flip?.on}
        partColors={props.partColors}
        textColor={props.topColor}
        plateColor={props.plateColor}
        dark={props.dark}
        lift={props.explode?.on ? Math.max(12, model ? model.height * 1.6 : 12) : 0}
      />
      <div className="hint">ลากเพื่อหมุน · เลื่อนเพื่อซูม</div>
    </section>
  )
}

export function ColorField(props: { label: string; value: string; onChange: (v: string) => void; lightOnly?: boolean }) {
  const current = props.value.toLowerCase()
  const named = SWATCHES.find((s) => s.hex === current)
  const groups = props.lightOnly ? LIGHT_GROUPS : GROUPS
  return (
    <div className="field">
      <div className="row">
        <label>{props.label}</label>
        <span className="value">{named?.name ?? props.value}</span>
      </div>
      {groups.map((g, gi) => (
        <div key={g.title} className="swatch-group">
          <div className="swatch-title">{g.title}</div>
          <div className="swatches">
            {g.items.map((s) => (
              <button
                key={s.hex}
                className={`swatch ${current === s.hex ? 'selected' : ''}`}
                style={{ background: s.hex }}
                title={s.name}
                aria-label={s.name}
                onClick={() => props.onChange(s.hex)}
              />
            ))}
            {gi === groups.length - 1 && !props.lightOnly && (
              <label className={`swatch custom ${named ? '' : 'selected'}`} title="เลือกสีเอง">
                <input type="color" value={props.value} onChange={(e) => props.onChange(e.target.value)} aria-label="เลือกสีเอง" />
                <span>+</span>
              </label>
            )}
          </div>
        </div>
      ))}
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
  /** One-colour model: offer a single combined file only. */
  single?: boolean
  plateLabel?: string
  /** How-to under the buttons; defaults to the two-colour slicer tip. */
  note?: string
}) {
  const plateLabel = props.plateLabel ?? 'ฐาน'
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
      {props.single ? (
        <div className="download-grid">
          <button className="dl-btn primary" disabled={off} onClick={() => save('all')}>
            ดาวน์โหลด STL
          </button>
        </div>
      ) : (
      <>
      <div className="download-grid">
        <button className="dl-btn" disabled={off} onClick={() => save('plate')}>
          <span className="dl-dot" style={{ background: props.plateColor }} />
          {plateLabel}
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
        {props.note ??
          `พิมพ์ 2 สี: โหลดไฟล์${plateLabel}กับ${props.topLabel} แล้วลากทั้ง 2 ไฟล์เข้า Creality Print พร้อมกัน เมื่อถามว่าจะโหลดเป็นวัตถุเดียวหลายชิ้นส่วนไหม ให้ตอบ "ใช่" แล้วเลือก filament ให้แต่ละชิ้น`}
      </div>
      </>
      )}
    </div>
  )
}

const HOLE_SIZES = [3, 5, 7]
const SIDES: { id: RingSide; label: string }[] = [
  { id: 'left', label: '⬅ ซ้าย' },
  { id: 'right', label: 'ขวา ➡' },
  { id: 'top', label: '⬆ บน' },
  { id: 'bottom', label: '⬇ ล่าง' },
]

export function RingField(props: { value: RingOptions; onChange: (v: RingOptions) => void }) {
  const { value } = props
  return (
    <div className="field">
      <div className="row">
        <label>ห่วงพวงกุญแจ</label>
        <span className="value">รู {value.holeDiameter} mm</span>
      </div>
      <div className="sub">ขนาดรู (เส้นผ่านศูนย์กลาง)</div>
      <div className="segmented" role="group" aria-label="ขนาดรู">
        {HOLE_SIZES.map((d) => (
          <button
            key={d}
            className={value.holeDiameter === d ? 'selected' : ''}
            aria-pressed={value.holeDiameter === d}
            onClick={() => props.onChange({ ...value, holeDiameter: d })}
          >
            {d} mm
          </button>
        ))}
      </div>
      <div className="sub">ตำแหน่งห่วง</div>
      <div className="segmented" role="group" aria-label="ตำแหน่งห่วง">
        {SIDES.map((s) => (
          <button
            key={s.id}
            className={value.side === s.id ? 'selected' : ''}
            aria-pressed={value.side === s.id}
            onClick={() => props.onChange({ ...value, side: s.id })}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
