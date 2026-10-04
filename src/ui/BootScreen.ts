import gsap from 'gsap'
import { CONTAINER_MARKINGS, type StatusTone } from '@/data/containers'
import { HOST, OF_NAME, PROFILE, SYSTEM } from '@/data/profile'

export interface BootScreen {
  /** Avancement du téléchargement du modèle, de 0 à 1. */
  setProgress(ratio: number): void
  /** Modèle chargé : la séquence continue jusqu'au bouton d'entrée. */
  done(): void
  /** Échec : la séquence s'arrête sur le message d'erreur. */
  fail(message: string): void
  /** Résolue quand le visiteur monte à bord (bouton ou Entrée). */
  readonly entered: Promise<void>
}

export interface BootScreenOptions {
  /** Nom de la carte graphique, affiché dans l'en-tête façon BIOS. */
  gpu: string
}

const TONE_CLASS: Record<StatusTone, string> = {
  ok: 'text-[#7ee787]',
  progress: 'text-[#f2cc60]',
  info: 'text-[#9ecbff]',
}

const PULL_BAR_WIDTH = 24
const FADE_MS = 600
/** Part de la barre globale : en-tête système, téléchargement réel, réseau, containers. */
const WEIGHT = { system: 0.1, pull: 0.6, network: 0.05, containers: 0.25 } as const

type Part = readonly [text: string, className?: string]

/**
 * Écran de démarrage : en-tête système (vraies infos du navigateur), `docker compose up` avec la vraie
 * progression du modèle 3D, démarrage des 9 containers, puis message d'accueil et bouton d'entrée.
 * « skip intro », Échap ou Entrée accélèrent tout ; le téléchargement, lui, reste réel.
 */
export function createBootScreen({ gpu }: BootScreenOptions): BootScreen {
  let fast = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let failed = false
  let pullRatio = 0
  let globalRatio = 0
  /** Animation en cours, terminée d'un coup par « skip intro ». */
  let active: gsap.core.Tween | null = null
  let resolveReady!: () => void
  const modelReady = new Promise<void>((resolve) => (resolveReady = resolve))
  let resolveEntered!: () => void
  const entered = new Promise<void>((resolve) => (resolveEntered = resolve))

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag)
    node.className = className
    node.textContent = text
    return node
  }

  const root = el(
    'div',
    'fixed inset-0 z-30 flex items-center justify-center bg-gradient-to-b from-[#1a6fd6] via-[#4fa6ee] to-[#cde9fb] p-4',
  )
  root.setAttribute('role', 'status')
  root.setAttribute('aria-live', 'polite')

  const win = el(
    'div',
    'flex h-full max-h-[560px] w-full max-w-[720px] flex-col rounded-xl bg-[#15171c]/95 font-mono text-[13px] leading-relaxed text-slate-200 shadow-2xl ring-1 ring-black/50',
  )

  // barre de titre façon macOS, comme le terminal du site
  const header = el('div', 'flex items-center gap-2 rounded-t-xl bg-[#24272e] px-3 py-2 text-xs text-slate-400')
  for (const color of ['bg-[#ff5f57]', 'bg-[#febc2e]', 'bg-[#28c840]']) header.append(el('span', `h-3 w-3 rounded-full ${color}`))
  header.append(el('span', 'flex-1 truncate text-center', `${PROFILE.user}@${HOST}: ~ — boot`))
  const skip = el(
    'button',
    'rounded border border-white/10 px-2 py-0.5 tracking-wider text-slate-500 transition-colors hover:border-white/30 hover:text-slate-200',
    '[ skip intro ]',
  )
  skip.type = 'button'
  header.append(skip)

  const body = el('div', 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 [scrollbar-width:none]')

  const footer = el('div', 'flex items-center gap-3 rounded-b-xl border-t border-white/5 bg-[#0f1115] px-5 py-2.5 text-[11px]')
  footer.append(el('span', 'tracking-[0.2em] text-slate-500', 'BOOT'))
  const track = el('div', 'h-1.5 flex-1 overflow-hidden rounded-full bg-white/10')
  const globalFill = el('div', 'h-full w-0 rounded-full bg-[#1aa2f2] transition-[width] duration-300 ease-out')
  track.append(globalFill)
  const globalLabel = el('span', 'min-w-[3ch] text-right text-slate-300', '0%')
  footer.append(track, globalLabel)

  win.append(header, body, footer)
  root.append(win)
  document.body.append(root)

  const scrollDown = (): void => {
    body.scrollTop = body.scrollHeight
  }

  const line = (...parts: Part[]): HTMLDivElement => {
    const row = el('div', 'min-h-[1.2em] whitespace-pre-wrap [overflow-wrap:anywhere]')
    for (const [text, className] of parts) row.append(el('span', className ?? '', text))
    body.append(row)
    scrollDown()
    return row
  }

  const wait = (ms: number): Promise<void> =>
    fast ? Promise.resolve() : new Promise((resolve) => window.setTimeout(resolve, ms))

  const setGlobal = (ratio: number): void => {
    globalRatio = Math.max(globalRatio, Math.min(1, ratio))
    const pct = Math.round(globalRatio * 100)
    globalFill.style.width = `${pct}%`
    globalLabel.textContent = `${pct}%`
  }

  let pullRow: HTMLDivElement | null = null
  const renderPull = (): void => {
    if (!pullRow) return
    const filled = Math.round(pullRatio * PULL_BAR_WIDTH)
    const bar = '='.repeat(Math.max(0, filled - 1)) + (filled > 0 ? '>' : '') + ' '.repeat(PULL_BAR_WIDTH - filled)
    pullRow.textContent = ` ⠿ docker-whale.glb  Downloading [${bar}] ${Math.round(pullRatio * 100)}%`
    setGlobal(WEIGHT.system + WEIGHT.pull * pullRatio)
  }

  const cores = navigator.hardwareConcurrency || 1
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  /** Pas de carte graphique : le navigateur dessine la 3D avec le processeur (accélération désactivée). */
  const software = /swiftshader|llvmpipe|software|basic render/i.test(gpu)
  const muted = 'text-slate-500'
  const value = 'text-slate-200'

  const systemLines: Part[][] = [
    [[`${SYSTEM} 2026.10 (Moby Dock)`, 'text-[#9ecbff]'], [`  ·  ${PROFILE.tagline}`, muted]],
    [['CPU  : ', muted], [`${cores} threads`, value], ['   ·   RAM : ', muted], [memory ? `${memory} GB OK` : 'OK', value]],
    [['GPU  : ', muted], [gpu, value]],
    [['DISP : ', muted], [`${window.innerWidth || screen.width}×${window.innerHeight || screen.height} @${window.devicePixelRatio}x`, value], ['   ·   NET : ', muted], ['bridge0', value]],
    [['─'.repeat(44), 'text-slate-700']],
  ]

  const startContainer = async (index: number): Promise<void> => {
    const marking = CONTAINER_MARKINGS[index]!
    const row = el('div', 'flex items-center gap-3 whitespace-nowrap')
    row.append(el('span', 'w-3 shrink-0 text-[#7ee787]', '✔'))
    row.append(el('span', 'w-[9ch] shrink-0 text-slate-200', marking.slug))
    const barTrack = el('div', 'hidden h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-white/10 sm:block')
    const barFill = el('div', 'h-full w-0 rounded-full bg-[#1aa2f2]')
    barTrack.append(barFill)
    row.append(barTrack)
    const pct = el('span', 'w-[4ch] shrink-0 text-right text-[11px] text-slate-500', '0%')
    row.append(pct)
    row.append(el('span', `truncate text-[11px] ${TONE_CLASS[marking.tone]}`, marking.status))
    body.append(row)
    scrollDown()

    const finish = (): void => {
      barFill.style.width = '100%'
      pct.textContent = '100%'
      pct.classList.replace('text-slate-500', 'text-slate-300')
    }
    if (fast) return finish()
    const state = { value: 0 }
    active = gsap.to(state, {
      value: 100,
      duration: 0.22,
      ease: 'power1.out',
      onUpdate: () => {
        if (fast) return
        barFill.style.width = `${state.value}%`
        pct.textContent = `${Math.round(state.value)}%`
      },
    })
    await active
    finish()
  }

  const showWelcome = async (): Promise<void> => {
    const block = el('div', 'mt-4 border-l-2 border-[#1aa2f2] py-1 pl-4 leading-[1.9]')
    const row = (...parts: Part[]): void => {
      const div = el('div')
      for (const [text, className] of parts) div.append(el('span', className ?? '', text))
      block.append(div)
    }
    // « d'Alice Martin », « de Moby Dock » : la préposition seule, puis le nom en gras
    const of = OF_NAME.slice(0, OF_NAME.length - PROFILE.name.length)
    row([`Bienvenue à bord du portfolio ${of}`, 'text-slate-200'], [PROFILE.name, 'font-bold text-white'])
    for (const text of PROFILE.welcome) row(['› ', 'text-[#1aa2f2]'], [text])
    row(['● ', 'text-[#7ee787]'], [`${CONTAINER_MARKINGS.length} containers UP · whale healthy · port 443`, 'text-[11px] text-slate-500'])
    body.append(block)
    scrollDown()
    if (fast) return
    active = gsap.from(block, { opacity: 0, x: -8, duration: 0.5, ease: 'power2.out' })
    await active
  }

  let enterButton: HTMLButtonElement | null = null
  const enter = (): void => {
    if (!enterButton) return
    enterButton = null
    window.removeEventListener('keydown', onKey)
    resolveEntered()
    gsap.to(win, { scale: 0.96, y: 12, duration: FADE_MS / 1000, ease: 'power2.in' })
    gsap.to(root, { opacity: 0, duration: FADE_MS / 1000, ease: 'power1.in', onComplete: () => root.remove() })
  }

  const showEnterButton = (): void => {
    const button = el(
      'button',
      'mx-auto mb-2 mt-6 block rounded-full border border-[#1aa2f2]/60 px-10 py-3 tracking-wide text-slate-100 transition-colors hover:border-[#1aa2f2] hover:bg-[#1aa2f2] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9ecbff]',
      'Monter à bord  ⏎',
    )
    button.type = 'button'
    button.addEventListener('click', enter)
    // conseil de performance, tout en bas, en gris discret
    const hint = software
      ? '⚠️ Rendu logiciel détecté : activez l\'accélération graphique de votre navigateur pour une scène fluide'
      : '⚠️ Ça lague ? Activez l\'accélération graphique de votre navigateur'
    body.append(button, el('div', 'mt-3 text-center text-[11px] text-slate-400/70', hint))
    scrollDown()
    skip.remove()
    enterButton = button
    button.focus({ preventScroll: true })
    if (!fast) gsap.from(button, { scale: 0, duration: 0.6, ease: 'back.out(1.7)' })
  }

  const accelerate = (): void => {
    fast = true
    active?.progress(1)
    skip.remove()
  }

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' && enterButton) {
      event.preventDefault()
      enter()
    } else if (event.key === 'Escape' || event.key === 'Enter') {
      accelerate()
    }
  }
  skip.addEventListener('click', accelerate)
  window.addEventListener('keydown', onKey)

  const run = async (): Promise<void> => {
    for (const parts of systemLines) {
      line(...parts)
      await wait(90)
    }
    setGlobal(WEIGHT.system)
    line()
    line(['$ ', 'text-[#7ee787]'], ['docker compose up -d', 'text-slate-100'])
    await wait(150)
    pullRow = line()
    pullRow.className += ' text-[#9ecbff]'
    renderPull()

    await modelReady
    if (failed) return
    pullRow.textContent = ' ✔ docker-whale.glb  Pull complete'
    pullRow.className = pullRow.className.replace('text-[#9ecbff]', 'text-[#7ee787]')
    setGlobal(WEIGHT.system + WEIGHT.pull)

    // réseau et volume au nom du projet Compose (le nom d'hôte), comme le ferait docker compose
    const resources = [
      ['Network', `${HOST}_bridge0`, 'Created'],
      ['Volume', `${HOST}_portfolio`, 'Created'],
      ['WebGL', 'renderer', 'Initialized'],
    ] as const
    const nameWidth = Math.max(...resources.map(([, name]) => name.length)) + 2
    for (const [kind, name, state] of resources) {
      line([' ✔ ', 'text-[#7ee787]'], [`${kind.padEnd(8)}`, 'text-slate-400'], [name.padEnd(nameWidth), 'text-slate-200'], [state, 'text-slate-400'])
      await wait(90)
    }
    setGlobal(WEIGHT.system + WEIGHT.pull + WEIGHT.network)
    line()

    const base = WEIGHT.system + WEIGHT.pull + WEIGHT.network
    for (let i = 0; i < CONTAINER_MARKINGS.length; i++) {
      await startContainer(i)
      setGlobal(base + (WEIGHT.containers * (i + 1)) / CONTAINER_MARKINGS.length)
      await wait(60)
    }

    await wait(200)
    await showWelcome()
    showEnterButton()
  }
  void run()

  return {
    setProgress(ratio: number): void {
      pullRatio = Math.min(1, Math.max(0, ratio))
      renderPull()
    },
    done(): void {
      pullRatio = 1
      renderPull()
      resolveReady()
    },
    fail(message: string): void {
      failed = true
      resolveReady()
      skip.remove()
      line()
      line([message, 'text-[#ff7b72]'])
    },
    entered,
  }
}
