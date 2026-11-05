import * as THREE from 'three'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { KeychainModel } from './geometry'

export type StlPart = 'plate' | 'text' | 'all'

/**
 * Binary STL in millimetres, Z up, plate bottom at Z = 0.
 * The plate and text files share one origin, so a slicer that loads both together
 * as one multi-part object lines them up exactly and each part can get its own filament.
 */
export function downloadStl(model: KeychainModel, part: StlPart, text: string) {
  const geo =
    part === 'plate'
      ? model.plate
      : part === 'text'
        ? model.text
        : mergeGeometries([model.plate, model.text])
  if (!geo) throw new Error('รวมชิ้นงานไม่สำเร็จ')

  const data = new STLExporter().parse(new THREE.Mesh(geo), { binary: true }) as DataView
  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'model/stl' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileStem(text)}-${{ plate: 'base', text: 'text', all: 'all' }[part]}.stl`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  if (part === 'all') geo.dispose()
}

/** ASCII only: Chrome drops a download name with Thai combining marks and falls back to "download". */
function fileStem(text: string): string {
  const clean = text.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
  return clean ? `keychain-${clean}` : 'keychain'
}
