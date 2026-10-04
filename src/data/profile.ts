/**
 * Identité du portfolio : tout ce qui est personnel en dehors du contenu des sections (sections.ts).
 * Le reste du site s'en sert : titre de la page, écran de démarrage, terminal, plaques des containers.
 * Remplace ces valeurs d'exemple par les tiennes.
 */
export const PROFILE = {
  name: 'Moby Dock',
  /** Utilisateur du terminal : invite (moby@…), dossier /home/moby, images Docker moby/cv:2026. */
  user: 'moby',
  /** Nom de domaine : titre de la page et nom d'hôte du terminal (sa première partie dans l'invite). */
  domain: 'portfolio.example',
  /**
   * Trigramme : code propriétaire peint sur les containers (MBYU + numéro de série, norme ISO 6346)
   * et nom du système de l'écran de démarrage et du terminal (MBY OS). Trois lettres majuscules.
   */
  code: 'MBY',
  /** En-tête de l'écran de démarrage, à côté du nom du système. */
  tagline: 'Ton école ou ta ville · 2026',
  /** Présentation de l'écran de démarrage, sous « Bienvenue à bord du portfolio de … ». */
  welcome: [
    'Ta formation ou ton poste actuel',
    'Tes spécialités, en quelques mots',
    'Objectif : le poste que tu vises',
  ],
} as const

/** Nom d'hôte court de l'invite du terminal : portfolio.example → portfolio. */
export const HOST = PROFILE.domain.split('.')[0] || PROFILE.domain

/** Système fictif de l'écran de démarrage et du terminal. */
export const SYSTEM = `${PROFILE.code} OS`

/** « d'Alice Martin », « de Moby Dock » : le nom précédé de « de », élidé devant une voyelle. */
export const OF_NAME = `${/^[aeiouyhàâäéèêëîïôöùûü]/i.test(PROFILE.name) ? "d'" : 'de '}${PROFILE.name}`
