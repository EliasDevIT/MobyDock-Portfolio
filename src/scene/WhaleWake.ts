import * as THREE from 'three'

/** Ondes qui partent de la coque : nombre simultané, période (s), distance parcourue, largeur. */
const RIPPLES = { count: 3, period: 4.8, spread: 5.5, width: 0.22, opacity: 0.4 } as const
/** Hauteur au-dessus de l'eau (y = 0), pour ne pas se battre avec la surface. */
const LIFT = 0.05
/** Points du contour après rééchantillonnage. */
const OUTLINE_POINTS = 160

export interface WhaleWake {
  group: THREE.Group
  update(elapsed: number): void
}

/**
 * Contour (x, z) où la coque coupe le plan horizontal `y` : intersection des arêtes qui traversent le
 * plan, sur tous les maillages donnés (dans le repère de `root`), puis ordonné par angle autour du centre.
 */
export function waterlineOutline(meshes: readonly THREE.Mesh[], root: THREE.Object3D, y: number): THREE.Vector2[] {
  root.updateMatrixWorld(true)
  const toRoot = root.matrixWorld.clone().invert()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const points: THREE.Vector2[] = []
  for (const mesh of meshes) {
    const matrix = toRoot.clone().multiply(mesh.matrixWorld)
    const position = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.index
    const count = index ? index.count : position.count
    const vertex = (i: number): number => (index ? index.getX(i) : i)
    for (let t = 0; t < count; t += 3) {
      for (let e = 0; e < 3; e++) {
        a.fromBufferAttribute(position, vertex(t + e)).applyMatrix4(matrix)
        b.fromBufferAttribute(position, vertex(t + ((e + 1) % 3))).applyMatrix4(matrix)
        if ((a.y - y) * (b.y - y) >= 0) continue
        const k = (y - a.y) / (b.y - a.y)
        points.push(new THREE.Vector2(a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k))
      }
    }
  }
  if (points.length < 3) return points

  // contour extérieur : pour chaque secteur angulaire, le point le plus éloigné du centre
  const center = points.reduce((sum, p) => sum.add(p), new THREE.Vector2()).divideScalar(points.length)
  const sectors: (THREE.Vector2 | undefined)[] = new Array(OUTLINE_POINTS)
  for (const p of points) {
    const angle = Math.atan2(p.y - center.y, p.x - center.x)
    const s = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * OUTLINE_POINTS) % OUTLINE_POINTS
    const current = sectors[s]
    if (!current || p.distanceToSquared(center) > current.distanceToSquared(center)) sectors[s] = p
  }
  return sectors.filter((p): p is THREE.Vector2 => p !== undefined)
}

/** Ondes qui s'éloignent de la coque (dans le repère de l'eau, y = 0). */
export function createWhaleWake(outline: readonly THREE.Vector2[]): WhaleWake {
  const group = new THREE.Group()
  group.name = 'whale_wake'
  const n = outline.length
  const center = outline.reduce((sum, p) => sum.add(p), new THREE.Vector2()).divideScalar(Math.max(1, n))
  const outward = outline.map((p) => p.clone().sub(center).normalize())

  // ondes : rubans fermés qui suivent la forme de la coque en s'en éloignant
  const indices: number[] = []
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    indices.push(i * 2, j * 2, i * 2 + 1, j * 2, j * 2 + 1, i * 2 + 1)
  }
  const ripples = Array.from({ length: RIPPLES.count }, (_, r) => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3))
    geometry.setIndex(indices)
    const material = new THREE.MeshBasicMaterial({
      color: '#eef7ff',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = `whale_ripple_${r + 1}`
    mesh.frustumCulled = false
    group.add(mesh)
    return { geometry, material, phase: r / RIPPLES.count }
  })

  const update = (elapsed: number): void => {
    for (const ripple of ripples) {
      const t = (elapsed / RIPPLES.period + ripple.phase) % 1
      const inner = t * RIPPLES.spread
      const outer = inner + RIPPLES.width * (1 + t)
      const attribute = ripple.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < n; i++) {
        const p = outline[i]
        const d = outward[i]
        if (!p || !d) continue
        attribute.setXYZ(i * 2, p.x + d.x * inner, LIFT, p.y + d.y * inner)
        attribute.setXYZ(i * 2 + 1, p.x + d.x * outer, LIFT, p.y + d.y * outer)
      }
      attribute.needsUpdate = true
      // apparition rapide, disparition lente en s'éloignant
      ripple.material.opacity = RIPPLES.opacity * Math.min(1, t / 0.08) * (1 - t) ** 1.6
    }
  }

  update(0)
  return { group, update }
}
