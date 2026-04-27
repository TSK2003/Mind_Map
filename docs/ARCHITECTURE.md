# Mind Map Architecture

## Recommendation

Use Electron + React + TypeScript for the first commercial Windows release. Tauri is excellent for small binaries and a tighter Rust security boundary, but Mind Map needs a large web UI surface, rich npm ecosystem access, native file operations, local AI process integration, embeddable plugin APIs, and mature Windows installer workflows. Electron is the faster path to a production-grade Windows alpha.

Tauri remains a strong future candidate for a lean Rust-backed edition. Its WebView2 model is attractive, but the Rust/native build burden is higher for a rapid product with heavy editor, graph, AI, and plugin needs.

Primary sources checked on 2026-04-27:

- Electron: https://www.electronjs.org/docs/latest
- Tauri 2: https://v2.tauri.app/start/
- React Flow: https://reactflow.dev/
- Tiptap: https://tiptap.dev/docs/editor/introduction
- SQLite FTS5: https://www.sqlite.org/fts5.html
- Ollama embeddings: https://docs.ollama.com/capabilities/embeddings
- electron-builder NSIS: https://www.electron.build/nsis.html

## Target Stack

- Desktop shell: Electron 41+ with context-isolated preload bridge.
- UI: React, TypeScript, Vite.
- Canvas: React Flow first, with optional Konva layer for freehand whiteboard objects and D3 for analytics-grade graph layouts.
- Editor: Tiptap on ProseMirror with custom block extensions.
- State: Zustand for UI state, command bus for domain actions, query/cache layer once persistence lands.
- Storage: `.brain` vault package with SQLite, assets, snapshots, and index metadata.
- Search: SQLite FTS5 for lexical search.
- Graph: relational edge table for backlinks and concept relationships, projected into canvas and graph views.
- AI: provider abstraction supporting local Ollama, OpenAI-compatible APIs, and disabled/offline mode.
- Packaging: electron-builder NSIS installer for Windows.

## Runtime Layers

1. Renderer
   React workbench, canvas, editor, dashboards, command palette, theme engine.

2. Preload bridge
   Narrow IPC API for vault open/save, filesystem imports, AI calls, backups, exports, and app settings.

3. Main process
   Window lifecycle, native dialogs, app protocol, file associations, vault package IO, background workers.

4. Knowledge engine
   Domain services for pages, blocks, maps, relationships, tags, tasks, assets, snapshots, search, and imports.

5. AI engine
   Chunking, embedding, retrieval, prompt orchestration, provider adapters, citation tracking, and audit logs.

6. Plugin host
   Sandboxed plugin manifests, command contributions, panels, import/export adapters, and AI tools.

## Vault Package Format

The long-term `.brain` file should be a zip-like package:

```text
MyVault.brain/
  manifest.json
  vault.sqlite
  assets/
    images/
    pdf/
    audio/
    video/
    documents/
    web-clips/
  snapshots/
    2026-04-27T09-30-00Z.sqlite
  indexes/
    embeddings.meta.json
```

The starter currently saves `.brain` as readable JSON so the app can open and save vaults before the SQLite package writer is implemented. The schema in `database/schema.sql` is the migration target.

## AI RAG Flow

1. Extract page, block, map node, attachment, and task text.
2. Chunk by semantic boundaries with source entity metadata.
3. Embed chunks with the configured provider.
4. Store embeddings in SQLite as BLOBs, then move to `sqlite-vec` when native extension packaging is ready.
5. On question, run hybrid retrieval: FTS5 lexical search plus vector nearest-neighbor search.
6. Build a grounded prompt with source citations and user-selected context.
7. Return answer, suggested backlinks, generated notes, generated maps, or tasks.

## Security Baseline

- `contextIsolation: true`
- `nodeIntegration: false`
- Renderer never receives unrestricted filesystem access.
- IPC input validation before persistence or command execution.
- App content security policy blocks remote scripts.
- AI providers are user-configured and can run fully local.
- Plugin execution must be permission-gated by manifest.
