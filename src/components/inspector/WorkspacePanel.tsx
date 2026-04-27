import { FileText, Network } from 'lucide-react';
import { useMemo } from 'react';
import { useBrainStore } from '../../store/useBrainStore';
import { MapInspector } from './MapInspector';

export function WorkspacePanel() {
  const activeView = useBrainStore((s) => s.activeView);
  const vault = useBrainStore((s) => s.vault);
  const selectedPageId = useBrainStore((s) => s.selectedPageId);
  const selectedPage = useMemo(
    () => vault.pages.find((p) => p.id === selectedPageId) ?? vault.pages[0],
    [selectedPageId, vault.pages],
  );
  const linkedNodeCount = useMemo(
    () => vault.maps.flatMap((m) => m.nodes).filter((n) => n.data.noteId === selectedPage?.id).length,
    [selectedPage?.id, vault.maps],
  );

  return (
    <aside className="assistant-panel">
      <div className="assistant-header">
        <div className="assistant-avatar">
          {activeView === 'map' ? <Network size={18} /> : <FileText size={18} />}
        </div>
        <div>
          <h2>{activeView === 'map' ? 'Map Details' : 'Note Details'}</h2>
          <p>{activeView === 'map' ? 'Edit the selected node and map structure.' : 'Review the selected note.'}</p>
        </div>
      </div>

      {activeView === 'map' ? (
        <>
          <MapInspector />
          <section className="side-panel-card">
            <div className="side-panel-header">
              <div>
                <h3>Keyboard shortcuts</h3>
                <p>Move faster while building the map.</p>
              </div>
            </div>
            <div className="shortcut-list">
              <span><strong>Tab</strong> — add child node</span>
              <span><strong>Shift+Tab</strong> — add sibling node</span>
              <span><strong>Delete</strong> — remove selected node</span>
              <span><strong>Scroll</strong> — pan the canvas</span>
              <span><strong>Ctrl+Scroll</strong> — zoom</span>
              <span><strong>Double-click</strong> — add node at cursor</span>
            </div>
          </section>
        </>
      ) : (
        <section className="side-panel-card">
          <div className="side-panel-header">
            <div>
              <h3>{selectedPage?.title ?? 'Untitled note'}</h3>
              <p>{linkedNodeCount} linked map node{linkedNodeCount === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="workspace-metrics">
            <div className="workspace-metric">
              <strong>{vault.pages.length}</strong>
              <span>Notes</span>
            </div>
            <div className="workspace-metric">
              <strong>{vault.maps[0]?.nodes.length ?? 0}</strong>
              <span>Nodes</span>
            </div>
          </div>
          <div className="shortcut-list">
            <span>Rename the note title to update linked node titles.</span>
            <span>Changes auto-save locally after brief idle time.</span>
          </div>
        </section>
      )}
    </aside>
  );
}
