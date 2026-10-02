# CLAUDE.md — frontend

This file provides guidance to Claude Code when working in the `frontend/` directory. See the root `CLAUDE.md` for project-wide context (environment, language, MCP setup).

## What it is

A "library" web app: the user uploads a PDF/DOCX, its text is extracted, (later) translated into simplified English at B1 or B2 level, saved, and read in a reader view. All UI text is in Azerbaijani.

Plain HTML/CSS/JS — no framework, no build step, no package manager, no tests. Third-party libs load from cdnjs: pdf.js 3.11.174 (PDF text) and mammoth 1.6.0 (DOCX text).

## Running

Serve the folder with the bundled static server (Python is not installed; port 8000 is taken by a local Apache):

```
node serve.js      # run inside frontend/, then open http://localhost:8765
```

Syntax-check JS with `node --check js/<file>.js`.

## Structure

- `index.html` + `js/upload.js` — upload form (drag & drop, title, B1/B2 level). Flow: `extractText` → `translateText` → `BookDB.save`.
- `library.html` + `js/library.js` — list of saved books (title, level, translation status, Oxu/Sil).
- `reader.html?id=<id>` + `js/reader.js` — reader. Splits text into paragraphs (blank-line separated; single newlines from PDF are joined), then pages of ~2500 chars. Paged/scroll mode, font size, and last page per book are kept in `localStorage`.
- `js/space.js` — canvas background (dark "space" style, modeled on a Krea-style landing video): 3D starfield plus light streaks that flow around the element marked `data-orbit` (the upload box). `<body data-space="static">` (reader) draws stars once with no animation; `prefers-reduced-motion` does the same. All pages are dark-only (Inter for UI, Literata for reader text, via Google Fonts).
- `js/db.js` — `BookDB` wrapper over IndexedDB (db `kitabxana`, store `books`, keyPath `id`). Book: `{ id, title, fileName, level, originalText, translatedText, createdAt }`.
- `js/extract.js` — `extractText(file)`; PDF and DOCX only. Scanned (image-only) PDFs produce no text and throw.
- `js/translate.js` — `translateText(text, level, onProgress)` POSTs to `/api/translate` (served by `serve.js` → `../backend/simplify.js` → Claude) and reads the NDJSON stream (`progress` lines, then `done` with the text or `error`). It throws on failure; `upload.js` then saves the book with `translatedText: null` ("not translated yet": the reader shows `originalText` with a notice) and `library.js` offers a "Tərcümə et" button to retry.

## Translation

The page must be opened through `node serve.js` (not as a file) for translation to work, and the server must be restarted after backend changes. `ANTHROPIC_API_KEY` goes in the root `.env`.

Storage is per-browser (IndexedDB); books are not shared across devices until the backend stores them.
