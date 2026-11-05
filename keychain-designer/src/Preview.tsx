import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { KeychainModel } from './geometry'

interface Props {
  model: KeychainModel | null
  textColor: string
  plateColor: string
  dark: boolean
}

interface Scene3D {
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  scene: THREE.Scene
  group: THREE.Group
  plateMat: THREE.MeshStandardMaterial
  textMat: THREE.MeshStandardMaterial
  grid: THREE.GridHelper
  fitWidth: number
  render: () => void
}

export default function Preview({ model, textColor, plateColor, dark }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene3D | null>(null)

  // Build the scene once.
  useEffect(() => {
    const host = hostRef.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000)
    camera.position.set(0, 90, 110)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a70, 1.6))
    const sun = new THREE.DirectionalLight(0xffffff, 2.2)
    sun.position.set(-60, 120, 80)
    scene.add(sun)
    const rim = new THREE.DirectionalLight(0xffffff, 0.6)
    rim.position.set(80, 40, -60)
    scene.add(rim)

    const grid = new THREE.GridHelper(400, 40)
    scene.add(grid)

    // Keychain is modelled in XY (mm) with thickness along Z; lay it flat on the grid.
    const group = new THREE.Group()
    group.rotation.x = -Math.PI / 2
    scene.add(group)

    const plateMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 })
    const textMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05 })

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.minDistance = 20
    controls.maxDistance = 800

    const render = () => renderer.render(scene, camera)
    const s: Scene3D = { renderer, camera, controls, scene, group, plateMat, textMat, grid, fitWidth: 0, render }
    sceneRef.current = s

    const resize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    let raf = 0
    const loop = () => {
      controls.update()
      render()
      raf = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      host.removeChild(renderer.domElement)
      sceneRef.current = null
    }
  }, [])

  // Swap geometry when the model changes; reframe only when the size changes a lot.
  useEffect(() => {
    const s = sceneRef.current
    if (!s) return
    for (const child of [...s.group.children]) {
      s.group.remove(child)
      ;(child as THREE.Mesh).geometry.dispose()
    }
    if (!model) return
    s.group.add(new THREE.Mesh(model.plate, s.plateMat), new THREE.Mesh(model.text, s.textMat))

    const span = Math.max(model.width, model.length * 1.6)
    if (s.fitWidth === 0 || span > s.fitWidth * 1.15 || span < s.fitWidth * 0.6) {
      s.fitWidth = span
      const fov = THREE.MathUtils.degToRad(s.camera.fov)
      const fitH = span / Math.max(s.camera.aspect, 0.6)
      const dist = (fitH / 2 / Math.tan(fov / 2)) * 1.2 + 10
      const dir = new THREE.Vector3(0, 1.3, 1).normalize()
      s.camera.position.copy(dir.multiplyScalar(dist))
      s.controls.target.set(0, 0, 0)
    }
  }, [model])

  useEffect(() => {
    const s = sceneRef.current
    if (!s) return
    s.textMat.color.set(textColor)
    s.plateMat.color.set(plateColor)
  }, [textColor, plateColor])

  useEffect(() => {
    const s = sceneRef.current
    if (!s) return
    // GridHelper bakes its colours into vertex colours, so rebuild it for the theme.
    s.scene.remove(s.grid)
    s.grid.dispose()
    s.grid = dark ? new THREE.GridHelper(400, 40, 0x5a4a3e, 0x3a302a) : new THREE.GridHelper(400, 40, 0xcdb9a8, 0xe6d9cd)
    s.grid.position.y = -0.05
    s.scene.add(s.grid)
  }, [dark])

  return <div ref={hostRef} className="preview-canvas" />
}
