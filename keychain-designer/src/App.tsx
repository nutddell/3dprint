import { useEffect, useState } from 'react'
import BigLetterTool from './BigLetterTool'
import ClickerTool from './ClickerTool'
import SignTool from './SignTool'
import DimTool from './DimTool'
import GripTool from './GripTool'
import ImageTool from './ImageTool'
import TextTool from './TextTool'
import TwoSidedTool from './TwoSidedTool'

const LOGO_URL = `${import.meta.env.BASE_URL}logo.png`

type ToolId = 'text' | 'image' | 'dim' | 'two' | 'grip' | 'clicker' | 'big' | 'sign'

const TOOLS: { id: ToolId | null; label: string; icon: string }[] = [
  { id: 'text', label: 'การทำพวงกุญแจ 3D', icon: '🔑' },
  { id: 'image', label: 'ทำพวงกุญแจจากรูป (2 สี)', icon: '🖼️' },
  { id: 'dim', label: 'พวงกุญแจตัวอักษรมิติ', icon: '🔠' },
  { id: 'two', label: 'พวงกุญแจชื่อ + โลโก้ (หน้า-หลัง)', icon: '🔄' },
  { id: 'grip', label: 'หัว Griptok ชื่อตัวอักษรมิติ', icon: '📱' },
  { id: 'clicker', label: 'Clicker-Namechain', icon: '⌨️' },
  { id: 'big', label: 'พวงกุญแจ-อักษรบิ๊กเบิ้ม', icon: '🅰️' },
  { id: 'sign', label: 'ตัวอักษรเบิ้มๆ (ป้าย)', icon: '🪧' },
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
    return saved === 'image' || saved === 'dim' || saved === 'two' || saved === 'grip' || saved === 'clicker' || saved === 'big' || saved === 'sign' ? saved : 'text'
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
      <div hidden={tool !== 'grip'}>
        <GripTool dark={dark} />
      </div>
      <div hidden={tool !== 'clicker'}>
        <ClickerTool dark={dark} />
      </div>
      <div hidden={tool !== 'big'}>
        <BigLetterTool dark={dark} />
      </div>
      <div hidden={tool !== 'sign'}>
        <SignTool dark={dark} />
      </div>
    </div>
  )
}
