// Global screens: home, mistakes notebook, cumulative review and progress.
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

const times = (n) => (n === 1 ? 'once' : `${n} times`);

// ---------- Home ----------
export function homeView(root) {
  const state = getState();
  const days = streak();
  const withActivity = lessons
    .filter((l) => state.lessons[l.id]?.lastSession)
    .sort((a, b) => state.lessons[b.id].lastSession.localeCompare(state.lessons[a.id].lastSession));
  const current = withActivity[0] ?? lessons[0];

  if (!lessons.length) {
    root.replaceChildren(h('h1', null, 'English Review'),
      h('p', { class: 'empty' }, 'There are no lessons yet. Add a file to src/lessons/ (see the README).'));
    return;
  }
  const step = nextStep(current);

  root.replaceChildren(
    h('h1', null, 'Your English review'),
    h('p', { class: 'lead' }, days > 1
      ? `You have practised ${days} days in a row.`
      : days === 1 ? 'You have already practised today. Come back tomorrow to start a streak.'
      : 'One short session after each class is enough to make it stick.'),

    h('section', { class: 'card continue', 'aria-labelledby': 'h-continue' },
      h('h2', { id: 'h-continue' }, withActivity.length ? 'Continue' : 'Get started'),
      h('p', null, `Lesson ${current.id.toUpperCase()} · ${current.title}`),
      h('a', { class: 'btn primary', href: step.href }, withActivity.length ? `Continue: ${step.label}` : `Start: ${step.label}`)),

    h('section', { 'aria-labelledby': 'h-lessons' },
      h('h2', { id: 'h-lessons' }, 'Lessons'),
      h('ul', { class: 'lesson-list' }, lessons.map((l) => {
        const s = lessonStats(l);
        return h('li', null,
          h('a', { class: 'card lesson-card', href: `#/lesson/${l.id}` },
            h('span', { class: 'eyebrow' }, `Lesson ${l.id.toUpperCase()}`),
            h('span', { class: 'lesson-title' }, l.title),
            h('span', { class: 'percent-row' },
              progressBar(s.percent, 100, `Lesson ${l.id} completed`), h('span', null, `${s.percent}%`)),
            h('span', { class: 'small' },
              s.lastSession ? `Last session: ${formatDate(s.lastSession)}` : 'Not started',
              s.cardsDue && s.lastSession ? ` · ${s.cardsDue} cards due today` : '')));
      }))),

    h('div', { class: 'row' },
      h('a', { class: 'btn', href: '#/review' }, 'Cumulative review'),
      h('a', { class: 'btn', href: '#/mistakes' }, `Mistakes notebook (${Object.keys(state.mistakes).length})`)),
  );
}

// ---------- Mistakes notebook ----------
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
      title: 'Practise my mistakes',
      items: shuffle([...entries.map(({ lesson, ex }) => ({ lesson, ex })), ...fromWords]).slice(0, MISTAKE_SESSION),
      backHref: '#/mistakes',
    });
  };

  root.replaceChildren(
    h('h1', null, 'Mistakes notebook'),
    h('p', null, 'Everything you get wrong is kept here. An exercise leaves the notebook once you get it right twice in a row.'),
    entries.length || words.length
      ? h('button', { type: 'button', class: 'btn primary', onClick: practise }, 'Practise only my mistakes')
      : h('p', { class: 'empty' }, 'You have no outstanding mistakes right now. When you get something wrong, it will appear here.'),

    entries.length
      ? h('section', { 'aria-labelledby': 'h-ex' },
          h('h2', { id: 'h-ex' }, `Exercises you got wrong (${entries.length})`),
          h('ul', { class: 'review-list' }, entries.map((e) =>
            h('li', null, h('div', { class: 'card' },
              h('p', { class: 'ex-type' }, `${TYPE_LABELS[e.ex.type]} · Lesson ${e.lesson.id.toUpperCase()}`),
              h('p', null, describe(e.ex)),
              h('p', null, 'Correct: ', h('strong', null, correctAnswerText(e.ex))),
              h('p', { class: 'small' },
                `Missed ${times(e.count)} · last time: ${formatDate(e.last)}`,
                e.streak ? ' · answered correctly once since then' : ''))))))
      : null,

    words.length
      ? h('section', { 'aria-labelledby': 'h-words' },
          h('h2', { id: 'h-words' }, `Words that won't stick (${words.length})`),
          h('ul', { class: 'vocab-list' }, words.map((w) =>
            h('li', null,
              h('div', { class: 'vocab-head' }, h('strong', null, w.card.en), speakButton(w.card.en)),
              h('div', null, w.card.def),
              h('div', { class: 'small' }, `Missed ${times(w.wrong)} · box ${w.box}`)))))
      : null,
  );
}

// ---------- Cumulative review ----------
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
  // Vocabulary: cards that are due and cards in low boxes come first
  const cards = shuffle(cardPool).sort((a, b) => a.overdue - b.overdue || a.box - b.box).slice(0, 5)
    .map(({ lesson, card }) => ({ lesson, ex: vocabQuestion(lesson, card) }));
  // Exercises: spread across lessons, keeping each lesson's own priority order
  const exercises = exPool.sort((a, b) => a.rank - b.rank).slice(0, REVIEW_SIZE - cards.length)
    .map(({ lesson, ex }) => ({ lesson, ex }));
  return shuffle([...cards, ...exercises]);
}

export function reviewView(root) {
  const started = lessons.filter((l) => getState().lessons[l.id]);
  root.replaceChildren(
    h('h1', null, 'Cumulative review'),
    h('p', null, `A session of about ${REVIEW_SIZE} questions mixing vocabulary and exercises from every lesson you have started, with priority for what is due and what you got wrong.`),
    started.length
      ? h('p', { class: 'small' }, `Lessons included: ${started.map((l) => l.id.toUpperCase()).join(', ')}.`)
      : h('p', { class: 'empty' }, 'You have not started any lessons yet. Do a session from lesson 1 first.'),
    started.length
      ? h('button', {
          type: 'button', class: 'btn primary',
          onClick: () => runSession(root, { title: 'Cumulative review', items: buildReview(), backHref: '#/review' }),
        }, 'Start the review')
      : h('a', { class: 'btn primary', href: '#/' }, 'Go to the lessons'),
  );
}

// ---------- Progress ----------
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

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', 'aria-label': 'Progress file' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (!confirm('Importing will replace the progress saved on this device. Continue?')) return;
      importProgress(text);
      progressView(root);
      root.querySelector('[role=status]').textContent = 'Progress imported.';
    } catch (err) {
      message.textContent = `Could not import: ${err.message}`;
    } finally {
      fileInput.value = '';
    }
  });

  const doExport = () => {
    const blob = new Blob([exportProgress()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `english-review-progress-${dayKey()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    message.textContent = 'Progress exported. Keep the file to move it to another device.';
  };

  const streakDays = streak();
  const practised = Object.keys(state.days).length;

  root.replaceChildren(
    h('h1', null, 'Progress'),
    h('ul', { class: 'stats' },
      stat(streakDays, streakDays === 1 ? 'day streak' : 'days streak'),
      stat(practised, practised === 1 ? 'day practised' : 'days practised'),
      stat(`${mastered} / ${totalCards}`, 'words mastered'),
      stat(attempts ? `${Math.round((100 * correct) / attempts)}%` : '—', 'overall accuracy')),
    h('p', { class: 'small' }, `A word counts as mastered when it reaches box ${MASTERED_BOX} (you have got it right in reviews several days apart).`),

    h('section', { 'aria-labelledby': 'h-boxes' },
      h('h2', { id: 'h-boxes' }, 'Vocabulary by box'),
      h('ul', { class: 'box-bars' }, boxCounts.map((n, i) =>
        h('li', null,
          h('span', { class: 'box-label' }, i === 0 ? 'Not seen' : `Box ${i}`),
          progressBar(n, totalCards || 1, i === 0 ? 'Cards not seen yet' : `Cards in box ${i}`),
          h('span', { class: 'box-count' }, n))))),

    h('section', { 'aria-labelledby': 'h-by-lesson' },
      h('h2', { id: 'h-by-lesson' }, 'By lesson'),
      h('div', { class: 'table-wrap' },
        h('table', null,
          h('thead', null, h('tr', null,
            ['Lesson', 'Complete', 'Accuracy', 'Best test', 'Last session'].map((t) => h('th', { scope: 'col' }, t)))),
          h('tbody', null, stats.map(({ lesson, s }) =>
            h('tr', null,
              h('th', { scope: 'row' }, h('a', { href: `#/lesson/${lesson.id}` }, `${lesson.id.toUpperCase()} · ${lesson.title}`)),
              h('td', null, `${s.percent}%`),
              h('td', null, s.accuracy === null ? '—' : `${s.accuracy}% (${s.correct}/${s.attempts})`),
              h('td', null, s.bestTest === null ? '—' : (s.bestTest / 10).toFixed(1)),
              h('td', null, formatDate(s.lastSession)))))))),

    h('section', { 'aria-labelledby': 'h-data' },
      h('h2', { id: 'h-data' }, 'Backup'),
      h('p', { class: 'small' }, 'Your progress is stored only in this browser. Export it to keep a copy or to move it from your computer to your phone.'),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onClick: doExport }, 'Export progress (JSON)'),
        h('button', { type: 'button', class: 'btn', onClick: () => fileInput.click() }, 'Import progress'),
        fileInput,
        h('button', {
          type: 'button', class: 'btn danger',
          onClick: () => {
            if (confirm('This deletes all progress on this device and cannot be undone. Are you sure?')) {
              resetProgress();
              progressView(root);
            }
          },
        }, 'Delete progress')),
      message),
  );
}
