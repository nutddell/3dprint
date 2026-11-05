import { useEffect, useState } from 'react'
import DimTool from './DimTool'
import ImageTool from './ImageTool'
import TextTool from './TextTool'
import TwoSidedTool from './TwoSidedTool'

const LOGO_URL = `${import.meta.env.BASE_URL}logo.png`

type ToolId = 'text' | 'image' | 'dim' | 'two'

const TOOLS: { id: ToolId | null; label: string; icon: string }[] = [
  { id: 'text', label: 'การทำพวงกุญแจ 3D', icon: '🔑' },
  { id: 'image', label: 'ทำพวงกุญแจจากรูป (2 สี)', icon: '🖼️' },
  { id: 'dim', label: 'พวงกุญแจตัวอักษรมิติ', icon: '🔠' },
  { id: 'two', label: 'พวงกุญแจชื่อ + โลโก้ (หน้า-หลัง)', icon: '🔄' },
  ...Array.from({ length: 2 }, () => ({ id: null, label: 'เร็วๆ นี้', icon: '' })),
]

function readSaved(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

export default function App() {
  const [dark, setDark] = useState(() => readSaved('theme') === 'dark')
  const [tool, setTool] = useState<ToolId>(() => {
    const saved = readSaved('tool')
    return saved === 'image' || saved === 'dim' || saved === 'two' ? saved : 'text'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    save('theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => save('tool', tool), [tool])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src={LOGO_URL} alt="นวมินทร์ 3D Print" />
          <div className="brand-text">
            <span className="brand-name">
              นวมินทร์<span className="bn-3d">
                3<b>D</b>
              </span>{' '}
              Print
            </span>
            <span className="bn-pill">Nawamin3DPrint</span>
          </div>
        </div>
        <div className="topbar-right">
          <span className="tagline">สร้างไฟล์งาน 3D Print</span>
          <button className="theme-btn" onClick={() => setDark(!dark)}>
            {dark ? '☀️ โหมดสว่าง' : '🌙 โหมดมืด'}
          </button>
        </div>
      </header>

      <nav className="tools" aria-label="ประเภทงาน">
        {TOOLS.map((t, i) =>
          t.id ? (
            <button
              key={t.id}
              className={`tool ${tool === t.id ? 'active' : ''}`}
              aria-pressed={tool === t.id}
              onClick={() => setTool(t.id!)}
            >
              <span className="tool-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ) : (
            <button key={`soon-${i}`} className="tool soon" disabled>
              <span>{t.label}</span>
            </button>
          ),
        )}
      </nav>

      {/* Both tools stay mounted so switching tabs keeps each one's settings. */}
      <div hidden={tool !== 'text'}>
        <TextTool dark={dark} />
      </div>
      <div hidden={tool !== 'image'}>
        <ImageTool dark={dark} />
      </div>
      <div hidden={tool !== 'dim'}>
        <DimTool dark={dark} />
      </div>
      <div hidden={tool !== 'two'}>
        <TwoSidedTool dark={dark} />
      </div>
    </div>
  )
}
