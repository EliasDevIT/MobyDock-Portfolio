import * as THREE from 'three'

/** Rayon du disque de mer de la scène d'environnement (l'horizon se confond avec celui du ciel). */
const SEA_RADIUS = 400

/**
 * Carte d'environnement pour les reflets des matériaux PBR (la baleine) : une copie du ciel au-dessus,
 * un disque couleur mer en dessous, rendus une seule fois en cubemap préfiltrée (PMREM).
 */
export function createEnvironment(
  renderer: THREE.WebGLRenderer,
  sky: THREE.Object3D,
  seaColor: THREE.ColorRepresentation,
): THREE.Texture {
  const scene = new THREE.Scene()
  scene.add(sky.clone())

  const sea = new THREE.Mesh(new THREE.CircleGeometry(SEA_RADIUS, 48), new THREE.MeshBasicMaterial({ color: seaColor }))
  sea.rotation.x = -Math.PI / 2
  sea.position.y = -2
  scene.add(sea)

  // les nuages sont éclairés : sans lumière ils sortiraient noirs dans les reflets
  scene.add(new THREE.HemisphereLight('#ffffff', '#9fc3e6', 2.5))

  const pmrem = new THREE.PMREMGenerator(renderer)
  const { texture } = pmrem.fromScene(scene, 0.03, 0.1, 1000)
  pmrem.dispose()
  return texture
}
