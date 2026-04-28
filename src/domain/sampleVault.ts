import type { BrainVault } from './types';

const now = new Date().toISOString();

export const sampleVault: BrainVault = {
  id: 'vault-mind-map',
  name: 'MindMap',
  version: '0.1.0',
  createdAt: now,
  updatedAt: now,
  pages: [
    {
      id: 'page-mind-map',
      title: 'Mind Map Vision',
      icon: 'Brain',
      tags: ['product', 'strategy', 'ai'],
      createdAt: now,
      updatedAt: now,
      links: ['page-map-engine'],
      metadata: { status: 'active', owner: 'Personal' },
      blocks: [
        { id: 'block-vision-heading', type: 'heading', content: 'AI Mind Mapping Knowledge System' },
        { id: 'block-vision-body', type: 'paragraph', content: 'A local-first workspace for mind maps, flowcharts, and AI-assisted visual thinking.' },
      ],
    },
    {
      id: 'page-map-engine',
      title: 'Mind Map Engine',
      icon: 'Network',
      tags: ['canvas', 'visual-thinking'],
      createdAt: now,
      updatedAt: now,
      links: ['page-mind-map'],
      metadata: { status: 'prototype' },
      blocks: [
        { id: 'block-map-heading', type: 'heading', content: 'Infinite Canvas Design' },
        { id: 'block-map-body', type: 'paragraph', content: 'Use a node graph core for mind maps and flowcharts with shared relationship semantics.' },
      ],
    },
  ],
  maps: [
    {
      id: 'map-product-os',
      title: 'Mind Map Blueprint',
      mode: 'mind-map',
      layout: 'organic',
      updatedAt: now,
      nodes: [
        {
          id: 'node-core',
          type: 'brainNode',
          position: { x: 0, y: 40 },
          data: { label: 'Mind Map', noteId: 'page-mind-map', tone: 'teal', summary: 'Unified local-first thinking system' },
        },
        {
          id: 'node-notes',
          type: 'brainNode',
          position: { x: -360, y: -120 },
          data: { label: 'Block Notes', noteId: 'page-mind-map', tone: 'amber', summary: 'Pages, databases, backlinks, templates' },
        },
        {
          id: 'node-maps',
          type: 'brainNode',
          position: { x: 360, y: -120 },
          data: { label: 'Visual Maps', noteId: 'page-map-engine', tone: 'sky', summary: 'Mind maps, flowcharts, graphs' },
        },
        {
          id: 'node-ai',
          type: 'brainNode',
          position: { x: 360, y: 250 },
          data: { label: 'AI Memory', tone: 'violet', summary: 'Ask notes, generate maps, plan work' },
        },
        {
          id: 'node-productivity',
          type: 'brainNode',
          position: { x: -360, y: 250 },
          data: { label: 'Execution', tone: 'rose', summary: 'Tasks, goals, habits, focus' },
        },
      ],
      edges: [
        { id: 'edge-core-notes', source: 'node-core', target: 'node-notes', type: 'smoothstep', label: 'structures' },
        { id: 'edge-core-maps', source: 'node-core', target: 'node-maps', type: 'smoothstep', label: 'visualizes' },
        { id: 'edge-core-ai', source: 'node-core', target: 'node-ai', type: 'smoothstep', label: 'augments', animated: true },
        { id: 'edge-core-productivity', source: 'node-core', target: 'node-productivity', type: 'smoothstep', label: 'executes' },
      ],
    },
  ],
  relationships: [
    { id: 'rel-vision-map', sourceId: 'page-mind-map', targetId: 'page-map-engine', type: 'reference', strength: 0.9, createdAt: now },
  ],
  attachments: [],
  tasks: [],
  settings: {
    theme: 'system',
    aiProvider: 'none',
    defaultMapLayout: 'organic',
    edgeStyle: 'curved',
  },
};
