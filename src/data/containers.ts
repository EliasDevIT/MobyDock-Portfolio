import type { ContainerIcon } from '@/scene/ContainerIcons'
import { PROFILE } from './profile'

/** Teinte de l'étiquette de statut collée sur le container. */
export type StatusTone = 'ok' | 'progress' | 'info'

/** Position de chargement façon plan de chargement maritime (baie, rangée, étage). */
export interface StowagePosition {
  /** Baie, de l'avant vers l'arrière ; impaire pour un 20 pieds. */
  bay: string
  /** Rangée : 00 = axe du navire. */
  row: string
  /** Étage sur le pont : 82, 84, 86… en partant du bas. */
  tier: string
}

export interface ContainerMarking {
  /** Nom du nœud dans le GLB (whale_box_01 … 09 : rangée du bas de l'avant vers l'arrière, puis milieu, puis sommet). */
  slot: string
  /** Nom court, utilisé comme nom de container par le terminal (`docker inspect cv`). */
  slug: string
  /** Nom peint en grand sur les grands côtés. */
  name: string
  /** Lettrage des portes (une ou deux lignes), identique aux deux bouts du container. */
  door: readonly string[]
  /** Pictogramme des portes. */
  icon: ContainerIcon
  /** Image Docker (dépôt:tag), peinte avec son empreinte sha256 et listée par `docker images`. */
  image: string
  position: StowagePosition
  /** Plaque de sécurité : date de dernière mise à jour et version. */
  updated: string
  version: string
  /** Identifiant « maison », peint sous le nom. */
  tag: string
  /** Numéro de série du code BIC (6 chiffres), précédé du préfixe propriétaire (BIC_OWNER). */
  serial: string
  status: string
  tone: StatusTone
  /** Peint le schéma Code → Build → Ship → Run à la place des mentions techniques. */
  pipeline?: boolean
}

/** Préfixe propriétaire du code BIC (trigramme du profil + U = conteneur de transport) et code pays / type ISO. */
export const BIC_OWNER = `${PROFILE.code}U`
export const BIC_COUNTRY_TYPE = 'FR 22G1'
/** Propriétaire inscrit sur la plaque de sécurité. */
export const OWNER = PROFILE.name.toUpperCase()

/** Image Docker d'une section : <utilisateur>/<section>:2026. */
const image = (slug: string): string => `${PROFILE.user}/${slug}:2026`

/**
 * Disposition 5-3-1 du logo, vue de profil (tête à gauche) :
 *   baie 01 : JEUX · baie 03 : CV / ABOUT + SKILLS · baie 05 : PROJETS + INFRA & CLOUD
 *   baie 07 : LABS & AI + TOOLS + CONTACT (sommet) · baie 09 : HOBBIES
 */
export const CONTAINER_MARKINGS: readonly ContainerMarking[] = [
  { slot: 'whale_box_01', slug: 'jeux', name: 'JEUX', door: ['JEUX'], icon: 'gamepad', image: image('jeux'), position: { bay: '01', row: '00', tier: '82' }, updated: '2026-10-03', version: '1.0.0', tag: 'DOCKYOURSELF-JEUX-01', serial: '000109', status: 'JOUABLES', tone: 'ok' },
  { slot: 'whale_box_02', slug: 'cv', name: 'CV / ABOUT', door: ['CV / ABOUT'], icon: 'document', image: image('cv'), position: { bay: '03', row: '00', tier: '82' }, updated: '2026-10-03', version: '1.0.0', tag: 'DOCKYOURSELF-CV-01', serial: '000101', status: 'À JOUR', tone: 'info' },
  { slot: 'whale_box_03', slug: 'projets', name: 'PROJETS', door: ['PROJETS'], icon: 'rocket', image: image('projets'), position: { bay: '05', row: '00', tier: '82' }, updated: '2026-10-03', version: '1.0.0', tag: 'DOCKYOURSELF-PROJ-01', serial: '000103', status: 'DÉPLOYÉS', tone: 'ok' },
  { slot: 'whale_box_04', slug: 'labs', name: 'LABS & AI', door: ['LABS & AI'], icon: 'flask', image: image('labs'), position: { bay: '07', row: '00', tier: '82' }, updated: '2026-10-03', version: '0.3.0', tag: 'DOCKYOURSELF-LABS-01', serial: '000105', status: 'EN COURS', tone: 'progress' },
  { slot: 'whale_box_05', slug: 'hobbies', name: 'HOBBIES', door: ['HOBBIES'], icon: 'padel', image: image('hobbies'), position: { bay: '09', row: '00', tier: '82' }, updated: '2026-10-03', version: '1.0.0', tag: 'DOCKYOURSELF-HOBBY-01', serial: '000108', status: 'ACTIF', tone: 'ok' },
  { slot: 'whale_box_06', slug: 'skills', name: 'SKILLS', door: ['SKILLS'], icon: 'gears', image: image('skills'), position: { bay: '03', row: '00', tier: '84' }, updated: '2026-10-03', version: '1.0.0', tag: 'DOCKYOURSELF-SKILLS-01', serial: '000102', status: 'ACQUISES', tone: 'ok' },
  { slot: 'whale_box_07', slug: 'infra', name: 'INFRA & CLOUD', door: ['INFRA', '& CLOUD'], icon: 'cloud', image: image('infra'), position: { bay: '05', row: '00', tier: '84' }, updated: '2026-10-03', version: '1.0.0', tag: 'DOCKYOURSELF-INFRA-01', serial: '000104', status: 'EN SERVICE', tone: 'ok' },
  { slot: 'whale_box_08', slug: 'tools', name: 'TOOLS', door: ['TOOLS'], icon: 'terminal', image: image('tools'), position: { bay: '07', row: '00', tier: '84' }, updated: '2026-10-03', version: '1.0.0', tag: 'DOCKYOURSELF-TOOLS-01', serial: '000106', status: 'PRÊTS', tone: 'info', pipeline: true },
  { slot: 'whale_box_09', slug: 'contact', name: 'CONTACT', door: ['CONTACT'], icon: 'envelope', image: image('contact'), position: { bay: '07', row: '00', tier: '86' }, updated: '2026-10-03', version: '1.0.0', tag: 'DOCKYOURSELF-CONTACT-01', serial: '000107', status: 'OUVERT', tone: 'info' },
]

const digests = new Map<string, Promise<string>>()

/** Empreinte sha256 (hex) du nom d'image, calculée une fois : sert de faux identifiant d'image stable. */
export function imageDigest(image: string): Promise<string> {
  let digest = digests.get(image)
  if (!digest) {
    digest = crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(image))
      .then((buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join(''))
    digests.set(image, digest)
  }
  return digest
}
