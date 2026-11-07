import { useEffect, useRef, useState } from 'react'
import { FONTS, type FontOption } from './fonts'
import { BIG_CAP, BIG_THICK, buildBigLetter, countLetters, type BigLetterModel, type RingOptions } from './geometry'
import { ColorField, DownloadField, PreviewCard, RingField } from './shared'
import { FontGroup } from './TextTool'

/** Heavy, solid fonts only: the big letter should look weighty. */
const HEAVY = ['kanit', 'prompt', 'mitr', 'poppins', 'bebas', 'bagel', 'titan']
const NAME_COLORS = [
  { hex: '#ffffff', name: 'ขาว' },
  { hex: '#1f1f1f', name: 'ดำ' },
  { hex: '#c9a227', name: 'ทอง' },
]
const MAX_NAME = 12

/** One big chunky initial with the full name raised along its longest stroke. */
export default function BigLetterTool({ dark }: { dark: boolean }) {
  const [letter, setLetter] = useState('V')
  const [name, setName] = useState('NUT')
  const [font, setFont] = useState<FontOption>(FONTS.find((f) => f.id === 'poppins')!)
  const [bodyColor, setBodyColor] = useState('#d9b77a')
  const [nameColor, setNameColor] = useState('#ffffff')
  const [ring, setRing] = useState<RingOptions>({ side: 'top', holeDiameter: 5 })
  const [model, setModel] = useState<BigLetterModel | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const buildId = useRef(0)

  useEffect(() => {
    const id = ++buildId.current
    const t = setTimeout(async () => {
      if (!letter.trim()) {
        setModel(null)
        setError('')
        return
      }
      setBusy(true)
      try {
        const m = await buildBigLetter(letter.trim(), font, name, ring)
        if (id !== buildId.current) return
        setModel(m)
        setError(m ? (name.trim() && m.nameHeight === 0 ? 'ชื่อวางบนตัวอักษรนี้ไม่ได้ ลองตัวอักษรหรือฟอนต์อื่น' : '') : 'ฟอนต์นี้ไม่มีตัวอักษรนี้')
      } catch (e) {
        if (id === buildId.current) setError(e instanceof Error ? e.message : 'สร้างโมเดลไม่สำเร็จ')
      } finally {
        if (id === buildId.current) setBusy(false)
      }
    }, 150)
    return () => clearTimeout(t)
  }, [letter, font, name, ring])

  // One letter: the latest letter typed replaces the old one; Thai vowel/tone marks typed after
  // it stay with it.
  const onLetter = (v: string) => {
    let out = ''
    for (const ch of Array.from(v.replace(/\s/g, ''))) {
      if (countLetters(ch) === 1) out = ch // a new letter starts over
      else if (out) out += ch // a mark joins the current letter
    }
    setLetter(out)
  }

  return (
    <main className="workspace">
      <PreviewCard model={model} busy={busy} topColor={nameColor} plateColor={bodyColor} dark={dark} emptyText="ใส่ตัวอักษรเพื่อดูตัวอย่าง" />

      <section className="panel card">
        <div className="field">
          <label htmlFor="big-letter">ตัวอักษรใหญ่ (1 ตัว)</label>
          <input
            id="big-letter"
            className="text-input big-letter-input"
            value={letter}
            placeholder="A"
            autoComplete="off"
            onFocus={(e) => e.target.select()}
            onChange={(e) => onLetter(e.target.value)}
          />
          <div className="sub">
            ไทยหรืออังกฤษ 1 ตัว (พิมพ์ตัวใหม่ทับได้เลย) · ขนาดเดียว: สูง {BIG_CAP} mm หนา {BIG_THICK} mm
          </div>
        </div>

        <div className="field">
          <label htmlFor="big-name">ชื่อ (วางตามแนวแท่งที่ยาวที่สุดของตัวอักษร)</label>
          <input id="big-name" className="text-input" value={name} maxLength={MAX_NAME} placeholder="พิมพ์ชื่อ" onChange={(e) => setName(e.target.value)} />
          <div className="sub">
            {Array.from(name).length}/{MAX_NAME} ตัวอักษร · ขนาดชื่อย่อขยายให้พอดีเอง
            {model && model.nameHeight > 0 && ` (สูง ~${model.nameHeight.toFixed(1)} mm)`}
          </div>
          {error && <div className="error">{error}</div>}
        </div>

        <div className="field">
          <label>ฟอนต์ตัวอักษรใหญ่ (หนา หนักแน่น)</label>
          <FontGroup title="ภาษาไทย" fonts={FONTS.filter((f) => f.script === 'thai' && HEAVY.includes(f.id))} value={font} onChange={setFont} sample="กขค Ab" />
          <FontGroup title="ภาษาอังกฤษ" fonts={FONTS.filter((f) => f.script === 'latin' && HEAVY.includes(f.id))} value={font} onChange={setFont} sample="ABC 123" />
        </div>

        <RingField value={ring} onChange={setRing} />

        <ColorField label="สีตัวอักษรใหญ่" value={bodyColor} onChange={setBodyColor} />

        <div className="field">
          <div className="row">
            <label>สีชื่อ</label>
            <span className="value">{NAME_COLORS.find((c) => c.hex === nameColor)?.name}</span>
          </div>
          <div className="swatches">
            {NAME_COLORS.map((c) => (
              <button
                key={c.hex}
                className={`swatch ${nameColor === c.hex ? 'selected' : ''} ${c.name === 'ทอง' ? 'gold' : ''}`}
                style={{ background: c.hex }}
                title={c.name}
                aria-label={c.name}
                onClick={() => setNameColor(c.hex)}
              />
            ))}
          </div>
        </div>

        <DownloadField
          model={model}
          disabled={busy || !model?.nameHeight}
          name={`big-${letter}-${name}`}
          topLabel="ชื่อ"
          plateLabel="ตัวอักษรใหญ่ + ห่วง"
          topColor={nameColor}
          plateColor={bodyColor}
          onError={setError}
        />
      </section>
    </main>
  )
}
