import * as THREE from 'three'
import { SUN_DIRECTION } from './Sky'

/**
 * Direction de la lumière du soleil (vers elle) : de face et en hauteur, côté caméra, pour éclairer
 * le flanc visible. Le disque du ciel (Sky.ts) est placé pour la composition, du même côté (droite).
 */
const SUN_LIGHT_DIRECTION = new THREE.Vector3(0.45, 0.8, 0.4).normalize()

export interface Lights {
  group: THREE.Group
}

/** Lumière de plein jour : soleil chaud qui porte les ombres, contre-jour, ciel bleu et reflet de la mer. */
export function createLights(): Lights {
  const group = new THREE.Group()
  group.name = 'lights'

  const sun = new THREE.DirectionalLight('#fff1d6', 2.3)
  sun.name = 'light_sun'
  // ombres resserrées sur la baleine (centre ≈ (5, 3, 0), rayon ≈ 17) : texels plus fins, et un
  // normalBias généreux pour supprimer l'acné (grain) sur ses courbes
  sun.target.position.set(5, 3, 0)
  sun.position.copy(SUN_LIGHT_DIRECTION).multiplyScalar(60).add(sun.target.position)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -17
  sun.shadow.camera.right = 17
  sun.shadow.camera.top = 17
  sun.shadow.camera.bottom = -17
  sun.shadow.camera.near = 20
  sun.shadow.camera.far = 100
  sun.shadow.bias = -0.0002
  sun.shadow.normalBias = 0.06
  sun.shadow.radius = 4

  // contre-jour : vient du soleil visible, derrière la baleine, et fait briller ses contours
  const rim = new THREE.DirectionalLight('#fff0d2', 1.8)
  rim.name = 'light_rim'
  rim.target.position.copy(sun.target.position)
  rim.position.copy(SUN_DIRECTION).multiplyScalar(60).add(rim.target.position)

  // ciel en haut, reflet bleuté de la mer en bas
  const hemisphere = new THREE.HemisphereLight('#cfeaff', '#a9cbe6', 0.9)
  hemisphere.name = 'light_hemisphere'

  group.add(sun, sun.target, rim, rim.target, hemisphere)

  return { group }
}
