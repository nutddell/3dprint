import { useEffect, useRef, useState } from 'react'
import { FONTS, type FontOption } from './fonts'
import { saveStl, fileStem } from './exportStl'
import { buildGriptok, countLetters, GRIP_DIAMETER, GRIP_LETTER_HEIGHT, GRIP_MAX_LETTERS, GRIP_MAX_LINES, type GriptokModel } from './geometry'
import { ColorField, PreviewCard } from './shared'
import { FontPicker } from './FontPicker'

/** Griptok top: one word warped to fill the whole Ø35 mm disc as dimensional letters, on a base with a locating rim. */
export default function GripTool({ dark }: { dark: boolean }) {
  const [text, setText] = useState('รวย')
  const [font, setFont] = useState<FontOption>(FONTS.find((f) => f.id === 'mitr')!)
  // One colour per line (like a stamp with orange / blue / pink rows).
  const [colors, setColors] = useState(['#e8731a', '#bcdcf2', '#f6c6d6'])
  const setLineColor = (i: number, c: string) => setColors((cs) => cs.map((x, j) => (j === i ? c : x)))
  const [baseColor, setBaseColor] = useState('#ffffff')
  const [exploded, setExploded] = useState(false)
  const [model, setModel] = useState<GriptokModel | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const buildId = useRef(0)
  const letters = countLetters(text)
  const lineWords = text.split(/\s+/).filter(Boolean).slice(0, GRIP_MAX_LINES)
  if (lineWords.length === 0) lineWords.push('')
  const off = !model || busy
  const stem = fileStem(text ? `grip-${text}` : 'grip')

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
      const c = ch === '\n' ? ' ' : ch // Enter works like a space: next word, next line
      if (c === ' ' && (out.endsWith(' ') || out.trim().split(/\s+/).length >= GRIP_MAX_LINES)) continue
      if (countLetters(out + c) > GRIP_MAX_LETTERS) break
      out += c
    }
    setText(out)
  }

  return (
    <main className="workspace">
      <PreviewCard
        model={model}
        busy={busy}
        topColor={colors[0]}
        partColors={colors}
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
            placeholder="เช่น รวย หรือ SUM MER CUT"
            onChange={(e) => onText(e.target.value)}
          />
          <div className="sub">
            {letters}/{GRIP_MAX_LETTERS} ตัวอักษร (สระ/วรรณยุกต์ไม่นับ) · คำเดียว: ยืดเต็มวงแบบเลนส์ตาปลา ·
            เว้นวรรค = ขึ้นบรรทัดใหม่ (ไม่เกิน {GRIP_MAX_LINES} บรรทัด) แต่ละบรรทัดยืดเต็มแถบของตัวเอง
          </div>
          {error && <div className="error">{error}</div>}
        </div>

        <div className="field">
          <label>ขนาด</label>
          <div className="sub">
            {`ฐานกลม Ø${GRIP_DIAMETER} mm`}
            {` · ตัวอักษรหนา ${GRIP_LETTER_HEIGHT} mm เท่ากันทุกตัว บนฐานมีขอบล็อก`}
          </div>
        </div>

        <div className="field">
          <label>ฟอนต์</label>
          <FontPicker value={font} onChange={setFont} />
          <div className="sub">ฟอนต์อ้วนกลม (Mitr, Bagel Fat One, Titan One) เหมาะกับหัวกริปที่สุด</div>
        </div>

        {lineWords.map((w, i) => (
          <ColorField
            key={i}
            label={lineWords.length > 1 ? `สีบรรทัด ${i + 1} · ${w}` : 'สีตัวอักษร'}
            value={colors[i]}
            onChange={(c) => setLineColor(i, c)}
          />
        ))}
        <ColorField label="สีฐาน" value={baseColor} onChange={setBaseColor} />

        <div className="field download">
          <label>ดาวน์โหลดไฟล์ STL</label>
          <div className="download-grid">
            <button className="dl-btn" disabled={off} onClick={() => model && saveStl(model.plate, `${stem}-base.stl`)}>
              <span className="dl-dot" style={{ background: baseColor }} />
              ฐานกริป
            </button>
            {model?.parts && model.parts.length > 1 ? (
              model.parts.map((g, i) => (
                <button key={i} className="dl-btn" disabled={off} onClick={() => saveStl(g, `${stem}-line${i + 1}.stl`)}>
                  <span className="dl-dot" style={{ background: colors[i] }} />
                  บรรทัด {i + 1}
                </button>
              ))
            ) : (
              <button className="dl-btn" disabled={off} onClick={() => model && saveStl(model.text, `${stem}-text.stl`)}>
                <span className="dl-dot" style={{ background: colors[0] }} />
                ตัวอักษร
              </button>
            )}
            {model?.parts && model.parts.length > 1 && (
              <button className="dl-btn" disabled={off} onClick={() => model && saveStl(model.text, `${stem}-text.stl`)}>
                ตัวอักษรทุกบรรทัด
              </button>
            )}
          </div>
          <div className="sub">
            พิมพ์ฐานกริปกับตัวอักษรแยกกัน แต่ละบรรทัดพิมพ์สีของตัวเอง (หรือพิมพ์หลายสีพร้อมกัน: ลากทุกไฟล์เข้า Creality Print
            แล้วตอบ “ใช่”) · วางตัวอักษรลงร่อง ทากาว แล้วติดด้านเรียบของฐานบนฐาน griptok Ø{GRIP_DIAMETER} mm
          </div>
        </div>
      </section>
    </main>
  )
}
