import { lazy, Suspense } from 'react';
import { AssistantPanel } from '../components/AssistantPanel';
import { FlowchartCanvas } from '../components/canvas/FlowchartCanvas';
import { MindMapCanvas } from '../components/canvas/MindMapCanvas';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { useBrainStore } from '../store/useBrainStore';


export function AppShell() {
  const activeView = useBrainStore((state) => state.activeView);

  return (
    <main className={`app-shell view-${activeView}`}>
      <Sidebar />
      <section className="workspace">
        <Topbar />
        <div className="workspace-grid">
          <section className="primary-pane">
            {activeView === 'map' ? <MindMapCanvas /> : null}
            {activeView === 'flowchart' ? <FlowchartCanvas /> : null}
          </section>
          <AssistantPanel />
        </div>
      </section>
    </main>
  );
}
