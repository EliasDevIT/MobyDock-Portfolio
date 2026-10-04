import * as THREE from 'three'
import { Water } from 'three/addons/objects/Water.js'
import { seededRandom } from './textures'

/** Côté du plan d'eau : déborde du dôme du ciel, le brouillard fond le bord dans l'horizon. */
const WATER_SIZE = 1200
/** Résolution du reflet (miroir) : 512 suffit, les vagues floutent le détail. */
const REFLECTION_SIZE = 512

/** Bleu profond vu de haut ; le reflet du ciel prend le dessus vers l'horizon (Fresnel). */
export const OCEAN_COLOR = '#0a3f86'

const WATER = {
  color: OCEAN_COLOR,
  sunColor: '#fff4dc',
  /** Déformation du reflet par les vagues. */
  distortion: 3.2,
  /** Échelle des vagues : plus grand = vagues plus petites. */
  size: 3,
  /** Vitesse de défilement des vagues. */
  speed: 0.6,
} as const

const NORMALS_SIZE = 512
/** Octaves du bruit de hauteur : nombre de cellules sur la tuile et amplitude. */
const OCTAVES = [
  { period: 3, amplitude: 1 },
  { period: 6, amplitude: 0.5 },
  { period: 12, amplitude: 0.22 },
  { period: 24, amplitude: 0.08 },
] as const
/** Relief de la carte de normales. */
const NORMALS_STRENGTH = 20

export interface Ocean {
  mesh: Water
  update(elapsed: number): void
}

/** Bruit de valeur périodique (raccordable sur les bords), lissé en quintique. */
function addPeriodicNoise(heights: Float32Array, size: number, period: number, amplitude: number, random: () => number): void {
  const lattice = Float32Array.from({ length: period * period }, () => random() * 2 - 1)
  const at = (x: number, y: number): number => lattice[(y % period) * period + (x % period)] ?? 0
  const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * period
    const iy = Math.floor(fy)
    const ty = fade(fy - iy)
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * period
      const ix = Math.floor(fx)
      const tx = fade(fx - ix)
      const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx
      const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx
      heights[y * size + x] = (heights[y * size + x] ?? 0) + (top + (bottom - top) * ty) * amplitude
    }
  }
}

/** Carte de normales de vagues, générée une fois : champ de hauteur fractal → normales. */
function createWaterNormals(): THREE.DataTexture {
  const size = NORMALS_SIZE
  const random = seededRandom(42)
  const heights = new Float32Array(size * size)
  for (const { period, amplitude } of OCTAVES) addPeriodicNoise(heights, size, period, amplitude, random)

  const data = new Uint8Array(size * size * 4)
  const h = (x: number, y: number): number => heights[((y + size) % size) * size + ((x + size) % size)] ?? 0
  const n = new THREE.Vector3()
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      n.set((h(x - 1, y) - h(x + 1, y)) * NORMALS_STRENGTH, (h(x, y - 1) - h(x, y + 1)) * NORMALS_STRENGTH, 1).normalize()
      const i = (y * size + x) * 4
      data[i] = (n.x * 0.5 + 0.5) * 255
      data[i + 1] = (n.y * 0.5 + 0.5) * 255
      data[i + 2] = (n.z * 0.5 + 0.5) * 255
      data[i + 3] = 255
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

/** Mer miroir : reflet du ciel et de la baleine déformé par les vagues, scintillement du soleil. */
export function createOcean(sunDirection: THREE.Vector3): Ocean {
  const water = new Water(new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE), {
    textureWidth: REFLECTION_SIZE,
    textureHeight: REFLECTION_SIZE,
    waterNormals: createWaterNormals(),
    sunDirection: sunDirection.clone().normalize(),
    sunColor: WATER.sunColor,
    waterColor: WATER.color,
    distortionScale: WATER.distortion,
    fog: true,
  })
  water.name = 'ocean'
  water.rotation.x = -Math.PI / 2
  water.receiveShadow = true

  const uniforms = water.material.uniforms
  const size = uniforms['size']
  if (size) size.value = WATER.size
  const time = uniforms['time']

  return {
    mesh: water,
    update(elapsed: number): void {
      if (time) time.value = elapsed * WATER.speed
    },
  }
}
