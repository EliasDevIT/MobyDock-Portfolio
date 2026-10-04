import { BIC_OWNER, CONTAINER_MARKINGS, OWNER, imageDigest, type ContainerMarking } from '@/data/containers'
import { HOST, OF_NAME, PROFILE, SYSTEM } from '@/data/profile'
import { QUIZ_CATEGORIES, type QuizCategory } from '@/data/quiz'
import { LIFEBOAT, MOBY_QUEST_DIR, launchLifeboat, mobyQuestTree } from './games/mobyQuest'
import { startQuiz } from './games/quiz'

/** Une ligne de sortie ; `tone` colore la ligne entière. */
export interface OutputLine {
  text: string
  tone?: 'muted' | 'error' | 'ok' | 'accent' | 'warn'
}

/** Invite du terminal : celle du shell (dossier courant) ou celle du jeu en cours. */
export type ShellPrompt = { kind: 'shell'; cwd: string } | { kind: 'program'; label: string }

/** Programme interactif (un jeu) : il reçoit chaque ligne saisie jusqu'à ce qu'il se termine. */
export interface Program {
  /** Invite affichée pendant le jeu (`quiz 3/10`). */
  label(): string
  input(line: string): { lines: OutputLine[]; done: boolean }
  /** `q` ou Ctrl+C : dernières lignes avant de rendre la main au shell. */
  quit(): OutputLine[]
}

export interface ShellHooks {
  /** Un container passe à l'arrêt ou en marche (`docker stop/start/run`, `compose up/down`). */
  onContainerState?(slot: string, running: boolean): void
  /** Un container est sollicité (`inspect`, `restart`, `logs`, bonne réponse au quiz…) : petit signe dans la scène. */
  onContainerPing?(slot: string): void
  /** `exit` : fermer la fenêtre. */
  onExit?(): void
  /** `open <section>` : ouvrir la section d'un container. */
  onOpenSection?(slug: string): void
}

export interface Shell {
  prompt(): ShellPrompt
  run(input: string): Promise<OutputLine[]>
  /** Ctrl+C : quitte le jeu en cours. */
  interrupt(): OutputLine[]
  /** Complétion (Tab) : renvoie la ligne complétée, ou la ligne telle quelle. */
  complete(input: string): string
}

export type FsNode = string | { [name: string]: FsNode }

const HOME = `/home/${PROFILE.user}`
const DOMAIN = PROFILE.domain
/** Suffixe des noms de noyau et de build, tiré du trigramme du profil (6.8.0-abc, abc2026). */
const CODE = PROFILE.code.toLowerCase()
/** Container qui « héberge » les jeux : arrêté, plus de jeux. */
const GAMES = 'jeux'

const GAMES_MENU: readonly OutputLine[] = [
  { text: `JEUX — container ${PROFILE.user}/jeux:2026`, tone: 'accent' },
  { text: '' },
  { text: '1) Moby Quest · escape game 100 % bash', tone: 'ok' },
  { text: '   Moby Dock dérive : retrouve le mot de passe du canot de sauvetage' },
  { text: '   avec de vraies commandes Linux (ls, cd, cat, grep…).' },
  { text: '   ▶ cd ~/jeux/moby-quest && cat LISEZMOI', tone: 'warn' },
  { text: '' },
  { text: '2) Quiz · 10 questions Docker, IA locale (RAG, inférence) et DevOps (Jenkins)', tone: 'ok' },
  { text: '   ▶ quiz      ou par thème : quiz docker · quiz ia · quiz devops', tone: 'warn' },
  { text: '' },
  { text: 'Tape 1 ou 2 pour lancer un jeu.', tone: 'muted' },
]

function containerYaml(c: ContainerMarking): string {
  const { bay, row, tier } = c.position
  return [
    `name: ${c.slug}`,
    `image: ${c.image}`,
    `section: ${c.name}`,
    `status: ${c.status}`,
    `stowage: BAY ${bay} ROW ${row} TIER ${tier}`,
    `updated: ${c.updated}`,
    `version: ${c.version}`,
  ].join('\n')
}

function buildFs(): FsNode {
  const containers: Record<string, FsNode> = {}
  for (const c of CONTAINER_MARKINGS) containers[`${c.slug}.yml`] = containerYaml(c)
  return {
    home: {
      [PROFILE.user]: {
        'README.md': [
          `# ${DOMAIN}`,
          `Portfolio ${OF_NAME}, servi par une baleine porte-conteneurs.`,
          '',
          'Chaque container de la baleine est une section du portfolio.',
          'Essayez : docker ps, docker inspect cv, ls containers, cat containers/skills.yml',
          'Envie de jouer ? Tapez : jeux',
        ].join('\n'),
        '.bashrc': `alias ll='ls -la'\nexport PS1='${PROFILE.user}@${HOST}:\\w$ '`,
        containers,
        jeux: {
          LISEZMOI: GAMES_MENU.map((line) => line.text).join('\n'),
          'moby-quest': mobyQuestTree(),
        },
      },
    },
    etc: {
      hostname: DOMAIN,
      'os-release': `NAME="${SYSTEM}"\nVERSION="2026.10 (Moby Dock)"\nID=${CODE}\nPRETTY_NAME="${SYSTEM} 2026.10"`,
    },
  }
}

const COMMANDS = [
  'help', 'ls', 'll', 'cd', 'pwd', 'cat', 'head', 'tail', 'grep', 'find', 'wc', 'chmod', 'bash', 'echo', 'whoami',
  'hostname', 'date', 'uname', 'uptime', 'history', 'clear', 'exit', 'sudo', 'docker', 'open', 'jeux', 'quiz', 'credits',
] as const

/**
 * Crédits affichés par `credits`. Le modèle de la baleine est sous licence CC BY-SA 4.0 : son auteur doit
 * être crédité là où le modèle est montré, donc sur le site lui-même.
 */
const CREDITS: readonly OutputLine[] = [
  { text: 'Crédits', tone: 'accent' },
  { text: 'Baleine 3D : « 3D Docker Whale » par leo199483' },
  { text: '  https://www.printables.com/model/566955-3d-docker-whale', tone: 'muted' },
  { text: '  Licence CC BY-SA 4.0 : https://creativecommons.org/licenses/by-sa/4.0/deed.fr', tone: 'muted' },
  { text: '  Adaptée : réassemblée dans Blender, yeux, trait de la bouche, containers.', tone: 'muted' },
  { text: 'Polices : JetBrains Mono, Lilita One, Orbitron (SIL Open Font License, Google Fonts)' },
  { text: 'Docker et le logo Docker sont des marques de Docker, Inc. (projet non affilié).', tone: 'muted' },
]
const DOCKER_COMMANDS = ['ps', 'images', 'inspect', 'logs', 'start', 'stop', 'restart', 'run', 'pull', 'exec', 'compose', 'version', 'help'] as const

/** Colonnes alignées à gauche, séparées par trois espaces (style `docker ps`). */
function table(rows: string[][]): string[] {
  const widths = rows[0]?.map((_, col) => Math.max(...rows.map((r) => (r[col] ?? '').length))) ?? []
  return rows.map((r) => r.map((cell, col) => (col < r.length - 1 ? cell.padEnd(widths[col] ?? 0) : cell)).join('   '))
}

/** Une étape d'une ligne de commande : un tube (`a | b`), suivi de son enchaînement (`&&`, `||` ou `;`). */
interface Step {
  pipeline: string[][]
  then: '&&' | '||' | ';'
}

/**
 * Découpe une ligne façon bash : étapes séparées par `&&`, `||` ou `;`, commandes reliées par `|`,
 * mots séparés par des espaces ; les guillemets simples ou doubles regroupent un mot.
 */
function parse(line: string): Step[] {
  const steps: Step[] = []
  let pipeline: string[][] = []
  let words: string[] = []
  let word = ''
  let quoted = false
  let quote: string | null = null
  const endWord = (): void => {
    if (word || quoted) words.push(word)
    word = ''
    quoted = false
  }
  const endCommand = (): void => {
    endWord()
    if (words.length) pipeline.push(words)
    words = []
  }
  const endStep = (then: Step['then']): void => {
    endCommand()
    if (pipeline.length) steps.push({ pipeline, then })
    pipeline = []
  }
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? ''
    const next = line[i + 1]
    if (quote) {
      if (ch === quote) quote = null
      else word += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      quoted = true
    } else if (/\s/.test(ch)) endWord()
    else if (ch === '&' && next === '&') {
      endStep('&&')
      i++
    } else if (ch === '|' && next === '|') {
      endStep('||')
      i++
    } else if (ch === '|') endCommand()
    else if (ch === ';') endStep(';')
    else word += ch
  }
  endStep(';')
  return steps
}

/** Motif de `find -name` (`*`, `?`) en expression régulière. */
function globToRegex(glob: string): RegExp {
  const source = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${source}$`)
}

export function createShell(hooks: ShellHooks = {}): Shell {
  const fs = buildFs()
  let cwd = HOME
  const history: string[] = []
  const running = new Map(CONTAINER_MARKINGS.map((c) => [c.slug, true]))
  const startedAt = Date.now()
  /** Fichiers rendus exécutables par chmod (chemins absolus). */
  const executables = new Set<string>()
  /** Jeu en cours : il reçoit les lignes saisies à la place du shell. */
  let program: Program | null = null
  /** Chrono et compteur de Moby Quest, lancés en entrant dans son dossier. */
  let quest: { start: number; commands: number } | null = null
  /** Échec signalé par une commande sans message d'erreur (grep sans résultat), pour `&&` et `||`. */
  let failed = false
  /** Le menu des jeux vient de s'afficher : « 1 » ou « 2 » choisit un jeu. */
  let menuShown = false

  // empreintes : identifiants d'image (sha256 du nom) et de container (sha256 du code BIC)
  const ready = Promise.all(
    CONTAINER_MARKINGS.map(async (c) => [c.slug, await imageDigest(c.image), await imageDigest(`${BIC_OWNER}${c.serial}`)] as const),
  ).then((entries) => new Map(entries.map(([slug, image, id]) => [slug, { image, id }])))

  const display = (path: string): string => (path === HOME ? '~' : path.startsWith(`${HOME}/`) ? `~${path.slice(HOME.length)}` : path)

  const resolve = (path: string): string => {
    const raw = path.startsWith('~') ? HOME + path.slice(1) : path.startsWith('/') ? path : `${cwd}/${path}`
    const parts: string[] = []
    for (const part of raw.split('/')) {
      if (!part || part === '.') continue
      if (part === '..') parts.pop()
      else parts.push(part)
    }
    return `/${parts.join('/')}`
  }

  const lookup = (path: string): FsNode | undefined => {
    let node: FsNode | undefined = fs
    for (const part of path.split('/').filter(Boolean)) {
      if (typeof node !== 'object') return undefined
      node = node[part]
    }
    return node
  }

  /** Contenu d'un fichier, ou la ligne d'erreur de `cmd`. */
  const readFile = (cmd: string, arg: string): string | OutputLine => {
    const node = lookup(resolve(arg))
    if (node === undefined) return { text: `${cmd}: ${arg}: No such file or directory`, tone: 'error' }
    if (typeof node === 'object') return { text: `${cmd}: ${arg}: Is a directory`, tone: 'error' }
    return node
  }

  const findContainer = (name: string | undefined): ContainerMarking | undefined =>
    CONTAINER_MARKINGS.find((c) => c.slug === name || c.image === name || c.image.split(':')[0] === name)

  const noSuchContainer = (name: string | undefined): OutputLine[] => [
    { text: name ? `Error response from daemon: No such container: ${name}` : '"docker" requires at least 1 argument.', tone: 'error' },
  ]

  const notRunning = (slug: string): OutputLine[] => [
    { text: `Error response from daemon: container ${slug} is not running (docker start ${slug})`, tone: 'error' },
  ]

  const setRunning = (c: ContainerMarking, state: boolean): void => {
    running.set(c.slug, state)
    hooks.onContainerState?.(c.slot, state)
  }

  const gamesSlot = CONTAINER_MARKINGS.find((c) => c.slug === GAMES)?.slot
  const pingGames = (): void => {
    if (gamesSlot) hooks.onContainerPing?.(gamesSlot)
  }
  /** Victoire : vague de petits sauts sur tous les containers. */
  const celebrate = (): void => {
    CONTAINER_MARKINGS.forEach((c, i) => setTimeout(() => hooks.onContainerPing?.(c.slot), i * 110))
  }

  const uptime = (): string => {
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000))
    return minutes < 60 ? `${minutes} minute${minutes > 1 ? 's' : ''}` : `${Math.round(minutes / 60)} hours`
  }

  /** Ligne de `ls -l` : droits, taille et nom ; les exécutables en vert, les dossiers en violet. */
  const longEntry = (name: string, node: FsNode, path: string): OutputLine => {
    const dir = typeof node === 'object'
    const exec = !dir && executables.has(path)
    const mode = dir ? 'drwxr-xr-x' : exec ? '-rwxr-xr-x' : '-rw-r--r--'
    const size = dir ? 4096 : new TextEncoder().encode(node).length
    return { text: `${mode} 1 ${PROFILE.user} ${PROFILE.user} ${String(size).padStart(5)} Oct  3 09:00 ${name}`, tone: dir ? 'accent' : exec ? 'ok' : undefined }
  }

  const linux = (cmd: string, args: string[], stdin?: string[]): OutputLine[] | null => {
    switch (cmd) {
      case 'help':
        return [
          { text: 'Linux', tone: 'accent' },
          { text: '  ls [-la] [chemin]              lister un dossier (-a : fichiers cachés)' },
          { text: '  cd <chemin> · pwd              se déplacer' },
          { text: '  cat · head · tail <fichier>    lire un fichier' },
          { text: '  grep [-inrv] <motif> [fich.]   chercher dans des fichiers' },
          { text: '  find [chemin] -name <motif>    trouver des fichiers' },
          { text: '  chmod +x <fichier> · ./script  rendre exécutable, lancer' },
          { text: '  echo · wc · whoami · hostname · date · uname [-a] · uptime · credits' },
          { text: '  history · clear (Ctrl+L) · exit · tubes | et enchaînements && ;' },
          { text: '' },
          { text: 'Docker', tone: 'accent' },
          { text: '  docker ps [-a]                   containers en marche (ou tous)' },
          { text: '  docker images                    images disponibles' },
          { text: "  docker inspect <nom>             détails d'un container" },
          { text: '  docker logs <nom>                journaux' },
          { text: '  docker start|stop|restart <nom>  allumer, éteindre, redémarrer' },
          { text: '  docker run|pull <image>' },
          { text: '  docker compose up|down|ps' },
          { text: '' },
          { text: 'Portfolio', tone: 'accent' },
          { text: '  open <section>                   ouvrir une section (cv, projets, contact…)' },
          { text: '  jeux [1|2]                       menu des jeux, ou lancer un jeu' },
          { text: '  quiz [docker|ia|devops]          quiz de 10 questions' },
          { text: '  cd ~/jeux/moby-quest             escape game en bash' },
          { text: '' },
          { text: 'Containers : ' + CONTAINER_MARKINGS.map((c) => c.slug).join(', '), tone: 'ok' },
          { text: 'Astuce : cliquez sur un container de la baleine, ou utilisez Tab et ↑/↓.', tone: 'muted' },
        ]
      case 'pwd':
        return [{ text: cwd }]
      case 'whoami':
        return [{ text: PROFILE.user }]
      case 'credits':
        return [...CREDITS]
      case 'hostname':
        return [{ text: DOMAIN }]
      case 'date':
        return [{ text: new Date().toString() }]
      case 'uname':
        return [{ text: args.includes('-a') ? `Linux ${DOMAIN} 6.8.0-${CODE} #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux` : 'Linux' }]
      case 'uptime':
        return [{ text: `up ${uptime()}, 1 user, load average: 0.04, 0.02, 0.00` }]
      case 'echo':
        return [{ text: args.join(' ') }]
      case 'history':
        return history.map((line, i) => ({ text: `${String(i + 1).padStart(4)}  ${line}` }))
      case 'clear':
        // effacé par le terminal ; rien à afficher quand clear est enchaîné à une autre commande
        return []
      case 'exit':
        hooks.onExit?.()
        return []
      case 'sudo':
        return [{ text: `${PROFILE.user} is not in the sudoers file. This incident will be reported.`, tone: 'error' }]
      case 'open': {
        const section = findContainer(args[0])
        if (!args[0]) return [{ text: `usage : open <section>   (${CONTAINER_MARKINGS.map((c) => c.slug).join(', ')})`, tone: 'muted' }]
        if (!section) return [{ text: `open: ${args[0]}: section introuvable`, tone: 'error' }]
        hooks.onOpenSection?.(section.slug)
        return [{ text: `Ouverture du container ${section.slug}…`, tone: 'muted' }]
      }
      case 'cd': {
        const target = resolve(args[0] ?? '~')
        const node = lookup(target)
        if (node === undefined) return [{ text: `cd: ${args[0]}: No such file or directory`, tone: 'error' }]
        if (typeof node === 'string') return [{ text: `cd: ${args[0]}: Not a directory`, tone: 'error' }]
        cwd = target
        return []
      }
      case 'll':
      case 'ls': {
        const flags = args.filter((a) => a.startsWith('-')).join('')
        const all = cmd === 'll' || flags.includes('a')
        const long = cmd === 'll' || flags.includes('l')
        const pathArg = args.find((a) => !a.startsWith('-'))
        const dir = resolve(pathArg ?? '.')
        const node = lookup(dir)
        if (node === undefined) return [{ text: `ls: cannot access '${pathArg}': No such file or directory`, tone: 'error' }]
        if (typeof node === 'string') return [long ? longEntry(pathArg ?? '', node, dir) : { text: pathArg ?? '' }]
        const names = Object.keys(node)
          .filter((name) => all || !name.startsWith('.'))
          .sort((a, b) => a.localeCompare(b, 'fr'))
        if (long) {
          const parent = resolve(`${dir}/..`)
          const entries: [string, FsNode, string][] = names.map((name) => [name, node[name] ?? '', `${dir}/${name}`])
          if (all) entries.unshift(['.', node, dir], ['..', lookup(parent) ?? node, parent])
          return [{ text: `total ${entries.length * 4}` }, ...entries.map(([name, child, path]) => longEntry(name, child, path))]
        }
        const shown = names.map((name) => {
          const child = node[name]
          if (typeof child === 'object') return `${name}/`
          return executables.has(`${dir}/${name}`.replace('//', '/')) ? `${name}*` : name
        })
        return [{ text: [...(all ? ['./', '../'] : []), ...shown].join('  '), tone: 'accent' }]
      }
      case 'cat': {
        if (!args.length) return stdin ? stdin.map((text) => ({ text })) : [{ text: 'cat: missing operand', tone: 'error' }]
        return args.flatMap((arg) => {
          const content = readFile('cat', arg)
          return typeof content === 'string' ? content.split('\n').map((text) => ({ text })) : [content]
        })
      }
      case 'head':
      case 'tail': {
        let count = 10
        const files: string[] = []
        for (let i = 0; i < args.length; i++) {
          const arg = args[i] ?? ''
          if (arg === '-n') count = Number(args[++i])
          else if (/^-n?\d+$/.test(arg)) count = Number(arg.replace(/^-n?/, ''))
          else files.push(arg)
        }
        if (!Number.isInteger(count) || count < 0) return [{ text: `${cmd}: invalid number of lines`, tone: 'error' }]
        const take = (lines: string[]): OutputLine[] =>
          (cmd === 'head' ? lines.slice(0, count) : lines.slice(Math.max(0, lines.length - count))).map((text) => ({ text }))
        if (!files.length) return take(stdin ?? [])
        return files.flatMap((file) => {
          const content = readFile(cmd, file)
          if (typeof content !== 'string') return [content]
          return [...(files.length > 1 ? [{ text: `==> ${file} <==`, tone: 'muted' as const }] : []), ...take(content.split('\n'))]
        })
      }
      case 'wc': {
        const flags = args.filter((a) => a.startsWith('-')).join('')
        const files = args.filter((a) => !a.startsWith('-'))
        const count = (text: string, label: string): OutputLine => {
          const lines = text ? text.split('\n').length : 0
          const words = text.split(/\s+/).filter(Boolean).length
          const bytes = new TextEncoder().encode(text).length
          const parts = flags.includes('l') ? [lines] : flags.includes('w') ? [words] : flags.includes('c') ? [bytes] : [lines, words, bytes]
          return { text: `${parts.join(' ')}${label ? ` ${label}` : ''}` }
        }
        if (!files.length) return [count((stdin ?? []).join('\n'), '')]
        return files.map((file) => {
          const content = readFile('wc', file)
          return typeof content === 'string' ? count(content, file) : content
        })
      }
      case 'grep': {
        const flags = args.filter((a) => a.startsWith('-') && a.length > 1).join('')
        const [pattern, ...files] = args.filter((a) => !(a.startsWith('-') && a.length > 1))
        if (pattern === undefined) return [{ text: 'usage: grep [-inrv] <motif> [fichier…]', tone: 'error' }]
        const ignoreCase = flags.includes('i') ? 'i' : ''
        let regex: RegExp
        try {
          regex = new RegExp(pattern, ignoreCase)
        } catch {
          regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), ignoreCase)
        }
        const invert = flags.includes('v')
        const numbered = flags.includes('n')
        const recursive = /[rR]/.test(flags)
        const hits: OutputLine[] = []
        let found = false
        const scan = (text: string, label: string | null): void => {
          text.split('\n').forEach((line, i) => {
            if (regex.test(line) === invert) return
            found = true
            hits.push({ text: `${label ? `${label}:` : ''}${numbered ? `${i + 1}:` : ''}${line}` })
          })
        }
        const walk = (node: FsNode, path: string): void => {
          if (typeof node === 'string') return scan(node, path)
          for (const name of Object.keys(node).sort()) walk(node[name] ?? '', `${path.replace(/\/$/, '')}/${name}`)
        }
        if (!files.length && !recursive) scan((stdin ?? []).join('\n'), null)
        for (const file of files.length ? files : recursive ? ['.'] : []) {
          const node = lookup(resolve(file))
          if (node === undefined) hits.push({ text: `grep: ${file}: No such file or directory`, tone: 'error' })
          else if (typeof node === 'object' && !recursive) hits.push({ text: `grep: ${file}: Is a directory`, tone: 'error' })
          else if (typeof node === 'object') walk(node, file)
          else scan(node, files.length > 1 ? file : null)
        }
        if (!found) failed = true
        return hits
      }
      case 'find': {
        const pathArg = args[0] && !args[0].startsWith('-') ? args[0] : '.'
        const option = (name: string): string | undefined => {
          const i = args.indexOf(name)
          return i >= 0 ? args[i + 1] : undefined
        }
        const namePattern = option('-name')
        const type = option('-type')
        const root = lookup(resolve(pathArg))
        if (root === undefined) return [{ text: `find: '${pathArg}': No such file or directory`, tone: 'error' }]
        const regex = namePattern ? globToRegex(namePattern) : null
        const out: OutputLine[] = []
        const walk = (node: FsNode, shown: string): void => {
          const dir = typeof node === 'object'
          const name = shown.split('/').pop() ?? shown
          if ((!regex || regex.test(name)) && (!type || (type === 'd') === dir)) out.push({ text: shown })
          if (dir) for (const child of Object.keys(node).sort()) walk(node[child] ?? '', `${shown.replace(/\/$/, '')}/${child}`)
        }
        walk(root, pathArg)
        return out
      }
      case 'chmod': {
        const [mode, ...files] = args
        if (!mode || !files.length) return [{ text: 'chmod: missing operand', tone: 'error' }]
        const numeric = /^[0-7]{3,4}$/.test(mode)
        if (!numeric && !/^[ugoa]*[-+=][rwx]+$/.test(mode)) return [{ text: `chmod: invalid mode: '${mode}'`, tone: 'error' }]
        const out: OutputLine[] = []
        for (const file of files) {
          const target = resolve(file)
          const node = lookup(target)
          if (node === undefined) out.push({ text: `chmod: cannot access '${file}': No such file or directory`, tone: 'error' })
          else if (typeof node === 'string') {
            // droit d'exécution du propriétaire : chiffre des centaines impair, ou +x / =…x
            const exec = numeric ? Number(mode[mode.length - 3]) % 2 === 1 : mode.includes('x') ? !mode.includes('-') : mode.includes('=') ? false : executables.has(target)
            if (exec) executables.add(target)
            else executables.delete(target)
          }
        }
        return out
      }
      default:
        return null
    }
  }

  /** Commandes des jeux (container `jeux`). */
  const games = (cmd: string, args: string[]): OutputLine[] | null => {
    if (cmd !== 'jeux' && cmd !== 'quiz') return null
    if (running.get(GAMES) === false) return notRunning(GAMES)
    pingGames()
    if (cmd === 'jeux') {
      // jeux 1 : Moby Quest (on entre dans son dossier et on lit les règles), jeux 2 : quiz
      if (args[0] === '1') {
        cwd = MOBY_QUEST_DIR
        return linux('cat', ['LISEZMOI']) ?? []
      }
      if (args[0] === '2') return games('quiz', args.slice(1))
      menuShown = true
      return [...GAMES_MENU]
    }
    const theme = args[0]?.toLowerCase()
    if (theme && !Object.keys(QUIZ_CATEGORIES).includes(theme)) {
      return [{ text: `quiz: thème inconnu « ${args[0]} » (docker, ia, devops)`, tone: 'error' }]
    }
    const quiz = startQuiz((theme as QuizCategory | undefined) ?? null, {
      onCorrect: pingGames,
      onFinish: (ratio) => {
        if (ratio >= 0.8) celebrate()
      },
    })
    program = quiz.program
    return quiz.lines
  }

  /** `./script`, `bash script` : seul le canot de Moby Quest sait faire quelque chose. */
  const execute = (path: string, args: string[], interpreter: boolean): OutputLine[] => {
    const target = resolve(path)
    const node = lookup(target)
    if (node === undefined) return [{ text: `bash: ${path}: No such file or directory`, tone: 'error' }]
    if (typeof node === 'object') return [{ text: `bash: ${path}: Is a directory`, tone: 'error' }]
    // `bash fichier` lit le script sans avoir besoin du droit d'exécution, `./fichier` non
    if (!interpreter && !executables.has(target)) return [{ text: `bash: ${path}: Permission denied`, tone: 'error' }]
    if (target === LIFEBOAT) {
      const stats = quest ? { seconds: Math.round((Date.now() - quest.start) / 1000), commands: quest.commands } : null
      const result = launchLifeboat(args, stats)
      if (result.won) {
        quest = null
        celebrate()
      } else failed = true
      return result.lines
    }
    const first = node.split('\n')[0]?.split(/\s+/)[0] ?? ''
    return [{ text: `${path}: line 1: ${first}: command not found`, tone: 'error' }]
  }

  const docker = async (args: string[]): Promise<OutputLine[]> => {
    const ids = await ready
    const [sub, ...rest] = args
    const target = rest.find((a) => !a.startsWith('-'))
    switch (sub) {
      case undefined:
      case 'help':
      case '--help':
        return [
          { text: 'Usage:  docker [OPTIONS] COMMAND', tone: 'muted' },
          { text: 'Commands: ' + DOCKER_COMMANDS.join(', '), tone: 'muted' },
        ]
      case 'version':
      case '--version':
      case '-v':
        return [{ text: `Docker version 27.3.1, build ${CODE}2026 (simulation)` }]
      case 'ps': {
        const all = rest.includes('-a') || rest.includes('--all')
        const rows = [['CONTAINER ID', 'IMAGE', 'STATUS', 'NAMES']]
        for (const c of CONTAINER_MARKINGS) {
          const up = running.get(c.slug) ?? false
          if (!up && !all) continue
          rows.push([ids.get(c.slug)?.id.slice(0, 12) ?? '', c.image, up ? `Up ${uptime()}` : 'Exited (0)', c.slug])
        }
        return table(rows).map((text, i) => ({ text, tone: i === 0 ? 'muted' : undefined }))
      }
      case 'images': {
        const rows = [['REPOSITORY', 'TAG', 'IMAGE ID', 'SIZE']]
        for (const c of CONTAINER_MARKINGS) {
          const [repo = '', tag = ''] = c.image.split(':')
          rows.push([repo, tag, ids.get(c.slug)?.image.slice(0, 12) ?? '', `${(40 + Number(c.serial.slice(-2)) * 3.7).toFixed(1)}MB`])
        }
        return table(rows).map((text, i) => ({ text, tone: i === 0 ? 'muted' : undefined }))
      }
      case 'inspect': {
        const c = findContainer(target)
        if (!c) return noSuchContainer(target)
        hooks.onContainerPing?.(c.slot)
        const id = ids.get(c.slug)
        const up = running.get(c.slug) ?? false
        const { bay, row, tier } = c.position
        return JSON.stringify(
          [
            {
              Id: id?.id,
              Name: `/${c.slug}`,
              Image: `sha256:${id?.image}`,
              State: { Status: up ? 'running' : 'exited', Running: up },
              Config: {
                Image: c.image,
                Labels: { owner: OWNER, section: c.name, status: c.status, updated: c.updated, version: c.version },
              },
              Stowage: `BAY ${bay} ROW ${row} TIER ${tier}`,
            },
          ],
          null,
          2,
        )
          .split('\n')
          .map((text) => ({ text }))
      }
      case 'logs': {
        const c = findContainer(target)
        if (!c) return noSuchContainer(target)
        hooks.onContainerPing?.(c.slot)
        return [
          { text: `[${c.updated}T09:00:00Z] pulling ${c.image}`, tone: 'muted' },
          { text: `[${c.updated}T09:00:02Z] container ${c.slug} v${c.version} started` },
          { text: `[${c.updated}T09:00:03Z] section « ${c.name} » : ${c.status.toLowerCase()}`, tone: 'ok' },
        ]
      }
      case 'start':
      case 'stop':
      case 'restart': {
        const names = rest.filter((a) => !a.startsWith('-'))
        if (!names.length) return noSuchContainer(undefined)
        return names.map((name) => {
          const c = findContainer(name)
          if (!c) return noSuchContainer(name)[0] as OutputLine
          if (sub === 'restart') hooks.onContainerPing?.(c.slot)
          setRunning(c, sub !== 'stop')
          return { text: c.slug }
        })
      }
      case 'run': {
        const image = rest.filter((a) => !a.startsWith('-')).pop()
        const c = findContainer(image)
        if (!c) {
          return [
            { text: `Unable to find image '${image ?? ''}' locally`, tone: 'muted' },
            { text: `docker: Error response from daemon: pull access denied for ${image ?? ''}.`, tone: 'error' },
          ]
        }
        setRunning(c, true)
        hooks.onContainerPing?.(c.slot)
        return [{ text: ids.get(c.slug)?.id ?? '' }, ...(c.slug === GAMES ? GAMES_MENU : [])]
      }
      case 'pull': {
        const c = findContainer(target)
        if (!c) return [{ text: `Error response from daemon: pull access denied for ${target ?? ''}`, tone: 'error' }]
        const [repo, tag] = c.image.split(':')
        return [
          { text: `${tag}: Pulling from ${repo}`, tone: 'muted' },
          { text: `Digest: sha256:${ids.get(c.slug)?.image}` },
          { text: `Status: Image is up to date for ${c.image}`, tone: 'ok' },
        ]
      }
      case 'exec': {
        // docker exec -it jeux quiz : les jeux tournent « dans » leur container
        const [name, command = '', ...params] = rest.filter((a) => !a.startsWith('-'))
        const c = findContainer(name)
        if (!c) return noSuchContainer(name)
        if (!(running.get(c.slug) ?? false)) return notRunning(c.slug)
        if (c.slug === GAMES) {
          const played = games(command, params)
          if (played) return played
        }
        return [{ text: 'OCI runtime exec failed: les shells interactifs sont désactivés dans cette démo.', tone: 'error' }]
      }
      case 'compose': {
        const action = rest[0]
        if (action === 'up' || action === 'down') {
          for (const c of CONTAINER_MARKINGS) setRunning(c, action === 'up')
          const verb = action === 'up' ? 'Started' : 'Stopped'
          return CONTAINER_MARKINGS.map((c) => ({ text: ` ✔ Container ${c.slug}  ${verb}`, tone: 'ok' }))
        }
        if (action === 'ps') return docker(['ps', '-a'])
        return [{ text: 'Usage:  docker compose up|down|ps', tone: 'muted' }]
      }
      default:
        return [{ text: `docker: '${sub}' is not a docker command. See 'docker --help'`, tone: 'error' }]
    }
  }

  const runCommand = async (words: string[], stdin?: string[]): Promise<OutputLine[]> => {
    const [cmd = '', ...args] = words
    if (cmd === 'docker') return docker(args)
    if (cmd.includes('/')) return execute(cmd, args, false)
    if (cmd === 'bash' || cmd === 'sh') {
      if (args[0]) return execute(args[0], args.slice(1), true)
      return [{ text: `${cmd}: les shells interactifs sont désactivés dans cette démo.`, tone: 'error' }]
    }
    return linux(cmd, args, stdin) ?? games(cmd, args) ?? [{ text: `${cmd}: command not found`, tone: 'error' }]
  }

  /** `a | b | c` : la sortie de chaque commande devient l'entrée de la suivante ; les erreurs s'affichent directement. */
  const runPipeline = async (commands: string[][]): Promise<{ lines: OutputLine[]; ok: boolean }> => {
    const shown: OutputLine[] = []
    let stdin: string[] | undefined
    let ok = true
    for (let i = 0; i < commands.length; i++) {
      failed = false
      const result = await runCommand(commands[i] ?? [], stdin)
      ok = !failed && !result.some((line) => line.tone === 'error')
      if (i === commands.length - 1) shown.push(...result)
      else {
        shown.push(...result.filter((line) => line.tone === 'error'))
        stdin = result.filter((line) => line.tone !== 'error').map((line) => line.text)
      }
      if (program) break
    }
    return { lines: shown, ok }
  }

  const inQuest = (): boolean => cwd === MOBY_QUEST_DIR || cwd.startsWith(`${MOBY_QUEST_DIR}/`)

  return {
    prompt: () => (program ? { kind: 'program', label: program.label() } : { kind: 'shell', cwd: display(cwd) }),
    async run(input: string): Promise<OutputLine[]> {
      if (program) {
        const step = program.input(input)
        if (step.done) program = null
        return step.lines
      }
      let line = input.trim()
      if (!line) return []
      // juste après le menu des jeux, un simple numéro lance le jeu correspondant
      if (menuShown && (line === '1' || line === '2')) line = `jeux ${line}`
      menuShown = false
      history.push(line)
      if (quest) quest.commands++
      const wasInQuest = inQuest()
      const out: OutputLine[] = []
      let ok = true
      let previous: Step['then'] = ';'
      for (const step of parse(line)) {
        const skip = (previous === '&&' && !ok) || (previous === '||' && ok)
        previous = step.then
        if (skip) continue
        const result = await runPipeline(step.pipeline)
        out.push(...result.lines)
        ok = result.ok
        // un jeu prend la main : la suite de la ligne est ignorée
        if (program) break
      }
      // Moby Quest : chrono et compteur démarrent en entrant dans le dossier du jeu
      if (!wasInQuest && inQuest()) quest = { start: Date.now(), commands: 0 }
      return out
    },
    interrupt(): OutputLine[] {
      if (!program) return []
      const lines = program.quit()
      program = null
      return lines
    },
    complete(input: string): string {
      if (program) return input
      const words = input.split(/\s+/)
      const last = words[words.length - 1] ?? ''
      let candidates: readonly string[]
      if (words.length === 1 && !last.includes('/')) candidates = COMMANDS
      else if (words[0] === 'docker' && words.length === 2) candidates = DOCKER_COMMANDS
      else if (words[0] === 'docker') candidates = CONTAINER_MARKINGS.flatMap((c) => [c.slug, c.image])
      else if (words[0] === 'quiz' && words.length === 2) candidates = Object.keys(QUIZ_CATEGORIES)
      else if (words[0] === 'open' && words.length === 2) candidates = CONTAINER_MARKINGS.map((c) => c.slug)
      else {
        // chemins du dossier courant (ou du dossier tapé) ; fichiers cachés seulement après un point
        const slash = last.lastIndexOf('/')
        const dir = slash >= 0 ? last.slice(0, slash + 1) : ''
        const hidden = last.slice(slash + 1).startsWith('.')
        const node = lookup(resolve(dir || '.'))
        candidates =
          typeof node === 'object'
            ? Object.keys(node)
                .filter((name) => hidden || !name.startsWith('.'))
                .map((name) => dir + name + (typeof node[name] === 'object' ? '/' : ''))
            : []
      }
      const matches = candidates.filter((c) => c.startsWith(last))
      if (!matches.length) return input
      // plusieurs possibilités : on complète jusqu'à leur début commun, comme bash
      let common = matches[0] ?? last
      for (const match of matches) while (!match.startsWith(common)) common = common.slice(0, -1)
      words[words.length - 1] = common
      const done = matches.length === 1 && !common.endsWith('/')
      return words.join(' ') + (done ? ' ' : '')
    },
  }
}
