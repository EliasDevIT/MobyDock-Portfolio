import { QUIZ_CATEGORIES, QUIZ_QUESTIONS, type QuizCategory, type QuizQuestion } from '@/data/quiz'
import type { OutputLine, Program } from '../shell'

/** Nombre de questions par partie. */
const ROUND = 10
const LETTERS = ['a', 'b', 'c', 'd'] as const

/** Titres de fin de partie, selon la part de bonnes réponses. */
const RANKS = [
  { min: 1, title: 'Amiral de la flotte : sans-faute !' },
  { min: 0.8, title: 'Capitaine : ça sent le DevOps confirmé.' },
  { min: 0.5, title: 'Matelot : de bonnes bases, encore quelques nœuds à faire.' },
  { min: 0, title: 'Moussaillon : la doc est ton amie, retente ta chance !' },
] as const

interface Round {
  question: QuizQuestion
  options: string[]
  correct: number
}

export interface QuizHooks {
  /** Bonne réponse : petit signe dans la scène. */
  onCorrect?(): void
  /** Fin de partie, avec la part de bonnes réponses (0 à 1). */
  onFinish?(ratio: number): void
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
  }
  return copy
}

/** Questions d'une partie : un seul thème, ou les trois en alternance. */
function pickQuestions(category: QuizCategory | null): QuizQuestion[] {
  if (category) return shuffle(QUIZ_QUESTIONS.filter((q) => q.category === category)).slice(0, ROUND)
  const piles = shuffle(Object.keys(QUIZ_CATEGORIES) as QuizCategory[]).map((c) => shuffle(QUIZ_QUESTIONS.filter((q) => q.category === c)))
  const picked: QuizQuestion[] = []
  for (let i = 0; picked.length < ROUND && piles.some((pile) => pile.length); i++) {
    const next = piles[i % piles.length]?.shift()
    if (next) picked.push(next)
  }
  return picked
}

/** Lance une partie : renvoie l'introduction, la première question et le programme qui lit les réponses. */
export function startQuiz(category: QuizCategory | null, hooks: QuizHooks = {}): { lines: OutputLine[]; program: Program } {
  const rounds: Round[] = pickQuestions(category).map((question) => {
    const options = shuffle([question.answer, ...question.wrong])
    return { question, options, correct: options.indexOf(question.answer) }
  })
  let index = 0
  let score = 0
  const results = new Map<QuizCategory, { right: number; total: number }>()

  const ask = (): OutputLine[] => {
    const round = rounds[index]
    if (!round) return []
    return [
      { text: '' },
      { text: `[${index + 1}/${rounds.length}] ${QUIZ_CATEGORIES[round.question.category]}`, tone: 'accent' },
      { text: round.question.question, tone: 'warn' },
      ...round.options.map((option, i) => ({ text: `  ${LETTERS[i]}) ${option}` })),
    ]
  }

  const summary = (): OutputLine[] => {
    const ratio = rounds.length ? score / rounds.length : 0
    const rank = RANKS.find((r) => ratio >= r.min) ?? RANKS[RANKS.length - 1]
    const detail = [...results].map(([c, r]) => `${QUIZ_CATEGORIES[c]} ${r.right}/${r.total}`).join(' · ')
    return [
      { text: '' },
      { text: '─'.repeat(36), tone: 'muted' },
      { text: `Score : ${score}/${rounds.length} — ${rank.title}`, tone: ratio >= 0.5 ? 'ok' : 'warn' },
      ...(detail ? [{ text: `  ${detail}`, tone: 'muted' as const }] : []),
      { text: 'Rejouer : quiz · quiz docker · quiz ia · quiz devops', tone: 'muted' },
    ]
  }

  const program: Program = {
    label: () => `quiz ${Math.min(index + 1, rounds.length)}/${rounds.length}`,
    input(line: string) {
      const raw = line.trim().toLowerCase()
      if (raw === 'q' || raw === 'quit' || raw === 'exit') return { lines: program.quit(), done: true }
      const choice = LETTERS.findIndex((letter, i) => raw === letter || raw === String(i + 1))
      const round = rounds[index]
      if (!round || choice < 0) return { lines: [{ text: 'Réponds par a, b, c ou d (q pour quitter).', tone: 'muted' }], done: false }

      const right = choice === round.correct
      const tally = results.get(round.question.category) ?? { right: 0, total: 0 }
      tally.total++
      if (right) {
        score++
        tally.right++
        hooks.onCorrect?.()
      }
      results.set(round.question.category, tally)
      const lines: OutputLine[] = [
        right
          ? { text: '✔ Bonne réponse !', tone: 'ok' }
          : { text: `✘ Raté : c'était ${LETTERS[round.correct]}) ${round.options[round.correct] ?? ''}`, tone: 'error' },
        { text: round.question.explain, tone: 'muted' },
      ]
      index++
      if (index < rounds.length) return { lines: [...lines, ...ask()], done: false }
      hooks.onFinish?.(score / rounds.length)
      return { lines: [...lines, ...summary()], done: true }
    },
    quit: () => [{ text: `Quiz interrompu (${score}/${index} bonnes réponses). Rejouer : quiz`, tone: 'muted' }],
  }

  const theme = category ? QUIZ_CATEGORIES[category] : 'Docker · IA locale · DevOps'
  return {
    lines: [
      { text: `QUIZ — ${rounds.length} questions · ${theme}`, tone: 'ok' },
      { text: 'Réponds par a, b, c ou d · q pour quitter', tone: 'muted' },
      ...ask(),
    ],
    program,
  }
}
