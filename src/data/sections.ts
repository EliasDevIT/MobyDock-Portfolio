/**
 * Contenu des sections, affiché dans le panneau qui s'ouvre au clic sur un container. Une section par
 * container (même `slug` que dans containers.ts) ; l'ordre du tableau est celui des flèches précédent / suivant.
 * Les blocs possibles sont décrits dans sectionTypes.ts.
 *
 * `draft: true` marque un bloc encore provisoire : il s'affiche avec une pastille « à compléter ».
 * Un lien sans `href` s'affiche grisé (« bientôt »).
 *
 * Tout ce qui suit est un exemple : remplace-le par ton contenu et retire les `draft: true`.
 */
import type { Section } from './sectionTypes'

export const SECTIONS: readonly Section[] = [
  {
    slug: 'cv',
    lead: 'Une phrase qui te présente : ta formation, ton poste actuel et ce que tu vises.',
    blocks: [
      {
        kind: 'text',
        title: 'À propos',
        draft: true,
        paragraphs: ['Deux ou trois phrases sur toi : ce qui te motive, ce que tu aimes construire, ce que tu cherches.'],
      },
      {
        kind: 'timeline',
        title: 'Parcours',
        draft: true,
        items: [
          { period: 'Depuis 2025', title: 'Ton poste actuel', place: 'Entreprise', detail: 'Ce que tu y fais' },
          { period: '2023 – 2026', title: 'Ta formation', place: 'École' },
        ],
      },
      {
        kind: 'links',
        title: 'CV',
        draft: true,
        // dépose ton CV dans public/cv.pdf puis indique href: '/cv.pdf'
        items: [{ label: 'Télécharger le CV (PDF)', href: '', hint: 'public/cv.pdf' }],
      },
    ],
  },
  {
    slug: 'projets',
    lead: "Une sélection de projets, de l'école à tes projets perso.",
    blocks: [
      {
        kind: 'projects',
        draft: true,
        items: [
          {
            name: 'Nom du projet',
            description: 'Ce que fait le projet, en une ou deux phrases, et ce que tu y as fait.',
            tags: ['Techno 1', 'Techno 2', 'Techno 3'],
            links: [{ label: 'Code source', href: 'https://github.com/' }],
          },
          {
            name: 'Autre projet',
            description: 'Un projet d\'école, un projet perso, une contribution open source…',
            tags: ['Techno'],
          },
        ],
      },
    ],
  },
  {
    slug: 'skills',
    lead: "Les technos que tu utilises, de la ligne de commande à la production.",
    blocks: [
      {
        kind: 'tags',
        draft: true,
        groups: [
          { label: 'Langages', items: ['Python', 'TypeScript', 'Bash'] },
          { label: 'Conteneurs & CI/CD', items: ['Docker', 'Git'] },
          { label: 'Systèmes', items: ['Linux'] },
        ],
      },
    ],
  },
  {
    slug: 'infra',
    lead: 'Infrastructure, cloud et automatisation.',
    blocks: [
      {
        kind: 'text',
        draft: true,
        paragraphs: ["Les environnements que tu as administrés, les clouds utilisés, tes outils d'infrastructure as code et de supervision."],
      },
    ],
  },
  {
    slug: 'labs',
    lead: 'Tes expériences et projets autour de l\'IA.',
    blocks: [
      {
        kind: 'text',
        draft: true,
        paragraphs: ['Tes expérimentations : modèles testés, RAG, moteurs d\'inférence, agents…'],
      },
    ],
  },
  {
    slug: 'tools',
    lead: 'Tes outils du quotidien, du code à la mise en production.',
    blocks: [
      {
        kind: 'tags',
        draft: true,
        groups: [
          { label: 'Code', items: ['Ton éditeur', 'Ton terminal'] },
          { label: 'DevOps', items: ['Tes outils'] },
        ],
      },
    ],
  },
  {
    slug: 'hobbies',
    lead: 'En dehors du code.',
    blocks: [
      {
        kind: 'tags',
        draft: true,
        groups: [{ label: 'Passions', items: ['Sport', 'Musique', 'Voyages'] }],
      },
    ],
  },
  {
    slug: 'jeux',
    lead: 'Deux jeux à lancer directement dans le terminal.',
    blocks: [
      {
        kind: 'actions',
        items: [
          {
            label: 'Moby Quest',
            hint: 'Escape game 100 % bash : retrouve le mot de passe du canot de sauvetage avec ls, cd, cat, grep…',
            command: 'jeux 1',
          },
          { label: 'Quiz', hint: "10 questions sur Docker, l'IA locale (RAG, inférence) et DevOps (Jenkins).", command: 'jeux 2' },
        ],
      },
    ],
  },
  {
    slug: 'contact',
    lead: 'Une question, une opportunité ? Écris-moi.',
    blocks: [
      {
        kind: 'links',
        draft: true,
        items: [
          { label: 'GitHub', href: '', hint: 'ton identifiant' },
          { label: 'LinkedIn', href: '' },
          // pour un e-mail : href: 'mailto:toi@example.com'
          { label: 'E-mail', href: '' },
        ],
      },
    ],
  },
]
