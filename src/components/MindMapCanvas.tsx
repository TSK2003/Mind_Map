import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  addEdge,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import { ChevronDown, Link2, Maximize2, Plus, WandSparkles } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MindMapEdge, MindMapNode, MindNodeData } from '../domain/types';
import { useBrainStore } from '../store/useBrainStore';

function BrainNode({ data }: { data: MindNodeData }) {
  return (
    <div className={`brain-node tone-${data.tone}`}>
      <Handle className="brain-handle brain-handle-target" type="target" position={Position.Left} />
      <div className="brain-node-header">
        <span>{data.label}</span>
        <ChevronDown size={14} />
      </div>
      {data.summary ? <p>{data.summary}</p> : null}
      {data.noteId ? (
        <div className="node-link">
          <Link2 size={13} />
          <span>Linked note</span>
        </div>
      ) : null}
      <Handle className="brain-handle brain-handle-source" type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  brainNode: memo(BrainNode),
};

export function MindMapCanvas() {
  const map = useBrainStore((state) => state.vault.maps[0]);
  const vaultLoadVersion = useBrainStore((state) => state.vaultLoadVersion);
  const selectedMapNodeId = useBrainStore((state) => state.selectedMapNodeId);
  const setSelectedPage = useBrainStore((state) => state.setSelectedPage);
  const setSelectedMapNode = useBrainStore((state) => state.setSelectedMapNode);
  const addMindNode = useBrainStore((state) => state.addMindNode);
  const expandActiveMap = useBrainStore((state) => state.expandActiveMap);
  const updateMapNodes = useBrainStore((state) => state.updateMapNodes);
  const updateMapEdges = useBrainStore((state) => state.updateMapEdges);
  const [flow, setFlow] = useState<ReactFlowInstance<Node<MindNodeData>, Edge> | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const pendingFocusNodeIdRef = useRef<string | null>(null);
  const lastAutoFitVersionRef = useRef<number | null>(null);
  const visibleNodeIds = useMemo(() => {
    const nodesById = new Map(map.nodes.map((node) => [node.id, node]));
    const incomingCount = new Map<string, number>();
    const outgoingBySource = new Map<string, string[]>();

    map.edges.forEach((edge) => {
      incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
      const existingTargets = outgoingBySource.get(edge.source) ?? [];
      existingTargets.push(edge.target);
      outgoingBySource.set(edge.source, existingTargets);
    });

    const roots = map.nodes.filter((node) => (incomingCount.get(node.id) ?? 0) === 0);
    const visitQueue = roots.length > 0 ? roots.map((node) => node.id) : map.nodes.slice(0, 1).map((node) => node.id);
    const visible = new Set<string>();

    while (visitQueue.length > 0) {
      const currentNodeId = visitQueue.shift();
      if (!currentNodeId || visible.has(currentNodeId)) {
        continue;
      }

      visible.add(currentNodeId);
      const currentNode = nodesById.get(currentNodeId);
      if (currentNode?.data.collapsed) {
        continue;
      }

      (outgoingBySource.get(currentNodeId) ?? []).forEach((targetId) => {
        if (!visible.has(targetId)) {
          visitQueue.push(targetId);
        }
      });
    }

    map.nodes.forEach((node) => {
      if (!incomingCount.has(node.id) && !visible.has(node.id)) {
        visible.add(node.id);
      }
    });

    return visible;
  }, [map.edges, map.nodes]);
  const selectedNodeLabel = useMemo(
    () => map.nodes.find((node) => node.id === selectedMapNodeId)?.data.label ?? 'Current idea',
    [map.nodes, selectedMapNodeId],
  );
  const nodes = useMemo<Node<MindNodeData>[]>(
    () =>
      map.nodes
        .filter((node) => visibleNodeIds.has(node.id))
        .map((node) => ({
          ...node,
          data: node.data,
        })),
    [map.nodes, visibleNodeIds],
  );
  const edges = useMemo<Edge[]>(
    () =>
      map.edges
        .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
        .map((edge) => ({
          ...edge,
          markerEnd: undefined,
        })),
    [map.edges, visibleNodeIds],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<MindNodeData>>[]) => {
      const changedNodeIds = new Set(changes.flatMap((change) => ('id' in change ? [change.id] : [])));
      const removedNodeIds = new Set(changes.flatMap((change) => (change.type === 'remove' ? [change.id] : [])));
      const nextVisibleNodes = applyNodeChanges(changes, nodes).map(
        (node) =>
          ({
            id: node.id,
            type: node.type,
            selected: node.selected,
            position: node.position,
            data: node.data,
          }) satisfies MindMapNode,
      );
      const nextVisibleNodeMap = new Map(nextVisibleNodes.map((node) => [node.id, node]));
      const nextNodes = map.nodes
        .filter((node) => !removedNodeIds.has(node.id))
        .map((node) => {
          if (!changedNodeIds.has(node.id)) {
            return node;
          }

          return nextVisibleNodeMap.get(node.id) ?? node;
        });
      updateMapNodes(map.id, nextNodes);
    },
    [map.id, map.nodes, nodes, updateMapNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const changedEdgeIds = new Set(changes.flatMap((change) => ('id' in change ? [change.id] : [])));
      const removedEdgeIds = new Set(changes.flatMap((change) => (change.type === 'remove' ? [change.id] : [])));
      const nextVisibleEdges = applyEdgeChanges(changes, edges).map(
        (edge) =>
          ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: typeof edge.label === 'string' ? edge.label : undefined,
            type: edge.type,
            animated: edge.animated,
          }) satisfies MindMapEdge,
      );
      const nextVisibleEdgeMap = new Map(nextVisibleEdges.map((edge) => [edge.id, edge]));
      const nextEdges = map.edges
        .filter((edge) => !removedEdgeIds.has(edge.id))
        .map((edge) => {
          if (!changedEdgeIds.has(edge.id)) {
            return edge;
          }

          return nextVisibleEdgeMap.get(edge.id) ?? edge;
        });
      updateMapEdges(map.id, nextEdges);
    },
    [edges, map.edges, map.id, updateMapEdges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const nextEdges = addEdge({ ...connection, id: `edge-${Date.now()}`, type: 'smoothstep' }, edges).map(
        (edge) =>
          ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: typeof edge.label === 'string' ? edge.label : undefined,
            type: edge.type,
            animated: edge.animated,
          }) satisfies MindMapEdge,
      );
      updateMapEdges(map.id, nextEdges);
    },
    [edges, map.id, updateMapEdges],
  );

  useEffect(() => {
    if (!flow || nodes.length === 0 || !flow.viewportInitialized) {
      return;
    }

    if (lastAutoFitVersionRef.current === vaultLoadVersion) {
      return;
    }

    lastAutoFitVersionRef.current = vaultLoadVersion;
    const timeoutId = window.setTimeout(() => {
      void flow.fitView({
        padding: 0.22,
        duration: 280,
        maxZoom: 1.05,
      });
    }, 50);

    return () => window.clearTimeout(timeoutId);
  }, [flow, nodes.length, vaultLoadVersion]);

  const focusNode = useCallback(
    (nodeId: string) => {
      if (!flow) {
        pendingFocusNodeIdRef.current = nodeId;
        return;
      }

      const focusAttempt = (attempt = 0) => {
        requestAnimationFrame(() => {
          const node = flow.getNode(nodeId);
          if (!node) {
            if (attempt < 6) {
              focusAttempt(attempt + 1);
            }
            return;
          }

          flow.setCenter(node.position.x + 105, node.position.y + 54, {
            duration: 380,
            zoom: Math.max(flow.getZoom(), 0.88),
          });
        });
      };

      focusAttempt();
    },
    [flow],
  );

  useEffect(() => {
    if (!flow || !flow.viewportInitialized || !pendingFocusNodeIdRef.current) {
      return;
    }

    const nodeId = pendingFocusNodeIdRef.current;
    pendingFocusNodeIdRef.current = null;
    focusNode(nodeId);
  }, [flow, focusNode, nodes.length]);

  const addNodeAtPosition = useCallback(
    (position?: { x: number; y: number }) => {
      const nextNodeId = addMindNode('New idea', 'Add details, links, or branch it further.', position);
      pendingFocusNodeIdRef.current = nextNodeId;
      focusNode(nextNodeId);
    },
    [addMindNode, focusNode],
  );

  const handleAddNode = useCallback(() => {
    const rect = shellRef.current?.getBoundingClientRect();
    const centerPosition =
      flow && rect
        ? flow.screenToFlowPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          })
        : undefined;
    addNodeAtPosition(centerPosition);
  }, [addNodeAtPosition, flow]);

  return (
    <div className="canvas-shell" ref={shellRef}>
      <div className="canvas-toolbar" aria-label="Mind map tools">
        <button type="button" title="Add node" aria-label="Add node" onClick={handleAddNode}>
          <Plus size={17} />
          <span>Node</span>
        </button>
        <button type="button" title="AI expand" aria-label="AI expand" onClick={() => expandActiveMap(selectedNodeLabel)}>
          <WandSparkles size={17} />
          <span>Expand</span>
        </button>
        <button type="button" title="Fit canvas" aria-label="Fit canvas" onClick={() => flow?.fitView({ padding: 0.25, duration: 500 })}>
          <Maximize2 size={17} />
          <span>Fit</span>
        </button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setFlow}
        onPaneClick={(event) => {
          setSelectedMapNode(undefined);
          const position = flow?.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });

          if (!position) {
            return;
          }

          if (event.detail >= 2) {
            addNodeAtPosition(position);
          }
        }}
        onSelectionChange={({ nodes: selectedNodes }) => {
          setSelectedMapNode(selectedNodes[0]?.id);
        }}
        onNodeClick={(_, node) => {
          setSelectedMapNode(node.id);
        }}
        onNodeDoubleClick={(_, node) => {
          const noteId = (node.data as MindNodeData).noteId;
          if (noteId) {
            setSelectedPage(noteId);
          }
        }}
        fitView
        minZoom={0.18}
        maxZoom={2}
        zoomOnDoubleClick={false}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeStrokeWidth={3} />
      </ReactFlow>
    </div>
  );
}
