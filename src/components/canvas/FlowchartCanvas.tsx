import { ArrowDown, Circle, Database, Diamond, FileText, Hexagon, Maximize2, Minus, RotateCcw, Spline, Square, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ── Constants ──────────────────────────────────────── */
const BLOCK_W = 180;
const BLOCK_H = 60;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;

type Viewport = { x: number; y: number; zoom: number };
type DragState = { nodeId: string; sx: number; sy: number; ox: number; oy: number };
type PanState = { sx: number; sy: number; ox: number; oy: number };
type FCEdgeStyle = 'line' | 'step';

type FCNode = {
  id: string;
  x: number;
  y: number;
  label: string;
  shape: 'rect' | 'diamond' | 'rounded' | 'start-end' | 'parallelogram' | 'hexagon' | 'cylinder' | 'document';
};

type FCEdge = { id: string; from: string; to: string };

type FCState = {
  nodes: FCNode[];
  edges: FCEdge[];
  selectedId: string | null;
  viewport: Viewport;
  edgeStyle: FCEdgeStyle;
};

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }
function uid() { return `fc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

/* ── Persistent state cache (survives tab switches) ── */
const DEFAULT_STATE: FCState = {
  nodes: [{ id: 'fc-start', x: 0, y: 0, label: 'Start', shape: 'start-end' }],
  edges: [],
  selectedId: 'fc-start',
  viewport: { x: 80, y: 80, zoom: 1 },
  edgeStyle: 'step',
};

let savedState: FCState = { ...DEFAULT_STATE };

/* ── Component ──────────────────────────────────────── */
export function FlowchartCanvas() {
  const shellRef = useRef<HTMLDivElement>(null);
  const vpRef = useRef<Viewport>(savedState.viewport);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);

  const [viewport, setViewport] = useState<Viewport>(savedState.viewport);
  const [nodes, setNodes] = useState<FCNode[]>(savedState.nodes);
  const [edges, setEdges] = useState<FCEdge[]>(savedState.edges);
  const [selectedId, setSelectedId] = useState<string | null>(savedState.selectedId);
  const [edgeStyle, setEdgeStyle] = useState<FCEdgeStyle>(savedState.edgeStyle);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => { vpRef.current = viewport; }, [viewport]);

  // Save state when component unmounts (tab switch)
  useEffect(() => {
    return () => {
      savedState = {
        nodes,
        edges,
        selectedId,
        viewport: vpRef.current,
        edgeStyle,
      };
    };
  });

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  /* ── viewport helpers ──────────────── */
  const toSx = (wx: number) => viewport.x + wx * viewport.zoom;
  const toSy = (wy: number) => viewport.y + wy * viewport.zoom;
  const toWorld = useCallback((cx: number, cy: number) => {
    const r = shellRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (cx - r.left - vpRef.current.x) / vpRef.current.zoom, y: (cy - r.top - vpRef.current.y) / vpRef.current.zoom };
  }, []);

  const zoomAt = useCallback((z: number, cx?: number, cy?: number) => {
    const r = shellRef.current?.getBoundingClientRect();
    if (!r) return;
    const nz = clamp(z, MIN_ZOOM, MAX_ZOOM);
    const fx = cx ?? r.left + r.width / 2;
    const fy = cy ?? r.top + r.height / 2;
    const w = toWorld(fx, fy);
    setViewport({ x: fx - r.left - w.x * nz, y: fy - r.top - w.y * nz, zoom: nz });
  }, [toWorld]);

  /* ── node CRUD ─────────────────────── */
  const addNode = useCallback((shape: FCNode['shape'] = 'rect') => {
    const r = shellRef.current?.getBoundingClientRect();
    if (!r) return;
    const w = toWorld(r.left + r.width / 2, r.top + r.height / 2);
    const labelMap: Record<string, string> = { diamond: 'Condition?', 'start-end': 'End', parallelogram: 'Input / Output', hexagon: 'Preparation', cylinder: 'Database', document: 'Document', rect: 'Process', rounded: 'Process' };
    const n: FCNode = { id: uid(), x: w.x - BLOCK_W / 2, y: w.y - BLOCK_H / 2, label: labelMap[shape] ?? 'Process', shape };
    setNodes((prev) => [...prev, n]);
    setSelectedId(n.id);
    if (selectedId) {
      setEdges((prev) => [...prev, { id: uid(), from: selectedId, to: n.id }]);
    }
  }, [selectedId, toWorld]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedId));
    setEdges((prev) => prev.filter((e) => e.from !== selectedId && e.to !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  /* ── drag & pan ────────────────────── */
  useEffect(() => {
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (dragRef.current) {
          const d = dragRef.current;
          const z = vpRef.current.zoom;
          const nx = d.ox + (e.clientX - d.sx) / z;
          const ny = d.oy + (e.clientY - d.sy) / z;
          setNodes((prev) => prev.map((n) => n.id === d.nodeId ? { ...n, x: nx, y: ny } : n));
        }
        if (panRef.current) {
          const p = panRef.current;
          setViewport({ x: p.ox + (e.clientX - p.sx), y: p.oy + (e.clientY - p.sy), zoom: vpRef.current.zoom });
        }
      });
    };
    const onUp = () => { cancelAnimationFrame(raf); dragRef.current = null; panRef.current = null; setIsPanning(false); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, []);

  /* ── smart edge path with direction-aware arrows ── */
  type EdgeInfo = { path: string; ax: number; ay: number; angle: number };
  const computeEdge = useCallback((from: FCNode, to: FCNode): EdgeInfo => {
    const fcx = from.x + BLOCK_W / 2, fcy = from.y + BLOCK_H / 2;
    const tcx = to.x + BLOCK_W / 2, tcy = to.y + BLOCK_H / 2;
    const dx = tcx - fcx, dy = tcy - fcy;

    // Determine best exit/entry sides
    let sx: number, sy: number, ex: number, ey: number;
    let angle: number;

    if (Math.abs(dy) >= Math.abs(dx)) {
      // Primarily vertical
      if (dy >= 0) {
        // Target is below
        sx = toSx(fcx); sy = toSy(from.y + BLOCK_H);
        ex = toSx(tcx); ey = toSy(to.y);
        angle = 90;
      } else {
        // Target is above
        sx = toSx(fcx); sy = toSy(from.y);
        ex = toSx(tcx); ey = toSy(to.y + BLOCK_H);
        angle = -90;
      }
    } else {
      // Primarily horizontal
      if (dx >= 0) {
        // Target is right
        sx = toSx(from.x + BLOCK_W); sy = toSy(fcy);
        ex = toSx(to.x); ey = toSy(tcy);
        angle = 0;
      } else {
        // Target is left
        sx = toSx(from.x); sy = toSy(fcy);
        ex = toSx(to.x + BLOCK_W); ey = toSy(tcy);
        angle = 180;
      }
    }

    let path: string;
    if (edgeStyle === 'line') {
      path = `M ${sx} ${sy} L ${ex} ${ey}`;
    } else {
      const mx = (sx + ex) / 2, my = (sy + ey) / 2;
      if (Math.abs(dy) >= Math.abs(dx)) {
        path = `M ${sx} ${sy} L ${sx} ${my} L ${ex} ${my} L ${ex} ${ey}`;
      } else {
        path = `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ey} L ${ex} ${ey}`;
      }
    }
    return { path, ax: ex, ay: ey, angle };
  }, [viewport, edgeStyle]);

  /* ── render ────────────────────────── */
  return (
    <div className={isPanning ? 'fc-shell is-panning' : 'fc-shell'} ref={shellRef}>
      {/* Toolbar */}
      <div className="fc-toolbar">
        <button type="button" title="Add process block" onClick={() => addNode('rect')}>
          <Square size={15} /><span>Process</span>
        </button>
        <button type="button" title="Add decision" onClick={() => addNode('diamond')}>
          <Diamond size={15} /><span>Decision</span>
        </button>
        <button type="button" title="Add start/end" onClick={() => addNode('start-end')}>
          <Circle size={15} /><span>Terminal</span>
        </button>
        <button type="button" title="Add I/O" onClick={() => addNode('parallelogram')}>
          <Minus size={15} /><span>I/O</span>
        </button>
        <button type="button" title="Add preparation" onClick={() => addNode('hexagon')}>
          <Hexagon size={15} /><span>Prepare</span>
        </button>
        <button type="button" title="Add database" onClick={() => addNode('cylinder')}>
          <Database size={15} /><span>DB</span>
        </button>
        <button type="button" title="Add document" onClick={() => addNode('document')}>
          <FileText size={15} /><span>Doc</span>
        </button>
        <span className="fc-sep" />
        <button type="button" title="Connect" onClick={() => setConnectFrom(selectedId)}>
          <ArrowDown size={15} /><span>{connectFrom ? 'Pick target' : 'Connect'}</span>
        </button>
        <span className="fc-sep" />
        <button type="button" title={`Wire: ${edgeStyle}`} onClick={() => setEdgeStyle((s) => s === 'step' ? 'line' : 'step')}>
          <Spline size={15} /><span>{edgeStyle === 'step' ? 'Step' : 'Line'}</span>
        </button>
        <button type="button" title="Fit" onClick={() => {
          if (nodes.length === 0) return;
          const r = shellRef.current?.getBoundingClientRect();
          if (!r) return;
          const b = nodes.reduce((a, n) => ({ minX: Math.min(a.minX, n.x), minY: Math.min(a.minY, n.y), maxX: Math.max(a.maxX, n.x + BLOCK_W), maxY: Math.max(a.maxY, n.y + BLOCK_H) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
          const w = Math.max(b.maxX - b.minX, BLOCK_W);
          const h = Math.max(b.maxY - b.minY, BLOCK_H);
          const z = clamp(Math.min((r.width - 120) / w, (r.height - 120) / h), MIN_ZOOM, 1.2);
          setViewport({ x: r.width / 2 - (b.minX + w / 2) * z, y: r.height / 2 - (b.minY + h / 2) * z, zoom: z });
        }}>
          <Maximize2 size={15} /><span>Fit</span>
        </button>
        <span className="fc-sep" />
        <button className="is-danger" type="button" disabled={!selectedId} onClick={deleteSelected}>
          <Trash2 size={15} /><span>Delete</span>
        </button>
        <button className="is-danger" type="button" onClick={() => {
          const fresh = { ...DEFAULT_STATE };
          setNodes([...fresh.nodes]);
          setEdges([]);
          setSelectedId('fc-start');
          setEdgeStyle(fresh.edgeStyle);
        }}>
          <RotateCcw size={15} /><span>Clear</span>
        </button>
      </div>

      {connectFrom ? (
        <div className="canvas-status">
          <ArrowDown size={14} />
          <span>Click a block to connect from "{nodeMap.get(connectFrom)?.label}"</span>
        </div>
      ) : null}

      {/* Surface */}
      <div
        className="fc-surface"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const t = e.target as HTMLElement;
          if (t.closest('.fc-block, .fc-toolbar, .fc-zoom, .canvas-info-panel, .canvas-minimap')) return;
          panRef.current = { sx: e.clientX, sy: e.clientY, ox: vpRef.current.x, oy: vpRef.current.y };
          setIsPanning(true);
          setConnectFrom(null);
        }}
        onDoubleClick={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest('.fc-block, .fc-toolbar, .fc-zoom, .canvas-info-panel, .canvas-minimap')) return;
          const w = toWorld(e.clientX, e.clientY);
          const n: FCNode = { id: uid(), x: w.x - BLOCK_W / 2, y: w.y - BLOCK_H / 2, label: 'Process', shape: 'rect' };
          setNodes((prev) => [...prev, n]);
          setSelectedId(n.id);
        }}
        onWheel={(e) => {
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            zoomAt(vpRef.current.zoom * Math.exp(-e.deltaY * 0.003), e.clientX, e.clientY);
          } else {
            setViewport((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
          }
        }}
      >
        <div className="canvas-grid" style={{ backgroundPosition: `${viewport.x}px ${viewport.y}px`, backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px` }} />

        {/* Edges */}
        <svg className="canvas-edge-layer" aria-hidden>
          <defs>
            <marker id="fc-arrowhead" viewBox="0 0 10 10" refX="10" refY="5"
              markerWidth="8" markerHeight="8" orient="auto-start-reverse"
              fill="var(--ink)" fillOpacity="0.55">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return null;
            const info = computeEdge(from, to);
            return (
              <g key={edge.id} className="canvas-edge-group">
                <path d={info.path} className="fc-edge" markerEnd="url(#fc-arrowhead)" />
                <path d={info.path} className="canvas-edge-hitarea" onClick={() => setEdges((prev) => prev.filter((e) => e.id !== edge.id))} />
              </g>
            );
          })}
        </svg>

        {/* Blocks */}
        <div className="canvas-node-layer">
          {nodes.map((node) => {
            const isSelected = selectedId === node.id;
            const shapeClass = `fc-shape-${node.shape}`;
            return (
              <div
                key={node.id}
                className="canvas-node-positioner"
                style={{ left: toSx(node.x), top: toSy(node.y), transform: `scale(${viewport.zoom})`, width: BLOCK_W }}
              >
                <div
                  className={`fc-block ${shapeClass} ${isSelected ? 'is-selected' : ''}`}
                  onPointerDown={(e) => {
                    if (e.button !== 0 || (e.target as HTMLElement).closest('input')) return;
                    e.preventDefault(); e.stopPropagation();
                    setSelectedId(node.id);
                    dragRef.current = { nodeId: node.id, sx: e.clientX, sy: e.clientY, ox: node.x, oy: node.y };
                  }}
                  onClick={() => {
                    if (connectFrom && connectFrom !== node.id) {
                      const exists = edges.some((e) => e.from === connectFrom && e.to === node.id);
                      if (!exists) setEdges((prev) => [...prev, { id: uid(), from: connectFrom, to: node.id }]);
                      setConnectFrom(null);
                      return;
                    }
                    setSelectedId(node.id);
                  }}
                  onDoubleClick={(e) => { e.stopPropagation(); setEditingId(node.id); }}
                >
                  {editingId === node.id ? (
                    <input
                      className="fc-label-input"
                      defaultValue={node.label}
                      autoFocus
                      onBlur={(e) => { setNodes((prev) => prev.map((n) => n.id === node.id ? { ...n, label: e.target.value || 'Process' } : n)); setEditingId(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    />
                  ) : (
                    <span className="fc-label">{node.label}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zoom */}
      <div className="fc-zoom canvas-zoom-controls">
        <button type="button" onClick={() => zoomAt(viewport.zoom * 1.15)}><ZoomIn size={16} /></button>
        <button type="button" onClick={() => zoomAt(viewport.zoom * 0.85)}><ZoomOut size={16} /></button>
        <button type="button" onClick={() => setViewport({ x: 80, y: 80, zoom: 1 })}><Maximize2 size={16} /></button>
      </div>

      {/* Info */}
      <div className="canvas-info-panel">
        <div className="canvas-info-item"><span className="canvas-info-label">Zoom</span><span className="canvas-info-value">{Math.round(viewport.zoom * 100)}%</span></div>
        <div className="canvas-info-separator" />
        <div className="canvas-info-item"><span className="canvas-info-label">Blocks</span><span className="canvas-info-value">{nodes.length}</span></div>
        <div className="canvas-info-separator" />
        <div className="canvas-info-item"><span className="canvas-info-label">Links</span><span className="canvas-info-value">{edges.length}</span></div>
      </div>

      {/* Minimap preview */}
      {nodes.length > 0 ? (() => {
        const bounds = nodes.reduce((a, n) => ({
          minX: Math.min(a.minX, n.x), minY: Math.min(a.minY, n.y),
          maxX: Math.max(a.maxX, n.x + BLOCK_W), maxY: Math.max(a.maxY, n.y + BLOCK_H),
        }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
        const bw = Math.max(bounds.maxX - bounds.minX, BLOCK_W);
        const bh = Math.max(bounds.maxY - bounds.minY, BLOCK_H);
        const mmW = 180;
        const mmH = 110;
        const pad = 12;
        const scale = Math.min((mmW - pad * 2) / bw, (mmH - pad * 2) / bh);
        const ox = (mmW - bw * scale) / 2 - bounds.minX * scale;
        const oy = (mmH - bh * scale) / 2 - bounds.minY * scale;
        return (
          <div
            className="canvas-minimap"
            aria-label="Flowchart minimap"
            onWheel={(e) => { e.stopPropagation(); zoomAt(vpRef.current.zoom * Math.exp(-e.deltaY * 0.005)); }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const worldX = (e.clientX - rect.left - ox) / scale;
              const worldY = (e.clientY - rect.top - oy) / scale;
              const shell = shellRef.current;
              if (!shell) return;
              const sr = shell.getBoundingClientRect();
              const z = vpRef.current.zoom;
              setViewport((v) => ({ ...v, x: sr.width / 2 - worldX * z, y: sr.height / 2 - worldY * z }));
            }}
          >
            <svg width={mmW} height={mmH}>
              {edges.map((edge) => {
                const from = nodeMap.get(edge.from);
                const to = nodeMap.get(edge.to);
                if (!from || !to) return null;
                const x1 = ox + (from.x + BLOCK_W / 2) * scale;
                const y1 = oy + (from.y + BLOCK_H / 2) * scale;
                const x2 = ox + (to.x + BLOCK_W / 2) * scale;
                const y2 = oy + (to.y + BLOCK_H / 2) * scale;
                return <line key={edge.id} x1={x1} y1={y1} x2={x2} y2={y2} className="minimap-edge" />;
              })}
              {nodes.map((node) => {
                const nx = ox + node.x * scale;
                const ny = oy + node.y * scale;
                const nw = BLOCK_W * scale;
                const nh = BLOCK_H * scale;
                return (
                  <rect
                    key={node.id} x={nx} y={ny} width={nw} height={nh} rx={2}
                    className={node.id === selectedId ? 'minimap-node is-selected' : 'minimap-node'}
                    onClick={(ev) => { ev.stopPropagation(); setSelectedId(node.id); }}
                  />
                );
              })}
            </svg>
          </div>
        );
      })() : null}
    </div>
  );
}
