import { useEffect, useRef, useState } from 'react'
import { fileStem, saveStl } from './exportStl'
import { FontPicker } from './FontPicker'
import { FONTS, type FontOption } from './fonts'
import { buildSignLetters, countLetters, SIGN_BED, SIGN_FACE, SIGN_LIP, SIGN_PITCH, type SignModel, type SignMount } from './geometry'
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

/** All faces moved down to the bed (they sit at the top of the frames when assembled). */
function centredAll(g: THREE.BufferGeometry) {
  const c = g.clone()
  c.computeBoundingBox()
  c.translate(0, 0, -c.boundingBox!.min.z)
  return c
}

/** Sign channel letters: one hollow letter frame per piece (for LEDs), every letter fits 26 × 26 cm. */
export default function SignTool({ dark }: { dark: boolean }) {
  const [text, setText] = useState('STEAK')
  const [font, setFont] = useState<FontOption>(FONTS.find((f) => f.id === 'archivoblack')!)
  const [height, setHeight] = useState(60)
  const [wall, setWall] = useState(3)
  const [color, setColor] = useState('#ffffff')
  const [faceColor, setFaceColor] = useState('#ffffff')
  const [mount, setMount] = useState<SignMount>('screw')
  const [exploded, setExploded] = useState(false)
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
        const m = await buildSignLetters(text, font, height, wall, mount)
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
  }, [text, font, height, wall, mount])

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
      <PreviewCard
        model={model}
        busy={busy}
        topColor={faceColor}
        plateColor={color}
        dark={dark}
        emptyText="พิมพ์ข้อความเพื่อดูตัวอย่าง"
        explode={{ on: exploded, onToggle: () => setExploded(!exploded) }}
      />

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
          <div className="sub">ผนังรอบตัวอักษรและรอบรูด้านใน ข้างในกลวงสำหรับติด LED</div>
        </div>

        <div className="field">
          <label>การยึดกับโครงป้าย</label>
          <div className="segmented" role="group" aria-label="การยึด">
            <button className={mount === 'screw' ? 'selected' : ''} aria-pressed={mount === 'screw'} onClick={() => setMount('screw')}>
              ยิงน็อต
            </button>
            <button className={mount === 'glue' ? 'selected' : ''} aria-pressed={mount === 'glue'} onClick={() => setMount('glue')}>
              ใช้กาว
            </button>
          </div>
          <div className="sub">
            ขอบยึดอยู่ด้านในโครง (มองไม่เห็น) กว้าง {SIGN_LIP} mm ที่ฐาน
            {mount === 'screw' ? ` มีรูน็อต Ø4 mm ทุก ~8 cm${model ? ` (รวม ${model.holes} รู)` : ''}` : ' ไม่มีรู สำหรับทากาว'} · ด้านบนมีบ่ารับชิ้นหน้า
            (ชิ้นหน้าหนา {SIGN_FACE} mm วางแล้วเสมอปากโครง) กด "ดูแยกชิ้น" เพื่อดูด้านใน
          </div>
        </div>

        <ColorField label="สีโครง (ขาวหรือพาสเทลโทนอ่อน)" value={color} onChange={setColor} lightOnly />
        <ColorField label="สีชิ้นหน้า (ขาวหรือพาสเทลโทนอ่อน ให้แสง LED ผ่าน)" value={faceColor} onChange={setFaceColor} lightOnly />

        <div className="field download">
          <label>ดาวน์โหลดไฟล์ STL</label>
          <div className="download-grid">
            <button className="dl-btn primary" disabled={off} onClick={() => model && saveStl(model.plate, `${stem}-frames.stl`)}>
              โครงทุกตัว (1 ไฟล์)
            </button>
            <button className="dl-btn primary" disabled={off} onClick={() => model && saveStl(centredAll(model.text), `${stem}-faces.stl`)}>
              ชิ้นหน้าทุกตัว (1 ไฟล์)
            </button>
          </div>
          {model?.letters.map((l, i) => (
            <div key={i} className="download-grid sign-row">
              <button className="dl-btn" disabled={off} onClick={() => saveStl(centred(l.frame), `${stem}-${i + 1}-frame.stl`)}>
                <span className="dl-dot" style={{ background: color }} />
                {i + 1}. {l.label} โครง <small>{(l.width / 10).toFixed(1)}×{(l.length / 10).toFixed(1)} cm</small>
              </button>
              <button className="dl-btn" disabled={off} onClick={() => saveStl(centred(l.face), `${stem}-${i + 1}-face.stl`)}>
                <span className="dl-dot" style={{ background: faceColor }} />
                {i + 1}. {l.label} ชิ้นหน้า
              </button>
            </div>
          ))}
          <div className="sub">
            ไฟล์รวม: ตัวอักษรวางห่างกันตัวละ {SIGN_PITCH / 10} cm · ใน Creality Print คลิกขวาที่โมเดล → Split → To objects แล้วกด Arrange
            โปรแกรมจะจัดให้ 1 ตัวต่อ 1 plate (ถ้าจัดเรียงข้าม plate ไม่ได้ ให้โหลดแยกทีละตัวแทน) · พิมพ์โครงตั้งขึ้น (ขอบยึดอยู่ล่าง)
            ไม่ต้องใช้ support · ชิ้นหน้าพิมพ์ราบ วางลงบ่าด้านบนของโครง
          </div>
        </div>
      </section>
    </main>
  )
}
