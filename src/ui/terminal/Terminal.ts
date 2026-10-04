import { HOST, PROFILE, SYSTEM } from '@/data/profile'
import { createShell, type OutputLine, type ShellHooks, type ShellPrompt } from './shell'

/** utilisateur@hôte de l'invite et du titre de la fenêtre. */
const USER_AT_HOST = `${PROFILE.user}@${HOST}`

export interface Terminal {
  /** Ouvre la fenêtre si besoin, tape et exécute la commande comme si l'utilisateur l'avait saisie. */
  execute(command: string): Promise<void>
  open(): void
  /** Réduit la fenêtre à sa barre de titre (ou la rétablit) ; renvoie l'état précédent. */
  setMinimized(minimized: boolean): boolean
}

const TONES: Record<NonNullable<OutputLine['tone']> | 'default', string> = {
  default: 'text-[#9ecbff]',
  muted: 'text-slate-400',
  error: 'text-[#ff7b72]',
  ok: 'text-[#7ee787]',
  accent: 'text-[#d2a8ff]',
  warn: 'text-[#f2cc60]',
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** Invite colorée : utilisateur@hôte en vert et dossier en bleu, ou nom du jeu en cours en jaune. */
function prompt(state: ShellPrompt): HTMLSpanElement {
  const span = el('span', 'shrink-0')
  if (state.kind === 'program') {
    span.append(el('span', 'text-[#f2cc60]', state.label), el('span', 'text-slate-300', ' › '))
    return span
  }
  const { cwd } = state
  // espace insécable : une espace ordinaire en fin d'élément serait supprimée dans une ligne flex
  span.append(el('span', 'text-[#7ee787]', USER_AT_HOST),el('span', 'text-slate-300', ':'), el('span', 'text-[#79c0ff]', cwd), el('span', 'text-slate-300', '$\u00a0'))
  return span
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Marge au bord de l'écran, taille minimale de la fenêtre et taille de départ. */
const MARGIN = 16
const MIN_SIZE = { w: 320, h: 140 } as const
const START_SIZE = { w: 560, h: 300 } as const
/**
 * Poignées de redimensionnement sur les 4 bords et les 4 coins : sens dans lequel chacune agrandit la
 * fenêtre (0 = cet axe ne bouge pas). Elles débordent un peu du bord pour être faciles à attraper.
 */
const RESIZE_HANDLES = [
  { x: 0, y: -1, className: '-top-1 inset-x-3 h-2 cursor-ns-resize' },
  { x: 0, y: 1, className: '-bottom-1 inset-x-3 h-2 cursor-ns-resize' },
  { x: -1, y: 0, className: '-left-1 inset-y-3 w-2 cursor-ew-resize' },
  { x: 1, y: 0, className: '-right-1 inset-y-3 w-2 cursor-ew-resize' },
  { x: -1, y: -1, className: '-left-1 -top-1 h-5 w-5 cursor-nwse-resize' },
  { x: 1, y: -1, className: '-right-1 -top-1 h-5 w-5 cursor-nesw-resize' },
  { x: -1, y: 1, className: '-bottom-1 -left-1 h-5 w-5 cursor-nesw-resize' },
  { x: 1, y: 1, className: '-bottom-1 -right-1 h-5 w-5 cursor-nwse-resize' },
] as const

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), Math.max(min, max))

/**
 * Terminal façon macOS, en bas à droite au départ : vraies commandes Linux de base et Docker (simulées),
 * historique (↑/↓) et complétion (Tab). Se déplace par la barre de titre et se redimensionne par les
 * bords et les coins. Pastille rouge : fermer (un bouton permet de rouvrir), jaune : réduire à la barre de titre,
 * verte (ou double-clic sur la barre) : plein écran / taille précédente.
 */
export function createTerminal(hooks: Omit<ShellHooks, 'onExit'> = {}): Terminal {
  const root = el(
    'section',
    // pas d'overflow-hidden ici : il rognerait aussi la zone cliquable des coins arrondis
    'fixed z-20 flex flex-col rounded-xl bg-[#15171c]/95 font-mono text-[13px] leading-[1.45] shadow-2xl ring-1 ring-black/50 backdrop-blur-sm',
  )
  root.setAttribute('aria-label', 'Terminal')

  const bar = el('header', 'relative flex h-8 shrink-0 cursor-grab touch-none items-center gap-2 rounded-t-xl bg-[#23262d] px-3 select-none active:cursor-grabbing')
  const dot = (color: string, label: string): HTMLButtonElement => {
    const button = el('button', `h-3 w-3 rounded-full ${color} hover:brightness-110 focus:outline-none`)
    button.type = 'button'
    button.setAttribute('aria-label', label)
    return button
  }
  const closeButton = dot('bg-[#ff5f57]', 'Fermer le terminal')
  const minimizeButton = dot('bg-[#febc2e]', 'Réduire le terminal')
  const zoomButton = dot('bg-[#28c840]', 'Agrandir le terminal')
  const title = el('span', 'pointer-events-none absolute inset-x-0 text-center text-xs text-slate-400', `${USER_AT_HOST}: ~`)
  bar.append(closeButton, minimizeButton, zoomButton, title)

  const body = el('div', 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-b-xl px-4 py-3')
  // retour à la ligne selon la largeur de la fenêtre ; espaces d'alignement conservés, mots trop longs coupés
  const output = el('div', 'whitespace-pre-wrap [overflow-wrap:anywhere]')
  const inputRow = el('label', 'flex items-baseline')
  const input = el('input', 'min-w-0 flex-1 bg-transparent text-slate-100 caret-[#7ee787] outline-none')
  input.type = 'text'
  input.spellcheck = false
  input.autocomplete = 'off'
  input.setAttribute('aria-label', 'Commande')
  body.append(output, inputRow)
  root.append(bar, body)
  const handles = RESIZE_HANDLES.map((corner) => {
    const handle = el('div', `absolute z-10 touch-none ${corner.className}`)
    root.append(handle)
    return { handle, corner }
  })

  const reopen = el(
    'button',
    'fixed bottom-4 right-4 z-20 hidden rounded-lg bg-[#15171c]/95 px-3 py-2 font-mono text-xs text-[#7ee787] shadow-xl ring-1 ring-black/50',
    '>_ terminal',
  )
  reopen.type = 'button'
  document.body.append(root, reopen)

  const shell = createShell({
    ...hooks,
    onExit: () => setOpen(false),
  })
  const history: string[] = []
  let historyIndex = 0
  let busy = false

  const scrollToEnd = (): void => {
    body.scrollTop = body.scrollHeight
  }

  /** Met à jour l'invite sans retirer le champ de saisie du DOM (il garderait sinon pas le focus). */
  const renderPrompt = (): void => {
    const state = shell.prompt()
    const current = inputRow.firstElementChild
    const next = prompt(state)
    if (current && current !== input) current.replaceWith(next)
    else inputRow.prepend(next)
    if (!input.isConnected) inputRow.append(input)
    title.textContent = `${USER_AT_HOST}: ${state.kind === 'shell' ? state.cwd : state.label}`
  }

  const print = (lines: readonly OutputLine[]): void => {
    for (const line of lines) output.append(el('div', TONES[line.tone ?? 'default'], line.text || ' '))
  }

  const echoCommand = (command: string): void => {
    const row = el('div', 'flex')
    row.append(prompt(shell.prompt()), el('span', 'text-slate-100', command))
    output.append(row)
  }

  const submit = async (command: string): Promise<void> => {
    if (busy) return
    busy = true
    echoCommand(command)
    // pendant un jeu, les réponses (a, b, c…) ne vont pas dans l'historique des commandes
    const inShell = shell.prompt().kind === 'shell'
    if (inShell && command.trim()) {
      history.push(command.trim())
      historyIndex = history.length
    }
    if (inShell && command.trim() === 'clear') output.replaceChildren()
    else print(await shell.run(command))
    input.value = ''
    renderPrompt()
    scrollToEnd()
    busy = false
    // le curseur reste dans le terminal d'une commande à l'autre
    if (!root.classList.contains('hidden')) input.focus({ preventScroll: true })
  }

  // ——— fenêtre : position, taille, plein écran, réduction ———
  let rect: Rect = { x: 0, y: 0, w: START_SIZE.w, h: START_SIZE.h }
  let restore: Rect | null = null
  let minimized = false
  /** Tant que l'utilisateur n'a ni déplacé ni redimensionné la fenêtre, elle reste ancrée en bas à droite. */
  let anchored = true

  const fit = (): void => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (anchored) {
      rect.w = Math.min(START_SIZE.w, vw - MARGIN * 2)
      rect.h = Math.min(START_SIZE.h, vh - MARGIN * 2)
      rect.x = vw - rect.w - MARGIN
      rect.y = vh - (minimized ? bar.offsetHeight : rect.h) - MARGIN
    }
    rect.w = clamp(rect.w, Math.min(MIN_SIZE.w, vw), vw)
    rect.h = clamp(rect.h, Math.min(MIN_SIZE.h, vh), vh)
    rect.x = clamp(rect.x, 0, vw - rect.w)
    rect.y = clamp(rect.y, 0, vh - (minimized ? bar.offsetHeight : rect.h))
  }

  const apply = (): void => {
    fit()
    root.style.left = `${rect.x}px`
    root.style.top = `${rect.y}px`
    root.style.width = `${rect.w}px`
    root.style.height = minimized ? '' : `${rect.h}px`
    body.classList.toggle('hidden', minimized)
    bar.classList.toggle('rounded-b-xl', minimized)
    // réduite à la barre de titre : seule la largeur reste réglable
    for (const { handle, corner } of handles) handle.classList.toggle('hidden', minimized && corner.y !== 0)
  }

  const toggleMaximize = (): void => {
    minimized = false
    anchored = false
    if (restore) {
      rect = restore
      restore = null
    } else {
      restore = { ...rect }
      rect = { x: MARGIN, y: MARGIN, w: window.innerWidth - MARGIN * 2, h: window.innerHeight - MARGIN * 2 }
    }
    apply()
    scrollToEnd()
  }

  /** Suit le pointeur depuis l'appui jusqu'au relâché, en bloquant la sélection de texte pendant le geste. */
  const track = (event: PointerEvent, onMove: (dx: number, dy: number) => void): void => {
    const target = event.currentTarget as HTMLElement
    const start = { x: event.clientX, y: event.clientY }
    target.setPointerCapture(event.pointerId)
    document.body.style.userSelect = 'none'
    const move = (e: PointerEvent): void => onMove(e.clientX - start.x, e.clientY - start.y)
    const end = (): void => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', end)
      target.removeEventListener('pointercancel', end)
      document.body.style.userSelect = ''
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', end)
    target.addEventListener('pointercancel', end)
  }

  bar.addEventListener('pointerdown', (event) => {
    if ((event.target as HTMLElement).closest('button')) return
    const from = { ...rect }
    track(event, (dx, dy) => {
      anchored = false
      restore = null
      rect.x = from.x + dx
      rect.y = from.y + dy
      apply()
    })
  })
  bar.addEventListener('dblclick', (event) => {
    if (!(event.target as HTMLElement).closest('button')) toggleMaximize()
  })
  for (const { handle, corner } of handles) {
    handle.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
      if (corner.y !== 0) minimized = false
      restore = null
      anchored = false
      const from = { ...rect }
      track(event, (dx, dy) => {
        // le bord opposé reste fixe ; un axe à 0 ne bouge pas
        const w = clamp(from.w + corner.x * dx, MIN_SIZE.w, window.innerWidth)
        const h = clamp(from.h + corner.y * dy, MIN_SIZE.h, window.innerHeight)
        rect.w = w
        rect.h = h
        rect.x = corner.x < 0 ? from.x + from.w - w : from.x
        rect.y = corner.y < 0 ? from.y + from.h - h : from.y
        apply()
      })
    })
  }
  window.addEventListener('resize', () => {
    if (restore) rect = { x: MARGIN, y: MARGIN, w: window.innerWidth - MARGIN * 2, h: window.innerHeight - MARGIN * 2 }
    apply()
  })

  const setOpen = (open: boolean): void => {
    root.classList.toggle('hidden', !open)
    reopen.classList.toggle('hidden', open)
    if (open) input.focus({ preventScroll: true })
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void submit(input.value)
    } else if (event.key === 'Tab') {
      event.preventDefault()
      input.value = shell.complete(input.value)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === 'ArrowUp' ? -1 : 1)))
      input.value = history[historyIndex] ?? ''
    } else if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault()
      output.replaceChildren()
    } else if (event.key === 'c' && event.ctrlKey && input.selectionStart === input.selectionEnd && !window.getSelection()?.toString()) {
      // Ctrl+C sans texte sélectionné : abandonne la ligne, ou quitte le jeu en cours
      event.preventDefault()
      echoCommand(`${input.value}^C`)
      print(shell.interrupt())
      input.value = ''
      renderPrompt()
      scrollToEnd()
    }
  })
  body.addEventListener('click', () => {
    if (!window.getSelection()?.toString()) input.focus({ preventScroll: true })
  })
  closeButton.addEventListener('click', () => setOpen(false))
  reopen.addEventListener('click', () => setOpen(true))
  minimizeButton.addEventListener('click', () => {
    minimized = !minimized
    apply()
  })
  zoomButton.addEventListener('click', toggleMaximize)

  apply()
  // la page peut ne pas encore avoir sa taille au premier appel : on replace à l'image suivante
  requestAnimationFrame(apply)

  print([
    { text: `${SYSTEM} 2026.10 (Moby Dock) — tty1`, tone: 'muted' },
    { text: "Bienvenue à bord ! Tapez 'help' pour la liste des commandes.", tone: 'ok' },
    { text: 'Astuce : cliquez sur un container de la baleine. Envie de jouer ? Tapez jeux', tone: 'muted' },
    { text: 'Baleine 3D : « 3D Docker Whale » par leo199483, CC BY-SA 4.0 — tapez credits', tone: 'muted' },
  ])
  renderPrompt()

  return {
    async execute(command: string): Promise<void> {
      setOpen(true)
      if (minimized) {
        minimized = false
        apply()
      }
      await submit(command)
    },
    open: () => setOpen(true),
    setMinimized(value: boolean): boolean {
      const previous = minimized
      if (value !== minimized) {
        minimized = value
        apply()
        if (!value) scrollToEnd()
      }
      return previous
    },
  }
}
