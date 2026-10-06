// Pantallas globales: inicio, cuaderno de errores, repaso acumulado y progreso.
import { h, formatDate, progressBar } from '../ui.js';
import { lessons, getLesson, lessonStats, nextStep, cardsOf, findExercise, vocabQuestion, prioritise } from '../lessons.js';
import {
  getState, getCard, streak, exportProgress, importProgress, resetProgress, dayKey, BOXES, MASTERED_BOX,
} from '../store.js';
import { runSession } from '../session.js';
import { describe, correctAnswerText, TYPE_LABELS } from '../exercises.js';
import { speakButton } from '../speech.js';
import { shuffle } from '../check.js';

const REVIEW_SIZE = 12;
const MISTAKE_SESSION = 15;

// ---------- Inicio ----------
export function homeView(root) {
  const state = getState();
  const days = streak();
  const withActivity = lessons
    .filter((l) => state.lessons[l.id]?.lastSession)
    .sort((a, b) => state.lessons[b.id].lastSession.localeCompare(state.lessons[a.id].lastSession));
  const current = withActivity[0] ?? lessons[0];

  if (!lessons.length) {
    root.replaceChildren(h('h1', null, 'English Review'),
      h('p', { class: 'empty' }, 'Todavía no hay lecciones. Añade un archivo en src/lessons/ (mira el README).'));
    return;
  }
  const step = nextStep(current);

  root.replaceChildren(
    h('h1', null, 'Tu repaso de inglés'),
    h('p', { class: 'lead' }, days
      ? (days === 1 ? 'Hoy ya has practicado. Vuelve mañana para empezar una racha.' : `Llevas ${days} días seguidos practicando.`)
      : 'Una sesión corta después de cada clase es suficiente para afianzar.'),

    h('section', { class: 'card continue', 'aria-labelledby': 'h-continue' },
      h('h2', { id: 'h-continue' }, withActivity.length ? 'Continuar' : 'Empezar'),
      h('p', null, `Lección ${current.id.toUpperCase()} · ${current.title}`),
      h('a', { class: 'btn primary', href: step.href }, withActivity.length ? `Continuar: ${step.label}` : `Empezar: ${step.label}`)),

    h('section', { 'aria-labelledby': 'h-lessons' },
      h('h2', { id: 'h-lessons' }, 'Lecciones'),
      h('ul', { class: 'lesson-list' }, lessons.map((l) => {
        const s = lessonStats(l);
        return h('li', null,
          h('a', { class: 'card lesson-card', href: `#/lesson/${l.id}` },
            h('span', { class: 'eyebrow' }, `Lección ${l.id.toUpperCase()}`),
            h('span', { class: 'lesson-title' }, l.title),
            h('span', { class: 'percent-row' },
              progressBar(s.percent, 100, `Lección ${l.id} completada`), h('span', null, `${s.percent} %`)),
            h('span', { class: 'small' },
              s.lastSession ? `Última sesión: ${formatDate(s.lastSession)}` : 'Sin empezar',
              s.cardsDue && s.lastSession ? ` · ${s.cardsDue} tarjetas para hoy` : '')));
      }))),

    h('div', { class: 'row' },
      h('a', { class: 'btn', href: '#/review' }, 'Repaso acumulado'),
      h('a', { class: 'btn', href: '#/mistakes' }, `Cuaderno de errores (${Object.keys(state.mistakes).length})`)),
  );
}

// ---------- Cuaderno de errores ----------
function mistakeEntries() {
  const out = [];
  for (const [key, m] of Object.entries(getState().mistakes)) {
    const [lessonId, ...rest] = key.split(':');
    const lesson = getLesson(lessonId);
    const ex = lesson && findExercise(lesson, rest.join(':'));
    if (ex) out.push({ lesson, ex, ...m });
  }
  return out.sort((a, b) => b.last.localeCompare(a.last));
}

function hardWords() {
  const out = [];
  for (const lesson of lessons) {
    for (const card of cardsOf(lesson)) {
      const c = getCard(lesson.id, card.id);
      if (c && c.wrong > 0 && c.box <= 2) out.push({ lesson, card, ...c });
    }
  }
  return out;
}

export function mistakesView(root) {
  const entries = mistakeEntries();
  const words = hardWords();

  const practise = () => {
    const mistakeIds = new Set(entries.map((e) => `${e.lesson.id}:${e.ex.id}`));
    const fromWords = words
      .map((w) => ({ lesson: w.lesson, ex: vocabQuestion(w.lesson, w.card) }))
      .filter((i) => !mistakeIds.has(`${i.lesson.id}:${i.ex.id}`));
    runSession(root, {
      title: 'Practicar mis fallos',
      items: shuffle([...entries.map(({ lesson, ex }) => ({ lesson, ex })), ...fromWords]).slice(0, MISTAKE_SESSION),
      backHref: '#/mistakes',
    });
  };

  root.replaceChildren(
    h('h1', null, 'Cuaderno de errores'),
    h('p', null, 'Aquí se guarda todo lo que fallas. Un ejercicio sale del cuaderno cuando lo aciertas dos veces seguidas.'),
    entries.length || words.length
      ? h('button', { type: 'button', class: 'btn primary', onClick: practise }, 'Practicar solo mis fallos')
      : h('p', { class: 'empty' }, 'Ahora mismo no tienes fallos pendientes. Cuando falles algo, aparecerá aquí.'),

    entries.length
      ? h('section', { 'aria-labelledby': 'h-ex' },
          h('h2', { id: 'h-ex' }, `Ejercicios fallados (${entries.length})`),
          h('ul', { class: 'review-list' }, entries.map((e) =>
            h('li', null, h('div', { class: 'card' },
              h('p', { class: 'ex-type' }, `${TYPE_LABELS[e.ex.type]} · Lección ${e.lesson.id.toUpperCase()}`),
              h('p', null, describe(e.ex)),
              h('p', null, 'Correcta: ', h('strong', { lang: 'en' }, correctAnswerText(e.ex))),
              h('p', { class: 'small' },
                `Fallado ${e.count} ${e.count === 1 ? 'vez' : 'veces'} · último: ${formatDate(e.last)}`,
                e.streak ? ' · acertado 1 vez desde entonces' : ''))))))
      : null,

    words.length
      ? h('section', { 'aria-labelledby': 'h-words' },
          h('h2', { id: 'h-words' }, `Palabras que se resisten (${words.length})`),
          h('ul', { class: 'vocab-list' }, words.map((w) =>
            h('li', null,
              h('div', { class: 'vocab-head' }, h('strong', { lang: 'en' }, w.card.en), speakButton(w.card.en)),
              h('div', null, w.card.es),
              h('div', { class: 'small' }, `Fallada ${w.wrong} ${w.wrong === 1 ? 'vez' : 'veces'} · caja ${w.box}`)))))
      : null,
  );
}

// ---------- Repaso acumulado ----------
export function buildReview() {
  const today = dayKey();
  const cardPool = [];
  const exPool = [];
  for (const lesson of lessons) {
    for (const card of cardsOf(lesson)) {
      const c = getCard(lesson.id, card.id);
      if (c) cardPool.push({ lesson, card, overdue: c.due <= today ? 0 : 1, box: c.box });
    }
    const started = getState().lessons[lesson.id];
    if (started) prioritise(lesson, lesson.exercises).forEach((ex, rank) => exPool.push({ lesson, ex, rank }));
  }
  // Vocabulario: primero lo que toca hoy y lo que está en cajas bajas
  const cards = shuffle(cardPool).sort((a, b) => a.overdue - b.overdue || a.box - b.box).slice(0, 5)
    .map(({ lesson, card }) => ({ lesson, ex: vocabQuestion(lesson, card) }));
  // Ejercicios: repartidos entre lecciones, respetando la prioridad de cada una
  const exercises = exPool.sort((a, b) => a.rank - b.rank).slice(0, REVIEW_SIZE - cards.length)
    .map(({ lesson, ex }) => ({ lesson, ex }));
  return shuffle([...cards, ...exercises]);
}

export function reviewView(root) {
  const started = lessons.filter((l) => getState().lessons[l.id]);
  root.replaceChildren(
    h('h1', null, 'Repaso acumulado'),
    h('p', null, `Una sesión de unas ${REVIEW_SIZE} preguntas que mezcla vocabulario y ejercicios de todas las lecciones que ya has empezado, dando prioridad a lo que toca repasar y a lo que fallaste.`),
    started.length
      ? h('p', { class: 'small' }, `Lecciones incluidas: ${started.map((l) => l.id.toUpperCase()).join(', ')}.`)
      : h('p', { class: 'empty' }, 'Aún no has empezado ninguna lección. Haz primero una sesión de la lección 1.'),
    started.length
      ? h('button', {
          type: 'button', class: 'btn primary',
          onClick: () => runSession(root, { title: 'Repaso acumulado', items: buildReview(), backHref: '#/review' }),
        }, 'Empezar el repaso')
      : h('a', { class: 'btn primary', href: '#/' }, 'Ir a las lecciones'),
  );
}

// ---------- Progreso ----------
export function progressView(root) {
  const state = getState();
  const stats = lessons.map((l) => ({ lesson: l, s: lessonStats(l) }));
  const totalCards = stats.reduce((n, x) => n + x.s.cardsTotal, 0);
  const mastered = stats.reduce((n, x) => n + x.s.cardsMastered, 0);
  const attempts = stats.reduce((n, x) => n + x.s.attempts, 0);
  const correct = stats.reduce((n, x) => n + x.s.correct, 0);
  const boxCounts = Array(BOXES + 1).fill(0);
  stats.forEach((x) => x.s.boxes.forEach((b) => boxCounts[b]++));
  const message = h('p', { class: 'small', role: 'status' });

  const stat = (value, label) => h('li', null, h('strong', null, value), h('span', null, label));

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', 'aria-label': 'Archivo de progreso' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (!confirm('Importar sustituirá el progreso actual de este dispositivo. ¿Continuar?')) return;
      importProgress(text);
      progressView(root);
      root.querySelector('[role=status]').textContent = 'Progreso importado correctamente.';
    } catch (err) {
      message.textContent = `No se ha podido importar: ${err.message}`;
    } finally {
      fileInput.value = '';
    }
  });

  const doExport = () => {
    const blob = new Blob([exportProgress()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `english-review-progreso-${dayKey()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    message.textContent = 'Progreso exportado. Guarda el archivo para llevarlo a otro dispositivo.';
  };

  root.replaceChildren(
    h('h1', null, 'Progreso'),
    h('ul', { class: 'stats' },
      stat(streak(), 'días de racha'),
      stat(Object.keys(state.days).length, 'días practicados'),
      stat(`${mastered} / ${totalCards}`, 'palabras dominadas'),
      stat(attempts ? `${Math.round((100 * correct) / attempts)} %` : '—', 'precisión global')),
    h('p', { class: 'small' }, `Una palabra cuenta como dominada cuando llega a la caja ${MASTERED_BOX} (la has acertado en repasos separados por varios días).`),

    h('section', { 'aria-labelledby': 'h-boxes' },
      h('h2', { id: 'h-boxes' }, 'Vocabulario por cajas'),
      h('ul', { class: 'box-bars' }, boxCounts.map((n, i) =>
        h('li', null,
          h('span', { class: 'box-label' }, i === 0 ? 'Sin ver' : `Caja ${i}`),
          progressBar(n, totalCards || 1, i === 0 ? 'Tarjetas sin ver' : `Tarjetas en la caja ${i}`),
          h('span', { class: 'box-count' }, n))))),

    h('section', { 'aria-labelledby': 'h-by-lesson' },
      h('h2', { id: 'h-by-lesson' }, 'Por lección'),
      h('div', { class: 'table-wrap' },
        h('table', null,
          h('thead', null, h('tr', null,
            ['Lección', 'Completado', 'Precisión', 'Mejor test', 'Última sesión'].map((t) => h('th', { scope: 'col' }, t)))),
          h('tbody', null, stats.map(({ lesson, s }) =>
            h('tr', null,
              h('th', { scope: 'row' }, h('a', { href: `#/lesson/${lesson.id}` }, `${lesson.id.toUpperCase()} · ${lesson.title}`)),
              h('td', null, `${s.percent} %`),
              h('td', null, s.accuracy === null ? '—' : `${s.accuracy} % (${s.correct}/${s.attempts})`),
              h('td', null, s.bestTest === null ? '—' : `${(s.bestTest / 10).toFixed(1).replace('.', ',')}`),
              h('td', null, formatDate(s.lastSession)))))))),

    h('section', { 'aria-labelledby': 'h-data' },
      h('h2', { id: 'h-data' }, 'Copia de seguridad'),
      h('p', { class: 'small' }, 'El progreso se guarda solo en este navegador. Expórtalo para tener una copia o para pasarlo del ordenador al móvil.'),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onClick: doExport }, 'Exportar progreso (JSON)'),
        h('button', { type: 'button', class: 'btn', onClick: () => fileInput.click() }, 'Importar progreso'),
        fileInput,
        h('button', {
          type: 'button', class: 'btn danger',
          onClick: () => {
            if (confirm('Esto borra todo el progreso de este dispositivo y no se puede deshacer. ¿Seguro?')) {
              resetProgress();
              progressView(root);
            }
          },
        }, 'Borrar progreso')),
      message),
  );
}
