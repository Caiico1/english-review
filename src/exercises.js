// Los seis tipos de ejercicio. Cada render devuelve un elemento y llama a onAnswer una sola vez con
// { correct, userAnswer, correctAnswer }.
import { h, rich, plain } from './ui.js';
import { checkGap, checkSentence, shuffle, shuffleDifferent } from './check.js';
import { speak, speechSupported } from './speech.js';

export const TYPE_LABELS = {
  'multiple-choice': 'Opción múltiple',
  'fill-gap': 'Rellenar huecos',
  'order-words': 'Ordenar palabras',
  match: 'Emparejar',
  translate: 'Traducción',
  dictation: 'Dictado',
};

const DEFAULT_PROMPTS = {
  'multiple-choice': 'Elige la opción correcta.',
  'fill-gap': 'Completa la frase.',
  'order-words': 'Ordena las palabras para formar la frase.',
  match: 'Empareja cada elemento con su pareja.',
  translate: 'Traduce al inglés.',
  dictation: 'Escucha y escribe lo que oyes.',
};

/** Texto corto que identifica un ejercicio (para listas de fallos). */
export function describe(ex) {
  switch (ex.type) {
    case 'fill-gap': return plain(ex.text);
    case 'translate': return ex.source;
    case 'dictation': return 'Dictado';
    case 'order-words': return ex.translation ? `Ordenar: «${ex.translation}»` : 'Ordenar la frase';
    default: return plain(ex.prompt ?? DEFAULT_PROMPTS[ex.type]);
  }
}

export function correctAnswerText(ex) {
  switch (ex.type) {
    case 'multiple-choice': return ex.options[ex.answer];
    case 'fill-gap': { let i = 0; return plain(ex.text).replace(/_{3,}/g, () => ex.answers[i++][0]); }
    case 'order-words': return ex.answer;
    case 'match': return ex.pairs.map((p) => `${p.left} → ${p.right}`).join(' · ');
    case 'translate': return ex.answers[0];
    case 'dictation': return ex.text;
    default: return '';
  }
}

export function renderExercise(ex, onAnswer) {
  const body = RENDERERS[ex.type](ex, once(onAnswer));
  return h('div', { class: `exercise ex-${ex.type}` },
    h('p', { class: 'ex-type' }, TYPE_LABELS[ex.type]),
    rich(ex.prompt ?? DEFAULT_PROMPTS[ex.type], 'h2', 'ex-prompt'),
    body,
  );
}

function once(fn) {
  let called = false;
  return (result) => { if (!called) { called = true; fn(result); } };
}

const checkButton = (disabled = false) =>
  h('button', { type: 'submit', class: 'btn primary', disabled }, 'Comprobar');

function lock(form) {
  form.querySelectorAll('input, button, textarea').forEach((el) => { el.disabled = true; });
}

function textField(label, placeholder) {
  return h('input', {
    type: 'text', class: 'answer-input', 'aria-label': label, placeholder,
    autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', lang: 'en',
  });
}

// ---------- Opción múltiple ----------
function multipleChoice(ex, onAnswer) {
  const order = ex.keepOrder ? ex.options.map((_, i) => i) : shuffle(ex.options.map((_, i) => i));
  const name = `mc-${Math.random().toString(36).slice(2)}`;
  const submit = checkButton(true);
  const form = h('form', { class: 'mc' },
    h('fieldset', null,
      h('legend', { class: 'sr-only' }, plain(ex.prompt ?? DEFAULT_PROMPTS[ex.type])),
      order.map((optIndex, pos) =>
        h('label', { class: 'option' },
          h('input', { type: 'radio', name, value: String(optIndex), onChange: () => { submit.disabled = false; } }),
          h('span', { class: 'option-key', 'aria-hidden': 'true' }, String(pos + 1)),
          rich(ex.options[optIndex], 'span', 'option-text'),
          h('span', { class: 'option-mark', 'aria-hidden': 'true' }),
        )),
    ),
    submit,
  );
  form.addEventListener('keydown', (e) => {
    const n = Number(e.key);
    const radios = form.querySelectorAll('input[type=radio]');
    if (n >= 1 && n <= radios.length && !radios[0].disabled) { radios[n - 1].checked = true; radios[n - 1].focus(); submit.disabled = false; }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const chosen = form.querySelector('input:checked');
    if (!chosen) return;
    const picked = Number(chosen.value);
    form.querySelectorAll('label.option').forEach((label) => {
      const v = Number(label.querySelector('input').value);
      if (v === ex.answer) { label.classList.add('is-correct'); label.querySelector('.option-mark').textContent = '✓ correcta'; }
      else if (v === picked) { label.classList.add('is-wrong'); label.querySelector('.option-mark').textContent = '✗ tu respuesta'; }
    });
    lock(form);
    onAnswer({ correct: picked === ex.answer, userAnswer: plain(ex.options[picked]), correctAnswer: plain(ex.options[ex.answer]) });
  });
  return form;
}

// ---------- Rellenar huecos ----------
function fillGap(ex, onAnswer) {
  const parts = ex.text.split(/_{3,}/);
  const inputs = [];
  const sentence = h('p', { class: 'gap-sentence', lang: 'en' });
  parts.forEach((part, i) => {
    sentence.append(rich(part));
    if (i < parts.length - 1) {
      const longest = Math.max(...ex.answers[i].map((a) => a.length));
      const input = textField(`Hueco ${i + 1}`, '');
      input.classList.add('gap');
      input.style.width = `${Math.max(5, longest + 3)}ch`;
      inputs.push(input);
      sentence.append(input);
    }
  });
  const form = h('form', { class: 'fill' },
    sentence,
    ex.hint ? h('p', { class: 'hint' }, 'Pista: ', rich(ex.hint)) : null,
    checkButton(),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (inputs.some((i) => !i.value.trim())) { inputs.find((i) => !i.value.trim()).focus(); return; }
    const results = inputs.map((input, i) => checkGap(input.value, ex.answers[i]));
    inputs.forEach((input, i) => {
      input.classList.add(results[i] ? 'is-correct' : 'is-wrong');
      input.setAttribute('aria-invalid', String(!results[i]));
    });
    lock(form);
    onAnswer({
      correct: results.every(Boolean),
      userAnswer: inputs.map((i) => i.value.trim()).join(' / '),
      correctAnswer: correctAnswerText(ex),
    });
  });
  return form;
}

// ---------- Ordenar palabras ----------
function orderWords(ex, onAnswer) {
  const words = ex.answer.trim().split(/\s+/);
  const endPunct = (words[words.length - 1].match(/[.?!]+$/) || [''])[0];
  if (endPunct) words[words.length - 1] = words[words.length - 1].slice(0, -endPunct.length);
  // La mayúscula inicial delataría la primera palabra
  if (!/^I(\b|')/.test(words[0]) && !ex.keepCapital) words[0] = words[0].toLowerCase();
  const tokens = shuffleDifferent([...words, ...(ex.distractors ?? [])]);

  const answerLine = h('div', { class: 'tokens answer-line', role: 'group', 'aria-label': 'Tu frase', lang: 'en' });
  const bank = h('div', { class: 'tokens bank', role: 'group', 'aria-label': 'Palabras disponibles', lang: 'en' });
  const punct = h('span', { class: 'end-punct', 'aria-hidden': 'true' }, endPunct);
  const submit = checkButton(true);
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });

  const refresh = () => {
    answerLine.append(punct);
    submit.disabled = answerLine.querySelectorAll('button').length < words.length;
    live.textContent = 'Tu frase: ' + [...answerLine.querySelectorAll('button')].map((b) => b.textContent).join(' ');
  };
  tokens.forEach((word) => {
    const btn = h('button', { type: 'button', class: 'token' }, word);
    btn.addEventListener('click', () => {
      const toAnswer = btn.parentElement === bank;
      (toAnswer ? answerLine : bank).append(btn);
      refresh();
      // Mantiene el foco útil al usar teclado
      (toAnswer ? bank.querySelector('button') ?? submit : btn).focus();
    });
    bank.append(btn);
  });
  answerLine.append(punct);

  const form = h('form', { class: 'order' },
    ex.translation ? h('p', { class: 'hint' }, 'Significado: ', ex.translation) : null,
    answerLine, bank, live, submit,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const given = [...answerLine.querySelectorAll('button')].map((b) => b.textContent).join(' ');
    const correct = checkSentence(given, [ex.answer, ...(ex.alternatives ?? [])]);
    answerLine.classList.add(correct ? 'is-correct' : 'is-wrong');
    lock(form);
    onAnswer({ correct, userAnswer: given + endPunct, correctAnswer: ex.answer });
  });
  return form;
}

// ---------- Emparejar ----------
function match(ex, onAnswer) {
  let selected = null; // { side, index, btn }
  let mistakes = 0;
  let matched = 0;
  const live = h('p', { class: 'match-status', 'aria-live': 'polite' }, 'Elige un elemento de cada columna.');

  const makeColumn = (side, order, label) =>
    h('div', { class: 'match-col', role: 'group', 'aria-label': label },
      order.map((index) => {
        const btn = h('button', { type: 'button', class: 'match-item', 'aria-pressed': 'false' },
          rich(ex.pairs[index][side]), h('span', { class: 'match-mark', 'aria-hidden': 'true' }));
        btn.addEventListener('click', () => pick({ side, index, btn }));
        return btn;
      }));

  function pick(choice) {
    if (selected && selected.side === choice.side) {
      selected.btn.setAttribute('aria-pressed', 'false');
      selected = selected.btn === choice.btn ? null : choice;
      if (selected) choice.btn.setAttribute('aria-pressed', 'true');
      return;
    }
    if (!selected) { selected = choice; choice.btn.setAttribute('aria-pressed', 'true'); return; }
    const a = selected;
    selected = null;
    a.btn.setAttribute('aria-pressed', 'false');
    if (a.index === choice.index) {
      matched++;
      for (const b of [a.btn, choice.btn]) {
        b.disabled = true;
        b.classList.add('is-correct');
        b.querySelector('.match-mark').textContent = ` ✓ ${matched}`;
      }
      live.textContent = `Correcto: ${plain(ex.pairs[a.index].left)} = ${plain(ex.pairs[a.index].right)}.`;
      if (matched === ex.pairs.length) {
        onAnswer({
          correct: mistakes === 0,
          userAnswer: mistakes === 0 ? 'Todo a la primera' : `${mistakes} ${mistakes === 1 ? 'intento fallido' : 'intentos fallidos'}`,
          correctAnswer: correctAnswerText(ex),
        });
      }
    } else {
      mistakes++;
      for (const b of [a.btn, choice.btn]) {
        b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
      }
      live.textContent = `✗ No coinciden. Prueba otra vez (${mistakes} ${mistakes === 1 ? 'fallo' : 'fallos'}).`;
    }
  }

  const indexes = ex.pairs.map((_, i) => i);
  return h('div', { class: 'match' },
    h('div', { class: 'match-grid' },
      makeColumn('left', shuffle(indexes), 'Columna izquierda'),
      makeColumn('right', shuffleDifferent(indexes), 'Columna derecha')),
    live,
  );
}

// ---------- Traducción ES→EN ----------
function translate(ex, onAnswer) {
  const input = textField('Tu traducción al inglés', 'Escribe en inglés…');
  const form = h('form', { class: 'typed' },
    h('p', { class: 'source', lang: 'es' }, ex.source),
    ex.hint ? h('p', { class: 'hint' }, 'Pista: ', rich(ex.hint)) : null,
    input, checkButton(),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!input.value.trim()) { input.focus(); return; }
    const correct = checkSentence(input.value, ex.answers);
    input.classList.add(correct ? 'is-correct' : 'is-wrong');
    lock(form);
    onAnswer({ correct, userAnswer: input.value.trim(), correctAnswer: ex.answers[0], alternatives: ex.answers.slice(1) });
  });
  return form;
}

// ---------- Dictado ----------
function dictation(ex, onAnswer) {
  const input = textField('Escribe lo que has oído', 'Escribe lo que oyes…');
  const form = h('form', { class: 'typed' },
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn', onClick: () => speak(ex.text, 0.95) }, '▶ Escuchar'),
      h('button', { type: 'button', class: 'btn', onClick: () => speak(ex.text, 0.6) }, '🐢 Más lento'),
    ),
    speechSupported ? null : h('p', { class: 'hint' }, 'Tu navegador no ofrece síntesis de voz; este ejercicio no se puede escuchar.'),
    input, checkButton(),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!input.value.trim()) { input.focus(); return; }
    const correct = checkSentence(input.value, [ex.text, ...(ex.alternatives ?? [])]);
    input.classList.add(correct ? 'is-correct' : 'is-wrong');
    lock(form);
    onAnswer({ correct, userAnswer: input.value.trim(), correctAnswer: ex.text });
  });
  // La reproducción automática necesita un gesto previo del usuario; si el navegador la bloquea, queda el botón
  setTimeout(() => { if (form.isConnected) speak(ex.text, 0.95); }, 350);
  return form;
}

const RENDERERS = {
  'multiple-choice': multipleChoice,
  'fill-gap': fillGap,
  'order-words': orderWords,
  match,
  translate,
  dictation,
};
