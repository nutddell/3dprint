import { useEffect, useRef, useState } from 'react'
import { FONT_STYLES, FONTS, fontFamily, type FontOption, type FontStyle } from './fonts'

const TAG: Record<FontStyle, string> = {
  ทางการ: 'formal',
  โมเดิร์น: 'modern',
  อ้วนกลม: 'chunky',
  ดีไซน์: 'design',
  ไม่เป็นทางการ: 'casual',
}

const sample = (f: FontOption) => (f.script === 'thai' ? 'กขค Ab' : 'Abc 123')

/**
 * Font chooser: shows the current font; opens a list that can be narrowed by language and style.
 * Each font only downloads when its sample is on screen.
 */
export function FontPicker(props: { value: FontOption; onChange: (f: FontOption) => void; fonts?: FontOption[]; label?: string }) {
  const fonts = props.fonts ?? FONTS
  const [open, setOpen] = useState(false)
  const [script, setScript] = useState<'all' | 'thai' | 'latin'>('all')
  const [style, setStyle] = useState<FontStyle | 'all'>('all')
  const ref = useRef<HTMLDivElement>(null)

  // Close when tapping outside.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const styles = FONT_STYLES.filter((st) => fonts.some((f) => f.style === st))
  const shown = fonts.filter((f) => (script === 'all' || f.script === script) && (style === 'all' || f.style === style))
  const count = (sc: 'all' | 'thai' | 'latin') => fonts.filter((f) => sc === 'all' || f.script === sc).length

  return (
    <div className="font-picker" ref={ref}>
      <button className={`fp-current ${open ? 'open' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="fp-sample" style={{ fontFamily: `'${fontFamily(props.value)}', sans-serif` }}>
          {sample(props.value)}
        </span>
        <span className="fp-meta">
          <span className="fp-name">{props.value.name}</span>
          <span className={`font-tag ${TAG[props.value.style]}`}>{props.value.style}</span>
        </span>
        <span className="fp-chev" aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="fp-panel">
          <div className="fp-filters" role="group" aria-label="ภาษา">
            {(
              [
                ['all', 'ทั้งหมด'],
                ['thai', 'ไทย'],
                ['latin', 'อังกฤษ'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} className={`chip ${script === id ? 'on' : ''}`} onClick={() => setScript(id)}>
                {label} <small>{count(id)}</small>
              </button>
            ))}
          </div>
          <div className="fp-filters" role="group" aria-label="สไตล์">
            <button className={`chip ${style === 'all' ? 'on' : ''}`} onClick={() => setStyle('all')}>
              ทุกสไตล์
            </button>
            {styles.map((st) => (
              <button key={st} className={`chip ${style === st ? 'on' : ''}`} onClick={() => setStyle(st)}>
                {st}
              </button>
            ))}
          </div>
          <div className="fp-list">
            {shown.map((f) => (
              <button
                key={f.id}
                className={`font-btn ${props.value.id === f.id ? 'selected' : ''}`}
                aria-pressed={props.value.id === f.id}
                onClick={() => {
                  props.onChange(f)
                  setOpen(false)
                }}
              >
                <span className="font-sample" style={{ fontFamily: `'${fontFamily(f)}', sans-serif` }}>
                  {sample(f)}
                </span>
                <span className="font-name">{f.name}</span>
                <span className={`font-tag ${TAG[f.style]}`}>{f.style}</span>
              </button>
            ))}
            {shown.length === 0 && <div className="sub">ไม่มีฟอนต์ในกลุ่มนี้</div>}
          </div>
          <div className="sub">ฟรี ใช้เชิงพาณิชย์ได้ทุกฟอนต์ · ฟอนต์อังกฤษจะใช้ Kanit (หรือ Mitr สำหรับฟอนต์อ้วนกลม) กับตัวอักษรไทย</div>
        </div>
      )}
    </div>
  )
}
