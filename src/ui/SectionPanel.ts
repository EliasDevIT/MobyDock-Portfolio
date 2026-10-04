import gsap from 'gsap'
import { BIC_OWNER, CONTAINER_MARKINGS, type StatusTone } from '@/data/containers'
import { SECTIONS } from '@/data/sections'
import type { SectionBlock, SectionLink } from '@/data/sectionTypes'
import { bicCheckDigit } from '@/scene/ContainerMarkings'

export interface SectionPanel {
  /** Affiche la section (ou remplace celle affichée). */
  show(slug: string): void
  hide(): void
}

export interface SectionPanelOptions {
  onClose(): void
  /** Flèches précédent / suivant. */
  onNavigate(slug: string): void
  /** Bouton d'action (section JEUX) : commande à lancer dans le terminal. */
  onCommand(command: string): void
}

const STATUS: Record<StatusTone, string> = { ok: 'bg-[#2fbf71]', progress: 'bg-[#f2b632]', info: 'bg-[#22b8e6]' }
const CHIP = 'rounded-md bg-[#1aa2f2]/15 px-2 py-0.5 font-mono text-[11px] text-[#9ecbff]'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

const isDesktop = (): boolean => window.matchMedia('(min-width: 768px)').matches

/** Lien externe dans un nouvel onglet ; lien sans adresse grisé (« bientôt »). */
function linkRow(link: SectionLink): HTMLElement {
  const label = el('span', 'flex min-w-0 flex-col')
  label.append(el('span', 'font-medium text-white', link.label))
  if (link.hint) label.append(el('span', 'truncate font-mono text-xs text-slate-400', link.hint))
  if (!link.href) {
    const row = el('div', 'flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5 opacity-60 ring-1 ring-white/10')
    row.append(label, el('span', 'shrink-0 font-mono text-[11px] text-slate-400', 'bientôt'))
    return row
  }
  const row = el('a', 'flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/10 transition-colors hover:bg-white/[0.09]')
  row.href = link.href
  if (/^https?:/.test(link.href)) {
    row.target = '_blank'
    row.rel = 'noopener noreferrer'
  }
  row.append(label, el('span', 'shrink-0 text-[#7ee787]', '↗'))
  return row
}

function chips(items: readonly string[]): HTMLElement {
  const list = el('ul', 'flex flex-wrap gap-1.5')
  for (const item of items) list.append(el('li', CHIP, item))
  return list
}

/**
 * Panneau d'une section, façon fenêtre du terminal : identité du container (code BIC, image, statut),
 * titre, accroche puis blocs de contenu. À gauche sur grand écran, en bas sur mobile. Échap ou ✕ ferme.
 */
export function createSectionPanel(options: SectionPanelOptions): SectionPanel {
  const root = el(
    'aside',
    'fixed inset-x-0 bottom-0 z-30 flex max-h-[62vh] flex-col rounded-t-2xl bg-[#15171c]/95 font-sans text-slate-200 shadow-2xl ring-1 ring-black/50 backdrop-blur-sm outline-none md:inset-x-auto md:bottom-4 md:left-4 md:top-4 md:max-h-none md:w-[420px] md:rounded-2xl',
  )
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-labelledby', 'section-title')
  root.tabIndex = -1
  root.style.visibility = 'hidden'

  const header = el('header', 'relative shrink-0 border-b border-white/10 px-5 pb-4 pt-4')
  const meta = el('p', 'pr-10 font-mono text-[11px] tracking-wide text-slate-400')
  const title = el('h2', "mt-1 pr-10 font-['Lilita_One'] text-[34px] leading-none text-white [text-shadow:0_3px_0_rgba(10,18,26,0.6)]")
  title.id = 'section-title'
  const status = el('span', 'mt-3 inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#0d1117]')
  const close = el('button', 'absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white', '✕')
  close.type = 'button'
  close.setAttribute('aria-label', 'Fermer la section')
  header.append(meta, title, status, close)

  const body = el('div', 'min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5')

  const footer = el('footer', 'flex shrink-0 items-center justify-between gap-2 border-t border-white/10 px-2 py-2')
  const navButton = (): HTMLButtonElement => {
    const button = el('button', 'max-w-[45%] truncate rounded-lg px-3 py-2 font-mono text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-white')
    button.type = 'button'
    return button
  }
  const previous = navButton()
  const next = navButton()
  const position = el('span', 'font-mono text-[11px] text-slate-500')
  footer.append(previous, position, next)

  root.append(header, body, footer)
  document.body.append(root)

  let current: string | null = null
  let visible = false

  const blockTitle = (block: SectionBlock): HTMLElement | null => {
    if (!block.title && !block.draft) return null
    const row = el('div', 'mb-2.5 flex items-center gap-2')
    if (block.title) row.append(el('h3', 'font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ecbff]', block.title))
    if (block.draft) row.append(el('span', 'rounded-full border border-[#f2cc60]/50 px-2 py-px font-mono text-[10px] uppercase tracking-wider text-[#f2cc60]', 'à compléter'))
    return row
  }

  const renderBlock = (block: SectionBlock): HTMLElement => {
    const section = el('section')
    const heading = blockTitle(block)
    if (heading) section.append(heading)
    switch (block.kind) {
      case 'text':
        for (const paragraph of block.paragraphs) section.append(el('p', 'text-sm leading-relaxed text-slate-300 [&+&]:mt-2', paragraph))
        break
      case 'timeline': {
        const list = el('ol', 'space-y-3 border-l border-white/15 pl-4')
        for (const item of block.items) {
          const entry = el('li', 'relative')
          entry.append(
            el('span', 'absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#1aa2f2] ring-4 ring-[#15171c]'),
            el('p', 'font-mono text-[11px] text-slate-400', item.period),
            el('p', 'text-sm font-semibold text-white', item.title),
          )
          const place = [item.place, item.detail].filter(Boolean).join(' · ')
          if (place) entry.append(el('p', 'text-sm text-slate-300', place))
          list.append(entry)
        }
        section.append(list)
        break
      }
      case 'projects':
        for (const project of block.items) {
          const card = el('article', 'rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/10 [&+&]:mt-3')
          card.append(el('h4', 'font-semibold text-white', project.name), el('p', 'mt-1 text-sm leading-relaxed text-slate-300', project.description))
          if (project.tags.length) {
            const tags = chips(project.tags)
            tags.classList.add('mt-3')
            card.append(tags)
          }
          if (project.links?.length) {
            const links = el('div', 'mt-3 flex flex-wrap gap-x-4 gap-y-1')
            for (const link of project.links) {
              const anchor = el('a', 'text-sm font-medium text-[#7ee787] hover:underline', `${link.label} ↗`)
              anchor.href = link.href
              anchor.target = '_blank'
              anchor.rel = 'noopener noreferrer'
              links.append(anchor)
            }
            card.append(links)
          }
          section.append(card)
        }
        break
      case 'tags':
        for (const group of block.groups) {
          const wrapper = el('div', '[&+&]:mt-3')
          wrapper.append(el('p', 'mb-1.5 text-xs text-slate-400', group.label), chips(group.items))
          section.append(wrapper)
        }
        break
      case 'links': {
        const list = el('div', 'space-y-2')
        for (const link of block.items) list.append(linkRow(link))
        section.append(list)
        break
      }
      case 'actions':
        for (const action of block.items) {
          const button = el('button', 'block w-full rounded-xl bg-[#1aa2f2]/10 p-4 text-left ring-1 ring-[#1aa2f2]/40 transition-colors hover:bg-[#1aa2f2]/20 [&+&]:mt-3')
          button.type = 'button'
          const top = el('span', 'flex items-center justify-between gap-3')
          top.append(el('span', "font-['Lilita_One'] text-xl text-white", action.label), el('span', 'font-mono text-xs text-[#7ee787]', `▶ ${action.command}`))
          button.append(top, el('span', 'mt-1 block text-sm text-slate-300', action.hint))
          button.addEventListener('click', () => options.onCommand(action.command))
          section.append(button)
        }
        break
    }
    return section
  }

  const fill = (slug: string): boolean => {
    const section = SECTIONS.find((s) => s.slug === slug)
    const marking = CONTAINER_MARKINGS.find((m) => m.slug === slug)
    if (!section || !marking) return false
    const code = `${BIC_OWNER}${marking.serial}`
    meta.textContent = `${BIC_OWNER} ${marking.serial} ${bicCheckDigit(code)} · ${marking.image}`
    title.textContent = marking.name
    status.className = status.className.replace(/bg-\[#[0-9a-f]+\]/g, '').trim() + ` ${STATUS[marking.tone]}`
    status.textContent = `● ${marking.status}`
    body.replaceChildren(el('p', 'text-[15px] leading-relaxed text-slate-100', section.lead), ...section.blocks.map(renderBlock))
    body.scrollTop = 0

    const index = SECTIONS.indexOf(section)
    const neighbour = (offset: number): string => SECTIONS[(index + offset + SECTIONS.length) % SECTIONS.length]?.slug ?? slug
    const label = (target: string): string => CONTAINER_MARKINGS.find((m) => m.slug === target)?.name ?? target
    const before = neighbour(-1)
    const after = neighbour(1)
    previous.textContent = `← ${label(before)}`
    previous.onclick = () => options.onNavigate(before)
    next.textContent = `${label(after)} →`
    next.onclick = () => options.onNavigate(after)
    position.textContent = `${index + 1}/${SECTIONS.length}`
    return true
  }

  close.addEventListener('click', () => options.onClose())
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && visible) options.onClose()
  })

  return {
    show(slug: string): void {
      if (slug === current && visible) return
      if (!fill(slug)) return
      current = slug
      if (visible) {
        // changement de section : le contenu se renouvelle, le panneau reste en place
        gsap.fromTo([header, body], { autoAlpha: 0.2 }, { autoAlpha: 1, duration: 0.35, ease: 'power1.out' })
        return
      }
      visible = true
      gsap.fromTo(
        root,
        { autoAlpha: 0, x: isDesktop() ? -32 : 0, y: isDesktop() ? 0 : 60 },
        { autoAlpha: 1, x: 0, y: 0, duration: 0.5, delay: 0.2, ease: 'power3.out', overwrite: true },
      )
      root.focus({ preventScroll: true })
    },
    hide(): void {
      if (!visible) return
      visible = false
      current = null
      gsap.to(root, { autoAlpha: 0, x: isDesktop() ? -24 : 0, y: isDesktop() ? 0 : 40, duration: 0.3, ease: 'power2.in', overwrite: true })
    },
  }
}
