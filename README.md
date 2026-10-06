# English Review

App estática para repasar un libro de inglés lección a lección. Sin backend ni cuentas: el progreso se guarda en el navegador (localStorage) y se puede exportar e importar en JSON.

## Arrancar

```bash
npm install
npm run dev
```

Abre <http://localhost:5173>.

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga automática |
| `npm run validate` | Revisa todas las lecciones y avisa de errores (`npm run validate -- 01b` para una sola) |
| `npm test` | Pruebas de la corrección de respuestas y del validador |
| `npm run build` | Valida las lecciones y genera la versión final en `dist/` |
| `npm run preview` | Sirve `dist/` en local para probar la versión final |

### Otros ordenadores: versión portátil

```bash
npm run build:portable
```

Genera `portable/english-review.html`: toda la app y todas las lecciones en un único archivo. Cópialo a otro PC (USB, correo, Drive…) y ábrelo con doble clic en Chrome o Edge; no hace falta instalar nada ni tener conexión.

- Cada vez que añadas una lección, vuelve a generar el archivo y cópialo de nuevo.
- El progreso se guarda en el navegador de cada PC. Para llevarlo de uno a otro: **Progreso → Exportar** e **Importar**.
- Guarda el archivo siempre en la misma ruta de ese PC; si lo mueves o lo renombras, el navegador puede tratarlo como una página nueva y empezar sin progreso (por eso conviene exportar de vez en cuando).

### Móvil y uso sin conexión

`dist/` es una carpeta estática: súbela a cualquier hosting estático con HTTPS (GitHub Pages, Netlify, Cloudflare Pages…). Tras la primera visita la app queda guardada y abre sin conexión; desde el menú del navegador del móvil se puede «Añadir a pantalla de inicio».

El modo sin conexión solo existe en la versión de `build` (no en `npm run dev`) y los navegadores lo exigen servido por HTTPS o desde `localhost`. Para pasar el progreso del ordenador al móvil: **Progreso → Exportar** en uno e **Importar** en el otro.

La pronunciación y los dictados usan la voz en inglés del dispositivo (Web Speech API). Si el navegador no tiene ninguna, los dictados se omiten de las sesiones.

## Añadir una lección

1. Crea `src/lessons/lesson-<id>.json` (por ejemplo `lesson-01b.json`). Lo más rápido es copiar `lesson-01a.json`.
2. El `id` de dentro debe coincidir con el nombre del archivo (`"id": "01b"`). El menú se ordena por `id`.
3. Ejecuta `npm run validate`.

No hay que tocar código: la app descubre sola todos los archivos de `src/lessons/`.

## Formato del JSON

El esquema completo está en `schema/lesson.schema.json`. Con la línea `"$schema": "../../schema/lesson.schema.json"` al principio del archivo, VS Code autocompleta y subraya errores mientras escribes.

```jsonc
{
  "$schema": "../../schema/lesson.schema.json",
  "id": "01b",                     // 2 dígitos + letra opcional; igual que el nombre del archivo
  "number": 1,                     // unidad del libro
  "title": "It's a mystery",
  "classDate": "2026-10-12",       // AAAA-MM-DD
  "objectives": ["…"],

  "vocabulary": [                  // mínimo 4
    { "id": "v-geek", "word": "geek", "translation": "friki", "partOfSpeech": "noun",
      "example": "He's a computer **geek**.", "exampleTranslation": "Es un friki de los ordenadores.",
      "pronunciationHint": "/ɡiːk/" }                          // opcional
  ],
  "phrases": [ { "id": "p-shame", "en": "What a shame!", "es": "¡Qué pena!", "context": "Cuándo se usa" } ],

  "grammar": [
    { "id": "g-indirect", "title": "…", "explanation": "En español.",
      "rules": ["…"],
      "examples": [ { "en": "Do you know where **he lives**?", "es": "…", "note": "opcional" } ],
      "commonMistakes": [ { "wrong": "…", "right": "…", "why": "…" } ] }
  ],

  "reading": {                     // opcional
    "type": "dialogue",            // o "text"
    "title": "…", "intro": "…",
    "lines": [ { "speaker": "Ana", "en": "…", "es": "…" } ],
    "questions": [ /* ejercicios, mismo formato que abajo */ ]
  },

  "exercises": [ /* ver tipos */ ]
}
```

- `**texto**` resalta la estructura en ejemplos, reglas, opciones y explicaciones.
- Cada elemento lleva un `id` único dentro de la lección (minúsculas, números y guiones). **No lo cambies después**: el progreso se guarda por `id`.
- `explanation` es lo que se enseña al fallar; `tags` es libre.

### Tipos de ejercicio

```jsonc
// Opción múltiple: answer es el índice (desde 0) de la correcta; las opciones se barajan solas
{ "id": "m-1", "type": "multiple-choice", "prompt": "¿Cuál es correcta?",
  "options": ["Who wrote this?", "Who did write this?"], "answer": 0, "explanation": "…" }

// Rellenar huecos: cada ___ es un hueco; answers tiene una lista de válidas por hueco
{ "id": "f-1", "type": "fill-gap", "text": "Where ___ last summer?", "hint": "you / go",
  "answers": [["did you go"]], "explanation": "…" }

// Ordenar palabras: las fichas salen de separar answer por espacios
{ "id": "o-1", "type": "order-words", "answer": "What are you waiting for?",
  "translation": "¿A qué esperas?", "alternatives": [], "distractors": [], "explanation": "…" }

// Emparejar
{ "id": "ma-1", "type": "match", "prompt": "Empareja…",
  "pairs": [ { "left": "owe", "right": "deber" }, { "left": "tough", "right": "difícil" } ] }

// Traducción ES→EN: todas las respuestas válidas; la primera se muestra como modelo
{ "id": "t-1", "type": "translate", "source": "¿Quién vive aquí?",
  "answers": ["Who lives here?"], "explanation": "…" }

// Dictado: text se lee en voz alta
{ "id": "d-1", "type": "dictation", "text": "Why didn't you tell me?", "translation": "…" }
```

Al corregir se ignoran mayúsculas, espacios de más y puntuación, y las contracciones cuentan igual que la forma completa (`don't` = `do not`). El orden de las palabras sí cuenta.

## Cómo funciona el repaso

- **Cajas de Leitner**: cada tarjeta (vocabulario y frases) empieza en la caja 1. Un acierto la sube de caja y la aplaza 1, 3, 7 y 14 días; un fallo la devuelve a la caja 1 y vuelve a salir en la misma sesión. Una palabra está «dominada» a partir de la caja 4.
- **Cuaderno de errores**: guarda cada ejercicio fallado; sale del cuaderno al acertarlo dos veces seguidas.
- **% completado** de una lección: 40 % ejercicios acertados alguna vez, 40 % avance del vocabulario y 20 % la mejor nota del test.

## Estructura

```
src/lessons/      una lección = un JSON
src/exercises.js  los seis tipos de ejercicio
src/session.js    sesiones (una pregunta por pantalla, corrección, resumen)
src/store.js      progreso, Leitner, exportar/importar
src/check.js      comparación de respuestas
src/views/        pantallas
schema/           esquema JSON de una lección
scripts/          validador y pruebas
public/sw.js      service worker (modo sin conexión)
```
