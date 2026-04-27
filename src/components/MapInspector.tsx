import { ChevronsUpDown, FileText, GitBranchPlus, Link2, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useBrainStore } from '../store/useBrainStore';
import type { MindNodeData } from '../domain/types';

const toneOptions: Array<{ value: MindNodeData['tone']; label: string }> = [
  { value: 'teal', label: 'Teal' },
  { value: 'amber', label: 'Amber' },
  { value: 'rose', label: 'Rose' },
  { value: 'violet', label: 'Violet' },
  { value: 'lime', label: 'Lime' },
  { value: 'sky', label: 'Sky' },
];

export function MapInspector() {
  const map = useBrainStore((state) => state.vault.maps[0]);
  const pages = useBrainStore((state) => state.vault.pages);
  const selectedMapNodeId = useBrainStore((state) => state.selectedMapNodeId);
  const setSelectedPage = useBrainStore((state) => state.setSelectedPage);
  const addMindNode = useBrainStore((state) => state.addMindNode);
  const updateMindNode = useBrainStore((state) => state.updateMindNode);
  const deleteMindNode = useBrainStore((state) => state.deleteMindNode);
  const createPageFromNode = useBrainStore((state) => state.createPageFromNode);

  const selectedNode = useMemo(
    () => map?.nodes.find((node) => node.id === selectedMapNodeId) ?? map?.nodes[0],
    [map?.nodes, selectedMapNodeId],
  );
  const linkedPage = useMemo(
    () => pages.find((page) => page.id === selectedNode?.data.noteId),
    [pages, selectedNode?.data.noteId],
  );
  const hasChildren = useMemo(() => map.edges.some((edge) => edge.source === selectedNode?.id), [map.edges, selectedNode?.id]);

  if (!map || !selectedNode) {
    return null;
  }

  const isRootNode = map.nodes[0]?.id === selectedNode.id;

  return (
    <section className="side-panel-card">
      <div className="side-panel-header">
        <div>
          <h3>Selected node</h3>
          <p>{linkedPage ? `Linked to ${linkedPage.title}` : 'No note linked yet'}</p>
        </div>
      </div>

      <div className="inspector-stack">
        <label className="inspector-field">
          <span>Title</span>
          <input
            type="text"
            value={selectedNode.data.label}
            onChange={(event) => updateMindNode(selectedNode.id, { label: event.target.value })}
            placeholder="Node title"
          />
        </label>

        <label className="inspector-field">
          <span>Summary</span>
          <textarea
            value={selectedNode.data.summary ?? ''}
            onChange={(event) => updateMindNode(selectedNode.id, { summary: event.target.value })}
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
            <GitBranchPlus size={16} />
            <span>Add child</span>
          </button>
          <button
            type="button"
            disabled={!hasChildren}
            onClick={() => updateMindNode(selectedNode.id, { collapsed: !selectedNode.data.collapsed })}
          >
            <ChevronsUpDown size={16} />
            <span>{selectedNode.data.collapsed ? 'Expand branch' : 'Collapse branch'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const pageId = createPageFromNode(selectedNode.id);
              if (pageId) {
                setSelectedPage(pageId);
              }
            }}
          >
            <FileText size={16} />
            <span>{linkedPage ? 'Open note' : 'Create note'}</span>
          </button>
          <button type="button" disabled={isRootNode} onClick={() => deleteMindNode(selectedNode.id)}>
            <Trash2 size={16} />
            <span>Delete</span>
          </button>
        </div>

        {linkedPage ? (
          <button className="linked-note-row" type="button" onClick={() => setSelectedPage(linkedPage.id)}>
            <Link2 size={16} />
            <span>{linkedPage.title}</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
