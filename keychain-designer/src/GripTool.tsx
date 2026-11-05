import { useEffect, useRef, useState } from 'react'
import { FONTS, type FontOption } from './fonts'
import { buildGriptok, countLetters, GRIP_DIAMETER, GRIP_LEVELS, GRIP_MAX_LETTERS, type GriptokModel } from './geometry'
import { ColorField, DownloadField, PreviewCard } from './shared'
import { FontGroup } from './TextTool'

/** Griptok top: a short name as arched dimensional letters on a Ø35 mm base with a locating rim. */
export default function GripTool({ dark }: { dark: boolean }) {
  const [text, setText] = useState('Mint')
  const [font, setFont] = useState<FontOption>(FONTS.find((f) => f.id === 'poppins')!)
  const [color, setColor] = useState('#f6c6d6')
  const [baseColor, setBaseColor] = useState('#ffffff')
  const [exploded, setExploded] = useState(false)
  const [model, setModel] = useState<GriptokModel | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const buildId = useRef(0)
  const letters = countLetters(text)

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
        const m = await buildGriptok(text, font)
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
  }, [text, font])

  const onText = (v: string) => {
    // Thai marks are free; anything past the sixth letter is cut off (also when pasting).
    let out = ''
    for (const ch of Array.from(v)) {
      if (countLetters(out + ch) > GRIP_MAX_LETTERS) break
      out += ch
    }
    setText(out)
  }

  return (
    <main className="workspace">
      <PreviewCard
        model={model}
        busy={busy}
        topColor={color}
        plateColor={baseColor}
        dark={dark}
        emptyText="พิมพ์ชื่อเพื่อดูตัวอย่าง"
        explode={{ on: exploded, onToggle: () => setExploded(!exploded) }}
      />

      <section className="panel card">
        <div className="field">
          <label htmlFor="grip-text">ชื่อบนหัวกริป</label>
          <input id="grip-text" className="text-input" value={text} placeholder="พิมพ์ชื่อ" onChange={(e) => onText(e.target.value)} />
          <div className="sub">
            {letters}/{GRIP_MAX_LETTERS} ตัวอักษร (สระ/วรรณยุกต์ไม่นับ) · ตัวอักษรโค้งแบบสายรุ้ง ขยายให้พอดีวงอัตโนมัติ
          </div>
          {error && <div className="error">{error}</div>}
        </div>

        <div className="field">
          <label>ขนาด</label>
          <div className="sub">
            {model
              ? `ฐานกลม Ø${model.diameter} mm${model.diameter > GRIP_DIAMETER ? ' (ขยายเพื่อให้ตัวอักษรไม่เล็กเกินไป)' : ''} · ตัวอักษรสูง ~${model.capHeight.toFixed(1)} mm`
              : `ฐานกลม Ø${GRIP_DIAMETER} mm`}
            {` · ความหนาตัวอักษรไล่ระดับ ${GRIP_LEVELS.join(' / ')} mm บนฐานมีขอบล็อก`}
          </div>
        </div>

        <div className="field">
          <label>ฟอนต์</label>
          <FontGroup title="ภาษาไทย" fonts={FONTS.filter((f) => f.script === 'thai')} value={font} onChange={setFont} sample="กขค Ab" />
          <FontGroup title="ภาษาอังกฤษ" fonts={FONTS.filter((f) => f.script === 'latin')} value={font} onChange={setFont} sample="Abc 123" />
          <div className="sub">ฟอนต์หนา (Poppins, Kanit, Prompt) เหมาะกับหัวกริปที่สุด</div>
        </div>

        <ColorField label="สีตัวอักษร" value={color} onChange={setColor} />
        <ColorField label="สีฐาน" value={baseColor} onChange={setBaseColor} />

        <DownloadField
          model={model}
          disabled={busy}
          name={text ? `grip-${text}` : 'grip'}
          topLabel="ตัวอักษร"
          topColor={color}
          plateColor={baseColor}
          plateLabel="ฐานกริป"
          onError={setError}
          note={`พิมพ์ฐานกริปกับตัวอักษรแยกกัน (หรือ 2 สีพร้อมกัน: ลากทั้ง 2 ไฟล์เข้า Creality Print แล้วตอบ “ใช่”) · วางตัวอักษรลงร่อง ทากาว แล้วติดด้านเรียบของฐานบนฐาน griptok Ø${GRIP_DIAMETER} mm`}
        />
      </section>
    </main>
  )
}
