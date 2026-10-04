import * as THREE from 'three'

let gradientMap: THREE.DataTexture | null = null

/** Rampe 3 tons partagée par tous les MeshToonMaterial. */
export function getGradientMap(): THREE.DataTexture {
  if (!gradientMap) {
    const data = new Uint8Array([90, 170, 255])
    gradientMap = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat)
    gradientMap.minFilter = THREE.NearestFilter
    gradientMap.magFilter = THREE.NearestFilter
    gradientMap.generateMipmaps = false
    gradientMap.needsUpdate = true
  }
  return gradientMap
}

export function toon(params: THREE.MeshToonMaterialParameters = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ gradientMap: getGradientMap(), ...params })
}
