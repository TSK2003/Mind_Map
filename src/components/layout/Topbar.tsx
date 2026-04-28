import { Download, FolderOpen, Moon, Save, Settings2, Sun } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import logoUrl from '../../assets/ic_launcher.png';
import { getDesktopApi } from '../../services/desktop';
import { useBrainStore } from '../../store/useBrainStore';

const localVaultKey = 'mindmap:vault';

function formatRelativeTime(date: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function getViewLabel(view: ReturnType<typeof useBrainStore.getState>['activeView']) {
  if (view === 'flowchart') {
    return 'Flowchart';
  }

  return 'Mind Map';
}

export function Topbar() {
  const activeView = useBrainStore((state) => state.activeView);
  const vault = useBrainStore((state) => state.vault);
  const vaultPath = useBrainStore((state) => state.vaultPath);
  const setVault = useBrainStore((state) => state.setVault);
  const updateSettings = useBrainStore((state) => state.updateSettings);
  const openSettings = useBrainStore((state) => state.openSettings);

  const [status, setStatus] = useState(vaultPath ? 'Vault connected' : 'Local workspace');

  const updatedAt = useMemo(() => formatRelativeTime(vault.updatedAt), [vault.updatedAt]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDesktop = Boolean(getDesktopApi());

  useEffect(() => {
    setStatus(vaultPath ? 'Vault connected' : 'Local workspace');
  }, [vaultPath]);

  async function openVault() {
    const api = getDesktopApi();
    if (api) {
      try {
        const result = await api.openVault();
        if (result) {
          setVault(result.vault, result.path);
          setStatus('Vault opened');
        }
      } catch {
        setStatus('Open failed');
      }
    } else {
      fileInputRef.current?.click();
    }
  }

  function handleFileImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (data && typeof data === 'object' && 'name' in data) {
          setVault(data as typeof vault);
          setStatus(`Imported: ${(data as { name: string }).name}`);
        } else {
          setStatus('Invalid vault file');
        }
      } catch {
        setStatus('Import failed - invalid JSON');
      }
    };

    reader.readAsText(file);
    event.target.value = '';
  }

  function exportVault() {
    const json = JSON.stringify(vault, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${vault.name.replace(/\s+/g, '-').toLowerCase()}.brain`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus('File exported');
  }

  async function saveVault() {
    const api = getDesktopApi();
    if (!api) {
      localStorage.setItem(localVaultKey, JSON.stringify(vault));
      setStatus('Saved in browser storage');
      return;
    }

    try {
      const result = vaultPath ? await api.saveVault(vaultPath, vault) : await api.saveVaultAs(vault);
      if (result) {
        setVault(result.vault, result.path);
        setStatus('Vault saved');
      }
    } catch {
      setStatus('Save failed');
    }
  }

  function toggleTheme() {
    updateSettings({ theme: vault.settings.theme === 'dark' ? 'light' : 'dark' });
  }

  return (
    <header className="topbar">
      <div className="vault-title">
        <div className="vault-icon">
          <img src={logoUrl} alt="Mind Map" />
        </div>
        <div>
          <h1>{vault.name}</h1>
          <p>{getViewLabel(activeView)} - {status} - {updatedAt}</p>
        </div>
      </div>
      <div className="topbar-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept=".brain,.json"
          style={{ display: 'none' }}
          onChange={handleFileImport}
        />
        <button className="icon-button" type="button" title={isDesktop ? 'Open vault' : 'Import vault file'} aria-label="Open vault" onClick={openVault}>
          <FolderOpen size={17} />
        </button>
        <button className="icon-button" type="button" title="Save vault" aria-label="Save vault" onClick={saveVault}>
          <Save size={17} />
        </button>
        <button className="icon-button" type="button" title="Export as .brain file" aria-label="Export file" onClick={exportVault}>
          <Download size={17} />
        </button>
        <span className="topbar-divider" />
        <button className="icon-button" type="button" title="Settings" aria-label="Settings" onClick={openSettings}>
          <Settings2 size={17} />
        </button>
        <button className="icon-button" type="button" title="Toggle theme" aria-label="Toggle theme" onClick={toggleTheme}>
          {vault.settings.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  );
}
