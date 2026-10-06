// Lesson screens: overview, grammar, reading, exercises and the final test.
import { h, rich, formatDate, backLink, progressBar } from '../ui.js';
import { getLesson, lessonStats, cardsOf, prioritise, vocabQuestion } from '../lessons.js';
import { markVisited } from '../store.js';
import { runSession } from '../session.js';
import { speakButton } from '../speech.js';
import { shuffle } from '../check.js';

const SESSION_SIZE = 10;
const TEST_SIZE = 13;

const score10 = (pct) => (pct / 10).toFixed(1);

function notFound(root) {
  root.replaceChildren(h('h1', null, 'Lesson not found'), h('a', { class: 'btn', href: '#/' }, 'Back to home'));
}

export function lessonView(root, id) {
  const lesson = getLesson(id);
  if (!lesson) return notFound(root);
  const s = lessonStats(lesson);
  const base = `#/lesson/${lesson.id}`;

  const tile = (href, title, detail) =>
    h('a', { class: 'tile', href }, h('span', { class: 'tile-title' }, title), h('span', { class: 'tile-detail' }, detail));

  root.replaceChildren(
    backLink('#/', 'Lessons'),
    h('p', { class: 'eyebrow' }, `Lesson ${lesson.id.toUpperCase()}`, lesson.classDate ? ` · class on ${formatDate(lesson.classDate)}` : ''),
    h('h1', null, lesson.title),
    h('div', { class: 'percent-row' }, progressBar(s.percent, 100, 'Lesson completed'), h('span', null, `${s.percent}% complete`)),

    h('section', { 'aria-labelledby': 'h-obj' },
      h('h2', { id: 'h-obj' }, 'Objectives'),
      h('ul', { class: 'objectives' }, lesson.objectives.map((o) => h('li', null, o)))),

    h('nav', { class: 'tiles', 'aria-label': 'Lesson activities' },
      tile(`${base}/vocab`, 'Vocabulary', s.cardsDue ? `${s.cardsDue} cards due today` : 'Nothing due today'),
      tile(`${base}/grammar`, 'Grammar', `${lesson.grammar.length} sections`),
      tile(`${base}/exercises`, 'Exercises', `${s.exCorrect} of ${s.exTotal} correct`),
      lesson.reading ? tile(`${base}/reading`, lesson.reading.type === 'dialogue' ? 'Dialogue' : 'Reading', lesson.reading.title) : null,
      tile(`${base}/test`, 'Final test', s.bestTest === null ? 'Not taken yet' : `Best score: ${score10(s.bestTest)}`),
    ),

    h('section', { 'aria-labelledby': 'h-gram' },
      h('h2', { id: 'h-gram' }, 'Key grammar'),
      h('div', { class: 'cards' }, lesson.grammar.map((g) =>
        h('article', { class: 'card' },
          h('h3', null, g.title),
          rich(g.explanation, 'p'),
          g.examples[0] ? h('p', { class: 'example' }, rich(g.examples[0].en)) : null)))),

    h('section', { 'aria-labelledby': 'h-voc' },
      h('h2', { id: 'h-voc' }, 'Key vocabulary'),
      h('ul', { class: 'vocab-list' }, lesson.vocabulary.map((v) =>
        h('li', null,
          h('div', { class: 'vocab-head' },
            h('strong', null, v.word), speakButton(v.word),
            h('span', { class: 'pos' }, v.partOfSpeech),
            v.pronunciationHint ? h('span', { class: 'ipa' }, v.pronunciationHint) : null),
          h('div', null, v.definition))))),

    lesson.phrases?.length
      ? h('section', { 'aria-labelledby': 'h-phr' },
          h('h2', { id: 'h-phr' }, 'Useful phrases'),
          h('ul', { class: 'vocab-list' }, lesson.phrases.map((p) =>
            h('li', null,
              h('div', { class: 'vocab-head' }, h('strong', null, p.phrase), speakButton(p.phrase)),
              h('div', null, p.meaning),
              p.context ? h('div', { class: 'small' }, p.context) : null))))
      : null,
  );
}

export function grammarView(root, id) {
  const lesson = getLesson(id);
  if (!lesson) return notFound(root);
  markVisited(lesson.id, 'grammar');

  root.replaceChildren(
    backLink(`#/lesson/${lesson.id}`, lesson.title),
    h('h1', null, 'Grammar'),
    ...lesson.grammar.map((g) =>
      h('article', { class: 'card grammar' },
        h('h2', null, g.title),
        rich(g.explanation, 'p'),
        h('h3', null, 'Rules'),
        h('ul', null, g.rules.map((r) => rich(r, 'li'))),
        h('h3', null, 'Examples'),
        h('ul', { class: 'examples' }, g.examples.map((e) =>
          h('li', null,
            h('div', { class: 'example' }, rich(e.en), ' ', speakButton(e.en)),
            e.note ? rich(e.note, 'div', 'small note') : null))),
        g.commonMistakes?.length ? h('h3', null, 'Common mistakes') : null,
        g.commonMistakes?.length
          ? h('ul', { class: 'mistakes' }, g.commonMistakes.map((m) =>
              h('li', null,
                h('div', null, h('span', { class: 'tag ko' }, '✗ Wrong'), ' ', h('s', null, m.wrong)),
                h('div', null, h('span', { class: 'tag ok' }, '✓ Right'), ' ', rich(m.right)),
                rich(m.why, 'div', 'small'))))
          : null,
      )),
    h('a', { class: 'btn primary', href: `#/lesson/${lesson.id}/exercises` }, 'Practise with exercises'),
  );
}

export function readingView(root, id) {
  const lesson = getLesson(id);
  if (!lesson?.reading) return notFound(root);
  markVisited(lesson.id, 'reading');
  const r = lesson.reading;

  root.replaceChildren(
    backLink(`#/lesson/${lesson.id}`, lesson.title),
    h('h1', null, r.title),
    r.intro ? h('p', null, r.intro) : null,
    h('ol', { class: 'reading' }, r.lines.map((line) =>
      h('li', null,
        h('div', { class: 'line-en' },
          line.speaker ? h('strong', null, line.speaker + ': ') : null, rich(line.en), ' ', speakButton(line.en))))),
    r.questions?.length
      ? h('button', {
          type: 'button', class: 'btn primary',
          onClick: () => runSession(root, {
            title: 'Comprehension questions',
            items: r.questions.map((ex) => ({ lesson, ex })),
            backHref: `#/lesson/${lesson.id}`,
          }),
        }, `Answer ${r.questions.length} questions`)
      : null,
  );
}

export function exercisesView(root, id) {
  const lesson = getLesson(id);
  if (!lesson) return notFound(root);
  runSession(root, {
    title: `Exercises · ${lesson.title}`,
    items: prioritise(lesson, lesson.exercises).slice(0, SESSION_SIZE).map((ex) => ({ lesson, ex })),
    backHref: `#/lesson/${lesson.id}`,
  });
}

/** Final test: a balanced mix of exercise types plus vocabulary questions. */
export function buildTest(lesson) {
  const byType = {};
  for (const ex of shuffle(lesson.exercises)) (byType[ex.type] ??= []).push(ex);
  const vocab = shuffle(cardsOf(lesson)).slice(0, 4).map((c) => vocabQuestion(lesson, c));
  const picked = [];
  const queues = shuffle(Object.values(byType));
  while (picked.length < TEST_SIZE - vocab.length && queues.some((q) => q.length)) {
    for (const q of queues) {
      if (q.length && picked.length < TEST_SIZE - vocab.length) picked.push(q.pop());
    }
  }
  return shuffle([...picked, ...vocab]);
}

export function testView(root, id) {
  const lesson = getLesson(id);
  if (!lesson) return notFound(root);
  const s = lessonStats(lesson);
  root.replaceChildren(
    backLink(`#/lesson/${lesson.id}`, lesson.title),
    h('h1', null, 'Final test'),
    h('p', null, `Up to ${TEST_SIZE} mixed grammar and vocabulary questions. You won't see any corrections until the end, when you get your score and a list of your mistakes.`),
    s.bestTest !== null ? h('p', { class: 'small' }, `Your best score so far: ${score10(s.bestTest)} / 10`) : null,
    h('button', {
      type: 'button', class: 'btn primary',
      onClick: () => runSession(root, {
        title: `Test · ${lesson.title}`,
        items: buildTest(lesson).map((ex) => ({ lesson, ex })),
        mode: 'test',
        backHref: `#/lesson/${lesson.id}`,
      }),
    }, 'Start the test'),
  );
}
