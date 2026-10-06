// Pruebas de la corrección de respuestas y del validador. Ejecutar con: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkGap, checkSentence, normalizeSentence } from '../src/check.js';
import { validate, semanticChecks } from './validate-lessons.mjs';
import { readFileSync } from 'node:fs';

const schema = JSON.parse(readFileSync(new URL('../schema/lesson.schema.json', import.meta.url), 'utf8'));
const lesson = () => JSON.parse(readFileSync(new URL('../src/lessons/lesson-01a.json', import.meta.url), 'utf8'));

test('los huecos toleran mayúsculas, espacios y puntuación final', () => {
  assert.ok(checkGap('  Did   YOU go ', ['did you go']));
  assert.ok(checkGap('to.', ['to']));
  assert.ok(checkGap('whether', ['if', 'whether']));
  assert.ok(!checkGap('do you go', ['did you go']));
  assert.ok(!checkGap('   ', ['to']));
});

test('las frases ignoran puntuación y equiparan contracciones', () => {
  assert.ok(!checkSentence('why you didn’t call me', ["Why didn't you call me?"]), 'el orden de palabras importa');
  assert.ok(checkSentence('why didn’t you call me', ["Why didn't you call me?"]), 'apóstrofo tipográfico');
  assert.ok(checkSentence('I can not remember where I put my keys', ["I can't remember where I put my keys."]));
  assert.ok(checkSentence('Do you know if she is coming to the party', ["Do you know if she's coming to the party?", 'Do you know if she is coming to the party?']));
  assert.ok(!checkSentence('Do you know where does Ana live?', ['Do you know where Ana lives?']));
  assert.equal(normalizeSentence("  What's  THIS?! "), "what's this");
});

test('la lección 01a es válida', () => {
  const l = lesson();
  assert.deepEqual(validate(l, schema), []);
  assert.deepEqual(semanticChecks(l, 'lesson-01a.json').errors, []);
});

test('el validador detecta errores típicos', () => {
  const l = lesson();
  delete l.vocabulary[0].translation;
  l.exercises[0].type = 'crossword';
  l.exrcises = [];
  const errors = validate(l, schema);
  assert.ok(errors.some((e) => e.includes('translation')));
  assert.ok(errors.some((e) => e.includes('crossword')));
  assert.ok(errors.some((e) => e.includes('exrcises')));

  const m = lesson();
  m.exercises.find((e) => e.type === 'multiple-choice').answer = 9;
  m.exercises.find((e) => e.type === 'fill-gap').answers.push(['extra']);
  m.exercises[1].id = m.exercises[0].id;
  const sem = semanticChecks(m, 'lesson-02a.json').errors;
  assert.ok(sem.some((e) => e.includes('fuera de')));
  assert.ok(sem.some((e) => e.includes('hueco')));
  assert.ok(sem.some((e) => e.includes('repetido')));
  assert.ok(sem.some((e) => e.includes('nombre del archivo')));
});
