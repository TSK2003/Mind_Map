import { create } from 'zustand';
import type {
  AgentResult,
  BrainVault,
  KnowledgePage,
  MapDocument,
  MindMapEdge,
  MindMapNode,
  Relationship,
  TaskItem,
  WorkspaceView,
} from '../domain/types';
import { sampleVault } from '../domain/sampleVault';

interface BrainState {
  activeView: WorkspaceView;
  vault: BrainVault;
  vaultPath?: string;
  selectedPageId: string;
  isCommandPaletteOpen: boolean;
  setActiveView: (view: WorkspaceView) => void;
  setVault: (vault: BrainVault, path?: string) => void;
  setSelectedPage: (pageId: string) => void;
  createPage: (title?: string, content?: string, tags?: string[]) => string;
  createTask: (title: string, priority?: TaskItem['priority']) => string;
  addMindNode: (label?: string, summary?: string) => string;
  expandActiveMap: (title: string, ideas?: Array<{ label: string; summary?: string; tone?: MindMapNode['data']['tone'] }>) => void;
  updateMapNodes: (mapId: string, nodes: MindMapNode[]) => void;
  updateMapEdges: (mapId: string, edges: MindMapEdge[]) => void;
  applyAgentResult: (result: AgentResult) => AgentResult;
  updateSelectedPageContent: (html: string) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
}

function htmlToText(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
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
  selectedPageId: sampleVault.pages[0]?.id ?? '',
  isCommandPaletteOpen: false,
  setActiveView: (activeView) => set({ activeView }),
  setVault: (vault, vaultPath) =>
    set({
      vault,
      vaultPath,
      selectedPageId: vault.pages[0]?.id ?? '',
    }),
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
  addMindNode: (label = 'New idea', summary = 'Double-click linked nodes to open notes') => {
    const { vault } = get();
    const map = vault.maps[0];
    const id = createId('node');

    if (!map) {
      return id;
    }

    const offset = map.nodes.length * 34;
    const node: MindMapNode = {
      id,
      type: 'brainNode',
      position: {
        x: 140 + offset,
        y: 80 + offset,
      },
      data: {
        label,
        summary,
        tone: 'teal',
      },
    };

    set({
      vault: updateFirstMap(vault, (currentMap) => ({
        ...currentMap,
        nodes: [...currentMap.nodes, node],
        updatedAt: new Date().toISOString(),
      })),
      activeView: 'map',
    });

    return id;
  },
  expandActiveMap: (title, ideas) => {
    const { vault } = get();
    const map = vault.maps[0];

    if (!map) {
      return;
    }

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
      vault: updateFirstMap(vault, (currentMap) => ({
        ...currentMap,
        nodes: [...currentMap.nodes, ...newNodes],
        edges: [...currentMap.edges, ...newEdges],
        updatedAt: new Date().toISOString(),
      })),
      activeView: 'map',
    });
  },
  updateMapNodes: (mapId, nodes) => {
    const { vault } = get();
    set({
      vault: touchVault({
        ...vault,
        maps: vault.maps.map((map) =>
          map.id === mapId
            ? {
                ...map,
                nodes,
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
        const map = nextVault.maps[0];
        if (!map) {
          continue;
        }

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

        nextVault = updateFirstMap(nextVault, (currentMap) => ({
          ...currentMap,
          nodes: [...currentMap.nodes, ...newNodes],
          edges: [...currentMap.edges, ...newEdges],
          updatedAt: new Date().toISOString(),
        }));
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
  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
  toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
}));
