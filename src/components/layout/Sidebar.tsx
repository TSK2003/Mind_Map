import { FileText, Network, Search, Settings } from 'lucide-react';
import clsx from 'clsx';
import type { WorkspaceView } from '../../domain/types';
import { useBrainStore } from '../../store/useBrainStore';
import logoUrl from '../../assets/ic_launcher.png';

const navItems: Array<{ id: WorkspaceView; label: string; icon: typeof Network }> = [
  { id: 'map', label: 'Mind Map', icon: Network },
  { id: 'notes', label: 'Notes', icon: FileText },
];

export function Sidebar() {
  const activeView = useBrainStore((s) => s.activeView);
  const setActiveView = useBrainStore((s) => s.setActiveView);
  const openCommandPalette = useBrainStore((s) => s.openCommandPalette);
  const openSettings = useBrainStore((s) => s.openSettings);

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
        <button className="icon-button sidebar-button" type="button" title="Search (Ctrl+K)" aria-label="Search" onClick={openCommandPalette}>
          <Search size={20} />
        </button>
        <button className="icon-button sidebar-button" type="button" title="Settings" aria-label="Settings" onClick={openSettings}>
          <Settings size={20} />
        </button>
      </div>
    </aside>
  );
}
