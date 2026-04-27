import { lazy, Suspense } from 'react';
import { MindMapCanvas } from '../components/canvas/MindMapCanvas';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { useBrainStore } from '../store/useBrainStore';
import { WorkspacePanel } from '../components/inspector/WorkspacePanel';

const NotesWorkspace = lazy(async () => ({
  default: (await import('../components/editor/NotesWorkspace')).NotesWorkspace,
}));

export function AppShell() {
  const activeView = useBrainStore((s) => s.activeView);

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="workspace">
        <Topbar />
        <div className="workspace-grid">
          <section className="primary-pane">
            {activeView === 'map' ? <MindMapCanvas /> : null}
            {activeView === 'notes' ? (
              <Suspense fallback={<div className="view-loading">Loading notes workspace…</div>}>
                <NotesWorkspace />
              </Suspense>
            ) : null}
          </section>
          <WorkspacePanel />
        </div>
      </section>
    </main>
  );
}
