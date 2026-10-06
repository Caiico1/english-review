// Comparación de respuestas. Funciones puras, sin DOM, para poder probarlas con node --test.

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

/** Minúsculas, espacios colapsados y apóstrofos tipográficos unificados. */
export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Como normalize, pero además ignora la puntuación y equipara contracciones (don't = do not). */
export function normalizeSentence(text) {
  let s = normalize(text);
  for (const [re, to] of CONTRACTIONS) s = s.replace(re, to);
  return s
    .replace(/[.,;:!?¿¡"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Hueco de un fill-gap: tolera mayúsculas, espacios, puntuación final y contracciones. */
export function checkGap(input, accepted) {
  const given = normalizeSentence(input);
  return given !== '' && accepted.some((a) => normalizeSentence(a) === given);
}

/** Frase completa (traducción, dictado, ordenar palabras). */
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

/** Baraja garantizando que el resultado no coincide con el orden original (si es posible). */
export function shuffleDifferent(list) {
  if (list.length < 2 || new Set(list).size < 2) return [...list];
  let out;
  do out = shuffle(list);
  while (out.every((x, i) => x === list[i]));
  return out;
}
