import * as THREE from 'three'
import { gsap } from 'gsap'

/**
 * Survol d'un container : il glisse vers la caméra hors de la pile, comme un tiroir, se soulève un peu
 * (moins que la fente de 0.17 entre deux étages : il ne touche jamais celui du dessus) et s'illumine.
 */
const SLIDE = 0.9
const LIFT = 0.12
const GLOW = { color: '#2a9df4', intensity: 0.3 } as const
const IN = { duration: 0.45, ease: 'back.out(2.2)' } as const
const OUT = { duration: 0.35, ease: 'power2.inOut' } as const

/** Container éteint (`docker stop`) : peinture assombrie de ce facteur. */
const STOPPED_SHADE = 0.35
/** Petit saut (sous la fente de 0.17 entre étages) et éclair de lueur quand un container est sollicité. */
const PULSE = { height: 0.15, duration: 0.18 } as const
/** Au-delà de ce déplacement (px) entre appui et relâché, c'est un glissé de caméra, pas un clic. */
const CLICK_TOLERANCE = 5

export interface ContainerHover {
  /** À appeler une fois par image : un seul lancer de rayon, et seulement si le pointeur est sur la scène. */
  update(): void
  /** Allume ou éteint un container (assombrit sa peinture). */
  setRunning(name: string, running: boolean): void
  /** Petit saut du container, pour signaler qu'il est sollicité. */
  pulse(name: string): void
  /** Container ouvert (section affichée) : il reste sorti de la pile, sans lueur ; null pour le ranger. */
  setFocus(name: string | null): void
  dispose(): void
}

export interface ContainerHoverOptions {
  /** Clic (ou tap) sur un container (nom du nœud GLB), ou à côté (null). */
  onSelect?(name: string | null): void
}

interface Target {
  node: THREE.Object3D
  proxy: THREE.Mesh
  rest: THREE.Vector3
  paint: THREE.MeshPhysicalMaterial[]
  /** Teintes d'origine de la peinture, pour rallumer un container éteint. */
  colors: THREE.Color[]
}

/** Boîte invisible englobant le container : 12 triangles à tester au lieu de ~1 800. */
function createProxy(node: THREE.Object3D): THREE.Mesh {
  const box = new THREE.Box3()
  for (const child of node.children) {
    if (!(child instanceof THREE.Mesh)) continue
    child.geometry.computeBoundingBox()
    if (child.geometry.boundingBox) box.union(child.geometry.boundingBox)
  }
  const size = box.getSize(new THREE.Vector3())
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial())
  proxy.name = `${node.name}_hover`
  proxy.position.copy(box.getCenter(new THREE.Vector3()))
  proxy.visible = false // jamais rendue ; le raycaster la teste quand même
  node.add(proxy)
  return proxy
}

export function createContainerHover(
  camera: THREE.Camera,
  element: HTMLElement,
  containers: readonly THREE.Object3D[],
  options: ContainerHoverOptions = {},
): ContainerHover {
  const targets: Target[] = containers.map((node) => {
    const paint: THREE.MeshPhysicalMaterial[] = []
    node.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const material: THREE.Material | THREE.Material[] = object.material
      if (material instanceof THREE.MeshPhysicalMaterial && material.name === 'whale_container_paint') {
        material.emissive.set(GLOW.color)
        material.emissiveIntensity = 0
        paint.push(material)
      }
    })
    return { node, proxy: createProxy(node), rest: node.position.clone(), paint, colors: paint.map((m) => m.color.clone()) }
  })
  const proxies = targets.map((t) => t.proxy)

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const cameraLocal = new THREE.Vector3()
  let inside = false
  let dragging = false
  let hovered: Target | null = null
  let focused: Target | null = null

  const putBack = (target: Target): void => {
    gsap.to(target.node.position, { y: target.rest.y, z: target.rest.z, ...OUT, overwrite: true })
    gsap.to(target.paint, { emissiveIntensity: 0, ...OUT, overwrite: true })
  }
  /** Glisse du côté de la caméra, le long du grand axe du container, et s'illumine de `glow`. */
  const pullOut = (target: Target, glow: number): void => {
    cameraLocal.copy(camera.position)
    target.node.parent?.worldToLocal(cameraLocal)
    const toward = Math.sign(cameraLocal.z - target.rest.z) || 1
    gsap.to(target.node.position, { y: target.rest.y + LIFT, z: target.rest.z + toward * SLIDE, ...IN, overwrite: true })
    gsap.to(target.paint, { emissiveIntensity: glow, ...IN, overwrite: true })
  }

  const setHovered = (next: Target | null): void => {
    if (next === hovered) return
    // le container ouvert ne bouge pas au survol
    if (hovered && hovered !== focused) putBack(hovered)
    if (next && next !== focused) pullOut(next, GLOW.intensity)
    hovered = next
    element.style.cursor = next ? 'pointer' : ''
  }

  const setPointer = (event: PointerEvent): void => {
    const rect = element.getBoundingClientRect()
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
  }
  const pick = (): Target | null => {
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(proxies, false)[0]
    return hit ? (targets.find((t) => t.proxy === hit.object) ?? null) : null
  }

  const pressed = new THREE.Vector2()
  const onDown = (event: PointerEvent): void => {
    pressed.set(event.clientX, event.clientY)
  }
  const onUp = (event: PointerEvent): void => {
    const moved = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y)
    if (moved > CLICK_TOLERANCE) return
    // lancer de rayon au point du clic : un tap sur écran tactile n'a pas de survol avant
    setPointer(event)
    options.onSelect?.(pick()?.node.name ?? null)
  }

  const onMove = (event: PointerEvent): void => {
    dragging = event.buttons !== 0
    setPointer(event)
    inside = event.pointerType === 'mouse'
  }
  const onLeave = (): void => {
    inside = false
    setHovered(null)
  }
  element.addEventListener('pointermove', onMove)
  element.addEventListener('pointerleave', onLeave)
  element.addEventListener('pointerdown', onDown)
  element.addEventListener('pointerup', onUp)

  const byName = (name: string): Target | undefined => targets.find((t) => t.node.name === name)

  return {
    update(): void {
      if (!inside || dragging) return
      setHovered(pick())
    },
    setRunning(name: string, running: boolean): void {
      const target = byName(name)
      if (!target) return
      target.paint.forEach((material, i) => {
        const base = target.colors[i]
        if (!base) return
        const color = running ? base : base.clone().multiplyScalar(STOPPED_SHADE)
        gsap.to(material.color, { r: color.r, g: color.g, b: color.b, duration: 0.5, ease: 'power2.out', overwrite: true })
      })
    },
    pulse(name: string): void {
      const target = byName(name)
      if (!target || target === hovered || target === focused) return
      gsap.fromTo(
        target.node.position,
        { y: target.rest.y },
        { y: target.rest.y + PULSE.height, duration: PULSE.duration, ease: 'power2.out', yoyo: true, repeat: 1, overwrite: true },
      )
      gsap.fromTo(
        target.paint,
        { emissiveIntensity: GLOW.intensity * 1.6 },
        { emissiveIntensity: 0, duration: 0.8, ease: 'power2.out', overwrite: true },
      )
    },
    setFocus(name: string | null): void {
      const next = name ? (byName(name) ?? null) : null
      if (next === focused) return
      const previous = focused
      focused = next
      // l'ancien container ouvert retourne dans la pile, ou reprend son état de survol
      if (previous) {
        if (previous === hovered) pullOut(previous, GLOW.intensity)
        else putBack(previous)
      }
      if (next) pullOut(next, 0)
    },
    dispose(): void {
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerleave', onLeave)
      element.removeEventListener('pointerdown', onDown)
      element.removeEventListener('pointerup', onUp)
      setHovered(null)
    },
  }
}
