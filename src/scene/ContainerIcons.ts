/**
 * Pictogrammes des portes de containers, dessinés au canvas dans un style illustré : aplats de couleur
 * cernés d'un contour sombre, comme le lettrage. Chaque icône est centrée en (0, 0) et tient dans un
 * carré de 2 × 2 unités ; `drawIcon` la met à l'échelle.
 */
export type ContainerIcon = 'document' | 'gears' | 'rocket' | 'cloud' | 'flask' | 'terminal' | 'envelope' | 'padel' | 'gamepad'

export const OUTLINE = '#22313c'
const WHITE = '#f4f7fa'
const GREY = '#c9d3dc'

type Ctx = CanvasRenderingContext2D

function shape(ctx: Ctx, fill: string, path: () => void): void {
  ctx.beginPath()
  path()
  ctx.fillStyle = fill
  ctx.fill('evenodd')
  ctx.stroke()
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.roundRect(x, y, w, h, r)
}

function gear(ctx: Ctx, cx: number, cy: number, r: number, teeth: number, fill: string): void {
  shape(ctx, fill, () => {
    const inner = r * 0.78
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2
      const half = Math.PI / teeth
      const points: [number, number][] = [
        [inner, a - half * 0.95],
        [r, a - half * 0.5],
        [r, a + half * 0.5],
        [inner, a + half * 0.95],
      ]
      points.forEach(([radius, angle], k) => {
        const x = cx + Math.cos(angle) * radius
        const y = cy + Math.sin(angle) * radius
        if (i === 0 && k === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
    }
    ctx.closePath()
    ctx.moveTo(cx + r * 0.32, cy)
    ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2)
  })
}

const ICONS: Record<ContainerIcon, (ctx: Ctx) => void> = {
  document(ctx) {
    shape(ctx, WHITE, () => {
      ctx.moveTo(-0.62, -0.9)
      ctx.lineTo(0.3, -0.9)
      ctx.lineTo(0.66, -0.54)
      ctx.lineTo(0.66, 0.9)
      ctx.lineTo(-0.62, 0.9)
      ctx.closePath()
    })
    shape(ctx, GREY, () => {
      ctx.moveTo(0.3, -0.9)
      ctx.lineTo(0.3, -0.54)
      ctx.lineTo(0.66, -0.54)
      ctx.closePath()
    })
    // photo et lignes de texte
    shape(ctx, '#2496ed', () => roundRect(ctx, -0.44, -0.66, 0.38, 0.42, 0.06))
    ctx.fillStyle = OUTLINE
    for (const [x, y, w] of [[0.02, -0.56, 0.4], [0.02, -0.36, 0.3], [-0.44, -0.06, 0.88], [-0.44, 0.16, 0.88], [-0.44, 0.38, 0.62], [-0.44, 0.6, 0.76]] as const) {
      ctx.fillRect(x, y - 0.04, w, 0.08)
    }
  },
  gears(ctx) {
    gear(ctx, -0.28, 0.22, 0.62, 10, GREY)
    gear(ctx, 0.5, -0.46, 0.42, 8, '#f2b632')
  },
  rocket(ctx) {
    ctx.save()
    ctx.rotate(Math.PI / 4)
    shape(ctx, '#f2b632', () => {
      ctx.moveTo(-0.2, 0.62)
      ctx.lineTo(0, 1.0)
      ctx.lineTo(0.2, 0.62)
      ctx.closePath()
    })
    shape(ctx, '#e8553d', () => {
      ctx.moveTo(-0.26, 0.2)
      ctx.lineTo(-0.56, 0.66)
      ctx.lineTo(-0.24, 0.6)
      ctx.closePath()
      ctx.moveTo(0.26, 0.2)
      ctx.lineTo(0.56, 0.66)
      ctx.lineTo(0.24, 0.6)
      ctx.closePath()
    })
    shape(ctx, WHITE, () => {
      ctx.moveTo(0, -1.0)
      ctx.bezierCurveTo(0.42, -0.6, 0.38, 0.2, 0.26, 0.62)
      ctx.lineTo(-0.26, 0.62)
      ctx.bezierCurveTo(-0.38, 0.2, -0.42, -0.6, 0, -1.0)
      ctx.closePath()
    })
    shape(ctx, '#2496ed', () => ctx.arc(0, -0.2, 0.16, 0, Math.PI * 2))
    ctx.restore()
  },
  cloud(ctx) {
    // baie de serveurs sous un nuage
    shape(ctx, '#3c4752', () => roundRect(ctx, -0.6, -0.05, 1.2, 0.95, 0.08))
    for (const y of [0.08, 0.38, 0.68]) {
      shape(ctx, GREY, () => roundRect(ctx, -0.48, y - 0.02, 0.96, 0.2, 0.04))
      ctx.fillStyle = '#2fbf71'
      ctx.beginPath()
      ctx.arc(0.32, y + 0.08, 0.05, 0, Math.PI * 2)
      ctx.fill()
    }
    shape(ctx, WHITE, () => {
      ctx.moveTo(-0.7, -0.22)
      ctx.arc(-0.48, -0.42, 0.3, Math.PI * 0.6, Math.PI * 1.5)
      ctx.arc(0.02, -0.64, 0.42, Math.PI * 1.1, Math.PI * 1.95)
      ctx.arc(0.5, -0.38, 0.3, Math.PI * 1.5, Math.PI * 0.45)
      ctx.closePath()
    })
  },
  flask(ctx) {
    const glass = (): void => {
      ctx.moveTo(-0.2, -0.88)
      ctx.lineTo(0.2, -0.88)
      ctx.lineTo(0.2, -0.3)
      ctx.lineTo(0.72, 0.72)
      ctx.quadraticCurveTo(0.78, 0.9, 0.56, 0.9)
      ctx.lineTo(-0.56, 0.9)
      ctx.quadraticCurveTo(-0.78, 0.9, -0.72, 0.72)
      ctx.lineTo(-0.2, -0.3)
      ctx.closePath()
    }
    shape(ctx, '#d6ecf7', glass)
    ctx.save()
    ctx.beginPath()
    glass()
    ctx.clip()
    ctx.fillStyle = '#2fbf71'
    ctx.fillRect(-1, 0.2, 2, 1)
    ctx.restore()
    ctx.beginPath()
    glass()
    ctx.stroke()
    ctx.fillStyle = WHITE
    for (const [x, y, r] of [[-0.18, 0.5, 0.08], [0.2, 0.62, 0.06], [0.04, 0.36, 0.05]] as const) {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    shape(ctx, GREY, () => roundRect(ctx, -0.3, -1.0, 0.6, 0.16, 0.05))
  },
  terminal(ctx) {
    shape(ctx, '#1b232b', () => roundRect(ctx, -0.92, -0.72, 1.84, 1.44, 0.14))
    shape(ctx, GREY, () => ctx.roundRect(-0.92, -0.72, 1.84, 0.3, [0.14, 0.14, 0, 0]))
    ;['#e8553d', '#f2b632', '#2fbf71'].forEach((color, i) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(-0.72 + i * 0.2, -0.57, 0.06, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.strokeStyle = '#2fbf71'
    ctx.beginPath()
    ctx.moveTo(-0.6, -0.12)
    ctx.lineTo(-0.28, 0.12)
    ctx.lineTo(-0.6, 0.36)
    ctx.stroke()
    ctx.fillStyle = '#2fbf71'
    ctx.fillRect(-0.14, 0.32, 0.5, 0.1)
    ctx.strokeStyle = OUTLINE
  },
  envelope(ctx) {
    shape(ctx, WHITE, () => roundRect(ctx, -0.92, -0.6, 1.84, 1.2, 0.08))
    ctx.beginPath()
    ctx.moveTo(-0.88, -0.54)
    ctx.lineTo(0, 0.12)
    ctx.lineTo(0.88, -0.54)
    ctx.moveTo(-0.88, 0.54)
    ctx.lineTo(-0.26, -0.06)
    ctx.moveTo(0.88, 0.54)
    ctx.lineTo(0.26, -0.06)
    ctx.stroke()
  },
  padel(ctx) {
    ctx.save()
    ctx.rotate(-Math.PI / 6)
    shape(ctx, '#3c4752', () => roundRect(ctx, -0.11, 0.28, 0.22, 0.72, 0.08))
    shape(ctx, '#22b8e6', () => {
      ctx.ellipse(0, -0.3, 0.52, 0.64, 0, 0, Math.PI * 2)
    })
    ctx.fillStyle = OUTLINE
    for (let row = -2; row <= 2; row++) {
      for (let col = -2; col <= 2; col++) {
        const x = col * 0.17
        const y = -0.3 + row * 0.2
        if ((x * x) / 0.16 + ((y + 0.3) * (y + 0.3)) / 0.26 > 1) continue
        ctx.beginPath()
        ctx.arc(x, y, 0.035, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
    shape(ctx, '#d9f24a', () => ctx.arc(0.62, 0.52, 0.24, 0, Math.PI * 2))
  },
  gamepad(ctx) {
    // manette : corps blanc à deux poignées, croix directionnelle, boutons start/select et quatre boutons colorés
    shape(ctx, WHITE, () => {
      ctx.moveTo(-0.42, -0.52)
      ctx.lineTo(0.42, -0.52)
      ctx.bezierCurveTo(0.8, -0.52, 0.94, -0.28, 0.98, 0.08)
      ctx.bezierCurveTo(1.02, 0.44, 0.92, 0.64, 0.72, 0.64)
      ctx.bezierCurveTo(0.54, 0.64, 0.46, 0.44, 0.34, 0.28)
      ctx.lineTo(-0.34, 0.28)
      ctx.bezierCurveTo(-0.46, 0.44, -0.54, 0.64, -0.72, 0.64)
      ctx.bezierCurveTo(-0.92, 0.64, -1.02, 0.44, -0.98, 0.08)
      ctx.bezierCurveTo(-0.94, -0.28, -0.8, -0.52, -0.42, -0.52)
      ctx.closePath()
    })
    ctx.fillStyle = '#3c4752'
    ctx.beginPath()
    ctx.rect(-0.6, -0.32, 0.17, 0.5)
    ctx.rect(-0.76, -0.155, 0.49, 0.17)
    ctx.fill()
    ctx.fillStyle = GREY
    for (const x of [-0.17, 0.03]) {
      ctx.beginPath()
      ctx.roundRect(x, 0.02, 0.14, 0.07, 0.035)
      ctx.fill()
    }
    for (const [x, y, color] of [[0.54, -0.3, '#2fbf71'], [0.75, -0.08, '#e8553d'], [0.54, 0.14, '#2496ed'], [0.33, -0.08, '#f2b632']] as const) {
      ctx.beginPath()
      ctx.arc(x, y, 0.105, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    }
  },
}

/** Dessine l'icône centrée en (x, y), de côté `size` pixels. */
export function drawIcon(ctx: Ctx, icon: ContainerIcon, x: number, y: number, size: number): void {
  const scale = size / 2
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.lineWidth = 9 / scale
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = OUTLINE
  ICONS[icon](ctx)
  ctx.restore()
}
