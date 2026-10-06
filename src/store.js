// Estado de progreso en localStorage. Un único objeto versionado, exportable e importable.

export const STORAGE_KEY = 'english-review:v1';
export const BOXES = 5;
// Días hasta el siguiente repaso según la caja de Leitner (caja 1 = hoy mismo)
const INTERVALS = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };
export const MASTERED_BOX = 4;

const empty = () => ({
  version: 1,
  settings: { theme: null, direction: 'en-es' },
  lessons: {},   // id -> { lastSession, attempts, correct, exercises: {exId: {attempts, correct, lastCorrect}}, tests: [], visited: {} }
  cards: {},     // "lessonId:itemId" -> { box, due, seen, wrong }
  mistakes: {},  // "lessonId:exId" -> { count, last, streak }
  days: {},      // "YYYY-MM-DD" -> { answers, correct }
});

let state = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw && raw.version === 1) return { ...empty(), ...raw, settings: { ...empty().settings, ...raw.settings } };
  } catch { /* estado corrupto o almacenamiento no disponible: se empieza de cero */ }
  return empty();
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* sin almacenamiento: la sesión sigue en memoria */ }
}

export const getState = () => state;

export function dayKey(date = new Date()) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

function lessonEntry(id) {
  return (state.lessons[id] ??= { lastSession: null, attempts: 0, correct: 0, exercises: {}, tests: [], visited: {} });
}

function bumpDay(correct) {
  const day = (state.days[dayKey()] ??= { answers: 0, correct: 0 });
  day.answers++;
  if (correct) day.correct++;
}

export function setSetting(key, value) {
  state.settings[key] = value;
  save();
}

export function markVisited(lessonId, section) {
  const l = lessonEntry(lessonId);
  l.visited[section] = true;
  l.lastSession = new Date().toISOString();
  save();
}

/** Registra la respuesta a un ejercicio y mantiene el cuaderno de errores. */
export function recordAnswer(lessonId, exId, correct) {
  const l = lessonEntry(lessonId);
  l.lastSession = new Date().toISOString();
  l.attempts++;
  if (correct) l.correct++;
  const e = (l.exercises[exId] ??= { attempts: 0, correct: 0, lastCorrect: false });
  e.attempts++;
  if (correct) e.correct++;
  e.lastCorrect = correct;

  const key = `${lessonId}:${exId}`;
  const m = state.mistakes[key];
  if (!correct) {
    state.mistakes[key] = { count: (m?.count ?? 0) + 1, last: new Date().toISOString(), streak: 0 };
  } else if (m) {
    // Un fallo sale del cuaderno al acertarlo dos veces seguidas
    m.streak++;
    if (m.streak >= 2) delete state.mistakes[key];
  }
  bumpDay(correct);
  save();
}

/** Leitner: acierto sube de caja; fallo vuelve a la caja 1 y toca repasarla hoy. */
export function recordCard(lessonId, itemId, correct, countDay = true) {
  const key = `${lessonId}:${itemId}`;
  const c = (state.cards[key] ??= { box: 1, due: dayKey(), seen: 0, wrong: 0 });
  c.seen++;
  if (correct) c.box = Math.min(BOXES, c.box + 1);
  else { c.box = 1; c.wrong++; }
  c.due = addDays(INTERVALS[c.box]);
  lessonEntry(lessonId).lastSession = new Date().toISOString();
  if (countDay) bumpDay(correct);
  save();
  return c;
}

export const getCard = (lessonId, itemId) => state.cards[`${lessonId}:${itemId}`];

export function isDue(lessonId, itemId) {
  const c = getCard(lessonId, itemId);
  return !c || c.due <= dayKey();
}

export function recordTest(lessonId, score, total) {
  lessonEntry(lessonId).tests.push({ date: new Date().toISOString(), score, total });
  save();
}

export function streak() {
  const days = state.days;
  let n = 0;
  const d = new Date();
  if (!days[dayKey(d)]) d.setDate(d.getDate() - 1); // hoy aún no cuenta en contra
  while (days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function exportProgress() {
  return JSON.stringify({ app: 'english-review', exportedAt: new Date().toISOString(), ...state }, null, 2);
}

export function importProgress(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('El archivo no es un JSON válido.'); }
  if (!data || data.app !== 'english-review' || data.version !== 1) {
    throw new Error('El archivo no parece un progreso exportado por esta app.');
  }
  for (const k of ['lessons', 'cards', 'mistakes', 'days']) {
    if (typeof data[k] !== 'object' || data[k] === null || Array.isArray(data[k])) {
      throw new Error(`Al archivo le falta la sección «${k}».`);
    }
  }
  const { app, exportedAt, ...rest } = data;
  state = { ...empty(), ...rest, settings: { ...empty().settings, ...rest.settings } };
  save();
}

export function resetProgress() {
  const settings = state.settings;
  state = { ...empty(), settings };
  save();
}
