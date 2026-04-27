import { AssistantPanel } from './AssistantPanel';
import { GraphPreview } from './GraphPreview';
import { MindMapCanvas } from './MindMapCanvas';
import { NotesWorkspace } from './NotesWorkspace';
import { ProductivityDashboard } from './ProductivityDashboard';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useBrainStore } from '../store/useBrainStore';

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
            {activeView === 'notes' ? <NotesWorkspace /> : null}
            {activeView === 'graph' ? <GraphPreview /> : null}
            {activeView === 'tasks' || activeView === 'dashboard' ? <ProductivityDashboard /> : null}
          </section>
          <AssistantPanel />
        </div>
      </section>
    </main>
  );
}

