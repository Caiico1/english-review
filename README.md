# English Review

A static app for reviewing an English course lesson by lesson, aimed at B2 learners. Everything the learner sees is in English. There is no backend and no accounts: progress is stored in the browser (localStorage) and can be exported and imported as JSON.

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run validate` | Checks every lesson and reports errors (`npm run validate -- 01b` for just one) |
| `npm test` | Tests for answer checking and for the validator |
| `npm run build` | Validates the lessons and builds the final version into `dist/` |
| `npm run preview` | Serves `dist/` locally to try the final version |
| `npm run build:portable` | Builds a single-file version into `portable/` |

### Online (any computer or phone)

The app is published at <https://caiico1.github.io/english-review/>. Every `git push` to `main` republishes it within a couple of minutes (see `.github/workflows/deploy.yml`), so a new lesson reaches every device with:

```bash
git add -A && git commit -m "Lesson 1B" && git push
```

After the first visit the app is saved on the device and opens offline. On a phone you can use "Add to Home screen". Progress stays local to each browser: to move it, use **Progress → Export** on one device and **Import** on the other.

### Other computers: portable version

```bash
npm run build:portable
```

This builds `portable/english-review.html`: the whole app and every lesson in one file. Copy it to another computer (USB stick, email, Drive…) and open it with a double click in Chrome or Edge. Nothing needs installing and no connection is needed.

- Rebuild and copy the file again whenever you add a lesson.
- Keep the file in the same place on that computer. If you move or rename it, the browser may treat it as a new page and start with no progress, so export from time to time.

### Audio

Pronunciation and dictation use the device's English voice (Web Speech API). If the browser has none, dictation exercises are left out of sessions.

## Adding a lesson

1. Create `src/lessons/lesson-<id>.json` (for example `lesson-01b.json`). The quickest way is to copy `lesson-01a.json`.
2. The `id` inside must match the file name (`"id": "01b"`). The menu is sorted by `id`.
3. Run `npm run validate`.

No code changes are needed: the app discovers every file in `src/lessons/` by itself.

## JSON format

The full schema is in `schema/lesson.schema.json`. With `"$schema": "../../schema/lesson.schema.json"` at the top of the file, VS Code autocompletes and underlines errors as you type.

```jsonc
{
  "$schema": "../../schema/lesson.schema.json",
  "id": "01b",                     // 2 digits + optional letter; same as the file name
  "number": 1,                     // unit in the book
  "title": "It's a mystery",
  "classDate": "2026-10-12",       // YYYY-MM-DD
  "objectives": ["…"],

  "vocabulary": [                  // at least 4
    { "id": "v-geek", "word": "geek", "partOfSpeech": "noun",
      "definition": "someone who knows a lot about one subject",
      "example": "He's a computer **geek**.",
      "pronunciationHint": "/ɡiːk/" }                          // optional
  ],
  "phrases": [
    { "id": "p-shame", "phrase": "What a shame!", "meaning": "shows you are sorry about bad news",
      "context": "Use it to show sympathy." }                  // context is optional
  ],

  "grammar": [
    { "id": "g-indirect", "title": "…", "explanation": "…",
      "rules": ["…"],
      "examples": [ { "en": "Do you know where **he lives**?", "note": "optional" } ],
      "commonMistakes": [ { "wrong": "…", "right": "…", "why": "…" } ] }
  ],

  "reading": {                     // optional
    "type": "dialogue",            // or "text"
    "title": "…", "intro": "…",
    "lines": [ { "speaker": "Ana", "en": "…" } ],
    "questions": [ /* exercises, same format as below */ ]
  },

  "exercises": [ /* see the types below */ ]
}
```

- `**text**` highlights the structure in examples, rules, options and explanations.
- Every item has an `id` that is unique within the lesson (lower case, digits and hyphens). **Don't change it later**: progress is stored by `id`.
- `explanation` is what the learner sees after a mistake; `tags` is free-form.
- Write definitions, hints and explanations in English.

### Exercise types

```jsonc
// Multiple choice: answer is the index (from 0) of the correct option; options are shuffled for you
{ "id": "m-1", "type": "multiple-choice", "prompt": "Which sentence is correct?",
  "options": ["Who wrote this?", "Who did write this?"], "answer": 0, "explanation": "…" }

// Fill in the gaps: each ___ is a gap; answers holds one list of accepted answers per gap
{ "id": "f-1", "type": "fill-gap", "text": "Where ___ last summer?", "hint": "you / go",
  "answers": [["did you go"]], "explanation": "…" }

// Word order: the tiles come from splitting answer on spaces
{ "id": "o-1", "type": "order-words", "answer": "What are you waiting for?",
  "hint": "optional clue", "alternatives": [], "distractors": [], "explanation": "…" }

// Matching
{ "id": "ma-1", "type": "match", "prompt": "Match each word with its definition.",
  "pairs": [ { "left": "owe", "right": "to have to pay money back" }, { "left": "tough", "right": "difficult" } ] }

// Rewrite the sentence: prompt is the instruction; list every accepted answer, the first is the model
{ "id": "rw-1", "type": "rewrite", "prompt": "Rewrite as an indirect question. Begin: Could you tell me…",
  "source": "What time does the museum close?",
  "answers": ["Could you tell me what time the museum closes?"], "explanation": "…" }

// Dictation: text is read aloud
{ "id": "d-1", "type": "dictation", "text": "Why didn't you tell me?" }
```

Checking ignores capitals, extra spaces and punctuation, and contractions count the same as the full form (`don't` = `do not`). Word order does count.

## How the review works

- **Leitner boxes**: every card (vocabulary and phrases) starts in box 1. A correct answer moves it up a box and delays it by 1, 3, 7 and 14 days; a miss sends it back to box 1 and it comes up again in the same session. A word is "mastered" from box 4.
- **Mistakes notebook**: keeps every exercise you get wrong; an exercise leaves the notebook once you get it right twice in a row.
- **% complete** for a lesson: 40% exercises answered correctly at least once, 40% vocabulary progress and 20% your best test score.

## Structure

```
src/lessons/      one lesson = one JSON file
src/exercises.js  the six exercise types
src/session.js    sessions (one question per screen, feedback, summary)
src/store.js      progress, Leitner, export / import
src/check.js      answer checking
src/views/        screens
schema/           JSON schema for a lesson
scripts/          validator, tests and the portable build
public/sw.js      service worker (offline mode)
```
