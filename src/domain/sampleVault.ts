import type { BrainVault } from './types';

const now = new Date().toISOString();

export const sampleVault: BrainVault = {
  id: 'vault-personal-os',
  name: 'Personal Knowledge OS',
  version: '0.1.0',
  createdAt: now,
  updatedAt: now,
  pages: [
    {
      id: 'page-second-brain',
      title: 'Second Brain OS Vision',
      icon: 'Brain',
      tags: ['product', 'strategy', 'ai'],
      createdAt: now,
      updatedAt: now,
      links: ['page-map-engine', 'page-ai-memory'],
      metadata: {
        status: 'active',
        owner: 'Personal',
      },
      blocks: [
        {
          id: 'block-vision-heading',
          type: 'heading',
          content: 'Personal Knowledge Operating System',
        },
        {
          id: 'block-vision-body',
          type: 'paragraph',
          content:
            'A local-first workspace for notes, maps, projects, media, backlinks, task planning, and AI-assisted recall.',
        },
        {
          id: 'block-vision-todo',
          type: 'todo',
          content: 'Design the first .brain vault package around SQLite, assets, snapshots, and search indexes.',
          checked: false,
        },
      ],
    },
    {
      id: 'page-map-engine',
      title: 'Mind Map Engine',
      icon: 'Network',
      tags: ['canvas', 'xmind', 'visual-thinking'],
      createdAt: now,
      updatedAt: now,
      links: ['page-second-brain'],
      metadata: {
        status: 'prototype',
      },
      blocks: [
        {
          id: 'block-map-heading',
          type: 'heading',
          content: 'Infinite Canvas Design',
        },
        {
          id: 'block-map-body',
          type: 'paragraph',
          content:
            'Use a node graph core for mind maps, concept maps, flowcharts, and whiteboard surfaces with shared relationship semantics.',
        },
      ],
    },
    {
      id: 'page-ai-memory',
      title: 'AI Memory Layer',
      icon: 'Sparkles',
      tags: ['rag', 'semantic-search', 'assistant'],
      createdAt: now,
      updatedAt: now,
      links: ['page-second-brain'],
      metadata: {
        status: 'planned',
      },
      blocks: [
        {
          id: 'block-ai-heading',
          type: 'heading',
          content: 'Local RAG Assistant',
        },
        {
          id: 'block-ai-body',
          type: 'paragraph',
          content:
            'Chunk notes, maps, and attachments into embeddings, retrieve relevant context locally, and expose workflows for summarization and map generation.',
        },
      ],
    },
  ],
  maps: [
    {
      id: 'map-product-os',
      title: 'Second Brain OS Blueprint',
      mode: 'mind-map',
      layout: 'organic',
      updatedAt: now,
      nodes: [
        {
          id: 'node-core',
          type: 'brainNode',
          position: { x: 0, y: 40 },
          data: {
            label: 'Second Brain OS',
            noteId: 'page-second-brain',
            tone: 'teal',
            summary: 'Unified local-first thinking system',
          },
        },
        {
          id: 'node-notes',
          type: 'brainNode',
          position: { x: -360, y: -120 },
          data: {
            label: 'Block Notes',
            noteId: 'page-second-brain',
            tone: 'amber',
            summary: 'Pages, databases, backlinks, templates',
          },
        },
        {
          id: 'node-maps',
          type: 'brainNode',
          position: { x: 360, y: -120 },
          data: {
            label: 'Visual Maps',
            noteId: 'page-map-engine',
            tone: 'sky',
            summary: 'Mind maps, flowcharts, graphs',
          },
        },
        {
          id: 'node-ai',
          type: 'brainNode',
          position: { x: 360, y: 250 },
          data: {
            label: 'AI Memory',
            noteId: 'page-ai-memory',
            tone: 'violet',
            summary: 'Ask notes, generate maps, plan work',
          },
        },
        {
          id: 'node-productivity',
          type: 'brainNode',
          position: { x: -360, y: 250 },
          data: {
            label: 'Execution',
            tone: 'rose',
            summary: 'Tasks, goals, habits, focus',
          },
        },
        {
          id: 'node-media',
          type: 'brainNode',
          position: { x: 0, y: 430 },
          data: {
            label: 'Media Vault',
            tone: 'lime',
            summary: 'PDFs, images, audio, web clips',
          },
        },
      ],
      edges: [
        { id: 'edge-core-notes', source: 'node-core', target: 'node-notes', type: 'smoothstep', label: 'structures' },
        { id: 'edge-core-maps', source: 'node-core', target: 'node-maps', type: 'smoothstep', label: 'visualizes' },
        { id: 'edge-core-ai', source: 'node-core', target: 'node-ai', type: 'smoothstep', label: 'augments', animated: true },
        { id: 'edge-core-productivity', source: 'node-core', target: 'node-productivity', type: 'smoothstep', label: 'executes' },
        { id: 'edge-ai-media', source: 'node-ai', target: 'node-media', type: 'smoothstep', label: 'indexes' },
      ],
    },
  ],
  relationships: [
    {
      id: 'rel-vision-map',
      sourceId: 'page-second-brain',
      targetId: 'page-map-engine',
      type: 'reference',
      strength: 0.9,
      createdAt: now,
    },
    {
      id: 'rel-vision-ai',
      sourceId: 'page-second-brain',
      targetId: 'page-ai-memory',
      type: 'reference',
      strength: 0.88,
      createdAt: now,
    },
  ],
  attachments: [
    {
      id: 'asset-whitepaper',
      name: 'Second Brain Research Notes.pdf',
      kind: 'pdf',
      mimeType: 'application/pdf',
      localPath: 'assets/second-brain-research.pdf',
      linkedEntityIds: ['page-second-brain'],
      createdAt: now,
    },
  ],
  tasks: [
    {
      id: 'task-schema',
      title: 'Finalize the vault schema and migration runner',
      status: 'active',
      priority: 'high',
      dueDate: '2026-05-08',
      linkedPageIds: ['page-second-brain'],
    },
    {
      id: 'task-editor',
      title: 'Add slash commands and block transforms',
      status: 'backlog',
      priority: 'medium',
      dueDate: '2026-05-17',
      linkedPageIds: ['page-second-brain'],
    },
    {
      id: 'task-rag',
      title: 'Prototype local embeddings and ask-my-notes retrieval',
      status: 'blocked',
      priority: 'high',
      linkedPageIds: ['page-ai-memory'],
    },
  ],
  goals: [
    {
      id: 'goal-mvp',
      title: 'Ship the private alpha vault',
      progress: 42,
      linkedTaskIds: ['task-schema', 'task-editor', 'task-rag'],
    },
    {
      id: 'goal-quality',
      title: 'Reach production-grade reliability baseline',
      progress: 28,
      linkedTaskIds: ['task-schema'],
    },
  ],
  habits: [
    {
      id: 'habit-daily-note',
      title: 'Daily note review',
      streak: 12,
      cadence: 'daily',
    },
    {
      id: 'habit-link-notes',
      title: 'Link new notes',
      streak: 5,
      cadence: 'daily',
    },
  ],
  settings: {
    theme: 'system',
    aiProvider: 'local',
    defaultMapLayout: 'organic',
  },
};

