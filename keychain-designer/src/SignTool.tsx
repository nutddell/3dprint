import { useEffect, useRef, useState } from 'react'
import { fileStem, saveStl } from './exportStl'
import { FontPicker } from './FontPicker'
import { FONTS, type FontOption } from './fonts'
import { buildSignLetters, countLetters, SIGN_BED, SIGN_PITCH, type SignModel } from './geometry'
import { ColorField, PreviewCard } from './shared'
import type * as THREE from 'three'

const MAX_LETTERS = 12

/** Copy of a letter moved so its footprint is centred on the origin (ready for its own plate). */
function centred(g: THREE.BufferGeometry) {
  const c = g.clone()
  c.computeBoundingBox()
  const b = c.boundingBox!
  c.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -b.min.z)
  return c
}

/** Sign channel letters: one hollow letter frame per piece (for LEDs), every letter fits 26 × 26 cm. */
export default function SignTool({ dark }: { dark: boolean }) {
  const [text, setText] = useState('STEAK')
  const [font, setFont] = useState<FontOption>(FONTS.find((f) => f.id === 'archivoblack')!)
  const [height, setHeight] = useState(60)
  const [wall, setWall] = useState(3)
  const [color, setColor] = useState('#ffffff')
  const [model, setModel] = useState<SignModel | null>(null)
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
        const m = await buildSignLetters(text, font, height, wall)
        if (id !== buildId.current) return
        setModel(m)
        setError(m ? '' : 'ฟอนต์นี้ไม่มีตัวอักษรที่พิมพ์ ลองเปลี่ยนฟอนต์')
      } catch (e) {
        if (id === buildId.current) setError(e instanceof Error ? e.message : 'สร้างโมเดลไม่สำเร็จ')
      } finally {
        if (id === buildId.current) setBusy(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [text, font, height, wall])

  const onText = (v: string) => {
    let out = ''
    for (const ch of Array.from(v)) {
      if (countLetters(out + ch) > MAX_LETTERS) break
      out += ch
    }
    setText(out)
  }

  const off = !model || busy
  const stem = fileStem(text ? `sign-${text}` : 'sign')

  return (
    <main className="workspace">
      <PreviewCard model={model} busy={busy} topColor={color} plateColor={color} dark={dark} emptyText="พิมพ์ข้อความเพื่อดูตัวอย่าง" />

      <section className="panel card">
        <div className="field">
          <label htmlFor="sign-text">ข้อความบนป้าย</label>
          <input id="sign-text" className="text-input" value={text} placeholder="เช่น STEAK" onChange={(e) => onText(e.target.value)} />
          <div className="sub">
            {countLetters(text)}/{MAX_LETTERS} ตัวอักษร · 1 ตัวอักษร = 1 ชิ้น · ทุกตัวขยายเต็มกรอบ {SIGN_BED / 10} × {SIGN_BED / 10} cm ด้วยสเกลเดียวกัน
            {model && ` (ตัวอักษรสูง ~${(model.capHeight / 10).toFixed(1)} cm)`}
          </div>
          {error && <div className="error">{error}</div>}
        </div>

        <div className="field">
          <label>ฟอนต์</label>
          <FontPicker value={font} onChange={setFont} />
          <div className="sub">ฟอนต์หนา (Archivo Black, Anton, Bebas Neue, Kanit, Prompt) ใส่ LED ข้างในได้ง่ายกว่า</div>
        </div>

        <div className="field">
          <div className="row">
            <label htmlFor="sign-h">ความสูงโครง (ความลึกกล่องไฟ)</label>
            <span className="value">{height / 10} cm</span>
          </div>
          <input id="sign-h" type="range" min={50} max={100} step={5} value={height} onChange={(e) => setHeight(Number(e.target.value))} />
        </div>

        <div className="field">
          <div className="row">
            <label htmlFor="sign-w">ความหนาผนัง</label>
            <span className="value">{wall} mm</span>
          </div>
          <input id="sign-w" type="range" min={2} max={6} step={0.5} value={wall} onChange={(e) => setWall(Number(e.target.value))} />
          <div className="sub">ผนังรอบตัวอักษรและรอบรูด้านใน ด้านบนและล่างเปิดโล่ง ข้างในกลวงสำหรับติด LED</div>
        </div>

        <ColorField label="สีตัวอักษร (ขาวหรือพาสเทลโทนอ่อน)" value={color} onChange={setColor} lightOnly />

        <div className="field download">
          <label>ดาวน์โหลดไฟล์ STL</label>
          <div className="download-grid">
            <button className="dl-btn primary" disabled={off} onClick={() => model && saveStl(model.plate, `${stem}-all.stl`)}>
              ทุกตัวอักษร (1 ไฟล์)
            </button>
            {model?.letters.map((l, i) => (
              <button key={i} className="dl-btn" disabled={off} onClick={() => saveStl(centred(l.geometry), `${stem}-${i + 1}.stl`)}>
                <span className="dl-dot" style={{ background: color }} />
                {i + 1}. {l.label} <small>{(l.width / 10).toFixed(1)}×{(l.length / 10).toFixed(1)} cm</small>
              </button>
            ))}
          </div>
          <div className="sub">
            ไฟล์รวม: ตัวอักษรวางห่างกันตัวละ {SIGN_PITCH / 10} cm · ใน Creality Print คลิกขวาที่โมเดล → Split → To objects แล้วกด Arrange
            โปรแกรมจะจัดให้ 1 ตัวต่อ 1 plate (ถ้าจัดเรียงข้าม plate ไม่ได้ ให้โหลดแยกทีละตัวแทน)
          </div>
        </div>
      </section>
    </main>
  )
}
