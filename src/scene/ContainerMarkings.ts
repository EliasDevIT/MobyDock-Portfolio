import * as THREE from 'three'
import { BIC_COUNTRY_TYPE, BIC_OWNER, OWNER, imageDigest, type ContainerMarking, type StatusTone } from '@/data/containers'
import { OUTLINE, drawIcon } from './ContainerIcons'
import { canvasTexture, createCanvas, seededRandom } from './textures'

/**
 * Gabarit du container généré par assets-src (container_model.py), dans le repère local du nœud GLB :
 * long axe en z, grands côtés face à ±x, pied en y = 0.
 */
const CONTAINER = { ribOuterX: 1.282 } as const
/**
 * Portes (-z) : lettrage posé devant la tôle et les renforts (z = -4.55), sous les barres de verrouillage
 * comme sur un vrai container. Le bout +z (face à la caméra) porte le même lettrage sur ses vantaux ouvrants.
 */
const DOOR = { width: 2.3, height: 2.2, centerY: 1.3, z: 4.558 } as const
const DOOR_TEXTURE = { width: 1024, height: 980 } as const
/** Ondulation des grands côtés : 25 nervures de 0.17 réparties sur [-4.42, 4.42]. */
const RIBS = { start: -4.42, count: 25, gap: 0.3536, width: 0.17 } as const

/** Zone peinte sur chaque grand côté (unités du container) et résolution de la texture. */
const PANEL = { length: 8.3, bottom: 0.27 } as const
const TEXTURE = { width: 2048, height: 512 } as const
const PANEL_HEIGHT = (PANEL.length * TEXTURE.height) / TEXTURE.width

const PAINT = '#f2f5f7'
const INK = '#0d1117'
const TONES: Record<StatusTone, string> = { ok: '#2fbf71', progress: '#f2b632', info: '#22b8e6' }

/** Polices du site (index.html) : attendues avant de peindre, sinon le canvas prend la police de repli. */
const fontsReady: Promise<void> = Promise.all([
  document.fonts.load('700 150px Orbitron'),
  document.fonts.load('700 60px "JetBrains Mono"'),
  document.fonts.load('400 170px "Lilita One"'),
])
  .then(() => undefined)
  .catch(() => undefined)

/** Valeur ISO 6346 d'un caractère du code BIC (lettres de 10 à 38 sans les multiples de 11). */
function bicValue(char: string): number {
  if (/\d/.test(char)) return Number(char)
  let value = 10 + (char.charCodeAt(0) - 65)
  for (const skip of [11, 22, 33]) if (value >= skip) value += 1
  return value
}

/** Chiffre de contrôle ISO 6346 d'un code propriétaire (4 lettres) + numéro de série (6 chiffres). */
export function bicCheckDigit(code: string): number {
  const sum = [...code].reduce((total, char, i) => total + bicValue(char) * 2 ** i, 0)
  return (sum % 11) % 10
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, family: string, size: number, maxWidth: number): void {
  ctx.font = `700 ${size}px ${family}`
  const width = ctx.measureText(text).width
  if (width > maxWidth) ctx.font = `700 ${Math.floor((size * maxWidth) / width)}px ${family}`
}

/** Pictogrammes peints Code → Build → Ship → Run, de gauche à droite à partir de (x, y). */
function drawPipeline(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const step = 250
  const icon = 64
  ctx.strokeStyle = PAINT
  ctx.fillStyle = PAINT
  ctx.lineWidth = 7
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const labels = ['CODE', 'BUILD', 'SHIP', 'RUN']
  labels.forEach((label, i) => {
    const cx = x + i * step + icon / 2
    const top = y
    ctx.save()
    if (i === 0) {
      ctx.font = '700 58px "JetBrains Mono"'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('</>', cx, top + icon / 2)
    } else if (i === 1) {
      // caisse en perspective
      ctx.beginPath()
      ctx.moveTo(cx - 28, top + 18)
      ctx.lineTo(cx, top + 4)
      ctx.lineTo(cx + 28, top + 18)
      ctx.lineTo(cx + 28, top + 52)
      ctx.lineTo(cx, top + 66)
      ctx.lineTo(cx - 28, top + 52)
      ctx.closePath()
      ctx.moveTo(cx - 28, top + 18)
      ctx.lineTo(cx, top + 32)
      ctx.lineTo(cx + 28, top + 18)
      ctx.moveTo(cx, top + 32)
      ctx.lineTo(cx, top + 66)
      ctx.stroke()
    } else if (i === 2) {
      // coque et deux containers
      ctx.beginPath()
      ctx.moveTo(cx - 38, top + 36)
      ctx.lineTo(cx + 38, top + 36)
      ctx.lineTo(cx + 26, top + 62)
      ctx.lineTo(cx - 28, top + 62)
      ctx.closePath()
      ctx.stroke()
      ctx.strokeRect(cx - 24, top + 12, 20, 18)
      ctx.strokeRect(cx + 2, top + 12, 20, 18)
    } else {
      ctx.beginPath()
      ctx.moveTo(cx - 20, top + 6)
      ctx.lineTo(cx + 30, top + icon / 2)
      ctx.lineTo(cx - 20, top + icon - 2)
      ctx.closePath()
      ctx.fill()
    }
    ctx.font = '700 30px "JetBrains Mono"'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(label, cx, top + icon + 46)
    ctx.restore()
    if (i < labels.length - 1) {
      // flèche vers l'étape suivante
      const ax = cx + icon / 2 + 40
      const ay = top + icon / 2
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(ax + 70, ay)
      ctx.moveTo(ax + 56, ay - 14)
      ctx.lineTo(ax + 72, ay)
      ctx.lineTo(ax + 56, ay + 14)
      ctx.stroke()
    }
  })
}

/** Couche peinte au pochoir : nom, identifiant, code BIC, mentions techniques ou schéma. */
function paintLayer(data: ContainerMarking): HTMLCanvasElement {
  const { width, height } = TEXTURE
  const { canvas, ctx } = createCanvas(width, height)
  const margin = 70
  ctx.fillStyle = PAINT
  ctx.textBaseline = 'alphabetic'

  // nom de la section et identifiant maison
  fitFont(ctx, data.name, 'Orbitron', 150, 1250)
  ctx.fillText(data.name, margin, 205)
  fitFont(ctx, data.tag, '"JetBrains Mono"', 54, 1250)
  ctx.fillText(data.tag, margin + 4, 285)

  // code BIC : propriétaire + série, chiffre de contrôle encadré, puis pays et type ISO
  const code = `${BIC_OWNER}${data.serial}`
  const box = { w: 72, h: 84 }
  const boxX = width - margin - box.w
  ctx.font = '700 72px "JetBrains Mono"'
  ctx.textAlign = 'right'
  ctx.fillText(`${BIC_OWNER} ${data.serial}`, boxX - 22, 122)
  ctx.lineWidth = 6
  ctx.strokeStyle = PAINT
  ctx.strokeRect(boxX, 56, box.w, box.h)
  ctx.textAlign = 'center'
  ctx.fillText(String(bicCheckDigit(code)), boxX + box.w / 2, 122)
  ctx.textAlign = 'right'
  ctx.font = '700 62px "JetBrains Mono"'
  ctx.fillText(BIC_COUNTRY_TYPE, width - margin, 212)
  ctx.textAlign = 'left'

  if (data.pipeline) {
    drawPipeline(ctx, margin + 10, 330)
  } else {
    ctx.font = '600 34px "JetBrains Mono"'
    ctx.fillText('MAX. GROSS  30.480 KG   67.200 LB', margin + 4, 408)
    ctx.fillText('TARE         2.200 KG    4.850 LB', margin + 4, 452)
  }

  // la peinture suit la tôle : plus sombre dans les creux entre les nervures
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillStyle = 'rgba(20, 30, 45, 0.32)'
  const toPx = (z: number): number => ((z + PANEL.length / 2) / PANEL.length) * width
  let previousEnd = RIBS.start - 1
  for (let i = 0; i <= RIBS.count; i++) {
    const center = RIBS.start + RIBS.gap * (i + 0.5)
    const ribStart = i < RIBS.count ? center - RIBS.width / 2 : PANEL.length
    ctx.fillRect(toPx(previousEnd), 0, toPx(ribStart) - toPx(previousEnd), height)
    previousEnd = center + RIBS.width / 2
  }

  // usure : petites écailles de peinture manquantes
  ctx.globalCompositeOperation = 'destination-out'
  const random = seededRandom(Number(data.serial))
  for (let i = 0; i < 900; i++) {
    ctx.globalAlpha = 0.3 + random() * 0.7
    ctx.beginPath()
    ctx.arc(random() * width, random() * height, 1 + random() * 3.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  return canvas
}

/** Étiquette de statut, collée par-dessus la peinture (nette, sans usure). */
function drawStatus(ctx: CanvasRenderingContext2D, data: ContainerMarking): void {
  const w = 520
  const h = 116
  const x = TEXTURE.width - 70 - w
  const y = 336
  ctx.fillStyle = TONES[data.tone]
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 16)
  ctx.fill()
  ctx.fillStyle = INK
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  fitFont(ctx, `● ${data.status}`, '"JetBrains Mono"', 60, w - 50)
  ctx.fillText(`● ${data.status}`, x + w / 2, y + h / 2 + 3)
}

/** Petite plaque métallique rivetée (plaque de sécurité CSC) : propriétaire, mise à jour, version. */
function drawSafetyPlate(ctx: CanvasRenderingContext2D, data: ContainerMarking): void {
  const plate = { x: 54, y: 810, w: 330, h: 138, r: 10 }
  const metal = ctx.createLinearGradient(plate.x, plate.y, plate.x + plate.w, plate.y + plate.h)
  metal.addColorStop(0, '#dfe5ea')
  metal.addColorStop(0.5, '#c3ccd4')
  metal.addColorStop(1, '#d6dde3')
  ctx.fillStyle = metal
  ctx.strokeStyle = '#7d8a96'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.roundRect(plate.x, plate.y, plate.w, plate.h, plate.r)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#7d8a96'
  for (const [x, y] of [[plate.x + 13, plate.y + 13], [plate.x + plate.w - 13, plate.y + 13], [plate.x + 13, plate.y + plate.h - 13], [plate.x + plate.w - 13, plate.y + plate.h - 13]] as const) {
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#1d2730'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = '700 22px "JetBrains Mono"'
  ctx.fillText('CSC SAFETY APPROVAL', plate.x + 30, plate.y + 38)
  ctx.fillRect(plate.x + 30, plate.y + 48, plate.w - 60, 2)
  ctx.font = '700 19px "JetBrains Mono"'
  const rows: [string, string][] = [
    ['OWNER', OWNER],
    ['UPDATED', data.updated],
    ['VERSION', `v${data.version}`],
  ]
  rows.forEach(([label, value], i) => {
    const y = plate.y + 76 + i * 25
    ctx.fillText(label, plate.x + 30, y)
    ctx.fillText(value, plate.x + 130, y)
  })
}

/** Porte : position de chargement, nom en lettrage cartoon (blanc cerné de sombre), pictogramme, plaque et image. */
function drawDoor(canvas: HTMLCanvasElement, data: ContainerMarking, digest: string): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width, height } = DOOR_TEXTURE
  ctx.clearRect(0, 0, width, height)

  // position de chargement, au pochoir, en haut
  const { bay, row, tier } = data.position
  ctx.fillStyle = 'rgba(244, 247, 250, 0.85)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = '700 34px "JetBrains Mono"'
  ctx.fillText(`BAY ${bay} · ROW ${row} · TIER ${tier}`, width / 2, 62)

  const lines = data.door
  const size = lines.length > 1 ? 145 : 175
  const baselines = lines.length > 1 ? [235, 380] : [285]
  ctx.lineJoin = 'round'
  lines.forEach((line, i) => {
    ctx.font = `400 ${size}px "Lilita One"`
    const measured = ctx.measureText(line).width
    if (measured > width - 120) ctx.font = `400 ${Math.floor((size * (width - 120)) / measured)}px "Lilita One"`
    const y = baselines[i] ?? 285
    // ombre portée, contour épais, puis remplissage blanc
    ctx.fillStyle = 'rgba(10, 18, 26, 0.35)'
    ctx.fillText(line, width / 2 + 8, y + 10)
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 22
    ctx.strokeText(line, width / 2, y)
    ctx.fillStyle = '#f4f7fa'
    ctx.fillText(line, width / 2, y)
  })
  const iconSize = lines.length > 1 ? 280 : 330
  drawIcon(ctx, data.icon, width / 2, lines.length > 1 ? 600 : 580, iconSize)

  drawSafetyPlate(ctx, data)

  // image et empreinte, au pochoir, en bas à droite
  ctx.fillStyle = 'rgba(244, 247, 250, 0.85)'
  ctx.textAlign = 'right'
  ctx.font = '700 30px "JetBrains Mono"'
  ctx.fillText(data.image, width - 56, 880)
  ctx.font = '600 24px "JetBrains Mono"'
  ctx.fillText(digest ? `sha256:${digest.slice(0, 12)}` : '', width - 56, 922)
}

function drawMarking(canvas: HTMLCanvasElement, data: ContainerMarking): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(paintLayer(data), 0, 0)
  drawStatus(ctx, data)
}

export interface ContainerMarkings {
  group: THREE.Group
  /** Lettrage des portes, aussi porté par les vantaux ouvrants du bout +z (ContainerDoors). */
  doorArt: THREE.CanvasTexture
}

/**
 * Marquage des deux grands côtés d'un container (un plan texturé posé sur la crête des nervures, de
 * chaque côté, lisible de l'extérieur) et lettrage des portes du bout -z. Le bout +z reçoit le même
 * lettrage sur ses vantaux ouvrants (`doorArt`).
 */
export function createContainerMarkings(data: ContainerMarking): ContainerMarkings {
  const group = new THREE.Group()
  group.name = `${data.slot}_markings`
  const { canvas } = createCanvas(TEXTURE.width, TEXTURE.height)
  const texture = canvasTexture(canvas)
  const door = createCanvas(DOOR_TEXTURE.width, DOOR_TEXTURE.height).canvas
  const doorTexture = canvasTexture(door)
  let digest = ''
  const paint = (): void => {
    drawMarking(canvas, data)
    drawDoor(door, data, digest)
    texture.needsUpdate = true
    doorTexture.needsUpdate = true
  }
  paint()
  void Promise.all([fontsReady, imageDigest(data.image)]).then(([, hash]) => {
    digest = hash
    paint()
  })

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    roughness: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  const geometry = new THREE.PlaneGeometry(PANEL.length, PANEL_HEIGHT)
  for (const side of [1, -1] as const) {
    const panel = new THREE.Mesh(geometry, material)
    panel.name = `${data.slot}_marking_${side > 0 ? 'back' : 'front'}`
    // +x : face à la queue, -x : face au nez ; le texte se lit de gauche à droite vu de l'extérieur
    panel.rotation.y = side * (Math.PI / 2)
    panel.position.set(side * (CONTAINER.ribOuterX + 0.006), PANEL.bottom + PANEL_HEIGHT / 2, 0)
    panel.receiveShadow = true
    group.add(panel)
  }

  const doorMaterial = material.clone()
  doorMaterial.map = doorTexture
  // portes à barres du bout -z, lisibles de l'extérieur
  const doors = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.width, DOOR.height), doorMaterial)
  doors.name = `${data.slot}_marking_doors`
  doors.rotation.y = Math.PI
  doors.position.set(0, DOOR.centerY, -DOOR.z)
  doors.receiveShadow = true
  group.add(doors)
  return { group, doorArt: doorTexture }
}

