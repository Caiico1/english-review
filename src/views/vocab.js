// Flashcards with a flip and simple spaced repetition (Leitner boxes).
import { h, rich, backLink, progressBar } from '../ui.js';
import { getLesson, cardsOf } from '../lessons.js';
import { getState, setSetting, recordCard, getCard, isDue, BOXES } from '../store.js';
import { speak, speakButton, stopSpeaking } from '../speech.js';
import { shuffle } from '../check.js';

const MAX_CARDS = 20;

export function vocabView(root, id) {
  const lesson = getLesson(id);
  if (!lesson) {
    root.replaceChildren(h('h1', null, 'Lesson not found'), h('a', { class: 'btn', href: '#/' }, 'Back to home'));
    return;
  }
  const back = `#/lesson/${lesson.id}`;
  const all = cardsOf(lesson);
  const due = all.filter((c) => isDue(lesson.id, c.id));
  const wordFirst = () => getState().settings.direction !== 'def-word';

  function intro() {
    const dirButton = (value, label) =>
      h('button', {
        type: 'button', class: 'btn seg', 'aria-pressed': String(wordFirst() === (value === 'word-def')),
        onClick: () => { setSetting('direction', value); intro(); },
      }, label);

    root.replaceChildren(
      backLink(back, lesson.title),
      h('h1', null, 'Vocabulary'),
      h('p', null, due.length
        ? `${due.length} of ${all.length} cards are due today. Any you miss will come back in this session and again tomorrow.`
        : 'You have no cards due today. Spaced repetition works best if you respect the gaps, but you can review them all if you like.'),
      h('div', { class: 'row', role: 'group', 'aria-label': 'Card direction' },
        dirButton('word-def', 'Word → Definition'), dirButton('def-word', 'Definition → Word')),
      h('div', { class: 'row' },
        due.length
          ? h('button', { type: 'button', class: 'btn primary', onClick: () => start(due) }, `Start (${Math.min(due.length, MAX_CARDS)})`)
          : null,
        h('button', { type: 'button', class: due.length ? 'btn' : 'btn primary', onClick: () => start(all) }, 'Review all'),
      ),
      boxesLegend(),
    );
  }

  function boxesLegend() {
    const counts = Array(BOXES + 1).fill(0);
    for (const c of all) counts[getCard(lesson.id, c.id)?.box ?? 0]++;
    return h('section', { 'aria-labelledby': 'h-boxes' },
      h('h2', { id: 'h-boxes' }, 'Your boxes'),
      h('p', { class: 'small' }, 'Each correct answer moves the card up one box and pushes it further into the future (1, 3, 7 and 14 days). A miss sends it back to box 1.'),
      h('ul', { class: 'boxes' },
        h('li', null, h('span', null, 'Not seen'), h('strong', null, counts[0])),
        counts.slice(1).map((n, i) => h('li', null, h('span', null, `Box ${i + 1}`), h('strong', null, n)))),
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
      const word = wordFirst();
      const box = getCard(lesson.id, card.id)?.box;

      const front = h('div', { class: 'face face-front' },
        h('p', { class: 'face-label' }, word ? 'Word' : 'Definition'),
        h('p', { class: word ? 'face-main' : 'face-main face-def' }, word ? card.en : card.def),
        word && card.pos ? h('p', { class: 'pos' }, card.pos) : null,
        word ? speakButton(card.en) : null,
      );
      const backFace = h('div', { class: 'face face-back', 'aria-hidden': 'true' },
        h('p', { class: 'face-label' }, word ? 'Definition' : 'Word'),
        h('p', { class: word ? 'face-main face-def' : 'face-main' }, word ? card.def : card.en, ' ', word ? null : speakButton(card.en)),
        card.hint ? h('p', { class: 'ipa' }, card.hint) : null,
        card.example ? h('p', { class: 'example' }, rich(card.example), ' ', speakButton(card.example, 'Listen to the example')) : null,
        card.context ? h('p', { class: 'small' }, card.context) : null,
      );
      const flipper = h('div', { class: 'flipper' }, front, backFace);
      const actions = h('div', { class: 'row card-actions' });
      const flip = h('button', { type: 'button', class: 'btn primary', onClick: reveal }, 'Show answer');
      actions.append(flip);
      const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });

      function reveal() {
        flipper.classList.add('flipped');
        backFace.setAttribute('aria-hidden', 'false');
        front.setAttribute('aria-hidden', 'true');
        live.textContent = `Answer: ${word ? card.def : card.en}`;
        if (!word) speak(card.en);
        const no = h('button', { type: 'button', class: 'btn ko', onClick: () => grade(false) }, "✗ I didn't know it");
        const yes = h('button', { type: 'button', class: 'btn ok', onClick: () => grade(true) }, '✓ I knew it');
        actions.replaceChildren(no, yes);
        yes.focus();
      }

      function grade(correct) {
        // Only the first time a card appears in the session counts for Leitner
        if (!done.has(card.id)) {
          done.add(card.id);
          recordCard(lesson.id, card.id, correct);
          if (correct) known++; else missed++;
        }
        if (!correct) queue.push(card); // missed cards come back sooner
        next();
      }

      root.replaceChildren(h('section', { class: 'session' },
        h('div', { class: 'session-top' },
          h('a', { class: 'back', href: back }, '✕ Quit'),
          h('span', { class: 'counter' }, `${done.size} / ${total}`)),
        progressBar(done.size, total, 'Cards reviewed'),
        h('h1', { class: 'sr-only' }, 'Vocabulary card'),
        h('div', { class: 'flashcard' }, flipper),
        h('p', { class: 'small center' }, box ? `Box ${box} of ${BOXES}` : 'New card'),
        live,
        actions,
        h('p', { class: 'small center' }, 'Think of the answer before you flip. Be honest when you grade yourself: that is what makes the review work.'),
      ));
      flip.focus();
    }

    function finish() {
      const pending = all.filter((c) => isDue(lesson.id, c.id)).length;
      root.replaceChildren(h('section', { class: 'summary' },
        h('h1', { tabindex: '-1' }, 'Vocabulary review complete'),
        h('p', { class: 'score' }, h('strong', null, `${known} out of ${total}`), h('span', null, ' first time')),
        h('p', null, missed
          ? `${missed} ${missed === 1 ? 'card has' : 'cards have'} gone back to box 1 and will come up again tomorrow.`
          : 'You knew them all first time. They will come back when they are due.'),
        h('div', { class: 'row' },
          pending ? h('button', { type: 'button', class: 'btn', onClick: () => vocabView(root, id) }, 'Keep reviewing') : null,
          h('a', { class: 'btn primary', href: back }, 'Back to the lesson')),
      ));
      root.querySelector('h1').focus();
    }
  }

  intro();
}
