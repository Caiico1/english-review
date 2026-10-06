// The six exercise types. Each renderer returns an element and calls onAnswer exactly once with
// { correct, userAnswer, correctAnswer }.
import { h, rich, plain } from './ui.js';
import { checkGap, checkSentence, shuffle, shuffleDifferent } from './check.js';
import { speak, speechSupported } from './speech.js';

export const TYPE_LABELS = {
  'multiple-choice': 'Multiple choice',
  'fill-gap': 'Fill in the gaps',
  'order-words': 'Word order',
  match: 'Matching',
  rewrite: 'Rewrite the sentence',
  dictation: 'Dictation',
};

const DEFAULT_PROMPTS = {
  'multiple-choice': 'Choose the correct option.',
  'fill-gap': 'Complete the sentence.',
  'order-words': 'Put the words in order to make a sentence.',
  match: 'Match the items.',
  rewrite: 'Rewrite the sentence.',
  dictation: 'Listen and type what you hear.',
};

/** Short text that identifies an exercise (used in lists of mistakes). */
export function describe(ex) {
  switch (ex.type) {
    case 'fill-gap': return plain(ex.text);
    case 'rewrite': return `${plain(ex.prompt)} — ${ex.source}`;
    case 'dictation': return 'Dictation';
    case 'order-words': return 'Put the words in order';
    default: return plain(ex.prompt ?? DEFAULT_PROMPTS[ex.type]);
  }
}

export function correctAnswerText(ex) {
  switch (ex.type) {
    case 'multiple-choice': return plain(ex.options[ex.answer]);
    case 'fill-gap': { let i = 0; return plain(ex.text).replace(/_{3,}/g, () => ex.answers[i++][0]); }
    case 'order-words': return ex.answer;
    case 'match': return ex.pairs.map((p) => `${p.left} → ${p.right}`).join(' · ');
    case 'rewrite': return ex.answers[0];
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
  h('button', { type: 'submit', class: 'btn primary', disabled }, 'Check');

function lock(form) {
  form.querySelectorAll('input, button, textarea').forEach((el) => { el.disabled = true; });
}

function textField(label, placeholder) {
  return h('input', {
    type: 'text', class: 'answer-input', 'aria-label': label, placeholder,
    autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
  });
}

// ---------- Multiple choice ----------
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
      if (v === ex.answer) { label.classList.add('is-correct'); label.querySelector('.option-mark').textContent = '✓ correct'; }
      else if (v === picked) { label.classList.add('is-wrong'); label.querySelector('.option-mark').textContent = '✗ your answer'; }
    });
    lock(form);
    onAnswer({ correct: picked === ex.answer, userAnswer: plain(ex.options[picked]), correctAnswer: plain(ex.options[ex.answer]) });
  });
  return form;
}

// ---------- Fill in the gaps ----------
function fillGap(ex, onAnswer) {
  const parts = ex.text.split(/_{3,}/);
  const inputs = [];
  const sentence = h('p', { class: 'gap-sentence' });
  parts.forEach((part, i) => {
    sentence.append(rich(part));
    if (i < parts.length - 1) {
      const longest = Math.max(...ex.answers[i].map((a) => a.length));
      const input = textField(`Gap ${i + 1}`, '');
      input.classList.add('gap');
      input.style.width = `${Math.max(5, longest + 3)}ch`;
      inputs.push(input);
      sentence.append(input);
    }
  });
  const form = h('form', { class: 'fill' },
    sentence,
    ex.hint ? h('p', { class: 'hint' }, 'Hint: ', rich(ex.hint)) : null,
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

// ---------- Word order ----------
function orderWords(ex, onAnswer) {
  const words = ex.answer.trim().split(/\s+/);
  const endPunct = (words[words.length - 1].match(/[.?!]+$/) || [''])[0];
  if (endPunct) words[words.length - 1] = words[words.length - 1].slice(0, -endPunct.length);
  // A capital letter would give away the first word
  if (!/^I(\b|')/.test(words[0]) && !ex.keepCapital) words[0] = words[0].toLowerCase();
  const tokens = shuffleDifferent([...words, ...(ex.distractors ?? [])]);

  const answerLine = h('div', { class: 'tokens answer-line', role: 'group', 'aria-label': 'Your sentence' });
  const bank = h('div', { class: 'tokens bank', role: 'group', 'aria-label': 'Available words' });
  const punct = h('span', { class: 'end-punct', 'aria-hidden': 'true' }, endPunct);
  const submit = checkButton(true);
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });

  const refresh = () => {
    answerLine.append(punct);
    submit.disabled = answerLine.querySelectorAll('button').length < words.length;
    live.textContent = 'Your sentence: ' + [...answerLine.querySelectorAll('button')].map((b) => b.textContent).join(' ');
  };
  tokens.forEach((word) => {
    const btn = h('button', { type: 'button', class: 'token' }, word);
    btn.addEventListener('click', () => {
      const toAnswer = btn.parentElement === bank;
      (toAnswer ? answerLine : bank).append(btn);
      refresh();
      // Keep focus somewhere useful for keyboard users
      (toAnswer ? bank.querySelector('button') ?? submit : btn).focus();
    });
    bank.append(btn);
  });
  answerLine.append(punct);

  const form = h('form', { class: 'order' },
    ex.hint ? h('p', { class: 'hint' }, 'Hint: ', rich(ex.hint)) : null,
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

// ---------- Matching ----------
function match(ex, onAnswer) {
  let selected = null; // { side, index, btn }
  let mistakes = 0;
  let matched = 0;
  const live = h('p', { class: 'match-status', 'aria-live': 'polite' }, 'Choose one item from each column.');

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
      live.textContent = `Correct: ${plain(ex.pairs[a.index].left)} = ${plain(ex.pairs[a.index].right)}.`;
      if (matched === ex.pairs.length) {
        onAnswer({
          correct: mistakes === 0,
          userAnswer: mistakes === 0 ? 'All matched first time' : `${mistakes} wrong ${mistakes === 1 ? 'attempt' : 'attempts'}`,
          correctAnswer: correctAnswerText(ex),
        });
      }
    } else {
      mistakes++;
      for (const b of [a.btn, choice.btn]) {
        b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
      }
      live.textContent = `✗ Those don't match. Try again (${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'}).`;
    }
  }

  const indexes = ex.pairs.map((_, i) => i);
  return h('div', { class: 'match' },
    h('div', { class: 'match-grid' },
      makeColumn('left', shuffle(indexes), 'Left column'),
      makeColumn('right', shuffleDifferent(indexes), 'Right column')),
    live,
  );
}

// ---------- Rewrite the sentence ----------
function rewrite(ex, onAnswer) {
  const input = textField('Your sentence', 'Type your sentence…');
  const form = h('form', { class: 'typed' },
    h('p', { class: 'source' }, ex.source),
    ex.hint ? h('p', { class: 'hint' }, 'Hint: ', rich(ex.hint)) : null,
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

// ---------- Dictation ----------
function dictation(ex, onAnswer) {
  const input = textField('Type what you heard', 'Type what you hear…');
  const form = h('form', { class: 'typed' },
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn', onClick: () => speak(ex.text, 0.95) }, '▶ Listen'),
      h('button', { type: 'button', class: 'btn', onClick: () => speak(ex.text, 0.6) }, '🐢 Slower'),
    ),
    speechSupported ? null : h('p', { class: 'hint' }, 'Your browser has no speech synthesis, so this exercise cannot be played.'),
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
  // Autoplay needs an earlier user gesture; if the browser blocks it, the button is still there
  setTimeout(() => { if (form.isConnected) speak(ex.text, 0.95); }, 350);
  return form;
}

const RENDERERS = {
  'multiple-choice': multipleChoice,
  'fill-gap': fillGap,
  'order-words': orderWords,
  match,
  rewrite,
  dictation,
};
