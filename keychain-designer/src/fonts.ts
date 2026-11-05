export type FontScript = 'thai' | 'latin'

export interface FontOption {
  id: string
  name: string
  file: string
  /** 'thai' fonts carry both Thai and Latin glyphs; 'latin' fonts need a Thai fallback. */
  script: FontScript
  style: 'ทางการ' | 'ไม่เป็นทางการ'
}

// All fonts are free for commercial use (SIL OFL 1.1, Permanent Marker: Apache 2.0).
export const FONTS: FontOption[] = [
  { id: 'sarabun', name: 'Sarabun', file: 'Sarabun-Bold.ttf', script: 'thai', style: 'ทางการ' },
  { id: 'prompt', name: 'Prompt', file: 'Prompt-Bold.ttf', script: 'thai', style: 'ทางการ' },
  { id: 'kanit', name: 'Kanit', file: 'Kanit-Bold.ttf', script: 'thai', style: 'ทางการ' },
  { id: 'mali', name: 'Mali', file: 'Mali-Bold.ttf', script: 'thai', style: 'ไม่เป็นทางการ' },
  { id: 'sriracha', name: 'Sriracha', file: 'Sriracha-Regular.ttf', script: 'thai', style: 'ไม่เป็นทางการ' },
  { id: 'poppins', name: 'Poppins', file: 'Poppins-Bold.ttf', script: 'latin', style: 'ทางการ' },
  { id: 'bebas', name: 'Bebas Neue', file: 'BebasNeue-Regular.ttf', script: 'latin', style: 'ทางการ' },
  { id: 'pacifico', name: 'Pacifico', file: 'Pacifico-Regular.ttf', script: 'latin', style: 'ไม่เป็นทางการ' },
  { id: 'lobster', name: 'Lobster', file: 'Lobster-Regular.ttf', script: 'latin', style: 'ไม่เป็นทางการ' },
  { id: 'marker', name: 'Permanent Marker', file: 'PermanentMarker-Regular.ttf', script: 'latin', style: 'ไม่เป็นทางการ' },
]

/** Used for Thai characters when an English-only font is selected. */
export const THAI_FALLBACK_ID = 'kanit'

export const fontUrl = (f: FontOption) => `${import.meta.env.BASE_URL}fonts/${f.file}`

export const fontFamily = (f: FontOption) => `kd-${f.id}`

/** Register every font with CSS so the picker buttons can preview them. */
export function registerCssFonts() {
  const css = FONTS.map(
    (f) => `@font-face{font-family:'${fontFamily(f)}';src:url('${fontUrl(f)}') format('truetype');font-display:swap;}`,
  ).join('\n')
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
}
