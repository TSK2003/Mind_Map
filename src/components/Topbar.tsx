import { FolderOpen, Moon, Save, Settings2, Sparkles, Sun } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getProviderLabel } from '../domain/chat';
import { getDesktopApi } from '../services/desktop';
import { useBrainStore } from '../store/useBrainStore';
import logoUrl from '../ic_launcher.png';

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
  const chatSettings = useBrainStore((state) => state.chatSettings);
  const vaultPath = useBrainStore((state) => state.vaultPath);
  const setVault = useBrainStore((state) => state.setVault);
  const updateSettings = useBrainStore((state) => state.updateSettings);
  const openSettings = useBrainStore((state) => state.openSettings);
  const [status, setStatus] = useState(vaultPath ? 'Vault connected' : 'Local workspace');
  const updatedAt = useMemo(() => formatRelativeTime(vault.updatedAt), [vault.updatedAt]);

  useEffect(() => {
    setStatus(vaultPath ? 'Vault connected' : 'Local workspace');
  }, [vaultPath]);

  async function openVault() {
    const desktopApi = getDesktopApi();

    if (!desktopApi) {
      setStatus('Desktop bridge unavailable');
      return;
    }

    try {
      const result = await desktopApi.openVault();
      if (result) {
        setVault(result.vault, result.path);
        setStatus('Vault opened');
      }
    } catch {
      setStatus('Open failed');
    }
  }

  async function saveVault() {
    const desktopApi = getDesktopApi();

    if (!desktopApi) {
      localStorage.setItem('mind-map:vault', JSON.stringify(vault));
      setStatus('Saved in browser storage');
      return;
    }

    try {
      const result = vaultPath
        ? await desktopApi.saveVault(vaultPath, vault)
        : await desktopApi.saveVaultAs(vault);

      if (result) {
        setVault(result.vault, result.path);
        setStatus('Vault saved');
      }
    } catch {
      setStatus('Save failed');
    }
  }

  function toggleTheme() {
    updateSettings({
      theme: vault.settings.theme === 'dark' ? 'light' : 'dark',
    });
  }

  return (
    <header className="topbar">
      <div className="vault-title">
        <div className="vault-icon">
          <img src={logoUrl} alt="Mind Map" />
        </div>
        <div>
          <h1>{vault.name}</h1>
          <p>{status} - updated {updatedAt}</p>
        </div>
      </div>
      <div className="topbar-actions">
        <div className="ai-chip">
          <Sparkles size={15} />
          <span>{getProviderLabel(chatSettings.provider)}</span>
        </div>
        <button className="icon-button" type="button" title="Open vault" aria-label="Open vault" onClick={openVault}>
          <FolderOpen size={18} />
        </button>
        <button className="icon-button" type="button" title="Save vault" aria-label="Save vault" onClick={saveVault}>
          <Save size={18} />
        </button>
        <button className="icon-button" type="button" title="Settings" aria-label="Settings" onClick={openSettings}>
          <Settings2 size={18} />
        </button>
        <button className="icon-button" type="button" title="Toggle theme" aria-label="Toggle theme" onClick={toggleTheme}>
          {vault.settings.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}
