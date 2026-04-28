import { ChevronsUpDown, FileText, GitBranch, GitBranchPlus, Image, Link2, Trash2, Unlink, X } from 'lucide-react';
import { useCallback, useMemo, useRef } from 'react';
import { useBrainStore } from '../../store/useBrainStore';
import type { MindNodeData } from '../../domain/types';
import { fileToDataUrl } from '../canvas/fileUtils';

const toneOptions: Array<{ value: MindNodeData['tone']; label: string }> = [
  { value: 'teal', label: 'Teal' },
  { value: 'amber', label: 'Amber' },
  { value: 'rose', label: 'Rose' },
  { value: 'violet', label: 'Violet' },
  { value: 'lime', label: 'Lime' },
  { value: 'sky', label: 'Sky' },
];

export function MapInspector() {
  const map = useBrainStore((s) => s.vault.maps[0]);
  const selectedMapNodeId = useBrainStore((s) => s.selectedMapNodeId);
  const addMindNode = useBrainStore((s) => s.addMindNode);
  const updateMindNode = useBrainStore((s) => s.updateMindNode);
  const deleteMindNode = useBrainStore((s) => s.deleteMindNode);
  const updateMapEdges = useBrainStore((s) => s.updateMapEdges);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedNode = useMemo(
    () => map?.nodes.find((n) => n.id === selectedMapNodeId) ?? map?.nodes[0],
    [map?.nodes, selectedMapNodeId],
  );

  const hasChildren = useMemo(
    () => map.edges.some((e) => e.source === selectedNode?.id),
    [map.edges, selectedNode?.id],
  );
  const hasParentEdge = useMemo(
    () => map.edges.some((e) => e.target === selectedNode?.id),
    [map.edges, selectedNode?.id],
  );

  const handleFileAttach = useCallback(async (file: File) => {
    if (!selectedNode) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      const type = file.type.startsWith('image/') ? 'image' as const
        : file.type === 'application/pdf' ? 'pdf' as const
        : file.type.startsWith('audio/') ? 'audio' as const
        : file.type.startsWith('video/') ? 'video' as const
        : 'document' as const;
      updateMindNode(selectedNode.id, {
        attachment: { type, name: file.name, dataUrl, mimeType: file.type },
      });
    } catch { /* silently fail */ }
  }, [selectedNode, updateMindNode]);

  if (!map || !selectedNode) return null;

  const isRootNode = map.nodes[0]?.id === selectedNode.id;

  return (
    <section className="side-panel-card">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,audio/*,video/*,.doc,.docx,.txt,.md"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFileAttach(f);
          e.target.value = '';
        }}
      />

      <div className="side-panel-header">
        <div>
          <h3>Selected node</h3>
          <p>Edit node details below</p>
        </div>
      </div>

      <div className="inspector-stack">
        <label className="inspector-field">
          <span>Title</span>
          <input
            type="text"
            value={selectedNode.data.label}
            onChange={(e) => updateMindNode(selectedNode.id, { label: e.target.value })}
            placeholder="Node title"
          />
        </label>

        <label className="inspector-field">
          <span>Summary</span>
          <textarea
            value={selectedNode.data.summary ?? ''}
            onChange={(e) => updateMindNode(selectedNode.id, { summary: e.target.value })}
            placeholder="Describe this idea, task, or branch"
          />
        </label>

        <div className="tone-grid" role="group" aria-label="Node color">
          {toneOptions.map((tone) => (
            <button
              key={tone.value}
              className={selectedNode.data.tone === tone.value ? 'tone-chip is-active' : 'tone-chip'}
              type="button"
              onClick={() => updateMindNode(selectedNode.id, { tone: tone.value })}
            >
              <span className={`tone-dot tone-${tone.value}`} />
              <span>{tone.label}</span>
            </button>
          ))}
        </div>

        <div className="inspector-actions">
          <button type="button" onClick={() => addMindNode('New idea', 'Add details, links, or branch it further.')}>
            <GitBranchPlus size={14} />
            <span>Add child</span>
          </button>
          <button type="button" disabled={isRootNode} onClick={() => addMindNode('New idea', 'Add details, links, or branch it further.', undefined, 'sibling')}>
            <GitBranch size={14} />
            <span>Add sibling</span>
          </button>
          <button type="button" disabled={!hasChildren} onClick={() => updateMindNode(selectedNode.id, { collapsed: !selectedNode.data.collapsed })}>
            <ChevronsUpDown size={14} />
            <span>{selectedNode.data.collapsed ? 'Expand' : 'Collapse'}</span>
          </button>

          <button type="button" onClick={() => fileInputRef.current?.click()}>
            <Image size={14} />
            <span>Attach file</span>
          </button>
          <button className="is-danger" type="button" disabled={isRootNode} onClick={() => deleteMindNode(selectedNode.id)}>
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>

        {selectedNode.data.attachment ? (
          <div className="node-attachment-preview" style={{ marginTop: 0, position: 'relative' }}>
            {selectedNode.data.attachment.type === 'image' ? (
              <img src={selectedNode.data.attachment.dataUrl} alt={selectedNode.data.attachment.name} style={{ height: '100px' }} />
            ) : (
              <div className="node-attachment-file">
                <span>{selectedNode.data.attachment.name}</span>
              </div>
            )}
            <button
              className="attachment-delete-btn"
              type="button"
              title="Remove attachment"
              onClick={() => updateMindNode(selectedNode.id, { attachment: undefined })}
            >
              <X size={12} />
            </button>
          </div>
        ) : null}

        {hasParentEdge ? (
          <button
            className="linked-note-row"
            type="button"
            style={{ color: 'var(--rose)' }}
            onClick={() => {
              const updatedEdges = map.edges.filter((e) => e.target !== selectedNode.id);
              updateMapEdges(map.id, updatedEdges);
            }}
          >
            <Unlink size={14} />
            <span>Disconnect from parent</span>
          </button>
        ) : null}


      </div>
    </section>
  );
}
