// Pantallas de una lección: resumen, gramática, lectura, ejercicios y test final.
import { h, rich, formatDate, backLink, progressBar } from '../ui.js';
import { getLesson, lessonStats, cardsOf, prioritise, vocabQuestion } from '../lessons.js';
import { markVisited } from '../store.js';
import { runSession } from '../session.js';
import { speakButton } from '../speech.js';
import { shuffle } from '../check.js';

const SESSION_SIZE = 10;
const TEST_SIZE = 13;

function notFound(root) {
  root.replaceChildren(h('h1', null, 'Lección no encontrada'), h('a', { class: 'btn', href: '#/' }, 'Volver al inicio'));
}

export function lessonView(root, id) {
  const lesson = getLesson(id);
  if (!lesson) return notFound(root);
  const s = lessonStats(lesson);
  const base = `#/lesson/${lesson.id}`;

  const tile = (href, title, detail) =>
    h('a', { class: 'tile', href }, h('span', { class: 'tile-title' }, title), h('span', { class: 'tile-detail' }, detail));

  root.replaceChildren(
    backLink('#/', 'Lecciones'),
    h('p', { class: 'eyebrow' }, `Lección ${lesson.id.toUpperCase()} · clase del ${formatDate(lesson.classDate)}`),
    h('h1', null, lesson.title),
    h('div', { class: 'percent-row' }, progressBar(s.percent, 100, 'Lección completada'), h('span', null, `${s.percent} % completado`)),

    h('section', { 'aria-labelledby': 'h-obj' },
      h('h2', { id: 'h-obj' }, 'Objetivos'),
      h('ul', { class: 'objectives' }, lesson.objectives.map((o) => h('li', null, o)))),

    h('nav', { class: 'tiles', 'aria-label': 'Actividades de la lección' },
      tile(`${base}/vocab`, 'Vocabulario', s.cardsDue ? `${s.cardsDue} tarjetas para hoy` : 'Nada pendiente hoy'),
      tile(`${base}/grammar`, 'Gramática', `${lesson.grammar.length} apartados`),
      tile(`${base}/exercises`, 'Ejercicios', `${s.exCorrect} de ${s.exTotal} acertados`),
      lesson.reading ? tile(`${base}/reading`, lesson.reading.type === 'dialogue' ? 'Diálogo' : 'Lectura', lesson.reading.title) : null,
      tile(`${base}/test`, 'Test final', s.bestTest === null ? 'Sin hacer' : `Mejor nota: ${(s.bestTest / 10).toFixed(1).replace('.', ',')}`),
    ),

    h('section', { 'aria-labelledby': 'h-gram' },
      h('h2', { id: 'h-gram' }, 'Gramática clave'),
      h('div', { class: 'cards' }, lesson.grammar.map((g) =>
        h('article', { class: 'card' },
          h('h3', null, g.title),
          rich(g.explanation, 'p'),
          g.examples[0] ? h('p', { class: 'example', lang: 'en' }, rich(g.examples[0].en)) : null)))),

    h('section', { 'aria-labelledby': 'h-voc' },
      h('h2', { id: 'h-voc' }, 'Vocabulario clave'),
      h('ul', { class: 'vocab-list' }, lesson.vocabulary.map((v) =>
        h('li', null,
          h('div', { class: 'vocab-head' },
            h('strong', { lang: 'en' }, v.word), speakButton(v.word),
            h('span', { class: 'pos' }, v.partOfSpeech),
            v.pronunciationHint ? h('span', { class: 'ipa' }, v.pronunciationHint) : null),
          h('div', null, v.translation))))),

    lesson.phrases?.length
      ? h('section', { 'aria-labelledby': 'h-phr' },
          h('h2', { id: 'h-phr' }, 'Frases útiles'),
          h('ul', { class: 'vocab-list' }, lesson.phrases.map((p) =>
            h('li', null,
              h('div', { class: 'vocab-head' }, h('strong', { lang: 'en' }, p.en), speakButton(p.en)),
              h('div', null, p.es),
              h('div', { class: 'small' }, p.context)))))
      : null,
  );
}

export function grammarView(root, id) {
  const lesson = getLesson(id);
  if (!lesson) return notFound(root);
  markVisited(lesson.id, 'grammar');

  root.replaceChildren(
    backLink(`#/lesson/${lesson.id}`, lesson.title),
    h('h1', null, 'Gramática'),
    ...lesson.grammar.map((g) =>
      h('article', { class: 'card grammar' },
        h('h2', null, g.title),
        rich(g.explanation, 'p'),
        h('h3', null, 'Reglas'),
        h('ul', null, g.rules.map((r) => rich(r, 'li'))),
        h('h3', null, 'Ejemplos'),
        h('ul', { class: 'examples' }, g.examples.map((e) =>
          h('li', null,
            h('div', { class: 'example', lang: 'en' }, rich(e.en), ' ', speakButton(e.en)),
            h('div', { class: 'small' }, e.es),
            e.note ? rich(e.note, 'div', 'small note') : null))),
        g.commonMistakes?.length ? h('h3', null, 'Errores típicos de hispanohablantes') : null,
        g.commonMistakes?.length
          ? h('ul', { class: 'mistakes' }, g.commonMistakes.map((m) =>
              h('li', null,
                h('div', { lang: 'en' }, h('span', { class: 'tag ko' }, '✗ Incorrecto'), ' ', h('s', null, m.wrong)),
                h('div', { lang: 'en' }, h('span', { class: 'tag ok' }, '✓ Correcto'), ' ', rich(m.right)),
                rich(m.why, 'div', 'small'))))
          : null,
      )),
    h('a', { class: 'btn primary', href: `#/lesson/${lesson.id}/exercises` }, 'Practicar con ejercicios'),
  );
}

export function readingView(root, id) {
  const lesson = getLesson(id);
  if (!lesson?.reading) return notFound(root);
  markVisited(lesson.id, 'reading');
  const r = lesson.reading;

  const toggle = h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false' }, 'Mostrar traducción');
  const list = h('ol', { class: 'reading hide-es' }, r.lines.map((line) =>
    h('li', null,
      h('div', { class: 'line-en', lang: 'en' },
        line.speaker ? h('strong', null, line.speaker + ': ') : null, rich(line.en), ' ', speakButton(line.en)),
      h('div', { class: 'line-es small' }, line.es))));
  toggle.addEventListener('click', () => {
    const hidden = list.classList.toggle('hide-es');
    toggle.setAttribute('aria-pressed', String(!hidden));
    toggle.textContent = hidden ? 'Mostrar traducción' : 'Ocultar traducción';
  });

  root.replaceChildren(
    backLink(`#/lesson/${lesson.id}`, lesson.title),
    h('h1', null, r.title),
    r.intro ? h('p', null, r.intro) : null,
    toggle,
    list,
    r.questions?.length
      ? h('button', {
          type: 'button', class: 'btn primary',
          onClick: () => runSession(root, {
            title: 'Preguntas de comprensión',
            items: r.questions.map((ex) => ({ lesson, ex })),
            backHref: `#/lesson/${lesson.id}`,
          }),
        }, `Responder ${r.questions.length} preguntas`)
      : null,
  );
}

export function exercisesView(root, id) {
  const lesson = getLesson(id);
  if (!lesson) return notFound(root);
  runSession(root, {
    title: `Ejercicios · ${lesson.title}`,
    items: prioritise(lesson, lesson.exercises).slice(0, SESSION_SIZE).map((ex) => ({ lesson, ex })),
    backHref: `#/lesson/${lesson.id}`,
  });
}

/** Test final: mezcla equilibrada de tipos de ejercicio + preguntas de vocabulario. */
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
    h('h1', null, 'Test final'),
    h('p', null, `Hasta ${TEST_SIZE} preguntas mezcladas de gramática y vocabulario. No verás la corrección hasta el final: al terminar tendrás la nota y la lista de fallos.`),
    s.bestTest !== null ? h('p', { class: 'small' }, `Tu mejor nota hasta ahora: ${(s.bestTest / 10).toFixed(1).replace('.', ',')} / 10`) : null,
    h('button', {
      type: 'button', class: 'btn primary',
      onClick: () => runSession(root, {
        title: `Test · ${lesson.title}`,
        items: buildTest(lesson).map((ex) => ({ lesson, ex })),
        mode: 'test',
        backHref: `#/lesson/${lesson.id}`,
      }),
    }, 'Empezar el test'),
  );
}
