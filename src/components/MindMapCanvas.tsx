import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
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
import { memo, useCallback, useMemo, useState } from 'react';
import type { MindMapEdge, MindMapNode, MindNodeData } from '../domain/types';
import { useBrainStore } from '../store/useBrainStore';

function BrainNode({ data }: { data: MindNodeData }) {
  return (
    <div className={`brain-node tone-${data.tone}`}>
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
    </div>
  );
}

const nodeTypes = {
  brainNode: memo(BrainNode),
};

export function MindMapCanvas() {
  const map = useBrainStore((state) => state.vault.maps[0]);
  const setSelectedPage = useBrainStore((state) => state.setSelectedPage);
  const addMindNode = useBrainStore((state) => state.addMindNode);
  const expandActiveMap = useBrainStore((state) => state.expandActiveMap);
  const updateMapNodes = useBrainStore((state) => state.updateMapNodes);
  const updateMapEdges = useBrainStore((state) => state.updateMapEdges);
  const [flow, setFlow] = useState<ReactFlowInstance<Node<MindNodeData>, Edge> | null>(null);
  const nodes = useMemo<Node<MindNodeData>[]>(
    () =>
      map.nodes.map((node) => ({
        ...node,
        data: node.data,
      })),
    [map.nodes],
  );
  const edges = useMemo<Edge[]>(
    () =>
      map.edges.map((edge) => ({
        ...edge,
        markerEnd: undefined,
      })),
    [map.edges],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<MindNodeData>>[]) => {
      const nextNodes = applyNodeChanges(changes, nodes).map(
        (node) =>
          ({
            id: node.id,
            type: node.type,
            position: node.position,
            data: node.data,
          }) satisfies MindMapNode,
      );
      updateMapNodes(map.id, nextNodes);
    },
    [map.id, nodes, updateMapNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const nextEdges = applyEdgeChanges(changes, edges).map(
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

  return (
    <div className="canvas-shell">
      <div className="canvas-toolbar" aria-label="Mind map tools">
        <button type="button" title="Add node" aria-label="Add node" onClick={() => addMindNode()}>
          <Plus size={17} />
          <span>Node</span>
        </button>
        <button type="button" title="AI expand" aria-label="AI expand" onClick={() => expandActiveMap('Current idea')}>
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
        onNodeDoubleClick={(_, node) => {
          const noteId = (node.data as MindNodeData).noteId;
          if (noteId) {
            setSelectedPage(noteId);
          }
        }}
        fitView
        minZoom={0.18}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeStrokeWidth={3} />
      </ReactFlow>
    </div>
  );
}
