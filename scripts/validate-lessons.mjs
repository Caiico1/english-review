// Valida src/lessons/*.json contra schema/lesson.schema.json y añade comprobaciones de coherencia.
// Uso: npm run validate            (todas las lecciones)
//      npm run validate -- 01a     (solo una)
// Sin dependencias: implementa el subconjunto de JSON Schema que usa el esquema.
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
    // Los ejercicios se distinguen por «type»: se valida solo contra la variante que corresponde
    const variants = node.oneOf;
    const known = variants.map((v) => v.properties?.type?.const).filter(Boolean);
    const variant = variants.find((v) => v.properties?.type?.const === data?.type);
    if (!variant) {
      errors.push(`${path}: type «${data?.type}» no válido. Tipos admitidos: ${known.join(', ')}`);
      return errors;
    }
    return validate(data, variant, path, errors);
  }

  const t = typeOf(data);
  if (node.type && !(node.type === t || (node.type === 'number' && t === 'integer'))) {
    errors.push(`${path || '(raíz)'}: se esperaba ${node.type} y hay ${t}`);
    return errors;
  }
  if (node.const !== undefined && data !== node.const) errors.push(`${path}: debe ser «${node.const}»`);
  if (node.enum && !node.enum.includes(data)) errors.push(`${path}: debe ser uno de ${node.enum.join(', ')}`);

  if (t === 'string') {
    if (node.minLength && data.trim().length < node.minLength) errors.push(`${path}: está vacío`);
    if (node.pattern && !new RegExp(node.pattern).test(data)) errors.push(`${path}: «${data}» no cumple el formato ${node.pattern}`);
  }
  if ((t === 'integer' || t === 'number') && node.minimum !== undefined && data < node.minimum) {
    errors.push(`${path}: debe ser ≥ ${node.minimum}`);
  }
  if (t === 'array') {
    if (node.minItems && data.length < node.minItems) errors.push(`${path}: necesita al menos ${node.minItems} elemento(s) y tiene ${data.length}`);
    if (node.items) data.forEach((item, i) => validate(item, node.items, `${path}[${i}]`, errors));
  }
  if (t === 'object') {
    for (const key of node.required ?? []) {
      if (!(key in data)) errors.push(`${path || '(raíz)'}: falta el campo obligatorio «${key}»`);
    }
    for (const [key, value] of Object.entries(data)) {
      const sub = node.properties?.[key];
      if (sub) validate(value, sub, path ? `${path}.${key}` : key, errors);
      else if (node.additionalProperties === false) errors.push(`${path || '(raíz)'}: campo desconocido «${key}» (¿errata?)`);
    }
  }
  return errors;
}

/** Comprobaciones que un esquema no puede expresar. */
export function semanticChecks(lesson, fileName) {
  const errors = [];
  const warnings = [];
  if (fileName && fileName !== `lesson-${lesson.id}.json`) {
    errors.push(`id «${lesson.id}» no coincide con el nombre del archivo (debería llamarse lesson-${lesson.id}.json)`);
  }

  const seen = new Map();
  const track = (id, where) => {
    if (typeof id !== 'string') return;
    if (seen.has(id)) errors.push(`${where}: id «${id}» repetido (ya está en ${seen.get(id)})`);
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
    if (typeof ex.id === 'string' && ex.id.startsWith('auto-')) errors.push(`${where}: los ids que empiezan por «auto-» están reservados`);
    if (ex.type === 'multiple-choice' && Array.isArray(ex.options)) {
      if (!(ex.answer >= 0 && ex.answer < ex.options.length)) errors.push(`${where}: answer=${ex.answer} está fuera de las ${ex.options.length} opciones`);
      if (new Set(ex.options).size !== ex.options.length) errors.push(`${where}: hay opciones repetidas`);
    }
    if (ex.type === 'fill-gap' && typeof ex.text === 'string' && Array.isArray(ex.answers)) {
      const gaps = (ex.text.match(/_{3,}/g) ?? []).length;
      if (gaps !== ex.answers.length) errors.push(`${where}: el texto tiene ${gaps} hueco(s) pero answers tiene ${ex.answers.length} lista(s)`);
    }
    if (ex.type === 'order-words' && typeof ex.answer === 'string') {
      const words = (s) => s.toLowerCase().replace(/[.?!]+$/, '').split(/\s+/).sort().join(' ');
      if (ex.answer.trim().split(/\s+/).length < 3) errors.push(`${where}: la frase necesita al menos 3 palabras`);
      for (const alt of ex.alternatives ?? []) {
        if (words(alt) !== words(ex.answer)) errors.push(`${where}: la alternativa «${alt}» no usa las mismas palabras que answer`);
      }
    }
    if (ex.type === 'match' && Array.isArray(ex.pairs)) {
      for (const side of ['left', 'right']) {
        const values = ex.pairs.map((p) => p[side]);
        if (new Set(values).size !== values.length) errors.push(`${where}: hay valores repetidos en la columna ${side}`);
      }
    }
    if (!ex.explanation && ex.type !== 'match' && ex.type !== 'dictation') warnings.push(`${where} (${ex.id}): sin explicación del error`);
  }

  const total = lesson.exercises?.length ?? 0;
  if (total < 10) warnings.push(`solo hay ${total} ejercicios; el test final funciona mejor con 10 o más`);
  if (!lesson.classDate) warnings.push('falta classDate (fecha de la clase)');
  return { errors, warnings };
}

function main() {
  const only = process.argv[2];
  const files = readdirSync(lessonsDir).filter((f) => f.endsWith('.json')).sort()
    .filter((f) => !only || f === `lesson-${only}.json` || f === only);
  if (!files.length) {
    console.error(only ? `No existe src/lessons/lesson-${only}.json` : 'No hay lecciones en src/lessons/');
    process.exit(1);
  }

  let failed = 0;
  const ids = new Map();
  for (const file of files) {
    let lesson;
    try {
      lesson = JSON.parse(readFileSync(join(lessonsDir, file), 'utf8'));
    } catch (err) {
      console.error(`✗ ${file}\n    JSON mal formado: ${err.message}`);
      failed++;
      continue;
    }
    const errors = validate(lesson, schema);
    const extra = semanticChecks(lesson, file);
    errors.push(...extra.errors);
    if (ids.has(lesson.id)) errors.push(`id «${lesson.id}» duplicado: también lo usa ${ids.get(lesson.id)}`);
    ids.set(lesson.id, file);

    if (errors.length) {
      failed++;
      console.error(`✗ ${file} — ${errors.length} error(es)`);
      errors.forEach((e) => console.error(`    ${e}`));
    } else {
      const byType = {};
      for (const e of lesson.exercises) byType[e.type] = (byType[e.type] ?? 0) + 1;
      console.log(`✓ ${file} — ${lesson.vocabulary.length} palabras, ${lesson.phrases?.length ?? 0} frases, ` +
        `${lesson.grammar.length} puntos de gramática, ${lesson.exercises.length} ejercicios ` +
        `(${Object.entries(byType).map(([t, n]) => `${t}: ${n}`).join(', ')})`);
    }
    extra.warnings.forEach((w) => console.warn(`    aviso: ${w}`));
  }
  if (failed) {
    console.error(`\n${failed} lección(es) con errores.`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
