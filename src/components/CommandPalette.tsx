import { Command, FileText, GitBranch, ListChecks, Network, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { WorkspaceView } from '../domain/types';
import { useBrainStore } from '../store/useBrainStore';

const commands: Array<{ label: string; view: WorkspaceView; icon: typeof Search }> = [
  { label: 'Open mind map', view: 'map', icon: Network },
  { label: 'Open notes', view: 'notes', icon: FileText },
  { label: 'Open graph', view: 'graph', icon: GitBranch },
  { label: 'Open tasks', view: 'tasks', icon: ListChecks },
  { label: 'Open dashboard', view: 'dashboard', icon: Sparkles },
];

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const pages = useBrainStore((state) => state.vault.pages);
  const setActiveView = useBrainStore((state) => state.setActiveView);
  const setSelectedPage = useBrainStore((state) => state.setSelectedPage);
  const filteredCommands = useMemo(
    () => commands.filter((command) => command.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const filteredPages = useMemo(
    () =>
      pages
        .filter((page) => `${page.title} ${page.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8),
    [pages, query],
  );

  return (
    <div className="palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="command-palette" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="palette-input">
          <Command size={18} />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Command or search" />
        </div>
        <div className="palette-results">
          {filteredCommands.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setActiveView(item.view);
                  onClose();
                }}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
          {filteredPages.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => {
                setSelectedPage(page.id);
                onClose();
              }}
            >
              <FileText size={17} />
              <span>{page.title}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
