import { FileText, Link2, Maximize2, Plus, RotateCcw, Trash2, Waypoints, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MindMapEdge, MindMapNode } from '../domain/types';
import { useBrainStore } from '../store/useBrainStore';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 116;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.8;
const DEFAULT_NODE_LABEL = 'New idea';
const DEFAULT_NODE_SUMMARY = 'Add details, links, or branch it further.';

type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

type DragState = {
  nodeId: string;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
};

type PanState = {
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeWheelDistance(distance: number, deltaMode: number) {
  if (deltaMode === 1) {
    return distance * 16;
  }

  if (deltaMode === 2) {
    return distance * 320;
  }

  return distance;
}

function createEdgeId() {
  return `edge-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function toScreenX(worldX: number, viewport: Viewport) {
  return viewport.x + worldX * viewport.zoom;
}

function toScreenY(worldY: number, viewport: Viewport) {
  return viewport.y + worldY * viewport.zoom;
}

function toWorldPosition(clientX: number, clientY: number, rect: DOMRect, viewport: Viewport) {
  return {
    x: (clientX - rect.left - viewport.x) / viewport.zoom,
    y: (clientY - rect.top - viewport.y) / viewport.zoom,
  };
}

function getNodeBounds(nodes: MindMapNode[]) {
  if (nodes.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: NODE_WIDTH,
      maxY: NODE_HEIGHT,
    };
  }

  return nodes.reduce(
    (bounds, node) => ({
      minX: Math.min(bounds.minX, node.position.x),
      minY: Math.min(bounds.minY, node.position.y),
      maxX: Math.max(bounds.maxX, node.position.x + NODE_WIDTH),
      maxY: Math.max(bounds.maxY, node.position.y + NODE_HEIGHT),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
}

function collectHiddenNodeIds(nodes: MindMapNode[], edges: MindMapEdge[]) {
  const collapsedNodeIds = new Set(nodes.filter((node) => node.data.collapsed).map((node) => node.id));

  if (collapsedNodeIds.size === 0) {
    return new Set<string>();
  }

  const childrenBySource = new Map<string, string[]>();
  edges.forEach((edge) => {
    const children = childrenBySource.get(edge.source) ?? [];
    children.push(edge.target);
    childrenBySource.set(edge.source, children);
  });

  const hidden = new Set<string>();
  const queue = [...collapsedNodeIds];

  while (queue.length > 0) {
    const currentNodeId = queue.shift();
    if (!currentNodeId) {
      continue;
    }

    (childrenBySource.get(currentNodeId) ?? []).forEach((childId) => {
      if (hidden.has(childId)) {
        return;
      }

      hidden.add(childId);
      queue.push(childId);
    });
  }

  return hidden;
}

function createEdgePath(source: MindMapNode, target: MindMapNode, viewport: Viewport) {
  const startX = toScreenX(source.position.x + NODE_WIDTH, viewport);
  const startY = toScreenY(source.position.y + NODE_HEIGHT / 2, viewport);
  const endX = toScreenX(target.position.x, viewport);
  const endY = toScreenY(target.position.y + NODE_HEIGHT / 2, viewport);
  const handleOffset = Math.max(70, Math.abs(endX - startX) * 0.36);

  return `M ${startX} ${startY} C ${startX + handleOffset} ${startY}, ${endX - handleOffset} ${endY}, ${endX} ${endY}`;
}

function BrainNodeCard({
  node,
  isSelected,
  isPendingConnection,
  onPointerDown,
  onSelect,
  onOpenNote,
  onCreateNote,
  onAddChild,
  onStartConnection,
}: {
  node: MindMapNode;
  isSelected: boolean;
  isPendingConnection: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onSelect: () => void;
  onOpenNote: () => void;
  onCreateNote: () => void;
  onAddChild: () => void;
  onStartConnection: () => void;
}) {
  return (
    <div
      className={isSelected ? 'canvas-node is-selected' : 'canvas-node'}
      onPointerDown={onPointerDown}
      onClick={onSelect}
      onDoubleClick={() => {
        if (node.data.noteId) {
          onOpenNote();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <article className={`brain-node tone-${node.data.tone}`}>
        <div className="brain-node-header">
          <span>{node.data.label}</span>
          <span className={isPendingConnection ? 'node-connection-chip is-active' : 'node-connection-chip'}>
            <Waypoints size={13} />
            <span>{isPendingConnection ? 'Pick target' : 'Branch'}</span>
          </span>
        </div>
        {node.data.summary ? <p>{node.data.summary}</p> : null}
        {node.data.noteId ? (
          <div className="node-link">
            <Link2 size={13} />
            <span>Linked note</span>
          </div>
        ) : null}

        {isSelected ? (
          <div className="brain-node-footer">
            <button className="brain-node-action" type="button" onClick={(event) => { event.stopPropagation(); onAddChild(); }}>
              <Plus size={14} />
              <span>Child</span>
            </button>
            <button className="brain-node-action" type="button" onClick={(event) => { event.stopPropagation(); onStartConnection(); }}>
              <Waypoints size={14} />
              <span>{isPendingConnection ? 'Cancel' : 'Connect'}</span>
            </button>
            <button
              className="brain-node-action"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (node.data.noteId) {
                  onOpenNote();
                  return;
                }
                onCreateNote();
              }}
            >
              <FileText size={14} />
              <span>{node.data.noteId ? 'Open note' : 'Create note'}</span>
            </button>
          </div>
        ) : null}
      </article>
    </div>
  );
}

export function MindMapCanvas() {
  const map = useBrainStore((state) => state.vault.maps[0]);
  const vaultLoadVersion = useBrainStore((state) => state.vaultLoadVersion);
  const selectedMapNodeId = useBrainStore((state) => state.selectedMapNodeId);
  const setSelectedMapNode = useBrainStore((state) => state.setSelectedMapNode);
  const setSelectedPage = useBrainStore((state) => state.setSelectedPage);
  const addMindNode = useBrainStore((state) => state.addMindNode);
  const createPageFromNode = useBrainStore((state) => state.createPageFromNode);
  const updateMapNodes = useBrainStore((state) => state.updateMapNodes);
  const updateMapEdges = useBrainStore((state) => state.updateMapEdges);
  const deleteMindNode = useBrainStore((state) => state.deleteMindNode);
  const clearMindMap = useBrainStore((state) => state.clearMindMap);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<Viewport>({ x: 120, y: 120, zoom: 1 });
  const mapRef = useRef(map);
  const lastSelectedNodeIdRef = useRef<string | undefined>(selectedMapNodeId);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const [viewport, setViewport] = useState<Viewport>(viewportRef.current);
  const [pendingConnectionSourceId, setPendingConnectionSourceId] = useState<string>();
  const [draggingNodeId, setDraggingNodeId] = useState<string>();
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    mapRef.current = map;
  }, [map]);

  const hiddenNodeIds = useMemo(() => collectHiddenNodeIds(map.nodes, map.edges), [map.edges, map.nodes]);

  const visibleNodes = useMemo(
    () => map.nodes.filter((node) => !hiddenNodeIds.has(node.id)),
    [hiddenNodeIds, map.nodes],
  );

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const visibleEdges = useMemo(
    () => map.edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
    [map.edges, visibleNodeIds],
  );

  const nodeById = useMemo(() => new Map(map.nodes.map((node) => [node.id, node])), [map.nodes]);

  const selectedNode =
    (selectedMapNodeId ? map.nodes.find((node) => node.id === selectedMapNodeId) : undefined) ?? map.nodes[0];
  const canDeleteSelectedNode = Boolean(selectedNode && map.nodes[0]?.id !== selectedNode.id);
  const canClearMap = map.nodes.length > 1 || map.edges.length > 0;

  const fitToNodes = useCallback((nodesToFit: MindMapNode[] = visibleNodes) => {
    const shell = shellRef.current;
    if (!shell || nodesToFit.length === 0) {
      return;
    }

    const rect = shell.getBoundingClientRect();
    const bounds = getNodeBounds(nodesToFit);
    const width = Math.max(bounds.maxX - bounds.minX, NODE_WIDTH);
    const height = Math.max(bounds.maxY - bounds.minY, NODE_HEIGHT);
    const padding = 72;
    const zoom = clamp(
      Math.min((rect.width - padding * 2) / width, (rect.height - padding * 2) / height),
      MIN_ZOOM,
      1.15,
    );

    setViewport({
      x: rect.width / 2 - (bounds.minX + width / 2) * zoom,
      y: rect.height / 2 - (bounds.minY + height / 2) * zoom,
      zoom,
    });
  }, [visibleNodes]);

  const centerOnNode = useCallback((nodeId: string) => {
    const shell = shellRef.current;
    const targetNode = mapRef.current.nodes.find((node) => node.id === nodeId);

    if (!shell || !targetNode) {
      return;
    }

    const rect = shell.getBoundingClientRect();
    const currentZoom = viewportRef.current.zoom;

    setViewport((currentViewport) => ({
      ...currentViewport,
      x: rect.width / 2 - (targetNode.position.x + NODE_WIDTH / 2) * currentZoom,
      y: rect.height / 2 - (targetNode.position.y + NODE_HEIGHT / 2) * currentZoom,
    }));
  }, []);

  const zoomAtPoint = useCallback((nextZoom: number, clientX?: number, clientY?: number) => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const rect = shell.getBoundingClientRect();
    const safeZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const focusClientX = clientX ?? rect.left + rect.width / 2;
    const focusClientY = clientY ?? rect.top + rect.height / 2;
    const focusWorld = toWorldPosition(focusClientX, focusClientY, rect, viewportRef.current);

    setViewport({
      x: focusClientX - rect.left - focusWorld.x * safeZoom,
      y: focusClientY - rect.top - focusWorld.y * safeZoom,
      zoom: safeZoom,
    });
  }, []);

  const selectNode = useCallback((nodeId: string) => {
    setSelectedMapNode(nodeId);
  }, [setSelectedMapNode]);

  const addNodeAt = useCallback((position: { x: number; y: number }) => {
    const nextNodeId = addMindNode(DEFAULT_NODE_LABEL, DEFAULT_NODE_SUMMARY, position);
    centerOnNode(nextNodeId);
  }, [addMindNode, centerOnNode]);

  const addNodeRelativeToSelected = useCallback((nodeId: string, mode: 'child' | 'sibling') => {
    setSelectedMapNode(nodeId);
    const nextNodeId = addMindNode(DEFAULT_NODE_LABEL, DEFAULT_NODE_SUMMARY, undefined, mode);
    centerOnNode(nextNodeId);
  }, [addMindNode, centerOnNode, setSelectedMapNode]);

  const connectNodes = useCallback((sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) {
      setPendingConnectionSourceId(undefined);
      return;
    }

    const alreadyConnected = mapRef.current.edges.some(
      (edge) => edge.source === sourceId && edge.target === targetId,
    );

    if (!alreadyConnected) {
      updateMapEdges(mapRef.current.id, [
        ...mapRef.current.edges,
        {
          id: createEdgeId(),
          source: sourceId,
          target: targetId,
          type: 'smoothstep',
        },
      ]);
    }

    setSelectedMapNode(targetId);
    setPendingConnectionSourceId(undefined);
  }, [setSelectedMapNode, updateMapEdges]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      fitToNodes();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [fitToNodes, vaultLoadVersion]);

  useEffect(() => {
    if (!selectedMapNodeId) {
      lastSelectedNodeIdRef.current = selectedMapNodeId;
      return;
    }

    if (lastSelectedNodeIdRef.current !== selectedMapNodeId) {
      centerOnNode(selectedMapNodeId);
    }

    lastSelectedNodeIdRef.current = selectedMapNodeId;
  }, [centerOnNode, selectedMapNodeId]);

  useEffect(() => {
    if (pendingConnectionSourceId && !nodeById.has(pendingConnectionSourceId)) {
      setPendingConnectionSourceId(undefined);
    }
  }, [nodeById, pendingConnectionSourceId]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (dragRef.current) {
        const currentViewport = viewportRef.current;
        const nextX = dragRef.current.originX + (event.clientX - dragRef.current.startClientX) / currentViewport.zoom;
        const nextY = dragRef.current.originY + (event.clientY - dragRef.current.startClientY) / currentViewport.zoom;
        const nextNodes = mapRef.current.nodes.map((node) =>
          node.id === dragRef.current?.nodeId
            ? {
                ...node,
                position: {
                  x: nextX,
                  y: nextY,
                },
              }
            : node,
        );

        updateMapNodes(mapRef.current.id, nextNodes);
      }

      if (panRef.current) {
        setViewport({
          x: panRef.current.originX + (event.clientX - panRef.current.startClientX),
          y: panRef.current.originY + (event.clientY - panRef.current.startClientY),
          zoom: viewportRef.current.zoom,
        });
      }
    }

    function handlePointerUp() {
      dragRef.current = null;
      panRef.current = null;
      setDraggingNodeId(undefined);
      setIsPanning(false);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [updateMapNodes]);

  return (
    <div className={isPanning ? 'canvas-shell is-panning' : 'canvas-shell'} ref={shellRef}>
      <div className="canvas-toolbar" aria-label="Mind map tools">
        <button
          type="button"
          title="Add node"
          aria-label="Add node"
          onClick={() => {
            const shell = shellRef.current;
            if (!shell) {
              return;
            }

            const rect = shell.getBoundingClientRect();
            addNodeAt(
              toWorldPosition(rect.left + rect.width / 2, rect.top + rect.height / 2, rect, viewportRef.current),
            );
          }}
        >
          <Plus size={17} />
          <span>Node</span>
        </button>
        <button type="button" title="Fit canvas" aria-label="Fit canvas" onClick={() => fitToNodes()}>
          <Maximize2 size={17} />
          <span>Fit</span>
        </button>
        <button
          className="is-danger"
          type="button"
          title="Delete selected node"
          aria-label="Delete selected node"
          disabled={!canDeleteSelectedNode}
          onClick={() => {
            if (selectedNode) {
              deleteMindNode(selectedNode.id);
            }
          }}
        >
          <Trash2 size={17} />
          <span>Delete</span>
        </button>
        <button
          className="is-danger"
          type="button"
          title="Clear map"
          aria-label="Clear map"
          disabled={!canClearMap}
          onClick={() => {
            clearMindMap();
            window.requestAnimationFrame(() => fitToNodes(mapRef.current.nodes));
          }}
        >
          <RotateCcw size={17} />
          <span>Clear</span>
        </button>
      </div>

      {pendingConnectionSourceId ? (
        <div className="canvas-status">
          <Waypoints size={15} />
          <span>
            Connecting from {nodeById.get(pendingConnectionSourceId)?.data.label ?? 'selected node'}.
            Click another node to finish.
          </span>
        </div>
      ) : null}

      <div
        className={draggingNodeId ? 'canvas-surface is-dragging-node' : 'canvas-surface'}
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return;
          }

          const target = event.target as HTMLElement | null;
          if (target?.closest('.canvas-node, .canvas-toolbar, .canvas-zoom-controls')) {
            return;
          }

          panRef.current = {
            startClientX: event.clientX,
            startClientY: event.clientY,
            originX: viewportRef.current.x,
            originY: viewportRef.current.y,
          };
          setIsPanning(true);
          setPendingConnectionSourceId(undefined);
        }}
        onDoubleClick={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest('.canvas-node, .canvas-toolbar, .canvas-zoom-controls')) {
            return;
          }

          const shell = shellRef.current;
          if (!shell) {
            return;
          }

          addNodeAt(toWorldPosition(event.clientX, event.clientY, shell.getBoundingClientRect(), viewportRef.current));
        }}
        onWheel={(event) => {
          event.preventDefault();
          const deltaX = normalizeWheelDistance(event.deltaX, event.deltaMode);
          const deltaY = normalizeWheelDistance(event.deltaY, event.deltaMode);
          const isGestureZoom = event.ctrlKey || event.metaKey;

          if (isGestureZoom) {
            const zoomFactor = Math.exp(-deltaY * 0.0025);
            zoomAtPoint(viewportRef.current.zoom * zoomFactor, event.clientX, event.clientY);
            return;
          }

          setViewport((currentViewport) => ({
            ...currentViewport,
            x: currentViewport.x - deltaX,
            y: currentViewport.y - deltaY,
          }));
        }}
      >
        <div
          className="canvas-grid"
          style={{
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            backgroundSize: `${22 * viewport.zoom}px ${22 * viewport.zoom}px`,
          }}
        />

        <svg className="canvas-edge-layer" aria-hidden="true">
          {visibleEdges.map((edge) => {
            const source = nodeById.get(edge.source);
            const target = nodeById.get(edge.target);
            if (!source || !target) {
              return null;
            }

            return (
              <path
                key={edge.id}
                d={createEdgePath(source, target, viewport)}
                className={edge.animated ? 'canvas-edge is-animated' : 'canvas-edge'}
              />
            );
          })}
        </svg>

        <div className="canvas-node-layer">
          {visibleNodes.map((node) => (
            <div
              key={node.id}
              className="canvas-node-positioner"
              style={{
                left: toScreenX(node.position.x, viewport),
                top: toScreenY(node.position.y, viewport),
                transform: `scale(${viewport.zoom})`,
              }}
            >
              <BrainNodeCard
                node={node}
                isSelected={selectedNode?.id === node.id}
                isPendingConnection={pendingConnectionSourceId === node.id}
                onPointerDown={(event) => {
                  const target = event.target as HTMLElement | null;
                  if (event.button !== 0 || target?.closest('button, input, textarea, a')) {
                    return;
                  }

                  event.preventDefault();
                  event.stopPropagation();
                  selectNode(node.id);
                  dragRef.current = {
                    nodeId: node.id,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    originX: node.position.x,
                    originY: node.position.y,
                  };
                  setDraggingNodeId(node.id);
                }}
                onSelect={() => {
                  if (pendingConnectionSourceId && pendingConnectionSourceId !== node.id) {
                    connectNodes(pendingConnectionSourceId, node.id);
                    return;
                  }

                  selectNode(node.id);
                }}
                onOpenNote={() => {
                  if (node.data.noteId) {
                    setSelectedPage(node.data.noteId);
                  }
                }}
                onCreateNote={() => {
                  const pageId = createPageFromNode(node.id);
                  if (pageId) {
                    setSelectedPage(pageId);
                  }
                }}
                onAddChild={() => addNodeRelativeToSelected(node.id, 'child')}
                onStartConnection={() => {
                  selectNode(node.id);
                  setPendingConnectionSourceId((currentSourceId) => (currentSourceId === node.id ? undefined : node.id));
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="canvas-zoom-controls" aria-label="Canvas zoom controls">
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => zoomAtPoint(viewport.zoom * 1.12)}>
          <ZoomIn size={16} />
        </button>
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => zoomAtPoint(viewport.zoom * 0.88)}>
          <ZoomOut size={16} />
        </button>
        <button type="button" title="Fit canvas" aria-label="Fit canvas" onClick={() => fitToNodes()}>
          <Maximize2 size={16} />
        </button>
      </div>
    </div>
  );
}
