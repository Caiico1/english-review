// Motor de sesiones: una pregunta por pantalla, barra de progreso, corrección y resumen final.
import { h, rich, progressBar } from './ui.js';
import { renderExercise, describe, TYPE_LABELS } from './exercises.js';
import { recordAnswer, recordCard, recordTest } from './store.js';
import { speechSupported, stopSpeaking, speakButton } from './speech.js';

/**
 * @param root   contenedor
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
      h('p', { class: 'empty' }, emptyMessage ?? 'No hay nada que practicar aquí todavía.'),
      h('a', { class: 'btn primary', href: backHref }, 'Volver'),
    );
    return;
  }

  function showQuestion() {
    stopSpeaking();
    const { lesson, ex } = items[index];
    const feedback = h('div', { class: 'feedback-slot', 'aria-live': 'polite' });
    const view = h('section', { class: 'session' },
      h('div', { class: 'session-top' },
        h('a', { class: 'back', href: backHref, 'aria-label': 'Salir de la sesión' }, '✕ Salir'),
        h('span', { class: 'counter' }, `${index + 1} / ${items.length}`),
      ),
      progressBar(index, items.length, `Progreso de la sesión: pregunta ${index + 1} de ${items.length}`),
      h('h1', { class: 'sr-only' }, `${title}: pregunta ${index + 1} de ${items.length}`),
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
      last ? 'Ver resultado' : 'Siguiente');
    if (isTest) {
      // En el test no se corrige pregunta a pregunta: la nota y los fallos van al final
      slot.replaceChildren(h('div', { class: 'feedback neutral' },
        h('p', null, 'Respuesta guardada.'), next));
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
      pct === 100 ? 'Sin fallos. Esta parte la tienes dominada.'
      : pct >= 80 ? 'Buen resultado. Repasa los fallos de abajo para cerrarlo.'
      : pct >= 60 ? 'Vas bien, pero aún hay cosas sin asentar. Mira los fallos con calma.'
      : 'Todavía cuesta: conviene releer la gramática y repetir. Es normal en un primer repaso.';

    root.replaceChildren(h('section', { class: 'summary' },
      h('h1', null, isTest ? 'Resultado del test' : 'Sesión terminada'),
      h('p', { class: 'score' },
        h('strong', null, isTest ? `${(pct / 10).toFixed(1).replace('.', ',')} / 10` : `${right} de ${results.length}`),
        h('span', null, isTest ? ` · ${right} de ${results.length} correctas` : ` · ${pct} %`)),
      h('p', null, verdict),
      skipped ? h('p', { class: 'hint' }, `Se han omitido ${skipped} dictados porque este navegador no tiene síntesis de voz.`) : null,
      wrong.length
        ? h('div', null,
            h('h2', null, `Fallos (${wrong.length})`),
            h('ul', { class: 'review-list' }, wrong.map((r) => h('li', null, failureCard(r)))))
        : null,
      h('div', { class: 'row' },
        wrong.length
          ? h('button', {
              type: 'button', class: 'btn primary',
              onClick: () => runSession(root, { title: 'Repetir fallos', items: wrong.map(({ lesson, ex }) => ({ lesson, ex })), backHref }),
            }, 'Repetir solo los fallos')
          : null,
        h('a', { class: wrong.length ? 'btn' : 'btn primary', href: backHref }, 'Volver'),
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
    h('p', { class: 'feedback-title' }, ok ? '✓ Correcto' : '✗ No es correcto'),
    ok ? null : h('p', null, 'Respuesta correcta: ',
      h('strong', { lang: 'en' }, result.correctAnswer), ' ', ex.type === 'match' ? null : speakButton(result.correctAnswer)),
    ok && ex.type === 'dictation' ? h('p', { lang: 'en' }, ex.text) : null,
    result.alternatives?.length ? h('p', { class: 'small' }, 'También vale: ', result.alternatives.join(' · ')) : null,
    ex.translation && ex.type === 'dictation' ? h('p', { class: 'small' }, 'Significa: ', ex.translation) : null,
    ex.explanation ? rich(ex.explanation, 'p', 'explanation') : null,
    nextButton,
  );
}

function failureCard(r) {
  return h('div', { class: 'card' },
    h('p', { class: 'ex-type' }, TYPE_LABELS[r.ex.type]),
    h('p', null, describe(r.ex)),
    h('p', { class: 'small' }, 'Tu respuesta: ', h('span', { class: 'wrong-text' }, r.userAnswer || '—')),
    h('p', null, 'Correcta: ', h('strong', { lang: 'en' }, r.correctAnswer)),
    r.ex.explanation ? rich(r.ex.explanation, 'p', 'explanation') : null,
  );
}
