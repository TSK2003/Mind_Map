import {
  ArrowDown,
  Circle,
  Database,
  Diamond,
  FileText,
  GitBranch,
  Hexagon,
  Maximize2,
  Minus,
  RotateCcw,
  Spline,
  Square,
  Target,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DiagramNodeShape, MindMapNode } from '../../domain/types';
import { useBrainStore } from '../../store/useBrainStore';

type Viewport = { x: number; y: number; zoom: number };
type DragState = { nodeId: string; sx: number; sy: number; ox: number; oy: number };
type PanState = { sx: number; sy: number; ox: number; oy: number };
type MinimapDragState = { ox: number; oy: number; scale: number };
type EdgeStyle = 'line' | 'step';

type WorkflowTool = {
  label: string;
  shape: DiagramNodeShape;
  icon: typeof Square;
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const FLOW_BLOCK_W = 180;
const FLOW_BLOCK_H = 60;
const STICK_BLOCK_W = 168;
const STICK_BLOCK_H = 48;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createEdgeId() {
  return `edge-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function createNodeId() {
  return `workflow-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function getBlockSize() {
  return { width: FLOW_BLOCK_W, height: FLOW_BLOCK_H };
}

function getToneForShape(shape: DiagramNodeShape) {
  if (shape === 'diamond') {
    return 'amber' as const;
  }

  if (shape === 'cylinder') {
    return 'violet' as const;
  }

  if (shape === 'document') {
    return 'rose' as const;
  }

  if (shape === 'parallelogram') {
    return 'sky' as const;
  }

  return 'teal' as const;
}

function getDefaultLabel(shape: DiagramNodeShape) {
  const labels: Record<string, string> = {
    diamond: 'Decision?',
    'start-end': 'Start',
    parallelogram: 'Input / Output',
    hexagon: 'Preparation',
    cylinder: 'Database',
    document: 'Document',
    rect: 'Process',
    rounded: 'Process',
  };

  return labels[shape] ?? 'Process';
}

function getToolset(): WorkflowTool[] {
  return [
    { label: 'Process', shape: 'rect', icon: Square },
    { label: 'Decision', shape: 'diamond', icon: Diamond },
    { label: 'Terminal', shape: 'start-end', icon: Circle },
    { label: 'I/O', shape: 'parallelogram', icon: Minus },
    { label: 'Prepare', shape: 'hexagon', icon: Hexagon },
    { label: 'DB', shape: 'cylinder', icon: Database },
    { label: 'Doc', shape: 'document', icon: FileText },
  ];
}

function getBounds(nodes: MindMapNode[], width: number, height: number) {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: width, maxY: height };
  }

  return nodes.reduce(
    (bounds, node) => ({
      minX: Math.min(bounds.minX, node.position.x),
      minY: Math.min(bounds.minY, node.position.y),
      maxX: Math.max(bounds.maxX, node.position.x + width),
      maxY: Math.max(bounds.maxY, node.position.y + height),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

export function WorkflowCanvas() {
  const shellRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<Viewport>({ x: 80, y: 80, zoom: 1 });
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const minimapDragRef = useRef<MinimapDragState | null>(null);
  const lastFitMapIdRef = useRef<string | null>(null);

  const map = useBrainStore((state) => state.vault.maps.find((entry) => entry.mode === 'flowchart'));
  const selectedMapNodeId = useBrainStore((state) => state.selectedMapNodeId);
  const setSelectedMapNode = useBrainStore((state) => state.setSelectedMapNode);
  const updateDiagramNodes = useBrainStore((state) => state.updateDiagramNodes);
  const updateDiagramEdges = useBrainStore((state) => state.updateDiagramEdges);
  const clearDiagram = useBrainStore((state) => state.clearDiagram);

  const [viewport, setViewport] = useState<Viewport>(viewportRef.current);
  const [edgeStyle, setEdgeStyle] = useState<EdgeStyle>('step');
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(null);

  const { width: blockWidth, height: blockHeight } = getBlockSize();
  const tools = useMemo(() => getToolset(), []);
  const nodes = useMemo(() => map?.nodes ?? [], [map?.nodes]);
  const edges = useMemo(() => map?.edges ?? [], [map?.edges]);
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedId = selectedMapNodeId && nodeMap.has(selectedMapNodeId) ? selectedMapNodeId : nodes[0]?.id ?? null;
  const canDeleteSelected = Boolean(selectedId && selectedId !== nodes[0]?.id);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    if (!selectedId && nodes[0]?.id) {
      setSelectedMapNode(nodes[0].id);
    }
  }, [nodes, selectedId, setSelectedMapNode]);

  const toScreenX = useCallback((worldX: number) => viewport.x + worldX * viewport.zoom, [viewport.x, viewport.zoom]);
  const toScreenY = useCallback((worldY: number) => viewport.y + worldY * viewport.zoom, [viewport.y, viewport.zoom]);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }

    return {
      x: (clientX - rect.left - viewportRef.current.x) / viewportRef.current.zoom,
      y: (clientY - rect.top - viewportRef.current.y) / viewportRef.current.zoom,
    };
  }, []);

  const zoomAt = useCallback((nextZoom: number, clientX?: number, clientY?: number) => {
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const focusX = clientX ?? rect.left + rect.width / 2;
    const focusY = clientY ?? rect.top + rect.height / 2;
    const world = toWorld(focusX, focusY);

    setViewport({
      x: focusX - rect.left - world.x * zoom,
      y: focusY - rect.top - world.y * zoom,
      zoom,
    });
  }, [toWorld]);

  const fitToDiagram = useCallback(() => {
    if (!nodes.length) {
      return;
    }

    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const bounds = getBounds(nodes, blockWidth, blockHeight);
    const contentWidth = Math.max(bounds.maxX - bounds.minX, blockWidth);
    const contentHeight = Math.max(bounds.maxY - bounds.minY, blockHeight);
    const padding = 96;
    const zoom = clamp(
      Math.min((rect.width - padding) / contentWidth, (rect.height - padding) / contentHeight),
      MIN_ZOOM,
      1.2,
    );

    setViewport({
      x: rect.width / 2 - (bounds.minX + contentWidth / 2) * zoom,
      y: rect.height / 2 - (bounds.minY + contentHeight / 2) * zoom,
      zoom,
    });
  }, [blockHeight, blockWidth, nodes]);

  useEffect(() => {
    const mapId = map?.id ?? null;
    if (lastFitMapIdRef.current === mapId) return;
    lastFitMapIdRef.current = mapId;
    const frame = requestAnimationFrame(() => {
      fitToDiagram();
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map?.id]);

  const updateViewportFromMinimap = useCallback((clientX: number, clientY: number, ox: number, oy: number, scale: number) => {
    const shellRect = shellRef.current?.getBoundingClientRect();
    if (!shellRect || scale <= 0) {
      return;
    }

    const worldX = (clientX - ox) / scale;
    const worldY = (clientY - oy) / scale;
    const zoom = viewportRef.current.zoom;

    setViewport((current) => ({
      ...current,
      x: shellRect.width / 2 - worldX * zoom,
      y: shellRect.height / 2 - worldY * zoom,
    }));
  }, []);

  useEffect(() => {
    let raf = 0;

    const handleMove = (event: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (dragRef.current) {
          const drag = dragRef.current;
          const zoom = viewportRef.current.zoom;
          const nextX = drag.ox + (event.clientX - drag.sx) / zoom;
          const nextY = drag.oy + (event.clientY - drag.sy) / zoom;
          updateDiagramNodes(
            'flowchart',
            nodes.map((node) => (node.id === drag.nodeId ? { ...node, position: { x: nextX, y: nextY } } : node)),
          );
        }

        if (panRef.current) {
          const pan = panRef.current;
          setViewport({
            x: pan.ox + (event.clientX - pan.sx),
            y: pan.oy + (event.clientY - pan.sy),
            zoom: viewportRef.current.zoom,
          });
        }

        if (minimapDragRef.current) {
          updateViewportFromMinimap(
            event.clientX,
            event.clientY,
            minimapDragRef.current.ox,
            minimapDragRef.current.oy,
            minimapDragRef.current.scale,
          );
        }
      });
    };

    const handleUp = () => {
      cancelAnimationFrame(raf);
      dragRef.current = null;
      panRef.current = null;
      minimapDragRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [nodes, updateDiagramNodes, updateViewportFromMinimap]);

  if (!map) {
    return <div className="view-loading">Loading diagram...</div>;
  }

  function addNode(shape: DiagramNodeShape) {
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const world = toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const node: MindMapNode = {
      id: createNodeId(),
      type: 'brainNode',
      position: {
        x: world.x - blockWidth / 2,
        y: world.y - blockHeight / 2,
      },
      data: {
        label: getDefaultLabel(shape),
        summary: 'Describe this workflow step.',
        tone: getToneForShape(shape),
        shape,
      },
    };

    const nextEdges =
      selectedId && selectedId !== node.id && !edges.some((edge) => edge.source === selectedId && edge.target === node.id)
        ? [
            ...edges,
            {
              id: createEdgeId(),
              source: selectedId,
              target: node.id,
              type: edgeStyle === 'step' ? 'smoothstep' : 'straight',
            },
          ]
        : edges;

    updateDiagramNodes('flowchart', [...nodes, node]);
    updateDiagramEdges('flowchart', nextEdges);
    setSelectedMapNode(node.id);
  }

  const deleteSelected = useCallback(() => {
    if (!selectedId || selectedId === nodes[0]?.id) {
      return;
    }

    const nextNodes = nodes.filter((node) => node.id !== selectedId);
    const nextEdges = edges.filter((edge) => edge.source !== selectedId && edge.target !== selectedId);
    updateDiagramNodes('flowchart', nextNodes);
    updateDiagramEdges('flowchart', nextEdges);
    setSelectedMapNode(nextNodes[0]?.id);
  }, [edges, nodes, selectedId, setSelectedMapNode, updateDiagramEdges, updateDiagramNodes]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Backspace' || event.key === 'Delete') {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea') return;
        deleteSelected();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteSelected]);

  const handleCopy = useCallback((nodeId: string) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    localStorage.setItem('mindmap-clipboard', JSON.stringify(node));
    setContextMenu(null);
  }, [nodeMap]);

  const handlePaste = useCallback((x: number, y: number) => {
    setContextMenu(null);
    try {
      const clip = localStorage.getItem('mindmap-clipboard');
      if (!clip) return;
      const nodeData = JSON.parse(clip) as MindMapNode;
      const world = toWorld(x, y);
      
      const newNode: MindMapNode = {
        ...nodeData,
        id: createNodeId(),
        position: { x: world.x - blockWidth / 2, y: world.y - blockHeight / 2 }
      };
      updateDiagramNodes('flowchart', [...nodes, newNode]);
      setSelectedMapNode(newNode.id);
    } catch {}
  }, [nodes, blockWidth, blockHeight, updateDiagramNodes, setSelectedMapNode, toWorld]);

  function computeEdgePath(source: MindMapNode, target: MindMapNode) {
    const sourceCenterX = source.position.x + blockWidth / 2;
    const sourceCenterY = source.position.y + blockHeight / 2;
    const targetCenterX = target.position.x + blockWidth / 2;
    const targetCenterY = target.position.y + blockHeight / 2;
    const dx = targetCenterX - sourceCenterX;
    const dy = targetCenterY - sourceCenterY;

    let startX: number;
    let startY: number;
    let endX: number;
    let endY: number;

    if (Math.abs(dy) >= Math.abs(dx)) {
      if (dy >= 0) {
        startX = toScreenX(sourceCenterX);
        startY = toScreenY(source.position.y + blockHeight);
        endX = toScreenX(targetCenterX);
        endY = toScreenY(target.position.y);
      } else {
        startX = toScreenX(sourceCenterX);
        startY = toScreenY(source.position.y);
        endX = toScreenX(targetCenterX);
        endY = toScreenY(target.position.y + blockHeight);
      }
    } else if (dx >= 0) {
      startX = toScreenX(source.position.x + blockWidth);
      startY = toScreenY(sourceCenterY);
      endX = toScreenX(target.position.x);
      endY = toScreenY(targetCenterY);
    } else {
      startX = toScreenX(source.position.x);
      startY = toScreenY(sourceCenterY);
      endX = toScreenX(target.position.x + blockWidth);
      endY = toScreenY(targetCenterY);
    }

    if (edgeStyle === 'line') {
      return `M ${startX} ${startY} L ${endX} ${endY}`;
    }

    if (Math.abs(dy) >= Math.abs(dx)) {
      const middleY = (startY + endY) / 2;
      return `M ${startX} ${startY} L ${startX} ${middleY} L ${endX} ${middleY} L ${endX} ${endY}`;
    }

    const middleX = (startX + endX) / 2;
    return `M ${startX} ${startY} L ${middleX} ${startY} L ${middleX} ${endY} L ${endX} ${endY}`;
  }

  const bounds = getBounds(nodes, blockWidth, blockHeight);
  const minimapWidth = 180;
  const minimapHeight = 110;
  const minimapPadding = 12;
  const boundsWidth = Math.max(bounds.maxX - bounds.minX, blockWidth);
  const boundsHeight = Math.max(bounds.maxY - bounds.minY, blockHeight);
  const minimapScale = Math.min((minimapWidth - minimapPadding * 2) / boundsWidth, (minimapHeight - minimapPadding * 2) / boundsHeight);
  const minimapOffsetX = (minimapWidth - boundsWidth * minimapScale) / 2 - bounds.minX * minimapScale;
  const minimapOffsetY = (minimapHeight - boundsHeight * minimapScale) / 2 - bounds.minY * minimapScale;
  const shellRect = shellRef.current?.getBoundingClientRect();
  const viewportWorld = shellRect
    ? {
        x: -viewport.x / viewport.zoom,
        y: -viewport.y / viewport.zoom,
        width: shellRect.width / viewport.zoom,
        height: shellRect.height / viewport.zoom,
      }
    : null;

  return (
    <div className={isPanning ? 'fc-shell is-panning' : 'fc-shell'} ref={shellRef} onClick={() => setContextMenu(null)}>
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
              if (contextMenu.nodeId) {
                setSelectedMapNode(contextMenu.nodeId);
                setTimeout(() => deleteSelected(), 0);
              }
              setContextMenu(null);
            }} style={{ border: 'none', minHeight: '32px', color: 'var(--rose)' }}>Delete</button>
          )}
        </div>
      ) : null}
      <div className="fc-toolbar" aria-label="Flowchart tools">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button key={tool.label} type="button" title={`Add ${tool.label}`} onClick={() => addNode(tool.shape)}>
              <Icon size={15} />
              <span>{tool.label}</span>
            </button>
          );
        })}
        <span className="fc-sep" />
        <button type="button" title="Connect selected node" disabled={!selectedId} onClick={() => setConnectFrom(selectedId)}>
          <ArrowDown size={15} />
          <span>{connectFrom ? 'Pick target' : 'Connect'}</span>
        </button>
        <span className="fc-sep" />
        <button type="button" title={`Wire style: ${edgeStyle}`} onClick={() => setEdgeStyle((current) => (current === 'step' ? 'line' : 'step'))}>
          <Spline size={15} />
          <span>{edgeStyle === 'step' ? 'Step' : 'Line'}</span>
        </button>
        <button type="button" title="Fit diagram" onClick={fitToDiagram}>
          <Maximize2 size={15} />
          <span>Fit</span>
        </button>
        <span className="fc-sep" />
        <button className="is-danger" type="button" disabled={!canDeleteSelected} onClick={deleteSelected}>
          <Trash2 size={15} />
          <span>Delete</span>
        </button>
        <button className="is-danger" type="button" onClick={() => clearDiagram('flowchart')}>
          <RotateCcw size={15} />
          <span>Clear</span>
        </button>
      </div>

      {connectFrom ? (
        <div className="canvas-status">
          <ArrowDown size={14} />
          <span>Click a block to connect from "{nodeMap.get(connectFrom)?.data.label ?? 'step'}".</span>
        </div>
      ) : null}

      <div
        className="fc-surface"
        onPointerDown={(event) => {
          if (event.button === 2) {
            setContextMenu({ x: event.clientX, y: event.clientY });
            return;
          }
          if (event.button !== 0) {
            return;
          }

          const target = event.target as HTMLElement;
          if (target.closest('.fc-block, .fc-toolbar, .fc-zoom, .canvas-info-panel, .canvas-minimap')) {
            return;
          }

          panRef.current = {
            sx: event.clientX,
            sy: event.clientY,
            ox: viewportRef.current.x,
            oy: viewportRef.current.y,
          };
          setIsPanning(true);
          setConnectFrom(null);
          setContextMenu(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
        onDoubleClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('.fc-block, .fc-toolbar, .fc-zoom, .canvas-info-panel, .canvas-minimap')) {
            return;
          }

          addNode('rect');
        }}
        onWheel={(event) => {
          event.preventDefault();
          if (event.ctrlKey || event.metaKey) {
            zoomAt(viewportRef.current.zoom * Math.exp(-event.deltaY * 0.003), event.clientX, event.clientY);
            return;
          }

          setViewport((current) => ({
            ...current,
            x: current.x - event.deltaX,
            y: current.y - event.deltaY,
          }));
        }}
      >
        <div
          className="canvas-grid"
          style={{
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
          }}
        />

        <svg className="canvas-edge-layer" aria-hidden="true">
          <defs>
            <marker
              id="workflow-arrowhead"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);
            if (!source || !target) {
              return null;
            }

            const path = computeEdgePath(source, target);

            return (
              <g key={edge.id} className="canvas-edge-group">
                <path
                  d={path}
                  className="fc-edge"
                  markerEnd="url(#workflow-arrowhead)"
                />
                <path
                  d={path}
                  className="canvas-edge-hitarea"
                  onClick={() => updateDiagramEdges('flowchart', edges.filter((candidate) => candidate.id !== edge.id))}
                />
              </g>
            );
          })}
        </svg>

        <div className="canvas-node-layer">
          {nodes.map((node) => {
            const isSelected = selectedId === node.id;
            const shape = (node.data.shape as DiagramNodeShape | undefined) ?? 'rect';
            const shapeClass = `fc-shape-${shape}`;

            return (
              <div
                key={node.id}
                className="canvas-node-positioner"
                style={{
                  left: toScreenX(node.position.x),
                  top: toScreenY(node.position.y),
                  transform: `scale(${viewport.zoom})`,
                  width: blockWidth,
                }}
              >
                <div
                  className={`fc-block ${shapeClass} ${isSelected ? 'is-selected' : ''}`}
                  onPointerDown={(event) => {
                    if (event.button === 2) {
                      event.preventDefault();
                      event.stopPropagation();
                      setSelectedMapNode(node.id);
                      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
                      return;
                    }
                    if (event.button !== 0 || (event.target as HTMLElement).closest('input')) {
                      return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedMapNode(node.id);
                    dragRef.current = {
                      nodeId: node.id,
                      sx: event.clientX,
                      sy: event.clientY,
                      ox: node.position.x,
                      oy: node.position.y,
                    };
                    setContextMenu(null);
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={() => {
                    if (connectFrom && connectFrom !== node.id) {
                      const exists = edges.some((edge) => edge.source === connectFrom && edge.target === node.id);
                      if (!exists) {
                        updateDiagramEdges('flowchart', [
                          ...edges,
                          {
                            id: createEdgeId(),
                            source: connectFrom,
                            target: node.id,
                            type: edgeStyle === 'step' ? 'smoothstep' : 'straight',
                          },
                        ]);
                      }
                      setConnectFrom(null);
                      return;
                    }

                    setSelectedMapNode(node.id);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    setEditingId(node.id);
                  }}
                >
                  {editingId === node.id ? (
                    <input
                      className="fc-label-input"
                      defaultValue={node.data.label}
                      autoFocus
                      onBlur={(event) => {
                        updateDiagramNodes(
                          'flowchart',
                          nodes.map((candidate) =>
                            candidate.id === node.id
                              ? {
                                  ...candidate,
                                  data: {
                                    ...candidate.data,
                                    label: event.target.value.trim() || getDefaultLabel(shape),
                                  },
                                }
                              : candidate,
                          ),
                        );
                        setEditingId(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          (event.target as HTMLInputElement).blur();
                        }
                      }}
                    />
                  ) : (
                    <span className="fc-label">{node.data.label}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="fc-zoom canvas-zoom-controls" aria-label="Workflow zoom controls">
        <button type="button" title="Zoom in" onClick={() => zoomAt(viewport.zoom * 1.15)}>
          <ZoomIn size={16} />
        </button>
        <button type="button" title="Zoom out" onClick={() => zoomAt(viewport.zoom * 0.85)}>
          <ZoomOut size={16} />
        </button>
        <button type="button" title="Fit diagram" onClick={fitToDiagram}>
          <Maximize2 size={16} />
        </button>
      </div>

      <div className="canvas-info-panel">
        <div className="canvas-info-item">
          <span className="canvas-info-label">Zoom</span>
          <span className="canvas-info-value">{Math.round(viewport.zoom * 100)}%</span>
        </div>
        <div className="canvas-info-separator" />
        <div className="canvas-info-item">
          <span className="canvas-info-label">Blocks</span>
          <span className="canvas-info-value">{nodes.length}</span>
        </div>
        <div className="canvas-info-separator" />
        <div className="canvas-info-item">
          <span className="canvas-info-label">Links</span>
          <span className="canvas-info-value">{edges.length}</span>
        </div>
      </div>

      {nodes.length > 0 ? (
        <div
          className="canvas-minimap"
          aria-label="Flowchart preview"
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const ox = rect.left + minimapOffsetX;
            const oy = rect.top + minimapOffsetY;
            minimapDragRef.current = {
              ox,
              oy,
              scale: minimapScale,
            };
            updateViewportFromMinimap(event.clientX, event.clientY, ox, oy, minimapScale);
          }}
          onWheel={(event) => {
            event.stopPropagation();
            zoomAt(viewportRef.current.zoom * Math.exp(-event.deltaY * 0.005));
          }}
        >
          <div className="minimap-zoom-controls">
            <button type="button" title="Zoom in" onClick={(event) => { event.stopPropagation(); zoomAt(viewport.zoom * 1.2); }}>
              <ZoomIn size={10} />
            </button>
            <button type="button" title="Zoom out" onClick={(event) => { event.stopPropagation(); zoomAt(viewport.zoom * 0.8); }}>
              <ZoomOut size={10} />
            </button>
          </div>
          <svg width={minimapWidth} height={minimapHeight}>
            {edges.map((edge) => {
              const source = nodeMap.get(edge.source);
              const target = nodeMap.get(edge.target);
              if (!source || !target) {
                return null;
              }

              return (
                <line
                  key={edge.id}
                  x1={minimapOffsetX + (source.position.x + blockWidth / 2) * minimapScale}
                  y1={minimapOffsetY + (source.position.y + blockHeight / 2) * minimapScale}
                  x2={minimapOffsetX + (target.position.x + blockWidth / 2) * minimapScale}
                  y2={minimapOffsetY + (target.position.y + blockHeight / 2) * minimapScale}
                  className="minimap-edge"
                />
              );
            })}
            {nodes.map((node) => (
              <rect
                key={node.id}
                x={minimapOffsetX + node.position.x * minimapScale}
                y={minimapOffsetY + node.position.y * minimapScale}
                width={blockWidth * minimapScale}
                height={blockHeight * minimapScale}
                rx={2}
                className={node.id === selectedId ? 'minimap-node is-selected' : 'minimap-node'}
              />
            ))}
            {viewportWorld ? (
              <rect
                x={minimapOffsetX + viewportWorld.x * minimapScale}
                y={minimapOffsetY + viewportWorld.y * minimapScale}
                width={viewportWorld.width * minimapScale}
                height={viewportWorld.height * minimapScale}
                className="minimap-viewport"
              />
            ) : null}
          </svg>
        </div>
      ) : null}
    </div>
  );
}
