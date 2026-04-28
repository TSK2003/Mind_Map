import { create } from 'zustand';
import type {
  AgentResult,
  BrainVault,
  ChatSettings,
  DiagramMode,
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

interface BrainState {
  activeView: WorkspaceView;
  vault: BrainVault;
  chatSettings: ChatSettings;
  vaultPath?: string;
  vaultLoadVersion: number;
  selectedPageId: string;
  selectedMapNodeId?: string;
  isCommandPaletteOpen: boolean;
  isSettingsOpen: boolean;
  setActiveView: (view: WorkspaceView) => void;
  setVault: (vault: BrainVault, path?: string) => void;
  setChatSettings: (settings: Partial<ChatSettings>) => void;
  setSelectedMapNode: (nodeId?: string) => void;
  addMindNode: (
    label?: string,
    summary?: string,
    position?: { x: number; y: number },
    mode?: 'child' | 'sibling',
  ) => string;
  expandActiveMap: (title: string, ideas?: Array<{ label: string; summary?: string; tone?: MindMapNode['data']['tone'] }>) => void;
  updateMindNode: (nodeId: string, patch: Partial<MindNodeData>) => void;
  deleteMindNode: (nodeId: string) => void;
  clearMindMap: () => void;
  updateMapNodes: (mapId: string, nodes: MindMapNode[]) => void;
  updateMapEdges: (mapId: string, edges: MindMapEdge[]) => void;
  updateDiagramNodes: (mode: 'flowchart', nodes: MindMapNode[]) => void;
  updateDiagramEdges: (mode: 'flowchart', edges: MindMapEdge[]) => void;
  clearDiagram: (mode: 'flowchart') => void;
  applyAgentResult: (result: AgentResult) => AgentResult;
  updateSettings: (settings: Partial<BrainVault['settings']>) => void;
  updateChatSettings: (settings: Partial<ChatSettings>) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  openSettings: () => void;
  closeSettings: () => void;
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

function getDiagramModeForView(view: WorkspaceView): Extract<DiagramMode, 'mind-map' | 'flowchart'> | null {
  if (view === 'map') {
    return 'mind-map';
  }

  if (view === 'flowchart') {
    return 'flowchart';
  }

  return null;
}

function createRootNodeForMode(mode: Extract<DiagramMode, 'mind-map' | 'flowchart'>, noteId?: string): MindMapNode {
  if (mode === 'flowchart') {
    return {
      id: createId('node'),
      type: 'brainNode',
      selected: false,
      position: { x: 0, y: 0 },
      data: {
        label: 'Start',
        noteId,
        tone: 'sky',
        summary: 'Begin the workflow here.',
        shape: 'start-end',
      },
    };
  }

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

function createStarterMap(
  noteId?: string,
  mode: Extract<DiagramMode, 'mind-map' | 'flowchart'> = 'mind-map',
): MapDocument {
  const rootNode = createRootNodeForMode(mode, noteId);

  return {
    id: createId('map'),
    title: mode === 'flowchart' ? 'Flowchart' : 'Main Map',
    mode,
    layout: mode === 'flowchart' ? 'sequence' : 'organic',
    updatedAt: new Date().toISOString(),
    nodes: [rootNode],
    edges: [],
  };
}

function createStarterVault(name = 'MindMap'): BrainVault {
  const now = new Date().toISOString();
  const homePage = createFallbackPage();

  return {
    id: createId('vault'),
    name,
    version: '0.1.0',
    createdAt: now,
    updatedAt: now,
    pages: [homePage],
    maps: [createStarterMap(homePage.id)],
    relationships: [],
    attachments: [],
    tasks: [],
    settings: {
      theme: 'system',
      aiProvider: 'none',
      defaultMapLayout: 'organic',
      edgeStyle: 'curved',
    },
  };
}

function findMapByMode(vault: BrainVault, mode: Extract<DiagramMode, 'mind-map' | 'flowchart' | 'stick-diagram'>) {
  return vault.maps.find((map) => map.mode === mode);
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

  const normalizedMode =
    map.mode === 'flowchart' || map.mode === 'mind-map'
      ? map.mode
      : 'mind-map';

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
      attachment: node.data?.attachment && typeof node.data.attachment === 'object'
        ? node.data.attachment as MindNodeData['attachment']
        : undefined,
      shape: typeof node.data?.shape === 'string' ? node.data.shape as MindNodeData['shape'] : undefined,
    },
  }));

  const ensuredNodes = normalizedNodes.length > 0 ? normalizedNodes : [createRootNodeForMode(normalizedMode, fallbackPageId)];
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
    mode: normalizedMode,
    layout:
      (normalizedMode === 'flowchart' ? 'sequence' : 'organic'),
    updatedAt: map.updatedAt || new Date().toISOString(),
    nodes: ensuredNodes,
    edges: normalizedEdges,
  };
}

function ensureMapDocument(
  vault: BrainVault,
  mode: Extract<DiagramMode, 'mind-map' | 'flowchart'>,
  fallbackPageId?: string,
) {
  const existingMap = findMapByMode(vault, mode);
  if (existingMap) {
    return {
      vault,
      map: normalizeMap(existingMap, fallbackPageId),
    };
  }

  const nextMap = createStarterMap(fallbackPageId, mode);

  return {
    vault: touchVault({
      ...vault,
      maps: [...vault.maps, nextMap],
    }),
    map: nextMap,
  };
}

function normalizeVault(vault: BrainVault): BrainVault {
  const fallbackVault = createStarterVault(typeof vault.name === 'string' && vault.name.trim() ? vault.name : 'MindMap');
  const pages = Array.isArray(vault.pages) && vault.pages.length > 0 ? vault.pages : [createFallbackPage()];
  const primaryPageId = pages[0]?.id;
  const maps = Array.isArray(vault.maps) && vault.maps.length > 0 ? vault.maps.map((map) => normalizeMap(map, primaryPageId)) : [createStarterMap(primaryPageId)];

  return {
    ...fallbackVault,
    ...vault,
    pages,
    maps,
    relationships: Array.isArray(vault.relationships) ? vault.relationships : [],
    attachments: Array.isArray(vault.attachments) ? vault.attachments : [],
    tasks: Array.isArray(vault.tasks) ? vault.tasks : [],
    settings: {
      ...fallbackVault.settings,
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

function updateMapByMode(
  vault: BrainVault,
  mode: Extract<DiagramMode, 'mind-map' | 'flowchart'>,
  updater: (map: MapDocument) => MapDocument,
  fallbackPageId?: string,
) {
  const ensured = ensureMapDocument(vault, mode, fallbackPageId);
  const nextMap = updater(ensured.map);

  return touchVault({
    ...ensured.vault,
    maps: ensured.vault.maps.map((map) => (map.id === ensured.map.id ? nextMap : map)),
  });
}

function buildSequentialDiagramEdges(nodeCount: number) {
  return Array.from({ length: Math.max(nodeCount - 1, 0) }, (_value, index): { sourceIndex: number; targetIndex: number; label?: string } => ({
    sourceIndex: index,
    targetIndex: index + 1,
  }));
}

function normalizeGeneratedEdges(
  nodeCount: number,
  edges: Array<{ sourceIndex: number; targetIndex: number; label?: string }> | undefined,
) {
  const candidates = edges && edges.length > 0 ? edges : buildSequentialDiagramEdges(nodeCount);

  return candidates.filter((edge) =>
    Number.isInteger(edge.sourceIndex) &&
    Number.isInteger(edge.targetIndex) &&
    edge.sourceIndex >= 0 &&
    edge.targetIndex >= 0 &&
    edge.sourceIndex < nodeCount &&
    edge.targetIndex < nodeCount &&
    edge.sourceIndex !== edge.targetIndex,
  );
}

function layoutGeneratedDiagram(
  mode: 'flowchart',
  title: string,
  nodes: Array<{ label: string; summary?: string; tone?: MindNodeData['tone']; shape?: MindNodeData['shape'] }>,
  edges: Array<{ sourceIndex: number; targetIndex: number; label?: string }> | undefined,
  fallbackPageId?: string,
): { title: string; layout: MapDocument['layout']; nodes: MindMapNode[]; edges: MindMapEdge[] } {
  if (nodes.length === 0) {
    return {
      title,
      layout: 'sequence',
      nodes: [createRootNodeForMode(mode, fallbackPageId)],
      edges: [] as MindMapEdge[],
    };
  }

  const normalizedEdges = normalizeGeneratedEdges(nodes.length, edges);
  const outgoing = new Map<number, number[]>();
  const indegree = new Array<number>(nodes.length).fill(0);

  normalizedEdges.forEach((edge) => {
    const list = outgoing.get(edge.sourceIndex) ?? [];
    list.push(edge.targetIndex);
    outgoing.set(edge.sourceIndex, list);
    indegree[edge.targetIndex] += 1;
  });

  const depth = new Array<number>(nodes.length).fill(-1);
  const queue: number[] = [];
  const roots = indegree
    .map((value, index) => ({ value, index }))
    .filter((item) => item.value === 0)
    .map((item) => item.index);

  (roots.length > 0 ? roots : [0]).forEach((rootIndex) => {
    if (depth[rootIndex] === -1) {
      depth[rootIndex] = 0;
      queue.push(rootIndex);
    }
  });

  while (queue.length > 0) {
    const currentIndex = queue.shift();
    if (currentIndex === undefined) {
      continue;
    }

    (outgoing.get(currentIndex) ?? []).forEach((targetIndex) => {
      const nextDepth = depth[currentIndex] + 1;
      if (depth[targetIndex] < nextDepth) {
        depth[targetIndex] = nextDepth;
        queue.push(targetIndex);
      }
    });
  }

  depth.forEach((value, index) => {
    if (value === -1) {
      depth[index] = 0;
    }
  });

  const nodesByDepth = new Map<number, number[]>();
  depth.forEach((value, index) => {
    const list = nodesByDepth.get(value) ?? [];
    list.push(index);
    nodesByDepth.set(value, list);
  });

  const createdNodes = nodes.map((node, index) => {
    const currentDepth = depth[index] ?? 0;
    const peers = nodesByDepth.get(currentDepth) ?? [index];
    const order = peers.indexOf(index);
    const centeredOffset = order - (peers.length - 1) / 2;

    return {
      id: createId('node'),
      type: 'brainNode',
      position: {
        x: centeredOffset * 260,
        y: currentDepth * 150,
      },
      data: {
        label: node.label,
        summary: node.summary,
        tone: node.tone ?? 'sky',
        shape: node.shape ?? (index === 0 || index === nodes.length - 1 ? 'start-end' : 'rect'),
      },
    } satisfies MindMapNode;
  });

  const createdEdges = normalizedEdges.reduce<MindMapEdge[]>((collection, edge) => {
      const source = createdNodes[edge.sourceIndex];
      const target = createdNodes[edge.targetIndex];
      if (!source || !target) {
        return collection;
      }

      collection.push({
        id: createId('edge'),
        source: source.id,
        target: target.id,
        type: 'smoothstep',
        label: edge.label,
      });

      return collection;
    }, []);

  return {
    title,
    layout: 'sequence' as const,
    nodes: createdNodes,
    edges: createdEdges,
  };
}

const initialVault = createStarterVault();

export const useBrainStore = create<BrainState>((set, get) => ({
  activeView: 'map',
  vault: initialVault,
  chatSettings: defaultChatSettings,
  vaultLoadVersion: 0,
  selectedPageId: initialVault.pages[0]?.id ?? '',
  selectedMapNodeId: initialVault.maps[0]?.nodes[0]?.id,
  isCommandPaletteOpen: false,
  isSettingsOpen: false,
  setActiveView: (activeView) =>
    set((state) => {
      const mode = getDiagramModeForView(activeView);
      if (!mode) {
        return { activeView };
      }

      const ensured = ensureMapDocument(state.vault, mode, state.vault.pages[0]?.id);
      const selectedMapNodeId =
        ensured.map.nodes.find((node) => node.id === state.selectedMapNodeId)?.id ??
        ensured.map.nodes[0]?.id;

      return {
        activeView,
        vault: ensured.vault,
        selectedMapNodeId,
      };
    }),
  setVault: (vault, vaultPath) => {
    const normalizedVault = normalizeVault(vault);
    set((state) => ({
      vault: normalizedVault,
      vaultPath,
      vaultLoadVersion: state.vaultLoadVersion + 1,
      selectedPageId:
        normalizedVault.pages.some((page) => page.id === state.selectedPageId)
          ? state.selectedPageId
          : normalizedVault.pages[0]?.id ?? '',
      selectedMapNodeId:
        (findMapByMode(normalizedVault, getDiagramModeForView(state.activeView) ?? 'mind-map')?.nodes ?? normalizedVault.maps[0]?.nodes ?? [])
          .some((node) => node.id === state.selectedMapNodeId)
          ? state.selectedMapNodeId
          : (findMapByMode(normalizedVault, getDiagramModeForView(state.activeView) ?? 'mind-map')?.nodes[0]?.id ??
            normalizedVault.maps[0]?.nodes[0]?.id),
    }));
  },
  setChatSettings: (settings) =>
    set((state) => ({
      chatSettings: {
        ...state.chatSettings,
        ...settings,
      },
    })),
  setSelectedMapNode: (selectedMapNodeId) => set({ selectedMapNodeId }),
  addMindNode: (label = 'New idea', summary = 'Double-click linked nodes to open notes', position, mode = 'child') => {
    const { vault, selectedMapNodeId } = get();
    const map = normalizeMap(findMapByMode(vault, 'mind-map'), vault.pages[0]?.id);
    const id = createId('node');

    if (!map) {
      return id;
    }

    const anchorNode = map.nodes.find((node) => node.id === selectedMapNodeId) ?? map.nodes[0];
    const incomingEdge =
      mode === 'sibling' && anchorNode
        ? map.edges.find((edge) => edge.target === anchorNode.id)
        : undefined;
    const parentNode =
      mode === 'sibling'
        ? map.nodes.find((node) => node.id === incomingEdge?.source)
        : anchorNode;
    const siblingCount = parentNode
      ? map.edges.filter((edge) => edge.source === parentNode.id).length
      : map.nodes.filter((node) => !map.edges.some((edge) => edge.target === node.id)).length;
    const node: MindMapNode = {
      id,
      type: 'brainNode',
      selected: true,
      position:
        position ?? {
          x:
            mode === 'sibling'
              ? (anchorNode?.position.x ?? 0) + (parentNode ? 0 : 260)
              : (parentNode?.position.x ?? 0) + 250,
          y:
            mode === 'sibling'
              ? (anchorNode?.position.y ?? 0) + 140
              : (parentNode?.position.y ?? 0) - 60 + siblingCount * 90,
        },
      data: {
        label,
        summary,
        tone: 'teal',
      },
    };

    const newEdge =
      parentNode && parentNode.id !== id
        ? {
            id: createId('edge'),
            source: parentNode.id,
            target: id,
            type: 'smoothstep',
          }
        : undefined;

    set({
      vault: updateMapByMode(vault, 'mind-map', (currentMap) => {
        const safeMap = normalizeMap(currentMap, vault.pages[0]?.id);

        return {
          ...safeMap,
          nodes: [
            ...safeMap.nodes.map((existingNode) => ({
              ...existingNode,
              selected: false,
              data:
                parentNode &&
                existingNode.id === parentNode.id &&
                existingNode.data.collapsed
                  ? {
                      ...existingNode.data,
                      collapsed: false,
                    }
                  : existingNode.data,
            })),
            node,
          ],
          edges: newEdge ? [...safeMap.edges, newEdge] : safeMap.edges,
          updatedAt: new Date().toISOString(),
        };
      }, vault.pages[0]?.id),
      activeView: 'map',
      selectedMapNodeId: id,
    });

    return id;
  },
  expandActiveMap: (title, ideas) => {
    const { vault, selectedMapNodeId } = get();
    const map = normalizeMap(findMapByMode(vault, 'mind-map'), vault.pages[0]?.id);

    const focusNode = map.nodes.find((node) => node.id === selectedMapNodeId) ?? map.nodes[0];
    const sourceId = focusNode?.id ?? map.nodes[0]?.id;
    const baseX = focusNode?.position.x ?? 0;
    const baseY = focusNode?.position.y ?? 0;
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
      vault: updateMapByMode(vault, 'mind-map', (currentMap) => {
        const safeMap = normalizeMap(currentMap, vault.pages[0]?.id);

        return {
          ...safeMap,
          nodes: [...safeMap.nodes, ...newNodes],
          edges: [...safeMap.edges, ...newEdges],
          updatedAt: new Date().toISOString(),
        };
      }, vault.pages[0]?.id),
      activeView: 'map',
    });
  },
  updateMindNode: (nodeId, patch) => {
    const { vault } = get();
    set({
      vault: updateMapByMode(vault, 'mind-map', (currentMap) => {
        const safeMap = normalizeMap(currentMap, vault.pages[0]?.id);

        return {
          ...safeMap,
          nodes: safeMap.nodes.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    ...patch,
                  },
                }
              : node,
          ),
          updatedAt: new Date().toISOString(),
        };
      }, vault.pages[0]?.id),
    });
  },
  deleteMindNode: (nodeId) => {
    const { vault } = get();
    const map = normalizeMap(findMapByMode(vault, 'mind-map'), vault.pages[0]?.id);
    const rootNodeId = map.nodes[0]?.id;
    const parentNodeId = map.edges.find((edge) => edge.target === nodeId)?.source ?? rootNodeId;

    if (!nodeId || nodeId === rootNodeId) {
      return;
    }

    const outgoingBySource = new Map<string, string[]>();
    map.edges.forEach((edge) => {
      const list = outgoingBySource.get(edge.source) ?? [];
      list.push(edge.target);
      outgoingBySource.set(edge.source, list);
    });

    const nodeIdsToRemove = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const currentNodeId = queue.shift();
      if (!currentNodeId || nodeIdsToRemove.has(currentNodeId)) {
        continue;
      }

      nodeIdsToRemove.add(currentNodeId);
      (outgoingBySource.get(currentNodeId) ?? []).forEach((targetId) => {
        queue.push(targetId);
      });
    }

    set({
      vault: updateMapByMode(vault, 'mind-map', (currentMap) => {
        const safeMap = normalizeMap(currentMap, vault.pages[0]?.id);

        return {
          ...safeMap,
          nodes: safeMap.nodes.filter((node) => !nodeIdsToRemove.has(node.id)),
          edges: safeMap.edges.filter((edge) => !nodeIdsToRemove.has(edge.source) && !nodeIdsToRemove.has(edge.target)),
          updatedAt: new Date().toISOString(),
        };
      }, vault.pages[0]?.id),
      selectedMapNodeId: parentNodeId,
      activeView: 'map',
    });
  },
  clearMindMap: () => {
    const { vault } = get();
    const map = normalizeMap(findMapByMode(vault, 'mind-map'), vault.pages[0]?.id);
    const rootNodeId = map.nodes[0]?.id;

    set({
      vault: updateMapByMode(vault, 'mind-map', (currentMap) => {
        const safeMap = normalizeMap(currentMap, vault.pages[0]?.id);
        const existingRoot = safeMap.nodes[0];
        const rootNode = existingRoot
          ? {
              ...existingRoot,
              selected: true,
              position: { x: 0, y: 0 },
              data: {
                ...existingRoot.data,
                collapsed: false,
              },
            }
          : createRootNodeForMode('mind-map', vault.pages[0]?.id);

        return {
          ...safeMap,
          nodes: [rootNode],
          edges: [],
          updatedAt: new Date().toISOString(),
        };
      }, vault.pages[0]?.id),
      selectedMapNodeId: rootNodeId,
      activeView: 'map',
    });
  },
  updateMapNodes: (mapId, nodes) => {
    const { vault, selectedMapNodeId } = get();
    const map = vault.maps.find((entry) => entry.id === mapId);
    const safeNodes = nodes.length > 0 ? nodes : [createRootNodeForMode((map?.mode as Extract<DiagramMode, 'mind-map' | 'flowchart' | 'stick-diagram'>) ?? 'mind-map', vault.pages[0]?.id)];
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
      selectedMapNodeId: selectedMapNodeId && safeNodeIds.has(selectedMapNodeId) ? selectedMapNodeId : safeNodes[0]?.id,
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
  updateDiagramNodes: (mode, nodes) => {
    const { vault, selectedMapNodeId } = get();
    const safeNodes = nodes.length > 0 ? nodes : [createRootNodeForMode(mode, vault.pages[0]?.id)];
    const safeNodeIds = new Set(safeNodes.map((node) => node.id));

    set({
      vault: updateMapByMode(vault, mode, (currentMap) => ({
        ...currentMap,
        nodes: safeNodes,
        edges: currentMap.edges.filter((edge) => safeNodeIds.has(edge.source) && safeNodeIds.has(edge.target)),
        updatedAt: new Date().toISOString(),
      }), vault.pages[0]?.id),
      selectedMapNodeId: selectedMapNodeId && safeNodeIds.has(selectedMapNodeId) ? selectedMapNodeId : safeNodes[0]?.id,
    });
  },
  updateDiagramEdges: (mode, edges) => {
    const { vault } = get();
    set({
      vault: updateMapByMode(vault, mode, (currentMap) => ({
        ...currentMap,
        edges,
        updatedAt: new Date().toISOString(),
      }), vault.pages[0]?.id),
    });
  },
  clearDiagram: (mode) => {
    const { vault } = get();
    const fallbackNode = createRootNodeForMode(mode, vault.pages[0]?.id);

    set({
      vault: updateMapByMode(vault, mode, (currentMap) => ({
        ...currentMap,
        title: 'Flowchart',
        nodes: [fallbackNode],
        edges: [],
        updatedAt: new Date().toISOString(),
      }), vault.pages[0]?.id),
      selectedMapNodeId: fallbackNode.id,
      activeView: 'flowchart',
    });
  },
  applyAgentResult: (result) => {
    const { vault, selectedPageId } = get();
    let nextVault = vault;
    let nextView: WorkspaceView = 'map';
    let nextSelectedPageId = selectedPageId;
    let nextSelectedMapNodeId = get().selectedMapNodeId;

    for (const action of result.actions) {

      if (action.type === 'create-map-nodes') {
        const map = normalizeMap(findMapByMode(nextVault, 'mind-map'), nextVault.pages[0]?.id);

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
              shape: branch.shape,
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

        nextVault = updateMapByMode(nextVault, 'mind-map', (currentMap) => {
          const safeMap = normalizeMap(currentMap, nextVault.pages[0]?.id);

          return {
            ...safeMap,
            nodes: [...safeMap.nodes, ...newNodes],
            edges: [...safeMap.edges, ...newEdges],
            updatedAt: new Date().toISOString(),
          };
        }, nextVault.pages[0]?.id);
        nextView = 'map';
        nextSelectedMapNodeId = newNodes[0]?.id ?? root?.id;
      }

      if (action.type === 'create-diagram') {
        const diagramMode = 'flowchart' as const;
        const generatedDiagram = layoutGeneratedDiagram(
          diagramMode,
          action.payload?.title ?? 'AI Flowchart',
          action.payload?.nodes ?? [],
          action.payload?.edges,
          nextVault.pages[0]?.id,
        );

        nextVault = updateMapByMode(nextVault, diagramMode, (currentMap) => ({
          ...currentMap,
          title: generatedDiagram.title,
          layout: generatedDiagram.layout,
          nodes: generatedDiagram.nodes,
          edges: generatedDiagram.edges,
          updatedAt: new Date().toISOString(),
        }), nextVault.pages[0]?.id);
        nextView = 'flowchart';
        nextSelectedMapNodeId = generatedDiagram.nodes[0]?.id;
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
      selectedMapNodeId: nextSelectedMapNodeId,
    });

    return appliedResult;
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
