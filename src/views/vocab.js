// Flashcards con volteo y repaso espaciado (cajas de Leitner).
import { h, rich, backLink, progressBar } from '../ui.js';
import { getLesson, cardsOf } from '../lessons.js';
import { getState, setSetting, recordCard, getCard, isDue, BOXES } from '../store.js';
import { speak, speakButton, stopSpeaking } from '../speech.js';
import { shuffle } from '../check.js';

const MAX_CARDS = 20;

export function vocabView(root, id) {
  const lesson = getLesson(id);
  if (!lesson) {
    root.replaceChildren(h('h1', null, 'Lección no encontrada'), h('a', { class: 'btn', href: '#/' }, 'Volver al inicio'));
    return;
  }
  const back = `#/lesson/${lesson.id}`;
  const all = cardsOf(lesson);
  const due = all.filter((c) => isDue(lesson.id, c.id));

  function intro() {
    const direction = getState().settings.direction;
    const dirButton = (value, label) =>
      h('button', {
        type: 'button', class: 'btn seg', 'aria-pressed': String(direction === value),
        onClick: () => { setSetting('direction', value); intro(); },
      }, label);

    root.replaceChildren(
      backLink(back, lesson.title),
      h('h1', null, 'Vocabulario'),
      h('p', null, due.length
        ? `Hoy tocan ${due.length} de ${all.length} tarjetas. Las que falles volverán a salir en esta misma sesión y mañana.`
        : 'No tienes tarjetas pendientes hoy. El repaso espaciado funciona mejor si respetas las pausas, pero puedes repasarlas todas si quieres.'),
      h('div', { class: 'row', role: 'group', 'aria-label': 'Dirección de las tarjetas' },
        dirButton('en-es', 'Inglés → Español'), dirButton('es-en', 'Español → Inglés')),
      h('div', { class: 'row' },
        due.length
          ? h('button', { type: 'button', class: 'btn primary', onClick: () => start(due) }, `Empezar (${Math.min(due.length, MAX_CARDS)})`)
          : null,
        h('button', { type: 'button', class: due.length ? 'btn' : 'btn primary', onClick: () => start(all) }, 'Repasar todas'),
      ),
      boxesLegend(),
    );
  }

  function boxesLegend() {
    const counts = Array(BOXES + 1).fill(0);
    for (const c of all) counts[getCard(lesson.id, c.id)?.box ?? 0]++;
    return h('section', { 'aria-labelledby': 'h-boxes' },
      h('h2', { id: 'h-boxes' }, 'Tus cajas'),
      h('p', { class: 'small' }, 'Cada acierto sube la tarjeta una caja y la aleja en el tiempo (1, 3, 7 y 14 días). Un fallo la devuelve a la caja 1.'),
      h('ul', { class: 'boxes' },
        h('li', null, h('span', null, 'Sin ver'), h('strong', null, counts[0])),
        counts.slice(1).map((n, i) => h('li', null, h('span', null, `Caja ${i + 1}`), h('strong', null, n)))),
    );
  }

  function start(pool) {
    const queue = shuffle(pool).slice(0, MAX_CARDS);
    const total = queue.length;
    let known = 0;
    let missed = 0;
    const done = new Set();
    next();

    function next() {
      stopSpeaking();
      if (!queue.length) return finish();
      showCard(queue.shift());
    }

    function showCard(card) {
      const enFirst = getState().settings.direction === 'en-es';
      const box = getCard(lesson.id, card.id)?.box;

      const front = h('div', { class: 'face face-front' },
        h('p', { class: 'face-label' }, enFirst ? 'Inglés' : 'Español'),
        h('p', { class: 'face-main', lang: enFirst ? 'en' : 'es' }, enFirst ? card.en : card.es),
        enFirst && card.pos ? h('p', { class: 'pos' }, card.pos) : null,
        enFirst ? speakButton(card.en) : null,
      );
      const backFace = h('div', { class: 'face face-back', 'aria-hidden': 'true' },
        h('p', { class: 'face-label' }, enFirst ? 'Español' : 'Inglés'),
        h('p', { class: 'face-main', lang: enFirst ? 'es' : 'en' }, enFirst ? card.es : card.en, ' ', enFirst ? null : speakButton(card.en)),
        card.hint ? h('p', { class: 'ipa' }, card.hint) : null,
        card.example ? h('p', { class: 'example', lang: 'en' }, rich(card.example), ' ', speakButton(card.example, 'Escuchar ejemplo')) : null,
        card.exampleEs ? h('p', { class: 'small' }, card.exampleEs) : null,
        card.context ? h('p', { class: 'small' }, card.context) : null,
      );
      const flipper = h('div', { class: 'flipper' }, front, backFace);
      const actions = h('div', { class: 'row card-actions' });
      const flip = h('button', { type: 'button', class: 'btn primary', onClick: reveal }, 'Mostrar respuesta');
      actions.append(flip);
      const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });

      function reveal() {
        flipper.classList.add('flipped');
        backFace.setAttribute('aria-hidden', 'false');
        front.setAttribute('aria-hidden', 'true');
        live.textContent = `Respuesta: ${enFirst ? card.es : card.en}`;
        if (!enFirst) speak(card.en);
        const no = h('button', { type: 'button', class: 'btn ko', onClick: () => grade(false) }, '✗ No la sabía');
        const yes = h('button', { type: 'button', class: 'btn ok', onClick: () => grade(true) }, '✓ La sabía');
        actions.replaceChildren(no, yes);
        yes.focus();
      }

      function grade(correct) {
        // Solo cuenta para Leitner la primera vez que sale la tarjeta en la sesión
        if (!done.has(card.id)) {
          done.add(card.id);
          recordCard(lesson.id, card.id, correct);
          if (correct) known++; else missed++;
        }
        if (!correct) queue.push(card); // lo que fallo vuelve antes
        next();
      }

      root.replaceChildren(h('section', { class: 'session' },
        h('div', { class: 'session-top' },
          h('a', { class: 'back', href: back }, '✕ Salir'),
          h('span', { class: 'counter' }, `${done.size} / ${total}`)),
        progressBar(done.size, total, 'Tarjetas repasadas'),
        h('h1', { class: 'sr-only' }, 'Tarjeta de vocabulario'),
        h('div', { class: 'flashcard' }, flipper),
        h('p', { class: 'small center' }, box ? `Caja ${box} de ${BOXES}` : 'Tarjeta nueva'),
        live,
        actions,
        h('p', { class: 'small center' }, 'Piensa la respuesta antes de voltear. Sé sincero al puntuarte: es lo que hace que el repaso funcione.'),
      ));
      flip.focus();
    }

    function finish() {
      const pending = all.filter((c) => isDue(lesson.id, c.id)).length;
      root.replaceChildren(h('section', { class: 'summary' },
        h('h1', { tabindex: '-1' }, 'Repaso de vocabulario terminado'),
        h('p', { class: 'score' }, h('strong', null, `${known} de ${total}`), h('span', null, ' a la primera')),
        h('p', null, missed
          ? `${missed} ${missed === 1 ? 'tarjeta ha vuelto' : 'tarjetas han vuelto'} a la caja 1 y ${missed === 1 ? 'saldrá' : 'saldrán'} de nuevo mañana.`
          : 'Todas sabidas a la primera. Volverán a salir cuando toque repasarlas.'),
        h('div', { class: 'row' },
          pending ? h('button', { type: 'button', class: 'btn', onClick: () => vocabView(root, id) }, 'Seguir repasando') : null,
          h('a', { class: 'btn primary', href: back }, 'Volver a la lección')),
      ));
      root.querySelector('h1').focus();
    }
  }

  intro();
}
