# Coding Standards

## TypeScript

- Use strict TypeScript.
- Keep domain types in `src/domain`.
- Keep renderer state separate from persistence services.
- Prefer narrow IPC methods over generic command execution.
- Validate all data crossing the preload boundary.

## React

- Components should be focused and named after product concepts.
- Keep visual state local unless it affects cross-panel behavior.
- Keep domain mutations in store/actions or services.
- Use accessible labels for icon-only buttons.

## Persistence

- All writes go through transactions.
- Migrations are additive and reversible where practical.
- Large binaries live in `assets/`; the database stores metadata and extracted text.
- Snapshots are created before destructive migrations.

## AI

- Retrieval answers must cite source entity IDs.
- Provider adapters must support disabled/offline mode.
- Never send vault data to a remote provider without explicit user configuration.
- Store prompt and response audit metadata separately from user notes.

