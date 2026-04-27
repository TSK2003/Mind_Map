import { FileText, Network } from 'lucide-react';
import { useMemo } from 'react';
import { useBrainStore } from '../store/useBrainStore';
import { MapInspector } from './MapInspector';

export function WorkspacePanel() {
  const activeView = useBrainStore((state) => state.activeView);
  const vault = useBrainStore((state) => state.vault);
  const selectedPageId = useBrainStore((state) => state.selectedPageId);
  const selectedPage = useMemo(
    () => vault.pages.find((page) => page.id === selectedPageId) ?? vault.pages[0],
    [selectedPageId, vault.pages],
  );
  const linkedNodeCount = useMemo(
    () => vault.maps.flatMap((map) => map.nodes).filter((node) => node.data.noteId === selectedPage?.id).length,
    [selectedPage?.id, vault.maps],
  );

  return (
    <aside className="assistant-panel">
      <div className="assistant-header">
        <div className="assistant-avatar">
          {activeView === 'map' ? <Network size={20} /> : <FileText size={20} />}
        </div>
        <div>
          <h2>{activeView === 'map' ? 'Map Details' : 'Note Details'}</h2>
          <p>{activeView === 'map' ? 'Edit the selected node and map structure.' : 'Review the selected note and linked map context.'}</p>
        </div>
      </div>

      {activeView === 'map' ? (
        <>
          <MapInspector />
          <section className="side-panel-card">
            <div className="side-panel-header">
              <div>
                <h3>Map shortcuts</h3>
                <p>Use the keyboard to move faster while building the map.</p>
              </div>
            </div>
            <div className="shortcut-list">
              <span>`Tab` add child node</span>
              <span>`Shift + Tab` add sibling node</span>
              <span>`Delete` remove selected node</span>
              <span>Trackpad scroll pans the canvas</span>
              <span>Pinch or `Ctrl + wheel` zooms the canvas</span>
              <span>Double-click canvas to add at cursor</span>
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
