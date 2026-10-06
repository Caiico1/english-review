// Discovers lessons automatically: any src/lessons/*.json file shows up in the menu.
import { shuffle } from './check.js';
import { getState, getCard, isDue, MASTERED_BOX } from './store.js';

const modules = import.meta.glob('./lessons/*.json', { eager: true });

export const lessons = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));

export const getLesson = (id) => lessons.find((l) => l.id === id);

/** A lesson's flashcards: vocabulary plus phrases, in one common shape. */
export function cardsOf(lesson) {
  return [
    ...(lesson.vocabulary ?? []).map((v) => ({
      id: v.id, en: v.word, def: v.definition, pos: v.partOfSpeech,
      example: v.example, hint: v.pronunciationHint,
    })),
    ...(lesson.phrases ?? []).map((p) => ({ id: p.id, en: p.phrase, def: p.meaning, pos: 'phrase', context: p.context })),
  ];
}

const AUTO = 'auto-mc:';

/** Multiple-choice question generated from a flashcard (for tests and reviews). */
export function vocabQuestion(lesson, card) {
  const others = shuffle(cardsOf(lesson).filter((c) => c.id !== card.id && c.def !== card.def)).slice(0, 3);
  const options = shuffle([card, ...others]);
  return {
    id: AUTO + card.id,
    type: 'multiple-choice',
    prompt: `What does “${card.en}” mean?`,
    options: options.map((c) => c.def),
    answer: options.indexOf(card),
    explanation: card.example ? `Example: ${card.example}` : undefined,
    cardId: card.id,
    keepOrder: true,
  };
}

/** Finds an exercise by id, including generated ones and reading questions. */
export function findExercise(lesson, exId) {
  if (exId.startsWith(AUTO)) {
    const card = cardsOf(lesson).find((c) => c.id === exId.slice(AUTO.length));
    return card ? vocabQuestion(lesson, card) : null;
  }
  return (
    lesson.exercises.find((e) => e.id === exId) ||
    lesson.reading?.questions?.find((e) => e.id === exId) ||
    null
  );
}

/** Orders exercises for a session: never attempted first, then last answered wrong, then the rest. */
export function prioritise(lesson, exercises) {
  const done = getState().lessons[lesson.id]?.exercises ?? {};
  const rank = (e) => (!done[e.id] ? 0 : done[e.id].lastCorrect ? 2 : 1);
  return shuffle(exercises).sort((a, b) => rank(a) - rank(b));
}

export function lessonStats(lesson) {
  const entry = getState().lessons[lesson.id];
  const cards = cardsOf(lesson);
  const boxes = cards.map((c) => getCard(lesson.id, c.id)?.box ?? 0);
  const done = entry?.exercises ?? {};
  const exCorrect = lesson.exercises.filter((e) => done[e.id]?.correct > 0).length;
  const tests = entry?.tests ?? [];
  const bestTest = tests.reduce((best, t) => Math.max(best, t.score / t.total), 0);

  // % complete = 40% exercises answered correctly at least once + 40% vocabulary progress + 20% best test
  const vocabFrac = cards.length ? boxes.reduce((s, b) => s + Math.max(0, b - 1) / (MASTERED_BOX - 1), 0) / cards.length : 1;
  const exFrac = lesson.exercises.length ? exCorrect / lesson.exercises.length : 1;
  const percent = Math.round(100 * (0.4 * exFrac + 0.4 * Math.min(1, vocabFrac) + 0.2 * bestTest));

  return {
    percent,
    cardsTotal: cards.length,
    cardsDue: cards.filter((c) => isDue(lesson.id, c.id)).length,
    cardsMastered: boxes.filter((b) => b >= MASTERED_BOX).length,
    boxes,
    exTotal: lesson.exercises.length,
    exCorrect,
    attempts: entry?.attempts ?? 0,
    correct: entry?.correct ?? 0,
    accuracy: entry?.attempts ? Math.round((100 * entry.correct) / entry.attempts) : null,
    bestTest: tests.length ? Math.round(bestTest * 100) : null,
    lastSession: entry?.lastSession ?? null,
  };
}

/** Recommended next step inside a lesson (for the Continue button). */
export function nextStep(lesson) {
  const s = lessonStats(lesson);
  const visited = getState().lessons[lesson.id]?.visited ?? {};
  if (!visited.grammar && lesson.grammar?.length) return { href: `#/lesson/${lesson.id}/grammar`, label: 'Read the grammar' };
  if (s.cardsDue > 0) return { href: `#/lesson/${lesson.id}/vocab`, label: `Review vocabulary (${s.cardsDue})` };
  if (s.exCorrect < s.exTotal) return { href: `#/lesson/${lesson.id}/exercises`, label: 'Do the exercises' };
  if (s.bestTest === null || s.bestTest < 80) return { href: `#/lesson/${lesson.id}/test`, label: 'Take the final test' };
  return { href: `#/lesson/${lesson.id}`, label: 'Open the lesson' };
}
