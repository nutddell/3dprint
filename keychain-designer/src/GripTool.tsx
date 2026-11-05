import { useEffect, useRef, useState } from 'react'
import { FONTS, type FontOption } from './fonts'
import { buildGriptok, countLetters, GRIP_DIAMETER, GRIP_LEVELS, GRIP_MAX_LETTERS, type GriptokModel } from './geometry'
import { ColorField, DownloadField, PreviewCard } from './shared'
import { FontGroup } from './TextTool'

/** Griptok top: one word warped to fill the whole Ø35 mm disc as dimensional letters, on a base with a locating rim. */
export default function GripTool({ dark }: { dark: boolean }) {
  const [text, setText] = useState('รวย')
  const [font, setFont] = useState<FontOption>(FONTS.find((f) => f.id === 'kanit')!)
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
    // Thai marks are free; anything past the letter or line limit is cut off (also when pasting).
    let out = ''
    for (const ch of Array.from(v)) {
      if (ch === '\n') continue // one line only
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
          <label htmlFor="grip-text">ข้อความบนหัวกริป</label>
          <input
            id="grip-text"
            className="text-input"
            value={text}
            placeholder="เช่น รวย, ปัง, Lucky"
            onChange={(e) => onText(e.target.value)}
          />
          <div className="sub">
            {letters}/{GRIP_MAX_LETTERS} ตัวอักษร (สระ/วรรณยุกต์ไม่นับ) · คำเดียวบรรทัดเดียว ยืดเต็มวง: ตัวกลางสูงเต็มวง
            ตัวริมซ้ายขวาโค้งตามขอบ
          </div>
          {error && <div className="error">{error}</div>}
        </div>

        <div className="field">
          <label>ขนาด</label>
          <div className="sub">
            {`ฐานกลม Ø${GRIP_DIAMETER} mm`}
            {` · ความหนาตัวอักษรไล่ระดับ ${GRIP_LEVELS.join(' / ')} mm บนฐานมีขอบล็อก`}
          </div>
        </div>

        <div className="field">
          <label>ฟอนต์</label>
          <FontGroup title="ภาษาไทย" fonts={FONTS.filter((f) => f.script === 'thai')} value={font} onChange={setFont} sample="กขค Ab" />
          <FontGroup title="ภาษาอังกฤษ" fonts={FONTS.filter((f) => f.script === 'latin')} value={font} onChange={setFont} sample="Abc 123" />
          <div className="sub">ฟอนต์หนา (Kanit, Prompt, Poppins) เหมาะกับหัวกริปที่สุด</div>
        </div>

        <ColorField label="สีตัวอักษร" value={color} onChange={setColor} />
        <ColorField label="สีฐาน" value={baseColor} onChange={setBaseColor} />

        <DownloadField
          model={model}
          disabled={busy}
          name={text ? `grip-${text.replace(/\s+/g, '-')}` : 'grip'}
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
