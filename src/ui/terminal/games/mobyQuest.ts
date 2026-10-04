import { PROFILE } from '@/data/profile'
import type { FsNode, OutputLine } from '../shell'

/**
 * Moby Quest : escape game joué avec de vraies commandes Linux. Trois morceaux de mot de passe sont cachés
 * dans l'arborescence : le premier se lit avec cat, le deuxième se trouve avec grep dans un journal trop
 * long, le troisième dans un dossier caché (ls -a). Il faut ensuite rendre le canot exécutable
 * (chmod +x) et le lancer avec le mot de passe : ./canot.sh MOBY-DOCK-2026.
 */
export const MOBY_QUEST_DIR = `/home/${PROFILE.user}/jeux/moby-quest`
export const LIFEBOAT = `${MOBY_QUEST_DIR}/canot.sh`
const PASSWORD = 'MOBY-DOCK-2026'

export interface QuestStats {
  seconds: number
  commands: number
}

/** Journal des machines : 150 lignes générées (toujours les mêmes), dont une seule contient le morceau 2. */
function engineLog(): string {
  const entries = [
    'chaudière : pression 7,2 bar — OK',
    'hélice bâbord : 112 tr/min',
    'hélice tribord : 114 tr/min',
    'température de la cale : 4 °C',
    'sonar : banc de sardines à 300 m',
    'pompe de cale : démarrage automatique',
    'radio : aucun message',
    'eau douce : réservoir à 63 %',
    'moteur : légère vibration, à surveiller',
    'container canot : Exited (1)',
    'healthcheck baleine : healthy',
    'docker ps : 9 containers Up',
    'cuisine : sardines au menu (encore)',
    'capitaine : demande un café',
    'vigie : rien à signaler',
    'nettoyage des logs : reporté à demain',
    'tempête : houle de 4 m, cap perdu',
  ]
  let seed = 2026
  const random = (): number => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const lines: string[] = []
  let seconds = 0
  for (let i = 0; i < 150; i++) {
    seconds += 20 + Math.floor(random() * 90)
    const time = new Date(Date.UTC(2026, 9, 3, 0, 0, seconds)).toISOString().slice(0, 19).replace('T', ' ')
    const entry = i === 97 ? 'note perso du chef — MORCEAU 2/3 : DOCK (ne le dis à personne)' : entries[Math.floor(random() * entries.length)]
    lines.push(`[${time}] ${entry}`)
  }
  return lines.join('\n')
}

export function mobyQuestTree(): FsNode {
  return {
    LISEZMOI: [
      '╔══════════════════════════════╗',
      '║      M O B Y   Q U E S T     ║',
      '╚══════════════════════════════╝',
      "Tempête sur l'océan : Moby Dock a perdu son cap, et toi avec.",
      'Le seul moyen de rentrer : lancer le canot de sauvetage.',
      '',
      '  ./canot.sh <mot-de-passe>',
      '',
      'Le mot de passe est en 3 morceaux, cachés à bord.',
      'Explore avec de vraies commandes Linux :',
      '  ls              regarder autour de toi',
      '  cd <dossier>    te déplacer (cd .. pour revenir)',
      '  cat <fichier>   lire un fichier',
      '  pwd             savoir où tu es',
      '',
      'Commence par : ls',
    ].join('\n'),
    'canot.sh': [
      '#!/bin/bash',
      '# Canot de sauvetage de Moby Dock',
      '# usage : ./canot.sh <mot-de-passe>',
      '#',
      "# Attention : ce script n'est pas encore exécutable.",
      '# Un fichier se rend exécutable avec : chmod +x <fichier>',
      'if verifier_mot_de_passe "$1"; then',
      '  demarrer_canot',
      'fi',
    ].join('\n'),
    pont: {
      'longue-vue': [
        'Tu colles ton œil à la longue-vue…',
        'À l\'horizon, un phare clignote en morse : M… O… B… Y…',
        '',
        '  MORCEAU 1/3 : MOBY',
        '',
        'Note-le bien !',
      ].join('\n'),
      mouette: [
        'Kiaou ! Une mouette se pose sur la rambarde et te fixe.',
        '« Les machinistes notent TOUT dans leur journal… beaucoup trop long à lire.',
        '  Cherche plutôt directement la ligne qui parle de MORCEAU :',
        '  grep MORCEAU journal.log »',
        'Le journal est dans la salle des machines.',
      ].join('\n'),
      bouee: `Une bouée orange marquée « MOBY DOCK — port d'attache : /home/${PROFILE.user} ». Pas très utile en pleine tempête.`,
    },
    machines: {
      'journal.log': engineLog(),
      'note-du-chef': [
        'Note du chef mécanicien :',
        'Le capitaine cache toujours son coffre dans la cale.',
        'Sur ce navire, ce qui est caché commence par un point… et ls ne le montre pas.',
        'Essaie : ls -a',
      ].join('\n'),
      chaudiere: 'Ça chauffe. Beaucoup. Mieux vaut ne toucher à rien.',
    },
    cale: {
      'caisse-01': 'Des bananes. Encore des bananes.',
      'caisse-02': 'Des câbles réseau tout emmêlés. Un vrai plat de spaghettis… catégorie 6.',
      filet: "Un filet de pêche. Quelque chose brille au fond… ah non, c'est une capsule de bière.",
      '.coffre-du-capitaine': {
        parchemin: [
          'Bravo, tu as trouvé le coffre du capitaine !',
          '',
          '  MORCEAU 3/3 : 2026',
          '',
          'Pour le canot, assemble les 3 morceaux dans l\'ordre, séparés par des tirets :',
          '  MORCEAU1-MORCEAU2-MORCEAU3',
          '',
          'PS : si le canot répond « Permission denied », c\'est qu\'il n\'est pas exécutable.',
          '     Retourne à la racine du jeu et essaie : chmod +x canot.sh',
        ].join('\n'),
      },
    },
  }
}

const SAILBOAT = [
  '            |\\',
  '            | \\',
  '            |  \\',
  '            |___\\',
  '     _______|________',
  '     \\  C A N O T  /',
  '  ~~~~\\___________/~~~~~',
]

function duration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return minutes ? `${minutes} min ${String(seconds % 60).padStart(2, '0')} s` : `${seconds} s`
}

/** `./canot.sh <mot-de-passe>` : vérifie le mot de passe et lance le canot. */
export function launchLifeboat(args: readonly string[], stats: QuestStats | null): { lines: OutputLine[]; won: boolean } {
  const attempt = args.join('').toUpperCase()
  if (!attempt) return { lines: [{ text: 'usage : ./canot.sh <mot-de-passe>', tone: 'muted' }], won: false }
  if (attempt.replace(/-/g, '') !== PASSWORD.replace(/-/g, '')) {
    return {
      lines: [
        { text: 'Vérification du mot de passe… refusé.', tone: 'error' },
        { text: 'Le canot reste à quai. Il faut les 3 morceaux, dans l\'ordre, séparés par des tirets.', tone: 'muted' },
      ],
      won: false,
    }
  }
  return {
    lines: [
      { text: 'Vérification du mot de passe… OK', tone: 'ok' },
      { text: ' ✔ Container canot  Started', tone: 'ok' },
      { text: '' },
      ...SAILBOAT.map((text) => ({ text })),
      { text: '' },
      {
        text: stats
          ? `Bravo ! Tu as quitté Moby Dock en ${duration(stats.seconds)} et ${stats.commands} commandes.`
          : 'Bravo ! Tu as quitté Moby Dock.',
        tone: 'ok',
      },
      { text: 'Tu viens d\'utiliser de vraies commandes Linux : ls -a, cd, cat, grep, chmod +x et ./script.', tone: 'muted' },
      { text: 'Rejouer : cd ~/jeux/moby-quest · Autre jeu : quiz', tone: 'muted' },
    ],
    won: true,
  }
}
