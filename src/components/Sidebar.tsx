import { BarChart3, CalendarDays, FileText, GitBranch, ListChecks, Network, Search, Settings } from 'lucide-react';
import clsx from 'clsx';
import type { WorkspaceView } from '../domain/types';
import { useBrainStore } from '../store/useBrainStore';
import logoUrl from '../ic_launcher.png';

const navItems: Array<{ id: WorkspaceView; label: string; icon: typeof Network }> = [
  { id: 'map', label: 'Map', icon: Network },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'graph', label: 'Graph', icon: GitBranch },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
];

export function Sidebar() {
  const activeView = useBrainStore((state) => state.activeView);
  const setActiveView = useBrainStore((state) => state.setActiveView);
  const openCommandPalette = useBrainStore((state) => state.openCommandPalette);

  return (
    <aside className="sidebar">
      <div className="brand-mark">
        <img src={logoUrl} alt="Mind Map" />
      </div>
      <nav className="sidebar-nav" aria-label="Workspace">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={clsx('icon-button sidebar-button', activeView === item.id && 'is-active')}
              key={item.id}
              type="button"
              title={item.label}
              aria-label={item.label}
              onClick={() => setActiveView(item.id)}
            >
              <Icon size={20} />
            </button>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <button className="icon-button sidebar-button" type="button" title="Search" aria-label="Search" onClick={openCommandPalette}>
          <Search size={20} />
        </button>
        <button className="icon-button sidebar-button" type="button" title="Calendar" aria-label="Calendar">
          <CalendarDays size={20} />
        </button>
        <button className="icon-button sidebar-button" type="button" title="Settings" aria-label="Settings">
          <Settings size={20} />
        </button>
      </div>
    </aside>
  );
}
