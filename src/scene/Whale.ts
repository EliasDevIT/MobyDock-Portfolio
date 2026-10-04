import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { CONTAINER_MARKINGS } from '@/data/containers'
import { createContainerDoors, type ContainerDoors } from './ContainerDoors'
import { createContainerMarkings } from './ContainerMarkings'
import { createWhaleWake, waterlineOutline, type WhaleWake } from './WhaleWake'

/**
 * Baleine Docker (« 3D Docker Whale » de leo199483, Printables #566955), assemblée et exportée
 * depuis Blender : assets-src/docker-whale/docker-whale.blend → public/models/docker-whale.glb.
 * Repère du modèle : tête vers -X, pont plat en y = 0 centré en x = 0, flanc gauche vers +Z.
 */
const MODEL_URL = `${import.meta.env.BASE_URL}models/docker-whale.glb`

/**
 * Finition par matériau du GLB : plastique verni (aspect jouet en vinyle), qui reflète le ciel via
 * `scene.environment`. Le matériau exporté par Blender est remplacé.
 */
const SURFACES: Record<string, THREE.MeshPhysicalMaterialParameters> = {
  whale_body: { color: '#1aa2f2', roughness: 0.4, specularIntensity: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.15, envMapIntensity: 0.6 },
  /** Containers : peinture bleu acier (distincte du bleu de la baleine), barres de verrouillage en acier. */
  whale_container_paint: { color: '#3a6ea5', roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.4, envMapIntensity: 0.6 },
  whale_container_steel: { color: '#24292e', metalness: 0.3, roughness: 0.5, envMapIntensity: 0.4 },
  whale_mouth: { color: '#eef4fa', roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.2 },
  whale_eye: { color: '#f4f7fa', roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1 },
  /** Trait du sourire, gris ardoise du logo. */
  whale_mouthline: { color: '#2f3a42', roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.2 },
}
/**
 * Une nuance de bleu acier par container (whale_box_01 … 09, dans l'ordre du GLB), pour qu'on distingue
 * chaque container de ses voisins ; toutes restent nettement plus sombres que le bleu de la baleine.
 */
const CONTAINER_SHADES = ['#3a6ea5', '#2e5b8a', '#4a7fb5', '#33628f', '#4275a8', '#2b5482', '#3d74ad', '#36679b', '#4680b8']

/** Pupille et reflet : non éclairés, pour rester bien noirs et bien blancs quelle que soit la lumière. */
const UNLIT: Record<string, string> = {
  whale_pupil: '#0d1826',
  whale_glint: '#ffffff',
}

/** Hauteur du pont au-dessus de l'eau (y = 0) : fond de coque à y ≈ -8.4, ~24 % de la hauteur immergée. */
const DECK_HEIGHT = 6.4

/**
 * Pile façon logo Docker : containers collés (un simple joint entre deux) et agrandis pour couvrir la même
 * longueur de pont que l'ancienne pile espacée du GLB. Baies 01…09 → colonnes 0…4, étages 82/84/86 → 0…2,
 * colonne centrale en x = `centerX`. `size` : largeur et hauteur d'un container du GLB.
 */
const STACK = { scale: 1.13, joint: 0.02, centerX: 1.35, size: { width: 2.604, height: 2.774 }, floor: 0.1 } as const

function stackContainers(model: THREE.Object3D): void {
  const pitchX = STACK.size.width * STACK.scale + STACK.joint
  const pitchY = STACK.size.height * STACK.scale + STACK.joint
  for (const marking of CONTAINER_MARKINGS) {
    const node = model.getObjectByName(marking.slot)
    if (!node) continue
    const column = (Number(marking.position.bay) - 1) / 2
    const tier = (Number(marking.position.tier) - 82) / 2
    node.scale.setScalar(STACK.scale)
    node.position.x = STACK.centerX + (column - 2) * pitchX
    node.position.y = STACK.floor * STACK.scale + tier * pitchY
  }
}

/** Flottaison : tangage, roulis (radians) et pilonnement, autour de la ligne de flottaison. */
const PITCH = THREE.MathUtils.degToRad(2.2)
const ROLL = THREE.MathUtils.degToRad(1.6)
const HEAVE = 0.28

/**
 * Queue qui frétille (ondulation latérale dans le shader du corps) : poids nul avant `start`, plein après
 * `end` (repère du modèle, x vers la queue), angle maximal en radians, vitesse et décalage de l'onde.
 */
const TAIL = { start: 9.5, end: 14, angle: 0.07, speed: 2.1, wave: 0.3 } as const

/** Contour sombre du logo (enveloppe inversée) autour du corps bleu : couleur ardoise et épaisseur. */
const OUTLINE = { color: '#2a353d', thickness: 0.14 } as const
/** Marge autour de la mâchoire où le contour du corps s'efface (pas de trait entre le bleu et le blanc). */
const JAW_MARGIN = 0.25

const glsl = (n: number): string => n.toFixed(3)
/** Ondulation de la queue, à injecter après `#include <begin_vertex>` (uniform uTailTime). */
const TAIL_GLSL = `
      float tailWeight = smoothstep(${glsl(TAIL.start)}, ${glsl(TAIL.end)}, transformed.x);
      transformed.z += sin(uTailTime * ${glsl(TAIL.speed)} - transformed.x * ${glsl(TAIL.wave)})
        * ${glsl(TAIL.angle)} * tailWeight * (transformed.x - ${glsl(TAIL.start)});`

export interface Whale {
  group: THREE.Group
  /** Résolu quand le modèle est chargé et ajouté à la scène. */
  ready: Promise<void>
  update(elapsed: number): void
  setIdle(enabled: boolean): void
  /** Portes ouvrantes d'un container (nom du nœud GLB), une fois le modèle chargé. */
  doors(slot: string): ContainerDoors | undefined
}

/** Numéro du container (whale_box_NN) auquel appartient ce maillage, ou null. */
function containerIndex(object: THREE.Object3D): number | null {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    const match = /^whale_box_(\d+)/.exec(current.name)
    if (match?.[1]) return Number(match[1])
  }
  return null
}

/** Peinture d'un container : matériau de sa tôle (un des maillages du nœud GLB). */
function containerPaint(node: THREE.Object3D): THREE.Material | null {
  for (const child of node.children) {
    if (child instanceof THREE.Mesh && !Array.isArray(child.material) && child.material.name === 'whale_container_paint') return child.material
  }
  return null
}

/** Fait onduler la queue : décale les sommets en z, proportionnellement à leur distance au pédoncule. */
function addTailWiggle(material: THREE.Material, time: { value: number }): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms['uTailTime'] = time
    shader.vertexShader = `uniform float uTailTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>${TAIL_GLSL}`,
    )
  }
}

/**
 * Contour sombre façon logo : copie de la coque gonflée le long de normales lissées (sommets fusionnés,
 * pour ne pas ouvrir de fente aux arêtes vives) et rendue par l'intérieur ; elle ne dépasse qu'au bord
 * de la silhouette et suit l'ondulation de la queue. Aucun gonflement dans `jaw` (encombrement de la
 * mâchoire blanche, repère du corps) : pas de trait entre le bleu et le blanc.
 */
function createOutline(geometry: THREE.BufferGeometry, tailTime: { value: number }, jaw: THREE.Box3): THREE.Mesh {
  const shell = geometry.clone()
  shell.deleteAttribute('normal')
  const merged = mergeVertices(shell, 1e-4)
  merged.computeVertexNormals()
  const material = new THREE.MeshBasicMaterial({ color: OUTLINE.color, side: THREE.BackSide })
  material.onBeforeCompile = (shader) => {
    shader.uniforms['uTailTime'] = tailTime
    shader.uniforms['uJawMin'] = { value: jaw.min }
    shader.uniforms['uJawMax'] = { value: jaw.max }
    shader.vertexShader = `uniform float uTailTime;\nuniform vec3 uJawMin;\nuniform vec3 uJawMax;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec3 jawInside = step(uJawMin, transformed) * step(transformed, uJawMax);
      float outlineWeight = 1.0 - jawInside.x * jawInside.y * jawInside.z;
      transformed += normalize(normal) * ${glsl(OUTLINE.thickness)} * outlineWeight;${TAIL_GLSL}`,
    )
  }
  material.customProgramCacheKey = () => 'whale-outline'
  const outline = new THREE.Mesh(merged, material)
  outline.raycast = () => undefined // jamais ciblé par le survol
  return outline
}

function material(name: string): THREE.Material | null {
  const unlit = UNLIT[name]
  if (unlit) return new THREE.MeshBasicMaterial({ color: unlit, polygonOffset: true, polygonOffsetFactor: -2 })
  const surface = SURFACES[name]
  if (!surface) return null
  const physical = new THREE.MeshPhysicalMaterial(surface)
  physical.name = name // retrouvé par nom (survol des containers)
  return physical
}

/** `onProgress` : avancement du téléchargement du modèle, de 0 à 1 (si le serveur donne la taille). */
export function createWhale(onProgress?: (ratio: number) => void): Whale {
  const group = new THREE.Group()
  group.name = 'whale'

  /** Tout ce qui tangue et pilonne ; pivot à la ligne de flottaison, `group` reste au niveau de l'eau. */
  const motion = new THREE.Group()
  motion.name = 'whale_motion'
  group.add(motion)

  const tailTime = { value: 0 }
  let wake: WhaleWake | null = null
  const doorsBySlot = new Map<string, ContainerDoors>()

  const progress = (event: ProgressEvent): void => {
    if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total)
  }
  const ready = new GLTFLoader().loadAsync(MODEL_URL, progress).then((gltf) => {
    const model = gltf.scene
    model.name = 'whale_model'
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const current: THREE.Material | THREE.Material[] = object.material
      const replacement = Array.isArray(current) ? null : material(current.name)
      if (replacement) object.material = replacement
      const index = containerIndex(object)
      if (index !== null && replacement instanceof THREE.MeshPhysicalMaterial && !Array.isArray(current) && current.name === 'whale_container_paint') {
        replacement.color.set(CONTAINER_SHADES[(index - 1) % CONTAINER_SHADES.length] ?? '#3a6ea5')
      }
      const unlit = replacement instanceof THREE.MeshBasicMaterial
      object.castShadow = !unlit
      object.receiveShadow = !unlit
    })
    model.position.y = DECK_HEIGHT
    stackContainers(model)

    // marquage peint sur les grands côtés de chaque container (code BIC, nom, statut), portes ouvrantes
    // au bout +z, peintes comme le container (même matériau : elles s'éclairent et s'éteignent avec lui)
    for (const marking of CONTAINER_MARKINGS) {
      const node = model.getObjectByName(marking.slot)
      if (!node) continue
      const markings = createContainerMarkings(marking)
      node.add(markings.group)
      const paint = containerPaint(node)
      if (!paint) continue
      const doors = createContainerDoors(paint, markings.doorArt, marking.icon)
      node.add(doors.group)
      doorsBySlot.set(marking.slot, doors)
    }

    const body = model.getObjectByName('whale_body')
    if (body instanceof THREE.Mesh && !Array.isArray(body.material)) {
      addTailWiggle(body.material, tailTime)
      // contour sombre autour du corps bleu seulement (pas autour de la mâchoire blanche)
      const jaw = new THREE.Box3()
      const mouth = model.getObjectByName('whale_mouth')
      if (mouth instanceof THREE.Mesh) {
        mouth.geometry.computeBoundingBox()
        model.updateMatrixWorld(true)
        const toBody = body.matrixWorld.clone().invert().multiply(mouth.matrixWorld)
        if (mouth.geometry.boundingBox) jaw.copy(mouth.geometry.boundingBox).applyMatrix4(toBody).expandByScalar(JAW_MARGIN)
      }
      const outline = createOutline(body.geometry, tailTime, jaw)
      outline.name = 'whale_body_outline'
      body.add(outline)
    }

    // écume et ondes autour de la coque, au niveau de l'eau (y = 0 dans `group`)
    const hull = ['whale_body', 'whale_mouth']
      .map((name) => model.getObjectByName(name))
      .filter((object): object is THREE.Mesh => object instanceof THREE.Mesh)
    model.updateMatrixWorld(true)
    wake = createWhaleWake(waterlineOutline(hull, model, -DECK_HEIGHT).map((p) => p.clone()))
    group.add(wake.group)

    motion.add(model)
  })

  let idle = true

  const pose = (elapsed: number, amount: number): void => {
    motion.rotation.z = PITCH * Math.sin(elapsed * 0.5) * amount
    motion.rotation.x = ROLL * Math.sin(elapsed * 0.37 + 1.1) * amount
    motion.position.y = HEAVE * Math.sin(elapsed * 0.75 + 0.6) * amount
    tailTime.value = elapsed * amount
  }

  pose(0, 0)

  return {
    group,
    ready,
    update(elapsed: number): void {
      wake?.update(elapsed)
      if (idle) pose(elapsed, 1)
    },
    setIdle(enabled: boolean): void {
      idle = enabled
      if (!enabled) pose(0, 0)
    },
    doors: (slot) => doorsBySlot.get(slot),
  }
}
