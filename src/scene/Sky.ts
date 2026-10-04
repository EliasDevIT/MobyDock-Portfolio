import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { toon } from './materials'
import { canvasTexture, createCanvas, seededRandom } from './textures'

/** Dégradé du dôme, du zénith vers l'horizon (et sous l'horizon, en attendant la mer). */
const SKY_ZENITH = new THREE.Color('#1a6fd6')
const SKY_MIDDLE = new THREE.Color('#4fa6ee')
const SKY_HORIZON = new THREE.Color('#cde9fb')
/** Teinte du ciel tout près du soleil (diffusion). */
const SKY_SUN_GLARE = new THREE.Color('#fbf8ec')
const DOME_RADIUS = 420

/** Direction du disque solaire (vers lui) : en haut à droite du cadre dans la vue de profil, reprise
 * par la mer pour aligner la traînée scintillante sous le soleil. */
export const SUN_DIRECTION = new THREE.Vector3(0.1, 0.13, -0.98).normalize()

const SUN_RAYS = 24
/** Rotation lente de l'étoile de rayons (rad/s). */
const SUN_RAYS_SPIN = 0.02

const SUN_AZIMUTH = Math.atan2(SUN_DIRECTION.z, SUN_DIRECTION.x)
/** Écart angulaire minimal entre un nuage et le soleil (à la création ; la dérive reste lente). */
const SUN_CLEARANCE = THREE.MathUtils.degToRad(28)

const CLOUD_COUNT = 9
/** Vitesse de dérive des nuages autour de la scène (rad/s). */
const CLOUD_DRIFT = 0.004

export interface Sky {
  group: THREE.Group
  fog: THREE.Fog
  update(elapsed: number): void
}

/** Dôme vu de l'intérieur, couleur par sommet selon l'élévation, éclairci autour du soleil. */
function createDome(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(DOME_RADIUS, 64, 32)
  const position = geometry.getAttribute('position')
  const colors = new Float32Array(position.count * 3)
  const color = new THREE.Color()
  const direction = new THREE.Vector3()
  for (let i = 0; i < position.count; i++) {
    direction.fromBufferAttribute(position, i).normalize()
    const h = direction.y
    if (h <= 0) color.copy(SKY_HORIZON)
    else if (h < 0.12) color.lerpColors(SKY_HORIZON, SKY_MIDDLE, h / 0.12)
    else color.lerpColors(SKY_MIDDLE, SKY_ZENITH, Math.min(1, (h - 0.12) / 0.5))
    // diffusion : le ciel pâlit et se réchauffe à l'approche du soleil
    const near = Math.max(0, direction.dot(SUN_DIRECTION))
    color.lerp(SKY_SUN_GLARE, near ** 48 * 0.8 + near ** 8 * 0.18)
    color.toArray(colors, i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const dome = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }),
  )
  dome.name = 'sky_dome'
  dome.renderOrder = -1
  return dome
}

/** Dégradé radial blanc : opaque jusqu'à `plateau`, puis décroissance douce jusqu'au bord. */
function createRadialTexture(plateau: number): THREE.CanvasTexture {
  const size = 256
  const { canvas, ctx } = createCanvas(size, size)
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(plateau, 'rgba(255,255,255,1)')
  gradient.addColorStop(plateau + (1 - plateau) * 0.25, 'rgba(255,255,255,0.45)')
  gradient.addColorStop(plateau + (1 - plateau) * 0.6, 'rgba(255,255,255,0.1)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return canvasTexture(canvas)
}

/** Étoile de rayons fins (diffraction de l'objectif), longueurs et épaisseurs irrégulières. */
function createRaysTexture(): THREE.CanvasTexture {
  const size = 512
  const c = size / 2
  const { canvas, ctx } = createCanvas(size, size)
  const random = seededRandom(17)
  const fade = ctx.createRadialGradient(c, c, 0, c, c, c)
  fade.addColorStop(0, 'rgba(255,255,255,0.8)')
  fade.addColorStop(0.2, 'rgba(255,255,255,0.3)')
  fade.addColorStop(0.6, 'rgba(255,255,255,0.06)')
  fade.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = fade
  ctx.filter = 'blur(3px)'
  for (let i = 0; i < SUN_RAYS; i++) {
    const angle = (i / SUN_RAYS) * Math.PI * 2 + (random() - 0.5) * 0.25
    const length = c * (0.35 + random() * 0.65)
    const width = 0.008 + random() * 0.014
    ctx.beginPath()
    ctx.moveTo(c, c)
    ctx.lineTo(c + Math.cos(angle - width) * length, c + Math.sin(angle - width) * length)
    ctx.lineTo(c + Math.cos(angle + width) * length, c + Math.sin(angle + width) * length)
    ctx.closePath()
    ctx.fill()
  }
  return canvasTexture(canvas)
}

interface Sun {
  group: THREE.Group
  update(elapsed: number): void
}

/**
 * Soleil : cœur blanc surexposé à bord doux, lueur chaude qui éclaircit le ciel et étoile de rayons
 * qui tourne lentement. Tout est en sprites transparents sans écriture de profondeur, empilés par
 * `renderOrder` (la baleine, opaque, passe toujours devant).
 */
function createSun(): Sun {
  const group = new THREE.Group()
  group.name = 'sun'
  group.position.copy(SUN_DIRECTION).multiplyScalar(DOME_RADIUS * 0.85)

  const sprite = (
    map: THREE.Texture,
    scale: number,
    color: string,
    opacity: number,
    order: number,
    blending: THREE.Blending = THREE.NormalBlending,
  ): THREE.Sprite => {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, fog: false, blending }),
    )
    s.scale.setScalar(scale)
    s.renderOrder = order
    return s
  }

  const soft = createRadialTexture(0)
  const core = createRadialTexture(0.32)
  const glare = sprite(soft, 200, '#fff3d1', 0.35, 0)
  const glow = sprite(soft, 75, '#fffbe8', 0.9, 1)
  const rays = sprite(createRaysTexture(), 110, '#fffaf0', 0.22, 2, THREE.AdditiveBlending)
  const disc = sprite(core, 34, '#ffffff', 1, 3)
  group.add(glare, glow, rays, disc)

  const raysMaterial = rays.material
  return {
    group,
    update(elapsed: number): void {
      raysMaterial.rotation = elapsed * SUN_RAYS_SPIN
      raysMaterial.opacity = 0.2 + 0.04 * Math.sin(elapsed * 0.9)
    },
  }
}

/** Nuage cartoon : boules fusionnées, base aplatie. */
function createCloudGeometry(random: () => number): THREE.BufferGeometry {
  const puffs: THREE.BufferGeometry[] = []
  const count = 5 + Math.floor(random() * 3)
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1) - 0.5
    const radius = 4 + (1 - Math.abs(t) * 1.6) * 4 + random() * 1.5
    const puff = new THREE.IcosahedronGeometry(radius, 2)
    puff.translate(t * 22 + (random() - 0.5) * 3, radius * 0.35, (random() - 0.5) * 6)
    puffs.push(puff)
  }
  const geometry = mergeGeometries(puffs)
  puffs.forEach((p) => p.dispose())
  geometry.scale(1, 0.7, 1)
  return geometry
}

function createClouds(): THREE.Group {
  const clouds = new THREE.Group()
  clouds.name = 'clouds'
  const random = seededRandom(5)
  const material = toon({ color: '#ffffff', emissive: new THREE.Color('#c9e4ff'), emissiveIntensity: 0.35 })
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const cloud = new THREE.Mesh(createCloudGeometry(random), material)
    let azimuth = (i / CLOUD_COUNT) * Math.PI * 2 + random() * 0.5
    // garde le soleil dégagé : un nuage trop proche de son azimut est décalé sur le côté
    const fromSun = Math.atan2(Math.sin(azimuth - SUN_AZIMUTH), Math.cos(azimuth - SUN_AZIMUTH))
    if (Math.abs(fromSun) < SUN_CLEARANCE) azimuth = SUN_AZIMUTH + Math.sign(fromSun || 1) * SUN_CLEARANCE
    const distance = 170 + random() * 110
    cloud.position.set(Math.cos(azimuth) * distance, 45 + random() * 45, Math.sin(azimuth) * distance)
    cloud.lookAt(0, cloud.position.y, 0)
    cloud.scale.setScalar(0.8 + random() * 0.7)
    cloud.name = `cloud_${i + 1}`
    clouds.add(cloud)
  }
  return clouds
}

export function createSky(): Sky {
  const group = new THREE.Group()
  group.name = 'sky'
  const clouds = createClouds()
  const sun = createSun()
  group.add(createDome(), sun.group, clouds)

  return {
    group,
    fog: new THREE.Fog(SKY_HORIZON, 160, DOME_RADIUS),
    update(elapsed: number): void {
      clouds.rotation.y = elapsed * CLOUD_DRIFT
      sun.update(elapsed)
    },
  }
}
