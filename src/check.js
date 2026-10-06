// Answer checking. Pure functions with no DOM, so they can be tested with node --test.

const CONTRACTIONS = [
  [/\bcan't\b/g, 'can not'],
  [/\bcannot\b/g, 'can not'],
  [/\bwon't\b/g, 'will not'],
  [/\bshan't\b/g, 'shall not'],
  [/n't\b/g, ' not'],
  [/\bi'm\b/g, 'i am'],
  [/'re\b/g, ' are'],
  [/'ve\b/g, ' have'],
  [/'ll\b/g, ' will'],
];

/** Lower case, collapsed spaces and curly apostrophes normalised. */
export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Like normalize, but also ignores punctuation and treats contractions as equal (don't = do not). */
export function normalizeSentence(text) {
  let s = normalize(text);
  for (const [re, to] of CONTRACTIONS) s = s.replace(re, to);
  return s
    .replace(/[.,;:!?¿¡"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** One gap in a fill-gap exercise: tolerates capitals, spaces, final punctuation and contractions. */
export function checkGap(input, accepted) {
  const given = normalizeSentence(input);
  return given !== '' && accepted.some((a) => normalizeSentence(a) === given);
}

/** A whole sentence (rewrite, dictation, word order). */
export function checkSentence(input, accepted) {
  const given = normalizeSentence(input);
  return given !== '' && accepted.some((a) => normalizeSentence(a) === given);
}

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffles, making sure the result differs from the original order when possible. */
export function shuffleDifferent(list) {
  if (list.length < 2 || new Set(list).size < 2) return [...list];
  let out;
  do out = shuffle(list);
  while (out.every((x, i) => x === list[i]));
  return out;
}
