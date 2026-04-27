import { lazy, Suspense } from 'react';
import { AssistantPanel } from './AssistantPanel';
import { MindMapCanvas } from './MindMapCanvas';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useBrainStore } from '../store/useBrainStore';

const GraphPreview = lazy(async () => ({ default: (await import('./GraphPreview')).GraphPreview }));
const NotesWorkspace = lazy(async () => ({ default: (await import('./NotesWorkspace')).NotesWorkspace }));
const ProductivityDashboard = lazy(async () => ({ default: (await import('./ProductivityDashboard')).ProductivityDashboard }));

export function AppShell() {
  const activeView = useBrainStore((state) => state.activeView);

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="workspace">
        <Topbar />
        <div className="workspace-grid">
          <section className="primary-pane">
            {activeView === 'map' ? <MindMapCanvas /> : null}
            {activeView === 'notes' ? (
              <Suspense fallback={<div className="view-loading">Loading notes workspace...</div>}>
                <NotesWorkspace />
              </Suspense>
            ) : null}
            {activeView === 'graph' ? (
              <Suspense fallback={<div className="view-loading">Loading graph workspace...</div>}>
                <GraphPreview />
              </Suspense>
            ) : null}
            {activeView === 'tasks' || activeView === 'dashboard' ? (
              <Suspense fallback={<div className="view-loading">Loading dashboard...</div>}>
                <ProductivityDashboard />
              </Suspense>
            ) : null}
          </section>
          <AssistantPanel />
        </div>
      </section>
    </main>
  );
}
