import { create } from 'zustand';
import type {
  AgentResult,
  BrainVault,
  ChatSettings,
  KnowledgePage,
  MapDocument,
  MindMapEdge,
  MindMapNode,
  MindNodeData,
  Relationship,
  TaskItem,
  WorkspaceView,
} from '../domain/types';
import { defaultChatSettings } from '../domain/chat';
import { sampleVault } from '../domain/sampleVault';

interface BrainState {
  activeView: WorkspaceView;
  vault: BrainVault;
  chatSettings: ChatSettings;
  vaultPath?: string;
  vaultLoadVersion: number;
  selectedPageId: string;
  isCommandPaletteOpen: boolean;
  isSettingsOpen: boolean;
  setActiveView: (view: WorkspaceView) => void;
  setVault: (vault: BrainVault, path?: string) => void;
  setChatSettings: (settings: Partial<ChatSettings>) => void;
  setSelectedPage: (pageId: string) => void;
  createPage: (title?: string, content?: string, tags?: string[]) => string;
  createTask: (title: string, priority?: TaskItem['priority']) => string;
  addMindNode: (label?: string, summary?: string, position?: { x: number; y: number }) => string;
  expandActiveMap: (title: string, ideas?: Array<{ label: string; summary?: string; tone?: MindMapNode['data']['tone'] }>) => void;
  updateMapNodes: (mapId: string, nodes: MindMapNode[]) => void;
  updateMapEdges: (mapId: string, edges: MindMapEdge[]) => void;
  applyAgentResult: (result: AgentResult) => AgentResult;
  updateSelectedPageContent: (html: string) => void;
  updateSettings: (settings: Partial<BrainVault['settings']>) => void;
  updateChatSettings: (settings: Partial<ChatSettings>) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  openSettings: () => void;
  closeSettings: () => void;
}

function htmlToText(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function createFallbackPage(): KnowledgePage {
  const now = new Date().toISOString();

  return {
    id: 'page-mind-map-home',
    title: 'Mind Map Home',
    icon: 'M',
    tags: ['welcome'],
    createdAt: now,
    updatedAt: now,
    links: [],
    metadata: {
      status: 'active',
    },
    blocks: [
      {
        id: createId('block'),
        type: 'heading',
        content: 'Mind Map Home',
      },
      {
        id: createId('block'),
        type: 'paragraph',
        content: 'Start with a note, then branch ideas out on the map.',
      },
    ],
  };
}

function createRootMapNode(noteId?: string): MindMapNode {
  return {
    id: createId('node'),
    type: 'brainNode',
    selected: false,
    position: { x: 0, y: 0 },
    data: {
      label: 'Mind Map',
      noteId,
      tone: 'teal',
      summary: 'Start mapping your ideas here.',
    },
  };
}

function createStarterMap(noteId?: string): MapDocument {
  return {
    id: createId('map'),
    title: 'Main Map',
    mode: 'mind-map',
    layout: 'organic',
    updatedAt: new Date().toISOString(),
    nodes: [createRootMapNode(noteId)],
    edges: [],
  };
}

function normalizePosition(position: MindMapNode['position'] | undefined, index: number) {
  const fallback = {
    x: (index % 3) * 220,
    y: Math.floor(index / 3) * 150,
  };

  if (!position) {
    return fallback;
  }

  const x = Number.isFinite(position.x) ? Math.max(-4000, Math.min(4000, position.x)) : fallback.x;
  const y = Number.isFinite(position.y) ? Math.max(-4000, Math.min(4000, position.y)) : fallback.y;

  return { x, y };
}

function normalizeMap(map: MapDocument | undefined, fallbackPageId?: string): MapDocument {
  if (!map) {
    return createStarterMap(fallbackPageId);
  }

  const nodes = Array.isArray(map.nodes) ? map.nodes : [];
  const normalizedNodes: MindMapNode[] = nodes.map((node, index) => ({
    id: node.id || createId('node'),
    type: node.type || 'brainNode',
    selected: Boolean(node.selected),
    position: normalizePosition(node.position, index),
    data: {
      label: typeof node.data?.label === 'string' && node.data.label.trim() ? node.data.label : `Idea ${index + 1}`,
      noteId: typeof node.data?.noteId === 'string' ? node.data.noteId : undefined,
      tone: ['teal', 'amber', 'rose', 'violet', 'lime', 'sky'].includes(String(node.data?.tone))
        ? (node.data?.tone as MindNodeData['tone'])
        : 'teal',
      summary: typeof node.data?.summary === 'string' ? node.data.summary : undefined,
      collapsed: Boolean(node.data?.collapsed),
    },
  }));

  const ensuredNodes = normalizedNodes.length > 0 ? normalizedNodes : [createRootMapNode(fallbackPageId)];
  const nodeIds = new Set(ensuredNodes.map((node) => node.id));
  const edges = Array.isArray(map.edges) ? map.edges : [];
  const normalizedEdges = edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({
      id: edge.id || createId('edge'),
      source: edge.source,
      target: edge.target,
      label: typeof edge.label === 'string' ? edge.label : undefined,
      type: edge.type || 'smoothstep',
      animated: Boolean(edge.animated),
    }));

  return {
    ...map,
    mode: map.mode || 'mind-map',
    layout: map.layout || 'organic',
    updatedAt: map.updatedAt || new Date().toISOString(),
    nodes: ensuredNodes,
    edges: normalizedEdges,
  };
}

function normalizeVault(vault: BrainVault): BrainVault {
  const pages = Array.isArray(vault.pages) && vault.pages.length > 0 ? vault.pages : [createFallbackPage()];
  const primaryPageId = pages[0]?.id;
  const maps = Array.isArray(vault.maps) && vault.maps.length > 0 ? vault.maps.map((map) => normalizeMap(map, primaryPageId)) : [createStarterMap(primaryPageId)];

  return {
    ...sampleVault,
    ...vault,
    pages,
    maps,
    relationships: Array.isArray(vault.relationships) ? vault.relationships : [],
    attachments: Array.isArray(vault.attachments) ? vault.attachments : [],
    tasks: Array.isArray(vault.tasks) ? vault.tasks : [],
    goals: Array.isArray(vault.goals) ? vault.goals : [],
    habits: Array.isArray(vault.habits) ? vault.habits : [],
    settings: {
      ...sampleVault.settings,
      ...vault.settings,
    },
  };
}

function touchVault(vault: BrainVault): BrainVault {
  return {
    ...vault,
    updatedAt: new Date().toISOString(),
  };
}

function updateFirstMap(vault: BrainVault, updater: (map: MapDocument) => MapDocument) {
  const firstMap = vault.maps[0];
  if (!firstMap) {
    return vault;
  }

  return touchVault({
    ...vault,
    maps: [updater(firstMap), ...vault.maps.slice(1)],
  });
}

export const useBrainStore = create<BrainState>((set, get) => ({
  activeView: 'map',
  vault: sampleVault,
  chatSettings: defaultChatSettings,
  vaultLoadVersion: 0,
  selectedPageId: sampleVault.pages[0]?.id ?? '',
  isCommandPaletteOpen: false,
  isSettingsOpen: false,
  setActiveView: (activeView) => set({ activeView }),
  setVault: (vault, vaultPath) => {
    const normalizedVault = normalizeVault(vault);
    set((state) => ({
      vault: normalizedVault,
      vaultPath,
      vaultLoadVersion: state.vaultLoadVersion + 1,
      selectedPageId: normalizedVault.pages[0]?.id ?? '',
    }));
  },
  setChatSettings: (settings) =>
    set((state) => ({
      chatSettings: {
        ...state.chatSettings,
        ...settings,
      },
    })),
  setSelectedPage: (selectedPageId) => set({ selectedPageId, activeView: 'notes' }),
  createPage: (title = 'Untitled', content = 'Start writing here.', tags = []) => {
    const { vault } = get();
    const now = new Date().toISOString();
    const id = createId('page');
    const page: KnowledgePage = {
      id,
      title,
      icon: title.slice(0, 1).toUpperCase() || 'N',
      tags,
      createdAt: now,
      updatedAt: now,
      links: [],
      metadata: {
        status: 'draft',
      },
      blocks: [
        {
          id: createId('block'),
          type: 'heading',
          content: title,
        },
        {
          id: createId('block'),
          type: 'paragraph',
          content,
        },
      ],
    };

    set({
      vault: touchVault({
        ...vault,
        pages: [page, ...vault.pages],
      }),
      selectedPageId: id,
      activeView: 'notes',
    });

    return id;
  },
  createTask: (title, priority = 'medium') => {
    const { vault, selectedPageId } = get();
    const task: TaskItem = {
      id: createId('task'),
      title,
      status: 'active',
      priority,
      linkedPageIds: selectedPageId ? [selectedPageId] : [],
    };

    set({
      vault: touchVault({
        ...vault,
        tasks: [task, ...vault.tasks],
      }),
      activeView: 'tasks',
    });

    return task.id;
  },
  addMindNode: (label = 'New idea', summary = 'Double-click linked nodes to open notes', position) => {
    const { vault } = get();
    const map = normalizeMap(vault.maps[0], vault.pages[0]?.id);
    const id = createId('node');

    if (!map) {
      return id;
    }

    const root = map.nodes[0];
    const fallbackOffset = Math.max(map.nodes.length - 1, 0);
    const node: MindMapNode = {
      id,
      type: 'brainNode',
      selected: true,
      position:
        position ?? {
          x: (root?.position.x ?? 0) + 260,
          y: (root?.position.y ?? 0) - 140 + fallbackOffset * 70,
        },
      data: {
        label,
        summary,
        tone: 'teal',
      },
    };

    const newEdge =
      root && root.id !== id
        ? {
            id: createId('edge'),
            source: root.id,
            target: id,
            type: 'smoothstep',
          }
        : undefined;

    set({
      vault: updateFirstMap(vault, (currentMap) => {
        const safeMap = normalizeMap(currentMap, vault.pages[0]?.id);

        return {
          ...safeMap,
          nodes: [...safeMap.nodes.map((existingNode) => ({ ...existingNode, selected: false })), node],
          edges: newEdge ? [...safeMap.edges, newEdge] : safeMap.edges,
          updatedAt: new Date().toISOString(),
        };
      }),
      activeView: 'map',
    });

    return id;
  },
  expandActiveMap: (title, ideas) => {
    const { vault } = get();
    const map = normalizeMap(vault.maps[0], vault.pages[0]?.id);

    const root = map.nodes[0];
    const sourceId = root?.id ?? map.nodes[0]?.id;
    const baseX = root?.position.x ?? 0;
    const baseY = root?.position.y ?? 0;
    const branches =
      ideas && ideas.length > 0
        ? ideas
        : [
            { label: 'Context', summary: `Understand ${title}`, tone: 'sky' as const },
            { label: 'Options', summary: `Explore choices for ${title}`, tone: 'amber' as const },
            { label: 'Actions', summary: `Move ${title} forward`, tone: 'rose' as const },
          ];

    const newNodes: MindMapNode[] = branches.map((branch, index) => {
      const angle = (Math.PI * 2 * index) / branches.length;
      return {
        id: createId('node'),
        type: 'brainNode',
        position: {
          x: baseX + Math.cos(angle) * 320,
          y: baseY + Math.sin(angle) * 210,
        },
        data: {
          label: branch.label,
          summary: branch.summary ?? `AI branch for ${title}`,
          tone: branch.tone ?? 'teal',
        },
      };
    });

    const newEdges: MindMapEdge[] =
      sourceId === undefined
        ? []
        : newNodes.map((node) => ({
            id: createId('edge'),
            source: sourceId,
            target: node.id,
            type: 'smoothstep',
            label: 'AI',
            animated: true,
          }));

    set({
      vault: updateFirstMap(vault, (currentMap) => {
        const safeMap = normalizeMap(currentMap, vault.pages[0]?.id);

        return {
          ...safeMap,
          nodes: [...safeMap.nodes, ...newNodes],
          edges: [...safeMap.edges, ...newEdges],
          updatedAt: new Date().toISOString(),
        };
      }),
      activeView: 'map',
    });
  },
  updateMapNodes: (mapId, nodes) => {
    const { vault } = get();
    const safeNodes = nodes.length > 0 ? nodes : [createRootMapNode(vault.pages[0]?.id)];
    const safeNodeIds = new Set(safeNodes.map((node) => node.id));
    set({
      vault: touchVault({
        ...vault,
        maps: vault.maps.map((map) =>
          map.id === mapId
            ? {
                ...map,
                nodes: safeNodes,
                edges: map.edges.filter((edge) => safeNodeIds.has(edge.source) && safeNodeIds.has(edge.target)),
                updatedAt: new Date().toISOString(),
              }
            : map,
        ),
      }),
    });
  },
  updateMapEdges: (mapId, edges) => {
    const { vault } = get();
    set({
      vault: touchVault({
        ...vault,
        maps: vault.maps.map((map) =>
          map.id === mapId
            ? {
                ...map,
                edges,
                updatedAt: new Date().toISOString(),
              }
            : map,
        ),
      }),
    });
  },
  applyAgentResult: (result) => {
    const { vault, selectedPageId } = get();
    let nextVault = vault;
    let nextView: WorkspaceView = 'map';
    let nextSelectedPageId = selectedPageId;

    for (const action of result.actions) {
      if (action.type === 'create-note') {
        const now = new Date().toISOString();
        const id = createId('page');
        const title = action.payload?.title ?? 'AI Note';
        const page: KnowledgePage = {
          id,
          title,
          icon: title.slice(0, 1).toUpperCase() || 'A',
          tags: action.payload?.tags ?? ['ai-generated'],
          createdAt: now,
          updatedAt: now,
          links: [],
          metadata: {
            source: 'agent',
          },
          blocks: [
            {
              id: createId('block'),
              type: 'heading',
              content: title,
            },
            {
              id: createId('block'),
              type: 'paragraph',
              content: action.payload?.content ?? result.body,
            },
          ],
        };
        nextVault = touchVault({ ...nextVault, pages: [page, ...nextVault.pages] });
        nextSelectedPageId = id;
        nextView = 'notes';
      }

      if (action.type === 'create-task' && action.payload?.task) {
        const task: TaskItem = {
          id: createId('task'),
          title: action.payload.task.title,
          status: 'active',
          priority: action.payload.task.priority ?? 'medium',
          dueDate: action.payload.task.dueDate,
          linkedPageIds: nextSelectedPageId ? [nextSelectedPageId] : [],
        };
        nextVault = touchVault({ ...nextVault, tasks: [task, ...nextVault.tasks] });
        nextView = 'tasks';
      }

      if (action.type === 'link-notes' && action.payload?.sourceId && action.payload.targetId) {
        const relationship: Relationship = {
          id: createId('rel'),
          sourceId: action.payload.sourceId,
          targetId: action.payload.targetId,
          type: 'reference',
          strength: 0.72,
          createdAt: new Date().toISOString(),
        };
        nextVault = touchVault({ ...nextVault, relationships: [relationship, ...nextVault.relationships] });
        nextView = 'graph';
      }

      if (action.type === 'create-map-nodes') {
        const map = normalizeMap(nextVault.maps[0], nextVault.pages[0]?.id);

        const root = map.nodes[0];
        const branches = action.payload?.nodes ?? [];
        const newNodes = branches.map((branch, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(branches.length, 1);
          return {
            id: createId('node'),
            type: 'brainNode',
            position: {
              x: (root?.position.x ?? 0) + Math.cos(angle) * 330,
              y: (root?.position.y ?? 0) + Math.sin(angle) * 230,
            },
            data: {
              label: branch.label,
              summary: branch.summary ?? `AI branch for ${action.payload?.title ?? 'idea'}`,
              tone: branch.tone ?? 'teal',
            },
          } satisfies MindMapNode;
        });

        const newEdges = root
          ? newNodes.map((node) => ({
              id: createId('edge'),
              source: root.id,
              target: node.id,
              type: 'smoothstep',
              label: 'AI',
              animated: true,
            }))
          : [];

        nextVault = updateFirstMap(nextVault, (currentMap) => {
          const safeMap = normalizeMap(currentMap, nextVault.pages[0]?.id);

          return {
            ...safeMap,
            nodes: [...safeMap.nodes, ...newNodes],
            edges: [...safeMap.edges, ...newEdges],
            updatedAt: new Date().toISOString(),
          };
        });
        nextView = 'map';
      }
    }

    const appliedResult: AgentResult = {
      ...result,
      applied: true,
    };

    set({
      vault: nextVault,
      activeView: nextView,
      selectedPageId: nextSelectedPageId,
    });

    return appliedResult;
  },
  updateSelectedPageContent: (html) => {
    const { vault, selectedPageId } = get();
    const pages: KnowledgePage[] = vault.pages.map((page) => {
      if (page.id !== selectedPageId) {
        return page;
      }

      const heading = page.blocks.find((block) => block.type === 'heading');
      return {
        ...page,
        updatedAt: new Date().toISOString(),
        blocks: [
          heading ?? {
            id: `${page.id}-heading`,
            type: 'heading',
            content: page.title,
          },
          {
            id: `${page.id}-body`,
            type: 'paragraph',
            content: htmlToText(html),
          },
        ],
      };
    });

    set({
      vault: {
        ...vault,
        updatedAt: new Date().toISOString(),
        pages,
      },
    });
  },
  updateSettings: (settings) => {
    const { vault } = get();
    set({
      vault: touchVault({
        ...vault,
        settings: {
          ...vault.settings,
          ...settings,
        },
      }),
    });
  },
  updateChatSettings: (settings) =>
    set((state) => ({
      chatSettings: {
        ...state.chatSettings,
        ...settings,
      },
    })),
  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
  toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
}));
