// Descubre las lecciones automáticamente: cualquier src/lessons/*.json entra en el menú.
import { shuffle } from './check.js';
import { getState, getCard, isDue, MASTERED_BOX } from './store.js';

const modules = import.meta.glob('./lessons/*.json', { eager: true });

export const lessons = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));

export const getLesson = (id) => lessons.find((l) => l.id === id);

/** Tarjetas de una lección: vocabulario + frases, con una forma común. */
export function cardsOf(lesson) {
  return [
    ...(lesson.vocabulary ?? []).map((v) => ({
      id: v.id, en: v.word, es: v.translation, pos: v.partOfSpeech,
      example: v.example, exampleEs: v.exampleTranslation, hint: v.pronunciationHint,
    })),
    ...(lesson.phrases ?? []).map((p) => ({ id: p.id, en: p.en, es: p.es, pos: 'frase', context: p.context })),
  ];
}

const AUTO = 'auto-mc:';

/** Pregunta de opción múltiple generada a partir de una tarjeta (para tests y repasos). */
export function vocabQuestion(lesson, card) {
  const others = shuffle(cardsOf(lesson).filter((c) => c.id !== card.id && c.es !== card.es)).slice(0, 3);
  const options = shuffle([card, ...others]);
  return {
    id: AUTO + card.id,
    type: 'multiple-choice',
    prompt: `¿Qué significa «${card.en}»?`,
    options: options.map((c) => c.es),
    answer: options.indexOf(card),
    explanation: card.example ? `Ejemplo: ${card.example}` : undefined,
    cardId: card.id,
    keepOrder: true,
  };
}

/** Recupera un ejercicio por id, incluidos los generados y las preguntas de la lectura. */
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

/** Ordena ejercicios para una sesión: primero los nunca hechos, luego los últimos fallados, luego el resto. */
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

  // % completado = 40 % ejercicios acertados alguna vez + 40 % avance de vocabulario + 20 % mejor test
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

/** Siguiente paso recomendado dentro de una lección (para el botón «Continuar»). */
export function nextStep(lesson) {
  const s = lessonStats(lesson);
  const visited = getState().lessons[lesson.id]?.visited ?? {};
  if (!visited.grammar && lesson.grammar?.length) return { href: `#/lesson/${lesson.id}/grammar`, label: 'Leer la gramática' };
  if (s.cardsDue > 0) return { href: `#/lesson/${lesson.id}/vocab`, label: `Repasar vocabulario (${s.cardsDue})` };
  if (s.exCorrect < s.exTotal) return { href: `#/lesson/${lesson.id}/exercises`, label: 'Hacer ejercicios' };
  if (s.bestTest === null || s.bestTest < 80) return { href: `#/lesson/${lesson.id}/test`, label: 'Hacer el test final' };
  return { href: `#/lesson/${lesson.id}`, label: 'Ver la lección' };
}
