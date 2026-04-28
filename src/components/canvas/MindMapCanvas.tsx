import { Image, Maximize2, Minus, Plus, RotateCcw, Spline, Trash2, Waypoints, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EdgeStyle, MindMapEdge, MindMapNode } from '../../domain/types';
import { useBrainStore } from '../../store/useBrainStore';
import { BrainNodeCard } from './BrainNodeCard';
import { fileToDataUrl, pickFile } from './fileUtils';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 120;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.0;
const DEFAULT_NODE_LABEL = 'New idea';
const DEFAULT_NODE_SUMMARY = 'Add details, links, or branch it further.';

type Viewport = { x: number; y: number; zoom: number };
type DragState = { nodeId: string; startClientX: number; startClientY: number; originX: number; originY: number };
type PanState = { startClientX: number; startClientY: number; originX: number; originY: number };
type MinimapDragState = { offsetX: number; offsetY: number; scale: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeWheelDistance(distance: number, deltaMode: number) {
  if (deltaMode === 1) return distance * 16;
  if (deltaMode === 2) return distance * 100;
  return distance;
}

function createEdgeId() {
  return `edge-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function toScreenX(worldX: number, vp: Viewport) { return vp.x + worldX * vp.zoom; }
function toScreenY(worldY: number, vp: Viewport) { return vp.y + worldY * vp.zoom; }

function toWorldPosition(clientX: number, clientY: number, rect: DOMRect, vp: Viewport) {
  return {
    x: (clientX - rect.left - vp.x) / vp.zoom,
    y: (clientY - rect.top - vp.y) / vp.zoom,
  };
}

function getNodeBounds(nodes: MindMapNode[]) {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: NODE_WIDTH, maxY: NODE_HEIGHT };
  }
  return nodes.reduce(
    (b, n) => ({
      minX: Math.min(b.minX, n.position.x),
      minY: Math.min(b.minY, n.position.y),
      maxX: Math.max(b.maxX, n.position.x + NODE_WIDTH),
      maxY: Math.max(b.maxY, n.position.y + NODE_HEIGHT),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

function collectHiddenNodeIds(nodes: MindMapNode[], edges: MindMapEdge[]) {
  const collapsed = new Set(nodes.filter((n) => n.data.collapsed).map((n) => n.id));
  if (collapsed.size === 0) return new Set<string>();

  const childrenBySource = new Map<string, string[]>();
  edges.forEach((e) => {
    const children = childrenBySource.get(e.source) ?? [];
    children.push(e.target);
    childrenBySource.set(e.source, children);
  });

  const hidden = new Set<string>();
  const queue = [...collapsed];
  while (queue.length > 0) {
    const id = queue.shift()!;
    (childrenBySource.get(id) ?? []).forEach((childId) => {
      if (!hidden.has(childId)) {
        hidden.add(childId);
        queue.push(childId);
      }
    });
  }
  return hidden;
}

/** Count direct children of each node via edges */
function computeChildCounts(edges: MindMapEdge[]) {
  const counts = new Map<string, number>();
  edges.forEach((e) => {
    counts.set(e.source, (counts.get(e.source) ?? 0) + 1);
  });
  return counts;
}

function createEdgePath(source: MindMapNode, target: MindMapNode, vp: Viewport, style: 'straight' | 'curved' | 'step' = 'curved') {
  const sx = toScreenX(source.position.x + NODE_WIDTH, vp);
  const sy = toScreenY(source.position.y + NODE_HEIGHT / 2, vp);
  const ex = toScreenX(target.position.x, vp);
  const ey = toScreenY(target.position.y + NODE_HEIGHT / 2, vp);
  if (style === 'straight') {
    return `M ${sx} ${sy} L ${ex} ${ey}`;
  }
  if (style === 'step') {
    const midX = (sx + ex) / 2;
    return `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ey} L ${ex} ${ey}`;
  }
  // curved (default)
  const dx = Math.abs(ex - sx);
  const offset = Math.max(60, dx * 0.4);
  return `M ${sx} ${sy} C ${sx + offset} ${sy}, ${ex - offset} ${ey}, ${ex} ${ey}`;
}

export function MindMapCanvas() {
  const map = useBrainStore((s) => s.vault.maps[0]);
  const vaultLoadVersion = useBrainStore((s) => s.vaultLoadVersion);
  const lastFitVersionRef = useRef(-1);
  const selectedMapNodeId = useBrainStore((s) => s.selectedMapNodeId);
  const setSelectedMapNode = useBrainStore((s) => s.setSelectedMapNode);
  const addMindNode = useBrainStore((s) => s.addMindNode);
  const updateMapNodes = useBrainStore((s) => s.updateMapNodes);
  const updateMapEdges = useBrainStore((s) => s.updateMapEdges);
  const updateMindNode = useBrainStore((s) => s.updateMindNode);
  const deleteMindNode = useBrainStore((s) => s.deleteMindNode);
  const clearMindMap = useBrainStore((s) => s.clearMindMap);
  const edgeStyle = useBrainStore((s) => s.vault.settings.edgeStyle ?? 'curved');
  const updateSettings = useBrainStore((s) => s.updateSettings);

  const shellRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<Viewport>({ x: 120, y: 120, zoom: 1 });
  const mapRef = useRef(map);
  const lastSelectedRef = useRef<string | undefined>(selectedMapNodeId);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const minimapDragRef = useRef<MinimapDragState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAttachNodeRef = useRef<string | undefined>(undefined);

  const [viewport, setViewport] = useState<Viewport>(viewportRef.current);
  const [pendingConnectionSourceId, setPendingConnectionSourceId] = useState<string>();
  const [draggingNodeId, setDraggingNodeId] = useState<string>();
  const [isPanning, setIsPanning] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(null);

  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  useEffect(() => { mapRef.current = map; }, [map]);

  const hiddenNodeIds = useMemo(() => collectHiddenNodeIds(map.nodes, map.edges), [map.edges, map.nodes]);
  const visibleNodes = useMemo(() => map.nodes.filter((n) => !hiddenNodeIds.has(n.id)), [hiddenNodeIds, map.nodes]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => map.edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)),
    [map.edges, visibleNodeIds],
  );
  const nodeById = useMemo(() => new Map(map.nodes.map((n) => [n.id, n])), [map.nodes]);
  const childCounts = useMemo(() => computeChildCounts(map.edges), [map.edges]);
  const parentEdgeMap = useMemo(() => {
    const m = new Map<string, string>();
    map.edges.forEach((e) => m.set(e.target, e.source));
    return m;
  }, [map.edges]);

  const selectedNode = (selectedMapNodeId ? map.nodes.find((n) => n.id === selectedMapNodeId) : undefined) ?? map.nodes[0];
  const canDeleteSelected = Boolean(selectedNode && map.nodes[0]?.id !== selectedNode.id);
  const canClearMap = map.nodes.length > 1 || map.edges.length > 0;

  const fitToNodes = useCallback((nodesToFit: MindMapNode[] = visibleNodes) => {
    const shell = shellRef.current;
    if (!shell || nodesToFit.length === 0) return;
    const rect = shell.getBoundingClientRect();
    const bounds = getNodeBounds(nodesToFit);
    const w = Math.max(bounds.maxX - bounds.minX, NODE_WIDTH);
    const h = Math.max(bounds.maxY - bounds.minY, NODE_HEIGHT);
    const pad = 72;
    const zoom = clamp(Math.min((rect.width - pad * 2) / w, (rect.height - pad * 2) / h), MIN_ZOOM, 1.1);
    setViewport({
      x: rect.width / 2 - (bounds.minX + w / 2) * zoom,
      y: rect.height / 2 - (bounds.minY + h / 2) * zoom,
      zoom,
    });
  }, [visibleNodes]);


  const zoomAtPoint = useCallback((nextZoom: number, cx?: number, cy?: number) => {
    const shell = shellRef.current;
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    const z = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const fx = cx ?? rect.left + rect.width / 2;
    const fy = cy ?? rect.top + rect.height / 2;
    const world = toWorldPosition(fx, fy, rect, viewportRef.current);
    setViewport({
      x: fx - rect.left - world.x * z,
      y: fy - rect.top - world.y * z,
      zoom: z,
    });
  }, []);

  const updateViewportFromMinimap = useCallback((clientX: number, clientY: number, offsetX: number, offsetY: number, scale: number) => {
    const shell = shellRef.current;
    if (!shell || scale <= 0) return;
    const rect = shell.getBoundingClientRect();
    const worldX = (clientX - offsetX) / scale;
    const worldY = (clientY - offsetY) / scale;
    const zoom = viewportRef.current.zoom;
    setViewport((current) => ({
      ...current,
      x: rect.width / 2 - worldX * zoom,
      y: rect.height / 2 - worldY * zoom,
    }));
  }, []);

  const selectNode = useCallback((id: string) => setSelectedMapNode(id), [setSelectedMapNode]);

  const addNodeAt = useCallback((position: { x: number; y: number }) => {
    addMindNode(DEFAULT_NODE_LABEL, DEFAULT_NODE_SUMMARY, position);
  }, [addMindNode]);

  const addNodeRelativeToSelected = useCallback((nodeId: string, mode: 'child' | 'sibling') => {
    setSelectedMapNode(nodeId);
    addMindNode(DEFAULT_NODE_LABEL, DEFAULT_NODE_SUMMARY, undefined, mode);
  }, [addMindNode, setSelectedMapNode]);

  const connectNodes = useCallback((sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) {
      setPendingConnectionSourceId(undefined);
      return;
    }
    // Bidirectional duplicate check
    const alreadyConnected = mapRef.current.edges.some(
      (e) => (e.source === sourceId && e.target === targetId) || (e.source === targetId && e.target === sourceId),
    );
    if (!alreadyConnected) {
      updateMapEdges(mapRef.current.id, [
        ...mapRef.current.edges,
        { id: createEdgeId(), source: sourceId, target: targetId, type: 'smoothstep' },
      ]);
    }
    setSelectedMapNode(targetId);
    setPendingConnectionSourceId(undefined);
  }, [setSelectedMapNode, updateMapEdges]);

  // Disconnect a node from its parent (remove the edge)
  const disconnectFromParent = useCallback((nodeId: string) => {
    const currentMap = mapRef.current;
    const updatedEdges = currentMap.edges.filter(
      (e) => !(e.target === nodeId),
    );
    updateMapEdges(currentMap.id, updatedEdges);
  }, [updateMapEdges]);

  // Delete a specific edge by id
  const deleteEdge = useCallback((edgeId: string) => {
    const currentMap = mapRef.current;
    const updatedEdges = currentMap.edges.filter((e) => e.id !== edgeId);
    updateMapEdges(currentMap.id, updatedEdges);
  }, [updateMapEdges]);

  // Delete attachment from a node
  const deleteAttachment = useCallback((nodeId: string) => {
    updateMindNode(nodeId, { attachment: undefined });
  }, [updateMindNode]);

  // Handle file attachment
  const handleFileSelect = useCallback(async (file: File, nodeId: string) => {
    try {
      const dataUrl = await fileToDataUrl(file);
      const attachmentType = file.type.startsWith('image/') ? 'image' as const
        : file.type === 'application/pdf' ? 'pdf' as const
        : file.type.startsWith('audio/') ? 'audio' as const
        : file.type.startsWith('video/') ? 'video' as const
        : 'document' as const;
      updateMindNode(nodeId, {
        attachment: {
          type: attachmentType,
          name: file.name,
          dataUrl,
          mimeType: file.type,
        },
      });
    } catch {
      // Silently fail — file too large or unsupported
    }
  }, [updateMindNode]);

  const triggerFileInput = useCallback((nodeId: string) => {
    pendingAttachNodeRef.current = nodeId;
    fileInputRef.current?.click();
  }, []);

  const onFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const nodeId = pendingAttachNodeRef.current;
    if (file && nodeId) {
      void handleFileSelect(file, nodeId);
    }
    e.target.value = '';
    pendingAttachNodeRef.current = undefined;
  }, [handleFileSelect]);

  const addImageNode = useCallback(async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    const shell = shellRef.current;
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    const pos = toWorldPosition(rect.left + rect.width / 2, rect.top + rect.height / 2, rect, viewportRef.current);
    const id = addMindNode(file.name.replace(/\.[^.]+$/, ''), '', pos);
    await handleFileSelect(file, id);
  }, [addMindNode, handleFileSelect]);

  // Fit on vault load only (not on every node change)
  useEffect(() => {
    if (lastFitVersionRef.current === vaultLoadVersion) return;
    lastFitVersionRef.current = vaultLoadVersion;
    const frameId = requestAnimationFrame(() => fitToNodes());
    return () => cancelAnimationFrame(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultLoadVersion]);

  // Track selected node (no auto-centering — user controls viewport)
  useEffect(() => {
    lastSelectedRef.current = selectedMapNodeId;
  }, [selectedMapNodeId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea') return;
        
        const selected = lastSelectedRef.current;
        if (selected && mapRef.current.nodes[0]?.id !== selected) {
          deleteMindNode(selected);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteMindNode]);

  const handleCopy = useCallback((nodeId: string) => {
    const node = mapRef.current.nodes.find(n => n.id === nodeId);
    if (!node) return;
    localStorage.setItem('mindmap-clipboard', JSON.stringify(node));
    setContextMenu(null);
  }, []);

  const handlePaste = useCallback((x: number, y: number) => {
    setContextMenu(null);
    try {
      const clip = localStorage.getItem('mindmap-clipboard');
      if (!clip) return;
      const nodeData = JSON.parse(clip) as MindMapNode;
      const shell = shellRef.current;
      if (!shell) return;
      const rect = shell.getBoundingClientRect();
      const world = toWorldPosition(x, y, rect, viewportRef.current);
      
      const newNodeId = addMindNode(nodeData.data.label, nodeData.data.summary, world);
      if (nodeData.data.tone) {
        updateMindNode(newNodeId, { tone: nodeData.data.tone });
      }
    } catch {}
  }, [addMindNode, updateMindNode]);

  // Clean up stale pending connections
  useEffect(() => {
    if (pendingConnectionSourceId && !nodeById.has(pendingConnectionSourceId)) {
      setPendingConnectionSourceId(undefined);
    }
  }, [nodeById, pendingConnectionSourceId]);

  // Pointer move / up for drag & pan — throttled to rAF for smooth 60fps
  useEffect(() => {
    let rafId = 0;
    function handlePointerMove(e: PointerEvent) {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (dragRef.current) {
          const vp = viewportRef.current;
          const nx = dragRef.current.originX + (e.clientX - dragRef.current.startClientX) / vp.zoom;
          const ny = dragRef.current.originY + (e.clientY - dragRef.current.startClientY) / vp.zoom;
          const nextNodes = mapRef.current.nodes.map((n) =>
            n.id === dragRef.current?.nodeId ? { ...n, position: { x: nx, y: ny } } : n,
          );
          updateMapNodes(mapRef.current.id, nextNodes);
        }
        if (panRef.current) {
          setViewport({
            x: panRef.current.originX + (e.clientX - panRef.current.startClientX),
            y: panRef.current.originY + (e.clientY - panRef.current.startClientY),
            zoom: viewportRef.current.zoom,
          });
        }
        if (minimapDragRef.current) {
          updateViewportFromMinimap(
            e.clientX,
            e.clientY,
            minimapDragRef.current.offsetX,
            minimapDragRef.current.offsetY,
            minimapDragRef.current.scale,
          );
        }
      });
    }
    function handlePointerUp() {
      cancelAnimationFrame(rafId);
      dragRef.current = null;
      panRef.current = null;
      minimapDragRef.current = null;
      setDraggingNodeId(undefined);
      setIsPanning(false);
    }
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [updateMapNodes, updateViewportFromMinimap]);

  return (
    <div className={isPanning ? 'canvas-shell is-panning' : 'canvas-shell'} ref={shellRef} onClick={() => setContextMenu(null)}>
      {contextMenu ? (
        <div style={{
          position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 9999,
          background: 'var(--surface-strong)', border: '1px solid var(--line)', borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '4px', minWidth: '120px', display: 'flex', flexDirection: 'column', gap: '2px'
        }}>
          {contextMenu.nodeId && (
            <button className="settings-option" onClick={() => handleCopy(contextMenu.nodeId!)} style={{ border: 'none', minHeight: '32px' }}>Copy</button>
          )}
          <button className="settings-option" onClick={() => handlePaste(contextMenu.x, contextMenu.y)} style={{ border: 'none', minHeight: '32px' }}>Paste</button>
          {contextMenu.nodeId && (
            <button className="settings-option" onClick={() => {
              if (contextMenu.nodeId) deleteMindNode(contextMenu.nodeId);
              setContextMenu(null);
            }} style={{ border: 'none', minHeight: '32px', color: 'var(--rose)' }}>Delete</button>
          )}
        </div>
      ) : null}
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,audio/*,video/*,.doc,.docx,.txt,.md"
        style={{ display: 'none' }}
        onChange={onFileInputChange}
      />

      {/* Canvas Toolbar */}
      <div className="canvas-toolbar" aria-label="Mind map tools">
        <button type="button" title="Add node" aria-label="Add node" onClick={() => {
          const shell = shellRef.current;
          if (!shell) return;
          const rect = shell.getBoundingClientRect();
          addNodeAt(toWorldPosition(rect.left + rect.width / 2, rect.top + rect.height / 2, rect, viewportRef.current));
        }}>
          <Plus size={15} />
          <span>Node</span>
        </button>
        <button type="button" title="Add image node" aria-label="Add image node" onClick={() => void addImageNode()}>
          <Image size={15} />
          <span>Image</span>
        </button>
        <span className="toolbar-separator" />
        <button type="button" title="Fit canvas" aria-label="Fit canvas" onClick={() => fitToNodes()}>
          <Maximize2 size={15} />
          <span>Fit</span>
        </button>
        <button type="button" title={`Wire: ${edgeStyle}`} aria-label="Toggle wire style" onClick={() => {
          const styles: EdgeStyle[] = ['curved', 'straight', 'step'];
          const next = styles[(styles.indexOf(edgeStyle) + 1) % styles.length];
          updateSettings({ edgeStyle: next });
        }}>
          <Spline size={15} />
          <span>{edgeStyle === 'curved' ? 'Curved' : edgeStyle === 'straight' ? 'Line' : 'Step'}</span>
        </button>
        <span className="toolbar-separator" />
        <button className="is-danger" type="button" title="Delete selected" aria-label="Delete selected" disabled={!canDeleteSelected}
          onClick={() => { if (selectedNode) deleteMindNode(selectedNode.id); }}
        >
          <Trash2 size={15} />
          <span>Delete</span>
        </button>
        <button className="is-danger" type="button" title="Clear map" aria-label="Clear map" disabled={!canClearMap}
          onClick={() => { clearMindMap(); requestAnimationFrame(() => fitToNodes(mapRef.current.nodes)); }}
        >
          <RotateCcw size={15} />
          <span>Clear</span>
        </button>
      </div>

      {/* Connection status */}
      {pendingConnectionSourceId ? (
        <div className="canvas-status">
          <Waypoints size={14} />
          <span>
            Connecting from {nodeById.get(pendingConnectionSourceId)?.data.label ?? 'node'}. Click target to finish.
          </span>
        </div>
      ) : null}

      {/* Canvas surface */}
      <div
        className={draggingNodeId ? 'canvas-surface is-dragging-node' : 'canvas-surface'}
        onPointerDown={(e) => {
          if (e.button === 2) {
            setContextMenu({ x: e.clientX, y: e.clientY });
            return;
          }
          if (e.button !== 0) return;
          const t = e.target as HTMLElement | null;
          if (t?.closest('.canvas-node, .canvas-toolbar, .canvas-zoom-controls, .canvas-info-panel, .canvas-minimap')) return;
          panRef.current = {
            startClientX: e.clientX, startClientY: e.clientY,
            originX: viewportRef.current.x, originY: viewportRef.current.y,
          };
          setIsPanning(true);
          setPendingConnectionSourceId(undefined);
          setContextMenu(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
        onDoubleClick={(e) => {
          const t = e.target as HTMLElement | null;
          if (t?.closest('.canvas-node, .canvas-toolbar, .canvas-zoom-controls, .canvas-info-panel, .canvas-minimap')) return;
          const shell = shellRef.current;
          if (!shell) return;
          addNodeAt(toWorldPosition(e.clientX, e.clientY, shell.getBoundingClientRect(), viewportRef.current));
        }}
        onWheel={(e) => {
          e.preventDefault();
          const dx = normalizeWheelDistance(e.deltaX, e.deltaMode);
          const dy = normalizeWheelDistance(e.deltaY, e.deltaMode);
          if (e.ctrlKey || e.metaKey) {
            zoomAtPoint(viewportRef.current.zoom * Math.exp(-dy * 0.003), e.clientX, e.clientY);
            return;
          }
          setViewport((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
        }}
      >
        {/* Dot grid background */}
        <div
          className="canvas-grid"
          style={{
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
          }}
        />

        {/* Edge layer */}
        <svg className="canvas-edge-layer" aria-hidden="true">
          {visibleEdges.map((edge) => {
            const source = nodeById.get(edge.source);
            const target = nodeById.get(edge.target);
            if (!source || !target) return null;
            return (
              <g key={edge.id} className="canvas-edge-group">
                <path
                  d={createEdgePath(source, target, viewport, edgeStyle)}
                  className={edge.animated ? 'canvas-edge is-animated' : 'canvas-edge'}
                />
                {/* Invisible wider hit area for clicking */}
                <path
                  d={createEdgePath(source, target, viewport, edgeStyle)}
                  className="canvas-edge-hitarea"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteEdge(edge.id);
                  }}
                />
                {/* Delete indicator at midpoint */}
                {(() => {
                  const sx = toScreenX(source.position.x + NODE_WIDTH, viewport);
                  const sy = toScreenY(source.position.y + NODE_HEIGHT / 2, viewport);
                  const ex = toScreenX(target.position.x, viewport);
                  const ey = toScreenY(target.position.y + NODE_HEIGHT / 2, viewport);
                  const mx = (sx + ex) / 2;
                  const my = (sy + ey) / 2;
                  return (
                    <g
                      className="edge-delete-indicator"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteEdge(edge.id);
                      }}
                    >
                      <circle cx={mx} cy={my} r={10} />
                      <line x1={mx - 4} y1={my - 4} x2={mx + 4} y2={my + 4} />
                      <line x1={mx + 4} y1={my - 4} x2={mx - 4} y2={my + 4} />
                    </g>
                  );
                })()}
              </g>
            );
          })}
        </svg>

        {/* Node layer */}
        <div className="canvas-node-layer">
          {visibleNodes.map((node) => (
            <div
              key={node.id}
              className="canvas-node-positioner"
              onContextMenu={(e) => e.preventDefault()}
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
                childCount={childCounts.get(node.id) ?? 0}
                hasParentEdge={parentEdgeMap.has(node.id)}
                onPointerDown={(e) => {
                  if (e.button === 2) {
                    e.preventDefault();
                    e.stopPropagation();
                    selectNode(node.id);
                    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
                    return;
                  }
                  const t = e.target as HTMLElement | null;
                  if (e.button !== 0 || t?.closest('button, input, textarea, a')) return;
                  e.preventDefault();
                  e.stopPropagation();
                  selectNode(node.id);
                  dragRef.current = {
                    nodeId: node.id,
                    startClientX: e.clientX, startClientY: e.clientY,
                    originX: node.position.x, originY: node.position.y,
                  };
                  setDraggingNodeId(node.id);
                  setContextMenu(null);
                }}
                onSelect={() => {
                  if (pendingConnectionSourceId && pendingConnectionSourceId !== node.id) {
                    connectNodes(pendingConnectionSourceId, node.id);
                    return;
                  }
                  selectNode(node.id);
                }}

                onAddChild={() => addNodeRelativeToSelected(node.id, 'child')}
                onStartConnection={() => {
                  selectNode(node.id);
                  setPendingConnectionSourceId((s) => (s === node.id ? undefined : node.id));
                }}
                onToggleCollapse={() => {
                  updateMindNode(node.id, { collapsed: !node.data.collapsed });
                }}
                onAttachFile={() => triggerFileInput(node.id)}
                onDeleteAttachment={() => deleteAttachment(node.id)}
                onDisconnectFromParent={() => disconnectFromParent(node.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Zoom controls + Info panel */}
      <div className="canvas-zoom-controls" aria-label="Canvas zoom controls">
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => zoomAtPoint(viewport.zoom * 1.15)}>
          <ZoomIn size={16} />
        </button>
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => zoomAtPoint(viewport.zoom * 0.85)}>
          <ZoomOut size={16} />
        </button>
        <button type="button" title="Fit canvas" aria-label="Fit canvas" onClick={() => fitToNodes()}>
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Mini info panel */}
      <div className="canvas-info-panel" aria-label="Canvas info">
        <div className="canvas-info-item">
          <span className="canvas-info-label">Zoom</span>
          <span className="canvas-info-value">{Math.round(viewport.zoom * 100)}%</span>
        </div>
        <div className="canvas-info-separator" />
        <div className="canvas-info-item">
          <span className="canvas-info-label">Nodes</span>
          <span className="canvas-info-value">{map.nodes.length}</span>
        </div>
        <div className="canvas-info-separator" />
        <div className="canvas-info-item">
          <span className="canvas-info-label">Edges</span>
          <span className="canvas-info-value">{map.edges.length}</span>
        </div>
      </div>

      {/* Minimap preview */}
      {visibleNodes.length > 0 ? (() => {
        const bounds = getNodeBounds(visibleNodes);
        const bw = Math.max(bounds.maxX - bounds.minX, NODE_WIDTH);
        const bh = Math.max(bounds.maxY - bounds.minY, NODE_HEIGHT);
        const mmW = 180;
        const mmH = 110;
        const pad = 12;
        const scale = Math.min((mmW - pad * 2) / bw, (mmH - pad * 2) / bh);
        const ox = (mmW - bw * scale) / 2 - bounds.minX * scale;
        const oy = (mmH - bh * scale) / 2 - bounds.minY * scale;
        const shellRect = shellRef.current?.getBoundingClientRect();
        const viewportWorld = shellRect ? {
          x: -viewport.x / viewport.zoom,
          y: -viewport.y / viewport.zoom,
          width: shellRect.width / viewport.zoom,
          height: shellRect.height / viewport.zoom,
        } : null;
        return (
          <div
            className="canvas-minimap"
            aria-label="Canvas minimap"
            onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              minimapDragRef.current = {
                offsetX: rect.left + ox,
                offsetY: rect.top + oy,
                scale,
              };
              updateViewportFromMinimap(e.clientX, e.clientY, rect.left + ox, rect.top + oy, scale);
            }}
            onWheel={(e) => {
              e.stopPropagation();
              const dy = normalizeWheelDistance(e.deltaY, e.deltaMode);
              zoomAtPoint(viewportRef.current.zoom * Math.exp(-dy * 0.005));
            }}
          >
            <div className="minimap-zoom-controls">
              <button type="button" title="Zoom in" onClick={(e) => { e.stopPropagation(); zoomAtPoint(viewport.zoom * 1.2); }}>
                <Plus size={10} />
              </button>
              <button type="button" title="Zoom out" onClick={(e) => { e.stopPropagation(); zoomAtPoint(viewport.zoom * 0.8); }}>
                <Minus size={10} />
              </button>
            </div>
            <svg width={mmW} height={mmH}>
              {visibleEdges.map((edge) => {
                const s = nodeById.get(edge.source);
                const t = nodeById.get(edge.target);
                if (!s || !t) return null;
                const x1 = ox + (s.position.x + NODE_WIDTH / 2) * scale;
                const y1 = oy + (s.position.y + NODE_HEIGHT / 2) * scale;
                const x2 = ox + (t.position.x + NODE_WIDTH / 2) * scale;
                const y2 = oy + (t.position.y + NODE_HEIGHT / 2) * scale;
                return <line key={edge.id} x1={x1} y1={y1} x2={x2} y2={y2} className="minimap-edge" />;
              })}
              {visibleNodes.map((node) => {
                const nx = ox + node.position.x * scale;
                const ny = oy + node.position.y * scale;
                const nw = NODE_WIDTH * scale;
                const nh = NODE_HEIGHT * scale;
                return (
                  <rect
                    key={node.id}
                    x={nx} y={ny} width={nw} height={nh}
                    rx={2}
                    className={node.id === selectedNode?.id ? 'minimap-node is-selected' : 'minimap-node'}
                    onClick={(ev) => { ev.stopPropagation(); selectNode(node.id); }}
                  />
                );
              })}
              {viewportWorld ? (
                <rect
                  x={ox + viewportWorld.x * scale}
                  y={oy + viewportWorld.y * scale}
                  width={viewportWorld.width * scale}
                  height={viewportWorld.height * scale}
                  className="minimap-viewport"
                />
              ) : null}
            </svg>
          </div>
        );
      })() : null}
    </div>
  );
}
