# Product Roadmap

## Phase 0: Starter Foundation

- Electron + React + TypeScript app shell.
- Docked workspace with sidebar, topbar, mind map, notes, graph, tasks, dashboard, and AI panel.
- JSON `.brain` open/save bridge.
- SQL schema and packaging plan.

## Phase 1: MVP Vault

- SQLite migration runner.
- Real `.brain` package writer and reader.
- Page tree, block editor persistence, map persistence.
- Auto-save, backups, recent vaults.
- Markdown and JSON import/export.
- FTS5 search across pages, blocks, maps, tasks, and extracted attachment text.

## Phase 2: Thinking Surface

- Mind map branch operations, collapse/expand, multiple layouts.
- Concept map and flowchart modes.
- Freeform whiteboard layer with images, sticky notes, shapes, and connectors.
- Backlink panel and graph traversal.
- PDF/image/audio/video attachment ingestion.

## Phase 3: AI Mind Map Agent

- Local Ollama provider.
- OpenAI-compatible provider interface.
- Chunking and embeddings.
- Ask-my-notes with source citations.
- Prompt-to-map and note-to-map conversion.
- Map-to-outline and map-to-project-plan conversion.
- Link suggestions and auto-organization queue.

## Phase 4: Productivity OS

- Kanban database.
- Task and goal dashboards.
- Daily notes and journal calendar.
- Habit tracker.
- Focus mode.
- Bookmark manager and web clipper import architecture.

## Phase 5: Platform

- Plugin manifest and permission model.
- Theme engine with typography and color tokens.
- Sync adapter interface.
- End-to-end tests for vault migrations and file recovery.
- Signed Windows installer, auto-update, crash reporting, telemetry opt-in.
