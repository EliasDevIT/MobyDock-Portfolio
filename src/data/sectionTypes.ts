/**
 * Forme du contenu des sections (sections.ts), affiché dans le panneau qui s'ouvre au clic sur un container.
 *
 * `draft: true` marque un bloc encore provisoire : il s'affiche avec une pastille « à compléter ».
 * Un lien sans `href` s'affiche grisé (« bientôt »).
 */

export interface SectionLink {
  label: string
  href: string
  /** Texte secondaire : identifiant, adresse, précision. */
  hint?: string
}

interface BlockBase {
  title?: string
  draft?: boolean
}

export type SectionBlock =
  | (BlockBase & { kind: 'text'; paragraphs: readonly string[] })
  | (BlockBase & { kind: 'timeline'; items: readonly { period: string; title: string; place?: string; detail?: string }[] })
  | (BlockBase & {
      kind: 'projects'
      items: readonly { name: string; description: string; tags: readonly string[]; links?: readonly SectionLink[] }[]
    })
  | (BlockBase & { kind: 'tags'; groups: readonly { label: string; items: readonly string[] }[] })
  | (BlockBase & { kind: 'links'; items: readonly SectionLink[] })
  /** Boutons qui lancent une commande dans le terminal (section JEUX). */
  | (BlockBase & { kind: 'actions'; items: readonly { label: string; hint: string; command: string }[] })

export interface Section {
  /** Container correspondant (containers.ts). */
  slug: string
  /** Phrase d'accroche, sous le titre. */
  lead: string
  blocks: readonly SectionBlock[]
}
