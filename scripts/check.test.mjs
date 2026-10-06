// Tests for answer checking and for the lesson validator. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkGap, checkSentence, normalizeSentence } from '../src/check.js';
import { validate, semanticChecks } from './validate-lessons.mjs';
import { readFileSync } from 'node:fs';

const schema = JSON.parse(readFileSync(new URL('../schema/lesson.schema.json', import.meta.url), 'utf8'));
const lesson = () => JSON.parse(readFileSync(new URL('../src/lessons/lesson-01a.json', import.meta.url), 'utf8'));

test('gaps tolerate capitals, extra spaces and final punctuation', () => {
  assert.ok(checkGap('  Did   YOU go ', ['did you go']));
  assert.ok(checkGap('to.', ['to']));
  assert.ok(checkGap('whether', ['if', 'whether']));
  assert.ok(!checkGap('do you go', ['did you go']));
  assert.ok(!checkGap('   ', ['to']));
});

test('sentences ignore punctuation and treat contractions as equal', () => {
  assert.ok(!checkSentence('why you didn’t call me', ["Why didn't you call me?"]), 'word order matters');
  assert.ok(checkSentence('why didn’t you call me', ["Why didn't you call me?"]), 'curly apostrophe');
  assert.ok(checkSentence('I can not remember where I put my keys', ["I can't remember where I put my keys."]));
  assert.ok(checkSentence('Do you know if she is coming to the party', ["Do you know if she's coming to the party?", 'Do you know if she is coming to the party?']));
  assert.ok(!checkSentence('Do you know where does Ana live?', ['Do you know where Ana lives?']));
  assert.equal(normalizeSentence("  What's  THIS?! "), "what's this");
});

test('lesson 01a is valid', () => {
  const l = lesson();
  assert.deepEqual(validate(l, schema), []);
  assert.deepEqual(semanticChecks(l, 'lesson-01a.json').errors, []);
});

test('every rewrite exercise accepts its own model answers', () => {
  for (const ex of lesson().exercises.filter((e) => e.type === 'rewrite')) {
    for (const answer of ex.answers) assert.ok(checkSentence(answer.toLowerCase(), ex.answers), `${ex.id}: ${answer}`);
    assert.ok(!checkSentence(ex.source, ex.answers), `${ex.id}: the source sentence must not count as an answer`);
  }
});

test('the validator catches typical mistakes', () => {
  const l = lesson();
  delete l.vocabulary[0].definition;
  l.vocabulary[1].translation = 'old field';
  l.exercises[0].type = 'crossword';
  l.exrcises = [];
  const errors = validate(l, schema);
  assert.ok(errors.some((e) => e.includes('"definition"')));
  assert.ok(errors.some((e) => e.includes('"translation"')));
  assert.ok(errors.some((e) => e.includes('crossword')));
  assert.ok(errors.some((e) => e.includes('exrcises')));

  const m = lesson();
  m.exercises.find((e) => e.type === 'multiple-choice').answer = 9;
  m.exercises.find((e) => e.type === 'fill-gap').answers.push(['extra']);
  m.exercises[1].id = m.exercises[0].id;
  const sem = semanticChecks(m, 'lesson-02a.json').errors;
  assert.ok(sem.some((e) => e.includes('out of range')));
  assert.ok(sem.some((e) => e.includes('gap(s)')));
  assert.ok(sem.some((e) => e.includes('duplicate id')));
  assert.ok(sem.some((e) => e.includes('file name')));
});
