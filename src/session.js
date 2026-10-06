// Session engine: one question per screen, progress bar, feedback and a final summary.
import { h, rich, progressBar } from './ui.js';
import { renderExercise, describe, TYPE_LABELS } from './exercises.js';
import { recordAnswer, recordCard, recordTest } from './store.js';
import { speechSupported, stopSpeaking, speakButton } from './speech.js';

/**
 * @param root   container element
 * @param opts   { title, items: [{ lesson, ex }], mode: 'practice' | 'test', backHref, emptyMessage }
 */
export function runSession(root, { title, items, mode = 'practice', backHref = '#/', emptyMessage }) {
  const skipped = speechSupported ? 0 : items.filter((i) => i.ex.type === 'dictation').length;
  if (skipped) items = items.filter((i) => i.ex.type !== 'dictation');
  const isTest = mode === 'test';
  const results = [];
  let index = 0;

  if (!items.length) {
    root.replaceChildren(
      h('h1', null, title),
      h('p', { class: 'empty' }, emptyMessage ?? 'There is nothing to practise here yet.'),
      h('a', { class: 'btn primary', href: backHref }, 'Back'),
    );
    return;
  }

  function showQuestion() {
    stopSpeaking();
    const { lesson, ex } = items[index];
    const feedback = h('div', { class: 'feedback-slot', 'aria-live': 'polite' });
    const view = h('section', { class: 'session' },
      h('div', { class: 'session-top' },
        h('a', { class: 'back', href: backHref, 'aria-label': 'Leave the session' }, '✕ Quit'),
        h('span', { class: 'counter' }, `${index + 1} / ${items.length}`),
      ),
      progressBar(index, items.length, `Session progress: question ${index + 1} of ${items.length}`),
      h('h1', { class: 'sr-only' }, `${title}: question ${index + 1} of ${items.length}`),
      renderExercise(ex, (result) => onAnswer(lesson, ex, result, feedback)),
      feedback,
    );
    root.replaceChildren(view);
    const first = view.querySelector('.exercise input, .exercise .token, .exercise .match-item, .exercise button');
    first?.focus({ preventScroll: true });
  }

  function onAnswer(lesson, ex, result, slot) {
    results.push({ lesson, ex, ...result });
    recordAnswer(lesson.id, ex.id, result.correct);
    if (ex.cardId) recordCard(lesson.id, ex.cardId, result.correct, false);

    const last = index === items.length - 1;
    const next = h('button', { type: 'button', class: 'btn primary', onClick: advance },
      last ? 'See results' : 'Next');
    if (isTest) {
      // No question-by-question marking in the test: the score and the mistakes come at the end
      slot.replaceChildren(h('div', { class: 'feedback neutral' },
        h('p', null, 'Answer saved.'), next));
    } else {
      slot.replaceChildren(feedbackPanel(ex, result, next));
    }
    next.focus();
  }

  function advance() {
    index++;
    if (index < items.length) showQuestion();
    else showSummary();
  }

  function showSummary() {
    stopSpeaking();
    const right = results.filter((r) => r.correct).length;
    const pct = Math.round((100 * right) / results.length);
    const wrong = results.filter((r) => !r.correct);
    if (isTest) recordTest(results[0].lesson.id, right, results.length);

    const verdict =
      pct === 100 ? 'No mistakes. You have this part under control.'
      : pct >= 80 ? 'A good result. Go through the mistakes below to finish the job.'
      : pct >= 60 ? 'You are getting there, but some points are not solid yet. Take your time over the mistakes.'
      : 'This is still hard: reread the grammar and try again. That is normal on a first review.';

    root.replaceChildren(h('section', { class: 'summary' },
      h('h1', null, isTest ? 'Test result' : 'Session complete'),
      h('p', { class: 'score' },
        h('strong', null, isTest ? `${(pct / 10).toFixed(1)} / 10` : `${right} out of ${results.length}`),
        h('span', null, isTest ? ` · ${right} out of ${results.length} correct` : ` · ${pct}%`)),
      h('p', null, verdict),
      skipped ? h('p', { class: 'hint' }, `${skipped} dictation ${skipped === 1 ? 'exercise was' : 'exercises were'} skipped because this browser has no speech synthesis.`) : null,
      wrong.length
        ? h('div', null,
            h('h2', null, `Mistakes (${wrong.length})`),
            h('ul', { class: 'review-list' }, wrong.map((r) => h('li', null, failureCard(r)))))
        : null,
      h('div', { class: 'row' },
        wrong.length
          ? h('button', {
              type: 'button', class: 'btn primary',
              onClick: () => runSession(root, { title: 'Retry mistakes', items: wrong.map(({ lesson, ex }) => ({ lesson, ex })), backHref }),
            }, 'Retry only the mistakes')
          : null,
        h('a', { class: wrong.length ? 'btn' : 'btn primary', href: backHref }, 'Back'),
      ),
    ));
    root.querySelector('h1').setAttribute('tabindex', '-1');
    root.querySelector('h1').focus();
  }

  showQuestion();
}

function feedbackPanel(ex, result, nextButton) {
  const ok = result.correct;
  return h('div', { class: `feedback ${ok ? 'ok' : 'ko'}` },
    h('p', { class: 'feedback-title' }, ok ? '✓ Correct' : '✗ Not quite'),
    ok ? null : h('p', null, 'Correct answer: ',
      h('strong', null, result.correctAnswer), ' ', ex.type === 'match' ? null : speakButton(result.correctAnswer)),
    ok && ex.type === 'dictation' ? h('p', null, ex.text) : null,
    result.alternatives?.length ? h('p', { class: 'small' }, 'Also accepted: ', result.alternatives.join(' · ')) : null,
    ex.explanation ? rich(ex.explanation, 'p', 'explanation') : null,
    nextButton,
  );
}

function failureCard(r) {
  return h('div', { class: 'card' },
    h('p', { class: 'ex-type' }, TYPE_LABELS[r.ex.type]),
    h('p', null, describe(r.ex)),
    h('p', { class: 'small' }, 'Your answer: ', h('span', { class: 'wrong-text' }, r.userAnswer || '—')),
    h('p', null, 'Correct: ', h('strong', null, r.correctAnswer)),
    r.ex.explanation ? rich(r.ex.explanation, 'p', 'explanation') : null,
  );
}
