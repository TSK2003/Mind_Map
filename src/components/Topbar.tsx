import { Database, FolderOpen, Moon, Save, Sparkles, Sun } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useBrainStore } from '../store/useBrainStore';

function formatRelativeTime(date: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function Topbar() {
  const vault = useBrainStore((state) => state.vault);
  const vaultPath = useBrainStore((state) => state.vaultPath);
  const setVault = useBrainStore((state) => state.setVault);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [status, setStatus] = useState('Local-first vault');
  const updatedAt = useMemo(() => formatRelativeTime(vault.updatedAt), [vault.updatedAt]);

  async function openVault() {
    if (!window.secondBrain) {
      setStatus('Desktop bridge unavailable');
      return;
    }

    const result = await window.secondBrain.openVault();
    if (result) {
      setVault(result.vault, result.path);
      setStatus('Vault opened');
    }
  }

  async function saveVault() {
    if (!window.secondBrain) {
      localStorage.setItem('second-brain-os:vault', JSON.stringify(vault));
      setStatus('Saved in browser storage');
      return;
    }

    const result = vaultPath
      ? await window.secondBrain.saveVault(vaultPath, vault)
      : await window.secondBrain.saveVaultAs(vault);

    if (result) {
      setVault(result.vault, result.path);
      setStatus('Vault saved');
    }
  }

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }

  return (
    <header className="topbar">
      <div className="vault-title">
        <div className="vault-icon">
          <Database size={18} />
        </div>
        <div>
          <h1>{vault.name}</h1>
          <p>{status} - updated {updatedAt}</p>
        </div>
      </div>
      <div className="topbar-actions">
        <div className="ai-chip">
          <Sparkles size={15} />
          <span>{vault.settings.aiProvider === 'local' ? 'Local AI' : 'AI'}</span>
        </div>
        <button className="icon-button" type="button" title="Open vault" aria-label="Open vault" onClick={openVault}>
          <FolderOpen size={18} />
        </button>
        <button className="icon-button" type="button" title="Save vault" aria-label="Save vault" onClick={saveVault}>
          <Save size={18} />
        </button>
        <button className="icon-button" type="button" title="Toggle theme" aria-label="Toggle theme" onClick={toggleTheme}>
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  );
}

