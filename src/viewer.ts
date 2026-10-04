import * as THREE from 'three'
import gsap from 'gsap'
import GUI from 'lil-gui'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createLights } from '@/scene/Lights'
import { CONTAINER_MARKINGS } from '@/data/containers'
import { PROFILE } from '@/data/profile'
import { SECTIONS } from '@/data/sections'
import { createContainerHover, type ContainerHover } from '@/scene/ContainerHover'
import { createEnvironment } from '@/scene/Environment'
import { createBootScreen } from '@/ui/BootScreen'
import { createSectionPanel } from '@/ui/SectionPanel'
import { createTerminal } from '@/ui/terminal/Terminal'
import { OCEAN_COLOR, createOcean } from '@/scene/Ocean'
import { SUN_DIRECTION, createSky } from '@/scene/Sky'
import { createWhale } from '@/scene/Whale'

type CameraView = 'plongee' | 'profil'

const CAMERA_VIEWS: Record<CameraView, { position: THREE.Vector3Tuple; target: THREE.Vector3Tuple }> = {
  plongee: { position: [38, 24, 38], target: [0, 3, 0] },
  profil: { position: [8, 9, 58], target: [3, 5.5, 0] },
}

function setWireframe(root: THREE.Object3D, enabled: boolean): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const materials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if (
        material instanceof THREE.MeshToonMaterial ||
        material instanceof THREE.MeshBasicMaterial ||
        material instanceof THREE.ShaderMaterial
      ) {
        material.wireframe = enabled
      }
    }
  })
}

function countTriangles(root: THREE.Object3D): number {
  let triangles = 0
  root.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const geometry: THREE.BufferGeometry = object.geometry
    const count = geometry.index ? geometry.index.count : geometry.getAttribute('position').count
    triangles += count / 3
  })
  return Math.round(triangles)
}

/**
 * Garde-fous de la caméra : jamais sous l'eau (angle polaire max, la cible est au-dessus de y = 0),
 * baleine toujours dans le cadre (distances min / max), pas de déplacement latéral de la cible.
 */
const CAMERA_LIMITS = { maxPolarAngle: Math.PI / 2 - 0.03, minDistance: 15, maxDistance: 150 } as const

/** Départ de l'arrivée caméra après l'écran de démarrage : au ras de l'eau, loin devant la baleine. */
const INTRO_FROM: THREE.Vector3Tuple = [14, 9, 112]
const INTRO_SECONDS = 2.6

/**
 * Section ouverte : la caméra se place face aux portes du container, un peu au-dessus et sur le côté,
 * de façon à cadrer `frame` (container et portes ouvertes, en unités de la scène) dans la zone que le
 * panneau laisse libre : à sa droite sur grand écran, au-dessus sur mobile.
 */
const FOCUS = {
  /** Centre des portes du bout +z, repère du container. */
  doors: new THREE.Vector3(0, 1.3, 4.55),
  frame: { width: 5.4, height: 5.2 },
  rise: 0.9,
  side: 1.4,
  /** Largeur du panneau (px) sur grand écran, part de la hauteur occupée par le panneau sur mobile. */
  panel: { width: 436, sheet: 0.6 },
  seconds: 1.4,
  /** Les portes s'ouvrent quand la caméra est presque arrivée. */
  doorsDelay: 0.7,
} as const

interface Pose {
  position: THREE.Vector3
  target: THREE.Vector3
}

/** Section demandée par l'adresse (`#cv`, `#/projets`), si elle existe. */
function sectionFromHash(): string | null {
  const slug = decodeURIComponent(window.location.hash.replace(/^#\/?/, ''))
  return SECTIONS.some((section) => section.slug === slug) ? slug : null
}

/** Nom lisible de la carte graphique : « ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x…) Direct3D11…) » → « NVIDIA GeForce RTX 3060 ». */
function gpuName(renderer: THREE.WebGLRenderer): string {
  const gl = renderer.getContext()
  let raw = String(gl.getParameter(gl.RENDERER))
  // Chrome masque RENDERER (« WebKit WebGL ») : l'extension donne le vrai nom
  if (/webkit|mozilla/i.test(raw)) {
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    if (info) raw = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
  }
  const angle = /^ANGLE \([^,]*, (.+?)(?: \(0x[0-9a-f]+\))?(?: Direct3D[^,]*)?(?:,[^,]*)?\)$/i.exec(raw)
  return angle?.[1] ?? raw
}

/**
 * Baleine Docker sur la mer, sous un ciel de plein jour. Le panneau de réglages (caméra, wireframe,
 * triangles, FPS) n'apparaît qu'avec `?debug` dans l'adresse.
 */
export function startViewer(root: HTMLElement): void {
  const debug = new URLSearchParams(window.location.search).has('debug')

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  // PCFSoftShadowMap est retiré depuis r180 : PCFShadowMap + shadow.radius donne des ombres douces
  renderer.shadowMap.type = THREE.PCFShadowMap
  root.appendChild(renderer.domElement)
  const loading = createBootScreen({ gpu: gpuName(renderer) })

  const scene = new THREE.Scene()
  const sky = createSky()
  scene.fog = sky.fog
  scene.add(sky.group)

  const lights = createLights()
  scene.add(lights.group)

  const ocean = createOcean(SUN_DIRECTION)
  scene.add(ocean.mesh)
  scene.environment = createEnvironment(renderer, sky.group, OCEAN_COLOR)

  const whale = createWhale((ratio) => loading.setProgress(ratio))
  scene.add(whale.group)

  const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 1000)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false
  controls.maxPolarAngle = CAMERA_LIMITS.maxPolarAngle
  controls.minDistance = CAMERA_LIMITS.minDistance
  controls.maxDistance = CAMERA_LIMITS.maxDistance

  const params = {
    view: 'plongee' as CameraView,
    wireframe: false,
    idle: true,
    triangles: 0,
    fps: 0,
  }

  /**
   * Mouvement de caméra en cours (vers une section, ou retour à la vue d'orbite) : de `from` vers `to()`,
   * recalculé à chaque image puisque le container tangue avec la baleine. Tant qu'il existe, il remplace
   * les contrôles d'orbite.
   */
  let move: { from: Pose; to: (pose: Pose) => Pose; blend: { value: number } } | null = null
  let moveTween: gsap.core.Tween | null = null
  /** Point visé pendant un mouvement (les contrôles d'orbite gardent le leur). */
  const lookTarget = new THREE.Vector3()
  const movePose: Pose = { position: new THREE.Vector3(), target: new THREE.Vector3() }
  /** Vue d'orbite à retrouver en fermant la section, et fin de l'arrivée caméra si elle est en cours. */
  let home: Pose | null = null
  let introEnd: Pose | null = null

  const applyCamera = (view: CameraView): void => {
    const { position, target } = CAMERA_VIEWS[view]
    // une vue choisie pendant l'arrivée caméra remplace l'animation
    gsap.killTweensOf(camera.position)
    moveTween?.kill()
    move = null
    home = null
    introEnd = null
    controls.enabled = true
    camera.position.set(...position)
    controls.target.set(...target)
    controls.update()
  }

  const refreshStats = (): void => {
    params.triangles = countTriangles(scene)
  }

  if (debug) {
    const gui = new GUI({ title: 'Viewer — debug' })
    gui
      .add(params, 'view', { 'Plongée (38, 24, 38)': 'plongee', 'Profil (type etape3_img4)': 'profil' })
      .name('Caméra')
      .onChange(() => applyCamera(params.view))
    gui.add(params, 'wireframe').name('Wireframe').onChange(() => setWireframe(scene, params.wireframe))
    gui.add(params, 'idle').name('Animation idle').onChange(() => whale.setIdle(params.idle))
    gui.add(params, 'triangles').name('Triangles').disable().listen()
    gui.add(params, 'fps').name('FPS').disable().listen()
  }

  applyCamera(params.view)
  refreshStats()

  const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /** Lance un mouvement de caméra vers `to` (recalculé à chaque image), depuis la pose actuelle. */
  const moveCamera = (to: (pose: Pose) => Pose, onDone?: () => void): void => {
    moveTween?.kill()
    gsap.killTweensOf(camera.position)
    controls.enabled = false
    const from: Pose = { position: camera.position.clone(), target: (move ? lookTarget : controls.target).clone() }
    const blend = { value: 0 }
    move = { from, to, blend }
    moveTween = gsap.to(blend, { value: 1, duration: reducedMotion() ? 0.01 : FOCUS.seconds, ease: 'power2.inOut', onComplete: onDone })
  }

  const doorsWorld = new THREE.Vector3()
  /** Pose face aux portes du container, avec le container au centre de la zone laissée libre par le panneau. */
  const framePose = (node: THREE.Object3D, pose: Pose): Pose => {
    node.localToWorld(doorsWorld.copy(FOCUS.doors))
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const desktop = window.innerWidth >= 768
    const freeWidth = desktop ? 1 - Math.min(0.5, FOCUS.panel.width / window.innerWidth) : 1
    const freeHeight = desktop ? 1 : 1 - FOCUS.panel.sheet
    const distance = Math.max(FOCUS.frame.height / freeHeight / (2 * tan), FOCUS.frame.width / freeWidth / (2 * tan * camera.aspect))
    // viser à côté du container le décale vers le centre de la zone libre
    const shiftX = (1 - freeWidth) * distance * tan * camera.aspect
    const shiftY = (1 - freeHeight) * distance * tan
    pose.target.set(doorsWorld.x - shiftX, doorsWorld.y - shiftY, doorsWorld.z)
    pose.position.set(pose.target.x + FOCUS.side, pose.target.y + FOCUS.rise, pose.target.z + distance)
    return pose
  }

  // à bord : la caméra arrive du large jusqu'à la vue plongée pendant que l'écran de démarrage s'efface ;
  // une adresse de section (#cv…) ouvre directement la section
  void loading.entered.then(() => {
    const deepLink = sectionFromHash()
    if (deepLink) {
      openSection(deepLink, false)
      return
    }
    if (reducedMotion()) return
    const end = camera.position.clone()
    introEnd = { position: end.clone(), target: controls.target.clone() }
    camera.position.set(...INTRO_FROM)
    controls.enabled = false
    gsap.to(camera.position, {
      x: end.x,
      y: end.y,
      z: end.z,
      duration: INTRO_SECONDS,
      ease: 'power3.inOut',
      onComplete: () => {
        introEnd = null
        if (!move) controls.enabled = true
      },
    })
  })

  let hover: ContainerHover | null = null
  const containersBySlug = new Map<string, { slot: string; node: THREE.Object3D }>()
  /** Section ouverte, et si son ouverture a ajouté une entrée à l'historique du navigateur. */
  let openSlug: string | null = null
  let pushedHistory = false
  let pendingDoors: gsap.core.Tween | null = null
  /** Le terminal se réduit pendant la lecture d'une section ; il retrouve ensuite son état d'avant. */
  let terminalWasMinimized = false

  /** Ouvre une section : container sorti de la pile, caméra devant ses portes, portes ouvertes, panneau. */
  const openSection = (slug: string, push = true): void => {
    const entry = containersBySlug.get(slug)
    if (!entry || !hover || slug === openSlug) return
    // historique : une entrée à l'ouverture, remplacée quand on passe d'une section à une autre
    if (push && openSlug) history.replaceState(null, '', `#${slug}`)
    else if (push) {
      history.pushState(null, '', `#${slug}`)
      pushedHistory = true
    }
    const previous = openSlug ? containersBySlug.get(openSlug) : undefined
    if (previous) whale.doors(previous.slot)?.close()
    else terminalWasMinimized = terminal.setMinimized(true)
    openSlug = slug
    // vue à retrouver en fermant : celle d'avant la première ouverture (ou la fin de l'arrivée caméra)
    home ??= introEnd ?? { position: camera.position.clone(), target: (move ? lookTarget : controls.target).clone() }
    introEnd = null
    hover.setFocus(entry.slot)
    moveCamera((pose) => framePose(entry.node, pose))
    pendingDoors?.kill()
    pendingDoors = gsap.delayedCall(reducedMotion() ? 0 : FOCUS.doorsDelay, () => whale.doors(entry.slot)?.open())
    panel.show(slug)
  }

  /** Referme la section ouverte et ramène la caméra sur la vue d'orbite d'avant. */
  const closeSection = (push = true): void => {
    if (!openSlug) return
    const entry = containersBySlug.get(openSlug)
    openSlug = null
    pendingDoors?.kill()
    if (entry) whale.doors(entry.slot)?.close()
    hover?.setFocus(null)
    panel.hide()
    if (!terminalWasMinimized) terminal.setMinimized(false)
    // `home` reste connu jusqu'à l'arrivée : une section rouverte en chemin y reviendra aussi
    const back = home
    if (back) {
      moveCamera(
        () => back,
        () => {
          move = null
          home = null
          camera.position.copy(back.position)
          controls.target.copy(back.target)
          controls.enabled = true
          controls.update()
        },
      )
    }
    const hadPushed = pushedHistory
    pushedHistory = false
    if (push && hadPushed) history.back()
    else if (push) history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  // précédent / suivant du navigateur : ouvre ou referme la section de l'adresse
  window.addEventListener('popstate', () => {
    const slug = sectionFromHash()
    if (slug) openSection(slug, false)
    else closeSection(false)
  })

  const terminal = createTerminal({
    onContainerState: (slot, running) => hover?.setRunning(slot, running),
    onContainerPing: (slot) => hover?.pulse(slot),
    onOpenSection: (slug) => openSection(slug),
  })
  const panel = createSectionPanel({
    onClose: () => closeSection(),
    onNavigate: (slug) => openSection(slug),
    onCommand: (command) => {
      closeSection()
      void terminal.execute(command)
    },
  })

  whale.ready
    .then(() => {
      loading.done()
      setWireframe(whale.group, params.wireframe)
      refreshStats()
      const containers: THREE.Object3D[] = []
      for (const marking of CONTAINER_MARKINGS) {
        const node = whale.group.getObjectByName(marking.slot)
        if (!node) continue
        containers.push(node)
        containersBySlug.set(marking.slug, { slot: marking.slot, node })
      }
      hover = createContainerHover(camera, renderer.domElement, containers, {
        // clic sur un container : sa section s'ouvre ; clic à côté : la section ouverte se referme
        onSelect: (slot) => {
          const marking = slot ? CONTAINER_MARKINGS.find((m) => m.slot === slot) : undefined
          if (marking) openSection(marking.slug)
          else closeSection()
        },
      })
    })
    .catch((error: unknown) => {
      console.error('Modèle de la baleine introuvable', error)
      loading.fail(`Error: manifest for ${PROFILE.user}/portfolio:2026 not found`)
    })

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  let frames = 0
  let fpsWindowStart = 0
  renderer.setAnimationLoop((time: number) => {
    const elapsed = time / 1000
    sky.update(elapsed)
    ocean.update(elapsed)
    whale.update(elapsed)
    if (move) {
      // mouvement vers une section (ou retour) : la destination suit le container qui tangue
      const to = move.to(movePose)
      camera.position.lerpVectors(move.from.position, to.position, move.blend.value)
      lookTarget.lerpVectors(move.from.target, to.target, move.blend.value)
      camera.lookAt(lookTarget)
    } else controls.update()
    hover?.update()
    renderer.render(scene, camera)

    frames++
    if (elapsed - fpsWindowStart >= 0.5) {
      params.fps = Math.round(frames / (elapsed - fpsWindowStart))
      frames = 0
      fpsWindowStart = elapsed
    }
  })
}
