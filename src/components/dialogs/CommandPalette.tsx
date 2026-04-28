import { Command, FileText, Network, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { WorkspaceView } from '../../domain/types';
import { useBrainStore } from '../../store/useBrainStore';

const commands: Array<{ label: string; view: WorkspaceView; icon: typeof Search }> = [
  { label: 'Open mind map', view: 'map', icon: Network },
];

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const setActiveView = useBrainStore((s) => s.setActiveView);

  const filteredCommands = useMemo(
    () => commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  );


  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="command-palette" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <Command size={16} />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search commands or pages…" />
        </div>
        <div className="palette-results">
          {filteredCommands.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.label} type="button" onClick={() => { setActiveView(item.view); onClose(); }}>
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}

        </div>
      </section>
    </div>
  );
}
