import { createEffect, onCleanup, onMount } from 'solid-js'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createCopperHandle, collectSeamPoints } from '~/three/handle'
import { useEvaluation } from '~/core/evaluation'
import { currentRecipe } from '~/core/store'
import { tileToCanvas } from '~/core/image'
import type { MaterialTiles, Tile } from '~/core/types'

export type ViewChannel = 'lit' | 'baseColor' | 'normal' | 'roughness' | 'metallic' | 'height'

interface SceneOptions {
  channel: () => ViewChannel
  lightRotation: () => number
  autoRotate: () => boolean
  showSeams: () => boolean
}

interface SceneHandle {
  updateMaterial: (material: MaterialTiles) => void
  dispose: () => void
}

function tileTexture(tile: Tile, channel?: number): THREE.CanvasTexture {
  const canvas = tileToCanvas(tile, channel)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createScene(container: HTMLElement, options: SceneOptions): SceneHandle {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf1f5f9)

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  camera.position.set(2.6, 1.2, 4.2)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.appendChild(renderer.domElement)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.4)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.set(1024, 1024)
  scene.add(keyLight)
  const fillLight = new THREE.DirectionalLight(0xbfd4ff, 0.7)
  fillLight.position.set(-2, 1, 2)
  scene.add(fillLight)
  scene.add(new THREE.AmbientLight(0xffffff, 0.35))

  const handle = createCopperHandle(currentRecipe().seed)
  scene.add(handle)

  const pbrMeshes: THREE.MeshStandardMaterial[] = []
  handle.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.name !== 'backplate') {
      pbrMeshes.push(obj.material as THREE.MeshStandardMaterial)
    }
  })

  // 接缝定位点：TubeGeometry UV 的 u=0/1 环
  const seamGroup = new THREE.Group()
  scene.add(seamGroup)
  const tube = handle.getObjectByName('handle-tube') as THREE.Mesh
  const seamGeo = new THREE.BufferGeometry().setFromPoints(collectSeamPoints(tube))
  seamGroup.add(new THREE.Points(seamGeo, new THREE.PointsMaterial({ color: 0xdc2626, size: 0.045 })))

  let currentMaterial: MaterialTiles | null = null
  let textures: THREE.CanvasTexture[] = []

  const applyChannelView = (): void => {
    if (!currentMaterial) return
    textures.forEach((t) => t.dispose())
    textures = []
    const mode = options.channel()
    const singleTiles: Record<Exclude<ViewChannel, 'lit'>, Tile> = {
      baseColor: currentMaterial.baseColor,
      normal: currentMaterial.normal,
      roughness: currentMaterial.roughness,
      metallic: currentMaterial.metallic,
      height: currentMaterial.height,
    }
    for (const mat of pbrMeshes) {
      if (mode === 'lit') {
        const base = tileTexture(currentMaterial.baseColor)
        const normal = tileTexture(currentMaterial.normal)
        normal.colorSpace = THREE.NoColorSpace
        const rough = tileTexture(currentMaterial.roughness)
        rough.colorSpace = THREE.NoColorSpace
        const metal = tileTexture(currentMaterial.metallic)
        metal.colorSpace = THREE.NoColorSpace
        mat.map = base
        mat.normalMap = normal
        mat.normalScale = new THREE.Vector2(1, 1)
        mat.roughnessMap = rough
        mat.metalnessMap = metal
        mat.roughness = 1
        mat.metalness = 1
        textures.push(base, normal, rough, metal)
      } else {
        const channel = mode === 'roughness' || mode === 'metallic' || mode === 'height' ? 0 : undefined
        const tex = tileTexture(singleTiles[mode], channel)
        mat.map = tex
        mat.normalMap = null
        mat.roughnessMap = null
        mat.metalnessMap = null
        mat.roughness = 0.6
        mat.metalness = mode === 'baseColor' ? 0.9 : 0.2
        textures.push(tex)
      }
      mat.needsUpdate = true
    }
  }

  const resize = (): void => {
    const { clientWidth, clientHeight } = container
    if (clientWidth === 0) return
    renderer.setSize(clientWidth, clientHeight, false)
    camera.aspect = clientWidth / clientHeight
    camera.updateProjectionMatrix()
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  resize()

  let raf = 0
  const animate = (): void => {
    raf = requestAnimationFrame(animate)
    const angle = (options.lightRotation() * Math.PI) / 180
    keyLight.position.set(Math.cos(angle) * 3.4, 2.2, Math.sin(angle) * 3.4)
    if (options.autoRotate()) handle.rotation.y += 0.004
    seamGroup.visible = options.showSeams()
    controls.update()
    renderer.render(scene, camera)
  }
  animate()

  return {
    updateMaterial(material: MaterialTiles) {
      currentMaterial = material
      applyChannelView()
    },
    dispose() {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      textures.forEach((t) => t.dispose())
      seamGeo.dispose()
      renderer.dispose()
      controls.dispose()
      renderer.domElement.remove()
    },
  }
}

// 桥接 Solid 响应式与命令式 three 场景
export function SceneBridge(props: {
  channel: () => ViewChannel
  lightRotation: () => number
  autoRotate: () => boolean
  showSeams: () => boolean
}) {
  const { material, evalVersion } = useEvaluation()
  let container: HTMLDivElement | undefined
  let scene: SceneHandle | undefined

  onMount(() => {
    scene = createScene(container!, {
      channel: props.channel,
      lightRotation: props.lightRotation,
      autoRotate: props.autoRotate,
      showSeams: props.showSeams,
    })
    if (material()) scene.updateMaterial(material()!)
  })

  createEffect(() => {
    void evalVersion()
    if (material() && scene) scene.updateMaterial(material()!)
  })

  createEffect(() => {
    void props.channel()
    if (scene && material()) scene.updateMaterial(material()!)
  })

  onCleanup(() => scene?.dispose())

  return <div ref={container} class="scene-container" />
}
