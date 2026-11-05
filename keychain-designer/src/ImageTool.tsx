import { useEffect, useRef, useState } from 'react'
import { buildFromRaised, type KeychainModel } from './geometry'
import { inkField, loadImage, traceImage, type LoadedImage } from './imageTrace'
import { ColorField, DownloadField, PreviewCard } from './shared'

const WIDTH_MIN = 30
const WIDTH_MAX = 120

export default function ImageTool({ dark }: { dark: boolean }) {
  const [img, setImg] = useState<LoadedImage | null>(null)
  const [invert, setInvert] = useState(false)
  const [level, setLevel] = useState(40) // % ink needed for a pixel to count as the design
  const [width, setWidth] = useState(70)
  const [topColor, setTopColor] = useState('#2563eb')
  const [plateColor, setPlateColor] = useState('#ffffff')
  const [model, setModel] = useState<KeychainModel | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const maskRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const buildId = useRef(0)

  const open = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('กรุณาเลือกไฟล์รูป (PNG, JPG, WEBP หรือ SVG)')
      return
    }
    setError('')
    setBusy(true)
    try {
      const loaded = await loadImage(file)
      setInvert(loaded.darkBackground)
      setImg(loaded)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เปิดไฟล์รูปไม่สำเร็จ')
      setBusy(false)
    }
  }

  // Trace + build after settings settle.
  useEffect(() => {
    if (!img) return
    const id = ++buildId.current
    const t = setTimeout(() => {
      setBusy(true)
      try {
        const traced = traceImage(img, invert, level / 100, width)
        const m = traced ? buildFromRaised(traced.paths) : null
        if (id !== buildId.current) return
        setModel(m)
        setError(m ? '' : 'ไม่พบลายในรูป ลองปรับ "ระดับการแยกลาย" หรือกด "สลับลายกับพื้น"')
      } catch (e) {
        if (id === buildId.current) setError(e instanceof Error ? e.message : 'สร้างโมเดลไม่สำเร็จ')
      } finally {
        if (id === buildId.current) setBusy(false)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [img, invert, level, width])

  // 2D check of which pixels become the raised colour.
  useEffect(() => {
    const canvas = maskRef.current
    if (!canvas || !img) return
    canvas.width = img.w
    canvas.height = img.h
    const ctx = canvas.getContext('2d')!
    const field = inkField(img, invert)
    const out = ctx.createImageData(img.w, img.h)
    const top = hexRgb(topColor)
    const base = hexRgb(plateColor)
    const t = level / 100
    for (let p = 0, i = 0; p < field.length; p++, i += 4) {
      const c = field[p] >= t ? top : base
      out.data[i] = c[0]
      out.data[i + 1] = c[1]
      out.data[i + 2] = c[2]
      out.data[i + 3] = 255
    }
    ctx.putImageData(out, 0, 0)
  }, [img, invert, level, topColor, plateColor])

  return (
    <main className="workspace">
      <PreviewCard
        model={model}
        busy={busy}
        topColor={topColor}
        plateColor={plateColor}
        dark={dark}
        emptyText="เลือกรูปเพื่อดูตัวอย่าง"
      />

      <section className="panel card">
        <div className="field">
          <label>รูปภาพ</label>
          <div
            className={`dropzone ${dragging ? 'over' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              open(e.dataTransfer.files[0])
            }}
          >
            {img ? (
              <>
                <canvas ref={maskRef} className="mask" aria-label="ตัวอย่างการแยกลาย" />
                <span className="dz-name">{img.name} · คลิกเพื่อเปลี่ยนรูป</span>
              </>
            ) : (
              <>
                <span className="dz-icon">🖼️</span>
                <span>คลิกหรือลากรูปมาวางที่นี่</span>
                <span className="sub">PNG พื้นใส หรือรูปพื้นขาว ให้ผลดีที่สุด</span>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            hidden
            onChange={(e) => {
              open(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          {error && <div className="error">{error}</div>}
        </div>

        <div className="field">
          <div className="row">
            <label htmlFor="width">ความกว้างของลาย</label>
            <span className="value">{width} mm</span>
          </div>
          <input
            id="width"
            type="range"
            min={WIDTH_MIN}
            max={WIDTH_MAX}
            step={1}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
          <div className="sub">ไม่รวมขอบฐานและห่วง · เส้นที่บางกว่า ~0.8 mm อาจพิมพ์ออกมาไม่ชัด</div>
        </div>

        <div className="field">
          <div className="row">
            <label htmlFor="level">ระดับการแยกลาย</label>
            <span className="value">{level}%</span>
          </div>
          <input
            id="level"
            type="range"
            min={5}
            max={95}
            step={1}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
          />
          <div className="sub">ค่าน้อย = สีอ่อนก็นับเป็นลาย · ค่ามาก = เอาเฉพาะส่วนที่เข้ม</div>
          <label className="check">
            <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
            สลับลายกับพื้น (ใช้กับลายสีอ่อนบนพื้นเข้ม)
          </label>
        </div>

        <ColorField label="สีลาย" value={topColor} onChange={setTopColor} />
        <ColorField label="สีพื้นหลัง" value={plateColor} onChange={setPlateColor} />

        <DownloadField
          model={model}
          disabled={busy}
          name={img ? img.name.replace(/\.[^.]+$/, '') : 'image'}
          topLabel="ลาย"
          topColor={topColor}
          plateColor={plateColor}
          onError={setError}
        />
      </section>
    </main>
  )
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
