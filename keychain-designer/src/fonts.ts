export type FontScript = 'thai' | 'latin'

export const FONT_STYLES = ['ทางการ', 'โมเดิร์น', 'อ้วนกลม', 'ดีไซน์', 'ไม่เป็นทางการ'] as const
export type FontStyle = (typeof FONT_STYLES)[number]

export interface FontOption {
  id: string
  name: string
  file: string
  /** 'thai' fonts carry both Thai and Latin glyphs; 'latin' fonts need a Thai fallback. */
  script: FontScript
  style: FontStyle
}

// All fonts are free for commercial use: SIL OFL 1.1, except Permanent Marker, Luckiest Guy and
// Chewy (Apache 2.0). Variable fonts were cut to a static Bold (700) instance so they print solid;
// Bagel Fat One is subset to Latin (the original also carries Korean and is 1.5 MB).
export const FONTS: FontOption[] = [
  { id: 'sarabun', name: 'Sarabun', file: 'Sarabun-Bold.ttf', script: 'thai', style: 'ทางการ' },
  { id: 'prompt', name: 'Prompt', file: 'Prompt-Bold.ttf', script: 'thai', style: 'ทางการ' },
  { id: 'kanit', name: 'Kanit', file: 'Kanit-Bold.ttf', script: 'thai', style: 'ทางการ' },
  { id: 'ibmplexthai', name: 'IBM Plex Sans Thai', file: 'IBMPlexSansThai-Bold.ttf', script: 'thai', style: 'ทางการ' },
  { id: 'anuphan', name: 'Anuphan', file: 'Anuphan-Bold.ttf', script: 'thai', style: 'ทางการ' },
  { id: 'krub', name: 'Krub', file: 'Krub-Bold.ttf', script: 'thai', style: 'ทางการ' },
  { id: 'taviraj', name: 'Taviraj', file: 'Taviraj-Bold.ttf', script: 'thai', style: 'ทางการ' },
  { id: 'trirong', name: 'Trirong', file: 'Trirong-Bold.ttf', script: 'thai', style: 'ทางการ' },
  { id: 'pridi', name: 'Pridi', file: 'Pridi-Bold.ttf', script: 'thai', style: 'ทางการ' },
  { id: 'baijamjuree', name: 'Bai Jamjuree', file: 'BaiJamjuree-Bold.ttf', script: 'thai', style: 'โมเดิร์น' },
  { id: 'chakrapetch', name: 'Chakra Petch', file: 'ChakraPetch-Bold.ttf', script: 'thai', style: 'โมเดิร์น' },
  { id: 'k2d', name: 'K2D', file: 'K2D-Bold.ttf', script: 'thai', style: 'โมเดิร์น' },
  { id: 'athiti', name: 'Athiti', file: 'Athiti-Bold.ttf', script: 'thai', style: 'โมเดิร์น' },
  { id: 'niramit', name: 'Niramit', file: 'Niramit-Bold.ttf', script: 'thai', style: 'โมเดิร์น' },
  { id: 'kodchasan', name: 'Kodchasan', file: 'Kodchasan-Bold.ttf', script: 'thai', style: 'โมเดิร์น' },
  { id: 'koho', name: 'KoHo', file: 'KoHo-Bold.ttf', script: 'thai', style: 'โมเดิร์น' },
  { id: 'thasadith', name: 'Thasadith', file: 'Thasadith-Bold.ttf', script: 'thai', style: 'โมเดิร์น' },
  { id: 'mitr', name: 'Mitr', file: 'Mitr-Bold.ttf', script: 'thai', style: 'อ้วนกลม' },
  { id: 'chonburi', name: 'Chonburi', file: 'Chonburi-Regular.ttf', script: 'thai', style: 'ดีไซน์' },
  { id: 'fahkwang', name: 'Fahkwang', file: 'Fahkwang-Bold.ttf', script: 'thai', style: 'ดีไซน์' },
  { id: 'charmonman', name: 'Charmonman', file: 'Charmonman-Bold.ttf', script: 'thai', style: 'ดีไซน์' },
  { id: 'srisakdi', name: 'Srisakdi', file: 'Srisakdi-Bold.ttf', script: 'thai', style: 'ดีไซน์' },
  { id: 'mali', name: 'Mali', file: 'Mali-Bold.ttf', script: 'thai', style: 'ไม่เป็นทางการ' },
  { id: 'sriracha', name: 'Sriracha', file: 'Sriracha-Regular.ttf', script: 'thai', style: 'ไม่เป็นทางการ' },
  { id: 'itim', name: 'Itim', file: 'Itim-Regular.ttf', script: 'thai', style: 'ไม่เป็นทางการ' },
  { id: 'charm', name: 'Charm', file: 'Charm-Bold.ttf', script: 'thai', style: 'ไม่เป็นทางการ' },
  { id: 'pattaya', name: 'Pattaya', file: 'Pattaya-Regular.ttf', script: 'thai', style: 'ไม่เป็นทางการ' },
  { id: 'poppins', name: 'Poppins', file: 'Poppins-Bold.ttf', script: 'latin', style: 'ทางการ' },
  { id: 'bebas', name: 'Bebas Neue', file: 'BebasNeue-Regular.ttf', script: 'latin', style: 'ทางการ' },
  { id: 'montserrat', name: 'Montserrat', file: 'Montserrat-Bold.ttf', script: 'latin', style: 'ทางการ' },
  { id: 'oswald', name: 'Oswald', file: 'Oswald-Bold.ttf', script: 'latin', style: 'ทางการ' },
  { id: 'spacegrotesk', name: 'Space Grotesk', file: 'SpaceGrotesk-Bold.ttf', script: 'latin', style: 'โมเดิร์น' },
  { id: 'syne', name: 'Syne', file: 'Syne-Bold.ttf', script: 'latin', style: 'โมเดิร์น' },
  { id: 'unbounded', name: 'Unbounded', file: 'Unbounded-Bold.ttf', script: 'latin', style: 'โมเดิร์น' },
  { id: 'rubik', name: 'Rubik', file: 'Rubik-Bold.ttf', script: 'latin', style: 'โมเดิร์น' },
  { id: 'orbitron', name: 'Orbitron', file: 'Orbitron-Bold.ttf', script: 'latin', style: 'โมเดิร์น' },
  { id: 'audiowide', name: 'Audiowide', file: 'Audiowide-Regular.ttf', script: 'latin', style: 'โมเดิร์น' },
  { id: 'russo', name: 'Russo One', file: 'RussoOne-Regular.ttf', script: 'latin', style: 'โมเดิร์น' },
  { id: 'righteous', name: 'Righteous', file: 'Righteous-Regular.ttf', script: 'latin', style: 'โมเดิร์น' },
  { id: 'quicksand', name: 'Quicksand', file: 'Quicksand-Bold.ttf', script: 'latin', style: 'โมเดิร์น' },
  { id: 'comfortaa', name: 'Comfortaa', file: 'Comfortaa-Bold.ttf', script: 'latin', style: 'โมเดิร์น' },
  { id: 'teko', name: 'Teko', file: 'Teko-Bold.ttf', script: 'latin', style: 'โมเดิร์น' },
  { id: 'anton', name: 'Anton', file: 'Anton-Regular.ttf', script: 'latin', style: 'โมเดิร์น' },
  { id: 'archivoblack', name: 'Archivo Black', file: 'ArchivoBlack-Regular.ttf', script: 'latin', style: 'โมเดิร์น' },
  { id: 'staatliches', name: 'Staatliches', file: 'Staatliches-Regular.ttf', script: 'latin', style: 'โมเดิร์น' },
  { id: 'bagel', name: 'Bagel Fat One', file: 'BagelFatOne-Regular.ttf', script: 'latin', style: 'อ้วนกลม' },
  { id: 'titan', name: 'Titan One', file: 'TitanOne-Regular.ttf', script: 'latin', style: 'อ้วนกลม' },
  { id: 'fredoka', name: 'Fredoka', file: 'Fredoka-Bold.ttf', script: 'latin', style: 'อ้วนกลม' },
  { id: 'chewy', name: 'Chewy', file: 'Chewy-Regular.ttf', script: 'latin', style: 'อ้วนกลม' },
  { id: 'lilita', name: 'Lilita One', file: 'LilitaOne-Regular.ttf', script: 'latin', style: 'อ้วนกลม' },
  { id: 'luckiest', name: 'Luckiest Guy', file: 'LuckiestGuy-Regular.ttf', script: 'latin', style: 'อ้วนกลม' },
  { id: 'sigmar', name: 'Sigmar One', file: 'SigmarOne-Regular.ttf', script: 'latin', style: 'อ้วนกลม' },
  { id: 'passion', name: 'Passion One', file: 'PassionOne-Bold.ttf', script: 'latin', style: 'อ้วนกลม' },
  { id: 'bungee', name: 'Bungee', file: 'Bungee-Regular.ttf', script: 'latin', style: 'ดีไซน์' },
  { id: 'blackops', name: 'Black Ops One', file: 'BlackOpsOne-Regular.ttf', script: 'latin', style: 'ดีไซน์' },
  { id: 'pressstart', name: 'Press Start 2P', file: 'PressStart2P-Regular.ttf', script: 'latin', style: 'ดีไซน์' },
  { id: 'rubikmono', name: 'Rubik Mono One', file: 'RubikMonoOne-Regular.ttf', script: 'latin', style: 'ดีไซน์' },
  { id: 'abril', name: 'Abril Fatface', file: 'AbrilFatface-Regular.ttf', script: 'latin', style: 'ดีไซน์' },
  { id: 'alfaslab', name: 'Alfa Slab One', file: 'AlfaSlabOne-Regular.ttf', script: 'latin', style: 'ดีไซน์' },
  { id: 'shrikhand', name: 'Shrikhand', file: 'Shrikhand-Regular.ttf', script: 'latin', style: 'ดีไซน์' },
  { id: 'bangers', name: 'Bangers', file: 'Bangers-Regular.ttf', script: 'latin', style: 'ดีไซน์' },
  { id: 'racing', name: 'Racing Sans One', file: 'RacingSansOne-Regular.ttf', script: 'latin', style: 'ดีไซน์' },
  { id: 'fugaz', name: 'Fugaz One', file: 'FugazOne-Regular.ttf', script: 'latin', style: 'ดีไซน์' },
  { id: 'pacifico', name: 'Pacifico', file: 'Pacifico-Regular.ttf', script: 'latin', style: 'ไม่เป็นทางการ' },
  { id: 'lobster', name: 'Lobster', file: 'Lobster-Regular.ttf', script: 'latin', style: 'ไม่เป็นทางการ' },
  { id: 'marker', name: 'Permanent Marker', file: 'PermanentMarker-Regular.ttf', script: 'latin', style: 'ไม่เป็นทางการ' },
  { id: 'dancing', name: 'Dancing Script', file: 'DancingScript-Bold.ttf', script: 'latin', style: 'ไม่เป็นทางการ' },
  { id: 'caveat', name: 'Caveat', file: 'Caveat-Bold.ttf', script: 'latin', style: 'ไม่เป็นทางการ' },
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
