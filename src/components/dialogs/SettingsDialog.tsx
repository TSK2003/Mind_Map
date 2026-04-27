import clsx from 'clsx';
import { Monitor, Moon, Settings2, Sun } from 'lucide-react';
import { useEffect } from 'react';
import type { BrainVault } from '../../domain/types';
import { useBrainStore } from '../../store/useBrainStore';

const themeOptions: Array<{ value: BrainVault['settings']['theme']; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const theme = useBrainStore((s) => s.vault.settings.theme);
  const updateSettings = useBrainStore((s) => s.updateSettings);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="settings-panel" role="dialog" aria-modal="true" aria-label="Settings" onMouseDown={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div className="settings-title">
            <Settings2 size={18} />
            <div>
              <h2>Workspace Settings</h2>
              <p>Configure appearance and workspace preferences.</p>
            </div>
          </div>
          <button className="settings-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <section className="settings-group">
          <div className="settings-group-heading">
            <span>Appearance</span>
            <strong>{theme}</strong>
          </div>
          <div className="segmented-control" role="group" aria-label="Theme">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  className={clsx('settings-option', theme === option.value && 'is-active')}
                  type="button"
                  onClick={() => updateSettings({ theme: option.value })}
                >
                  <Icon size={16} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </section>
    </div>
  );
}
