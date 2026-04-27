# Database Design

The canonical schema is `database/schema.sql`.

## Storage Model

- `vaults`: one root record per `.brain` package.
- `pages` and `blocks`: Notion-style nested document model.
- `maps`, `map_nodes`, `map_edges`: XMind-style and graph-style visual documents.
- `relationships`: Obsidian-style backlinks plus typed semantic edges.
- `tags` and `taggings`: shared metadata across notes, nodes, tasks, assets, and goals.
- `assets`: media and file attachment registry; binary files live in the package `assets/` directory.
- `tasks`, `goals`, `habits`, `daily_notes`, `templates`: productivity layer.
- `snapshots`: version history and backup pointers.
- `ai_chunks`, `ai_embeddings`: retrieval memory layer.
- `search_index`: FTS5 lexical index.

## Relationship Strategy

Every connectable item is an entity addressed by:

```text
entity_type + entity_id
```

Examples:

- `page:page-mind-map`
- `block:block-vision-body`
- `map_node:node-ai`
- `asset:asset-whitepaper`
- `task:task-rag`

This keeps backlinks, AI citations, graph traversal, and plugin extensions consistent.

## Vector Strategy

MVP stores embeddings as raw BLOBs in `ai_embeddings` and performs simple cosine similarity in an application worker for small vaults. The production path is:

1. Package `sqlite-vec` for Windows.
2. Mirror `ai_embeddings` into a vector virtual table.
3. Use hybrid ranking: FTS5 bm25 score plus vector distance plus relationship boost.

## Snapshot Strategy

Use a rolling snapshot policy:

- Auto-save current DB every few seconds through debounced transactions.
- Keep hourly snapshots for 24 hours.
- Keep daily snapshots for 30 days.
- Keep user-pinned snapshots indefinitely.
