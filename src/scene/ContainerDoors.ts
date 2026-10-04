import * as THREE from 'three'
import gsap from 'gsap'
import { drawIcon, type ContainerIcon } from './ContainerIcons'
import { canvasTexture, createCanvas } from './textures'

/**
 * Portes du bout +z (face à la caméra), repère local du container : zone des portes (même gabarit que
 * le lettrage), plan de la tôle du fond et épaisseur des vantaux.
 */
const DOOR = { width: 2.3, height: 2.2, centerY: 1.3, wall: 4.552, thickness: 0.05 } as const
const OPEN_ANGLE = THREE.MathUtils.degToRad(105)
const INTERIOR_TEXTURE = { width: 512, height: 490 } as const

export interface ContainerDoors {
  group: THREE.Group
  open(): void
  close(): void
}

type Point = readonly [number, number]

/**
 * Intérieur d'un container vide, vu par l'ouverture : plafond, parois nervurées et plancher qui fuient
 * vers le fond, éclairé en bleu, avec le pictogramme de la section.
 */
function drawInterior(icon: ContainerIcon): HTMLCanvasElement {
  const { width: w, height: h } = INTERIOR_TEXTURE
  const { canvas, ctx } = createCanvas(w, h)
  const back = { x: w * 0.34, y: h * 0.3, w: w * 0.32, h: h * 0.34 }
  const tl: Point = [0, 0]
  const tr: Point = [w, 0]
  const br: Point = [w, h]
  const bl: Point = [0, h]
  const btl: Point = [back.x, back.y]
  const btr: Point = [back.x + back.w, back.y]
  const bbr: Point = [back.x + back.w, back.y + back.h]
  const bbl: Point = [back.x, back.y + back.h]
  const quad = (points: readonly Point[], fill: string | CanvasGradient): void => {
    ctx.beginPath()
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
  }
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

  // plafond, parois et plancher, plus sombres vers le fond
  const ceiling = ctx.createLinearGradient(0, 0, 0, back.y)
  ceiling.addColorStop(0, '#2b3a4a')
  ceiling.addColorStop(1, '#121a23')
  quad([tl, tr, btr, btl], ceiling)
  const left = ctx.createLinearGradient(0, 0, back.x, 0)
  left.addColorStop(0, '#30465c')
  left.addColorStop(1, '#141c26')
  quad([tl, btl, bbl, bl], left)
  const right = ctx.createLinearGradient(w, 0, back.x + back.w, 0)
  right.addColorStop(0, '#2b3f53')
  right.addColorStop(1, '#121a23')
  quad([tr, btr, bbr, br], right)
  const floor = ctx.createLinearGradient(0, h, 0, back.y + back.h)
  floor.addColorStop(0, '#6e5239')
  floor.addColorStop(1, '#2a1f17')
  quad([bl, bbl, bbr, br], floor)

  // nervures des parois, de plus en plus serrées vers le fond (perspective)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'
  ctx.lineWidth = 3
  ctx.beginPath()
  for (let i = 1; i <= 9; i++) {
    const depth = i * 0.6
    const s = depth / (depth + 1) / (6 / 7)
    if (s >= 1) break
    for (const [outerX, innerX] of [[0, back.x], [w, back.x + back.w]] as const) {
      const x = lerp(outerX, innerX, s)
      ctx.moveTo(x, lerp(0, back.y, s))
      ctx.lineTo(x, lerp(h, back.y + back.h, s))
    }
  }
  // lames du plancher, qui convergent vers le fond
  for (let k = 1; k < 6; k++) {
    ctx.moveTo(lerp(0, w, k / 6), h)
    ctx.lineTo(lerp(back.x, back.x + back.w, k / 6), back.y + back.h)
  }
  ctx.stroke()

  // fond éclairé et pictogramme de la section
  const cx = back.x + back.w / 2
  const cy = back.y + back.h / 2
  const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, back.w * 0.9)
  glow.addColorStop(0, '#a8d8ff')
  glow.addColorStop(0.55, '#3b7bbd')
  glow.addColorStop(1, '#1b3452')
  quad([btl, btr, bbr, bbl], glow)
  drawIcon(ctx, icon, cx, cy, back.h * 0.62)

  // lumière bleue qui se diffuse depuis le fond
  const haze = ctx.createRadialGradient(cx, cy, back.w * 0.3, cx, cy, w * 0.75)
  haze.addColorStop(0, 'rgba(120, 190, 255, 0.28)')
  haze.addColorStop(1, 'rgba(120, 190, 255, 0)')
  ctx.fillStyle = haze
  ctx.fillRect(0, 0, w, h)
  return canvas
}

/** Halo doux (dégradé radial blanc bleuté), pour la lumière qui sort du container. */
function drawGlow(): HTMLCanvasElement {
  const size = 256
  const { canvas, ctx } = createCanvas(size, size)
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(190, 228, 255, 1)')
  gradient.addColorStop(0.45, 'rgba(120, 190, 255, 0.45)')
  gradient.addColorStop(1, 'rgba(120, 190, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return canvas
}

/** Moitié gauche (0 → 0.5) ou droite (0.5 → 1) de la texture des portes. */
function halfPlane(width: number, height: number, from: number, to: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(width, height)
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setX(i, from + uv.getX(i) * (to - from))
  uv.needsUpdate = true
  return geometry
}

/**
 * Deux vantaux sur charnières au bout +z du container, peints comme le container (`paint`) et portant
 * le lettrage des portes (`art`, coupé en deux au milieu). Ils s'ouvrent vers l'extérieur et découvrent
 * un intérieur éclairé ; rien n'est dessiné en plus tant qu'ils sont fermés.
 */
export function createContainerDoors(paint: THREE.Material, art: THREE.Texture, icon: ContainerIcon): ContainerDoors {
  const group = new THREE.Group()
  group.name = 'container_doors'
  const leafWidth = DOOR.width / 2

  const artMaterial = new THREE.MeshStandardMaterial({
    map: art,
    transparent: true,
    depthWrite: false,
    roughness: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  // vantaux un peu plus étroits que la moitié : un fin jour au milieu, comme de vraies portes
  const leafGeometry = new THREE.BoxGeometry(leafWidth - 0.008, DOOR.height, DOOR.thickness)
  const hinges = ([-1, 1] as const).map((side) => {
    const hinge = new THREE.Group()
    hinge.position.set(side * leafWidth, DOOR.centerY, DOOR.wall)
    const leaf = new THREE.Mesh(leafGeometry, paint)
    leaf.position.set(-side * (leafWidth / 2), 0, DOOR.thickness / 2)
    leaf.castShadow = true
    leaf.receiveShadow = true
    const decal = new THREE.Mesh(halfPlane(leafWidth, DOOR.height, side < 0 ? 0 : 0.5, side < 0 ? 0.5 : 1), artMaterial)
    decal.position.set(-side * (leafWidth / 2), 0, DOOR.thickness + 0.002)
    decal.receiveShadow = true
    hinge.add(leaf, decal)
    group.add(hinge)
    return { hinge, side }
  })

  const interior = new THREE.Mesh(
    new THREE.PlaneGeometry(DOOR.width, DOOR.height),
    new THREE.MeshBasicMaterial({ map: canvasTexture(drawInterior(icon)) }),
  )
  interior.position.set(0, DOOR.centerY, DOOR.wall - 0.0005)
  interior.visible = false
  group.add(interior)

  const glowMaterial = new THREE.MeshBasicMaterial({
    map: canvasTexture(drawGlow()),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.width * 1.3, DOOR.height * 1.25), glowMaterial)
  glow.position.set(0, DOOR.centerY, DOOR.wall + 0.12)
  glow.visible = false
  group.add(glow)

  return {
    group,
    open(): void {
      interior.visible = true
      glow.visible = true
      for (const { hinge, side } of hinges) {
        // vantail gauche (charnière en -x) : angle négatif, vantail droit : positif ; tous deux s'ouvrent vers +z
        gsap.to(hinge.rotation, { y: side * OPEN_ANGLE, duration: 1.1, delay: side > 0 ? 0.08 : 0, ease: 'power3.out', overwrite: true })
      }
      gsap.to(glowMaterial, { opacity: 0.35, duration: 0.9, ease: 'power2.out', overwrite: true })
    },
    close(): void {
      for (const { hinge, side } of hinges) {
        gsap.to(hinge.rotation, {
          y: 0,
          duration: 0.6,
          delay: side > 0 ? 0 : 0.05,
          ease: 'power2.in',
          overwrite: true,
          onComplete: () => {
            if (side < 0) interior.visible = false
          },
        })
      }
      gsap.to(glowMaterial, {
        opacity: 0,
        duration: 0.4,
        overwrite: true,
        onComplete: () => {
          glow.visible = false
        },
      })
    },
  }
}
