// Validates src/lessons/*.json against schema/lesson.schema.json and adds consistency checks.
// Usage: npm run validate            (every lesson)
//        npm run validate -- 01a     (just one)
// No dependencies: implements the subset of JSON Schema that the schema uses.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lessonsDir = join(root, 'src', 'lessons');
const schema = JSON.parse(readFileSync(join(root, 'schema', 'lesson.schema.json'), 'utf8'));

const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : Number.isInteger(v) ? 'integer' : typeof v);

export function validate(data, node, path = '', errors = []) {
  if (node.$ref) node = node.$ref.replace('#/', '').split('/').reduce((n, k) => n[k], schema);

  if (node.oneOf) {
    // Exercises are told apart by "type": validate only against the matching variant
    const variants = node.oneOf;
    const known = variants.map((v) => v.properties?.type?.const).filter(Boolean);
    const variant = variants.find((v) => v.properties?.type?.const === data?.type);
    if (!variant) {
      errors.push(`${path}: invalid type "${data?.type}". Allowed types: ${known.join(', ')}`);
      return errors;
    }
    return validate(data, variant, path, errors);
  }

  const t = typeOf(data);
  if (node.type && !(node.type === t || (node.type === 'number' && t === 'integer'))) {
    errors.push(`${path || '(root)'}: expected ${node.type} but found ${t}`);
    return errors;
  }
  if (node.const !== undefined && data !== node.const) errors.push(`${path}: must be "${node.const}"`);
  if (node.enum && !node.enum.includes(data)) errors.push(`${path}: must be one of ${node.enum.join(', ')}`);

  if (t === 'string') {
    if (node.minLength && data.trim().length < node.minLength) errors.push(`${path}: is empty`);
    if (node.pattern && !new RegExp(node.pattern).test(data)) errors.push(`${path}: "${data}" does not match the format ${node.pattern}`);
  }
  if ((t === 'integer' || t === 'number') && node.minimum !== undefined && data < node.minimum) {
    errors.push(`${path}: must be ≥ ${node.minimum}`);
  }
  if (t === 'array') {
    if (node.minItems && data.length < node.minItems) errors.push(`${path}: needs at least ${node.minItems} item(s) but has ${data.length}`);
    if (node.items) data.forEach((item, i) => validate(item, node.items, `${path}[${i}]`, errors));
  }
  if (t === 'object') {
    for (const key of node.required ?? []) {
      if (!(key in data)) errors.push(`${path || '(root)'}: missing required field "${key}"`);
    }
    for (const [key, value] of Object.entries(data)) {
      const sub = node.properties?.[key];
      if (sub) validate(value, sub, path ? `${path}.${key}` : key, errors);
      else if (node.additionalProperties === false) errors.push(`${path || '(root)'}: unknown field "${key}" (typo?)`);
    }
  }
  return errors;
}

/** Checks a schema cannot express. */
export function semanticChecks(lesson, fileName) {
  const errors = [];
  const warnings = [];
  if (fileName && fileName !== `lesson-${lesson.id}.json`) {
    errors.push(`id "${lesson.id}" does not match the file name (it should be called lesson-${lesson.id}.json)`);
  }

  const seen = new Map();
  const track = (id, where) => {
    if (typeof id !== 'string') return;
    if (seen.has(id)) errors.push(`${where}: duplicate id "${id}" (already used in ${seen.get(id)})`);
    else seen.set(id, where);
  };
  (lesson.vocabulary ?? []).forEach((v, i) => track(v.id, `vocabulary[${i}]`));
  (lesson.phrases ?? []).forEach((p, i) => track(p.id, `phrases[${i}]`));
  (lesson.grammar ?? []).forEach((g, i) => track(g.id, `grammar[${i}]`));

  const exercises = [
    ...(lesson.exercises ?? []).map((e, i) => [e, `exercises[${i}]`]),
    ...(lesson.reading?.questions ?? []).map((e, i) => [e, `reading.questions[${i}]`]),
  ];
  for (const [ex, where] of exercises) {
    track(ex.id, where);
    if (typeof ex.id === 'string' && ex.id.startsWith('auto-')) errors.push(`${where}: ids starting with "auto-" are reserved`);
    if (ex.type === 'multiple-choice' && Array.isArray(ex.options)) {
      if (!(ex.answer >= 0 && ex.answer < ex.options.length)) errors.push(`${where}: answer=${ex.answer} is out of range for ${ex.options.length} options`);
      if (new Set(ex.options).size !== ex.options.length) errors.push(`${where}: there are repeated options`);
    }
    if (ex.type === 'fill-gap' && typeof ex.text === 'string' && Array.isArray(ex.answers)) {
      const gaps = (ex.text.match(/_{3,}/g) ?? []).length;
      if (gaps !== ex.answers.length) errors.push(`${where}: the text has ${gaps} gap(s) but answers has ${ex.answers.length} list(s)`);
    }
    if (ex.type === 'order-words' && typeof ex.answer === 'string') {
      const words = (s) => s.toLowerCase().replace(/[.?!]+$/, '').split(/\s+/).sort().join(' ');
      if (ex.answer.trim().split(/\s+/).length < 3) errors.push(`${where}: the sentence needs at least 3 words`);
      for (const alt of ex.alternatives ?? []) {
        if (words(alt) !== words(ex.answer)) errors.push(`${where}: the alternative "${alt}" does not use the same words as answer`);
      }
    }
    if (ex.type === 'match' && Array.isArray(ex.pairs)) {
      for (const side of ['left', 'right']) {
        const values = ex.pairs.map((p) => p[side]);
        if (new Set(values).size !== values.length) errors.push(`${where}: there are repeated values in the ${side} column`);
      }
    }
    if (!ex.explanation && ex.type !== 'match' && ex.type !== 'dictation') warnings.push(`${where} (${ex.id}): no explanation for the learner`);
  }

  const definitions = [...(lesson.vocabulary ?? []).map((v) => v.definition), ...(lesson.phrases ?? []).map((p) => p.meaning)];
  if (new Set(definitions).size < 4) errors.push('vocabulary and phrases need at least 4 different definitions to build quiz questions');

  const total = lesson.exercises?.length ?? 0;
  if (total < 10) warnings.push(`there are only ${total} exercises; the final test works best with 10 or more`);
  if (!lesson.classDate) warnings.push('classDate (the date of the class) is missing');
  return { errors, warnings };
}

function main() {
  const only = process.argv[2];
  const files = readdirSync(lessonsDir).filter((f) => f.endsWith('.json')).sort()
    .filter((f) => !only || f === `lesson-${only}.json` || f === only);
  if (!files.length) {
    console.error(only ? `src/lessons/lesson-${only}.json does not exist` : 'There are no lessons in src/lessons/');
    process.exit(1);
  }

  let failed = 0;
  const ids = new Map();
  for (const file of files) {
    let lesson;
    try {
      lesson = JSON.parse(readFileSync(join(lessonsDir, file), 'utf8'));
    } catch (err) {
      console.error(`✗ ${file}\n    Malformed JSON: ${err.message}`);
      failed++;
      continue;
    }
    const errors = validate(lesson, schema);
    const extra = semanticChecks(lesson, file);
    errors.push(...extra.errors);
    if (ids.has(lesson.id)) errors.push(`duplicate id "${lesson.id}": ${ids.get(lesson.id)} uses it too`);
    ids.set(lesson.id, file);

    if (errors.length) {
      failed++;
      console.error(`✗ ${file} — ${errors.length} error(s)`);
      errors.forEach((e) => console.error(`    ${e}`));
    } else {
      const byType = {};
      for (const e of lesson.exercises) byType[e.type] = (byType[e.type] ?? 0) + 1;
      console.log(`✓ ${file} — ${lesson.vocabulary.length} words, ${lesson.phrases?.length ?? 0} phrases, ` +
        `${lesson.grammar.length} grammar points, ${lesson.exercises.length} exercises ` +
        `(${Object.entries(byType).map(([t, n]) => `${t}: ${n}`).join(', ')})`);
    }
    extra.warnings.forEach((w) => console.warn(`    warning: ${w}`));
  }
  if (failed) {
    console.error(`\n${failed} lesson(s) with errors.`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
