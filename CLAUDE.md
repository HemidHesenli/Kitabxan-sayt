# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A "library" web app: the user uploads a PDF/DOCX, its text is extracted, translated into simplified English at CEFR B1 (strong) or B2 (weak) level — simple sentence structure, easy vocabulary — stored, and read in a paged or scrolling reader. UI text is in Azerbaijani.

Split into two directories, each with its own `CLAUDE.md` holding stack-specific commands and architecture:

- `frontend/` — plain HTML/CSS/JS, no build step. Upload, text extraction, library list, reader, and IndexedDB storage all work. `frontend/serve.js` serves the site and also exposes `POST /api/translate`, which calls `backend/`.
- `backend/simplify.js` — the B1/B2 simplification via the Claude API (`claude-opus-5-5`, effort `low`, `fallbacks: "default"`). Splits text into ~12k-char chunks at paragraph boundaries, runs 4 in parallel, keeps order, and logs tokens and estimated cost to the server console. Needs `ANTHROPIC_API_KEY` in the root `.env` (the key cannot live in the browser). Uses the root `node_modules` (`@anthropic-ai/sdk`).

Separately, `tools/translate-doc.js` (run via `npm run translate -- <file>` or by dropping files onto `tercume-et.bat`) is a standalone CLI that translates a .docx/.pdf into Azerbaijani with Azure Translator and writes `name.az.docx` / `name.az.pdf` next to the original. It is not wired into the web app. The Azure key is in root `.env` (shared F0 quota with the sibling `derman-sayti` project). Details: `TERCUME-ALETI.md`. The root `package.json`/`node_modules` hold the dependencies for this tool and for `backend/`.

There is no git repository, test framework, or linter. Keep this root file for project-wide context only.

## Environment

- Windows 11; PowerShell 5.1 is the primary shell (Git Bash is also available).
- The user writes in Azerbaijani — respond in Azerbaijani.

## MCP: hermes-agent

A local-scope MCP server `hermes-agent` is configured for this project (stored in `C:\Users\ACER\.claude.json`):

```
C:\Users\ACER\AppData\Local\hermes\hermes-agent\venv\Scripts\hermes.exe mcp serve
```

- It exposes Hermes messaging conversations (Telegram, Discord, Slack, etc.) as tools: `conversations_list`, `conversation_get`, `messages_read`, `attachments_fetch`, `events_poll`, `events_wait`, `messages_send`, `channels_list`, `permissions_list_open`, `permissions_respond`.
- The server takes ~7.5s to start, which exceeds Claude Code's default MCP startup timeout. `MCP_TIMEOUT=60000` is set in `C:\Users\ACER\.claude\settings.json` (`env`) to fix this. If it shows "Request timed out" in `claude mcp list`, check that setting first.
- `...\hermes-agent\apps\desktop\release\win-unpacked\Hermes.exe` is the Electron desktop app, not the MCP server.
- Hermes uses `mcp` 2.0 (Python); its client/result fields are snake_case (e.g. `server_info`, `protocol_version`).
