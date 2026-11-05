import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { KeychainModel } from './geometry'

interface Props {
  model: KeychainModel | null
  textColor: string
  plateColor: string
  dark: boolean
  /** mm to lift the top part off the base ("exploded" view), animated. */
  lift?: number
  /** Colour of the back face's design on two-sided keychains. */
  backColor?: string
  /** Turn the keychain over to show its back, animated. */
  flip?: boolean
}

interface Scene3D {
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  scene: THREE.Scene
  group: THREE.Group
  /** Raises two-sided models so they rest on the grid. */
  stand: THREE.Group
  /** Turns the model over about its long axis. */
  pivot: THREE.Group
  flipTarget: number
  backMat: THREE.MeshStandardMaterial
  plateMat: THREE.MeshStandardMaterial
  textMat: THREE.MeshStandardMaterial
  grid: THREE.GridHelper
  fitWidth: number
  /** Framing waits for a real size when the model arrives while its tab is hidden. */
  needsFit: boolean
  host: HTMLDivElement
  textMesh: THREE.Mesh | null
  liftTarget: number
  render: () => void
}

function frame(s: Scene3D) {
  if (s.host.clientWidth === 0 || s.host.clientHeight === 0) {
    s.needsFit = true
    return
  }
  s.needsFit = false
  const fov = THREE.MathUtils.degToRad(s.camera.fov)
  const fitH = s.fitWidth / Math.max(s.camera.aspect, 0.6)
  const dist = (fitH / 2 / Math.tan(fov / 2)) * 1.2 + 10
  const dir = new THREE.Vector3(0, 1.3, 1).normalize()
  s.camera.position.copy(dir.multiplyScalar(dist))
  s.controls.target.set(0, 0, 0)
}

export default function Preview({ model, textColor, plateColor, dark, lift = 0, backColor, flip = false }: Props) {
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

    scene.add(new THREE.HemisphereLight(0xffffff, 0x7a70a0, 1.6))
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
    const stand = new THREE.Group()
    const pivot = new THREE.Group()
    group.add(stand)
    stand.add(pivot)

    const plateMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 })
    const textMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05 })
    const backMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05 })

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.minDistance = 20
    controls.maxDistance = 800

    const render = () => renderer.render(scene, camera)
    const s: Scene3D = { renderer, camera, controls, scene, group, stand, pivot, flipTarget: 0, backMat, plateMat, textMat, grid, fitWidth: 0, needsFit: false, host, textMesh: null, liftTarget: 0, render }
    sceneRef.current = s

    const resize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (w === 0 || h === 0) return // hidden tab
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      if (s.needsFit) frame(s)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    let raf = 0
    const loop = () => {
      if (host.clientWidth > 0) {
        const m = s.textMesh
        if (m && Math.abs(m.position.z - s.liftTarget) > 0.01) m.position.z += (s.liftTarget - m.position.z) * 0.18
        const turn = s.flipTarget - s.pivot.rotation.y
        if (Math.abs(turn) > 0.001) s.pivot.rotation.y += turn * 0.15
        controls.update()
        render()
      }
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
    for (const child of [...s.pivot.children]) {
      s.pivot.remove(child)
      ;(child as THREE.Mesh).geometry.dispose()
    }
    s.textMesh = null
    if (!model) return
    s.textMesh = new THREE.Mesh(model.text, s.textMat)
    s.textMesh.position.z = s.liftTarget
    s.pivot.add(new THREE.Mesh(model.plate, s.plateMat), s.textMesh)
    if (model.back) s.pivot.add(new THREE.Mesh(model.back.plate, s.plateMat), new THREE.Mesh(model.back.text, s.backMat))
    // Two-sided models are built around z = 0 (front up, back down): stand them on the grid.
    s.stand.position.z = model.back ? model.height / 2 : 0

    const span = Math.max(model.width, model.length * 1.6)
    if (s.fitWidth === 0 || s.needsFit || span > s.fitWidth * 1.15 || span < s.fitWidth * 0.6) {
      s.fitWidth = span
      frame(s)
    }
  }, [model])

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.liftTarget = lift
  }, [lift])

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.flipTarget = flip ? Math.PI : 0
  }, [flip])

  useEffect(() => {
    sceneRef.current?.backMat.color.set(backColor ?? textColor)
  }, [backColor, textColor])

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
    s.grid = dark ? new THREE.GridHelper(400, 40, 0x4a3f7a, 0x2c2552) : new THREE.GridHelper(400, 40, 0xc9bfe8, 0xe4def5)
    s.grid.position.y = -0.05
    s.scene.add(s.grid)
  }, [dark])

  return <div ref={hostRef} className="preview-canvas" />
}
