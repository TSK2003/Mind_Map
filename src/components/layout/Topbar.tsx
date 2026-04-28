import { Download, FolderOpen, Moon, Save, Settings2, Sun, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getDesktopApi } from '../../services/desktop';
import { useBrainStore } from '../../store/useBrainStore';
import logoUrl from '../../assets/ic_launcher.png';

const localVaultKey = 'mindmap:vault';

function formatRelativeTime(date: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function Topbar() {
  const vault = useBrainStore((s) => s.vault);
  const vaultPath = useBrainStore((s) => s.vaultPath);
  const setVault = useBrainStore((s) => s.setVault);
  const updateSettings = useBrainStore((s) => s.updateSettings);
  const openSettings = useBrainStore((s) => s.openSettings);
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
        if (result) { setVault(result.vault, result.path); setStatus('Vault opened'); }
      } catch { setStatus('Open failed'); }
    } else {
      // Browser mode: trigger file input
      fileInputRef.current?.click();
    }
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (data && typeof data === 'object' && data.name) {
          setVault(data);
          setStatus(`Imported: ${data.name}`);
        } else {
          setStatus('Invalid vault file');
        }
      } catch { setStatus('Import failed — invalid JSON'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function exportVault() {
    const json = JSON.stringify(vault, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${vault.name.replace(/\s+/g, '-').toLowerCase()}.brain`;
    a.click();
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
      const result = vaultPath
        ? await api.saveVault(vaultPath, vault)
        : await api.saveVaultAs(vault);
      if (result) { setVault(result.vault, result.path); setStatus('Vault saved'); }
    } catch { setStatus('Save failed'); }
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
          <p>{status} · {updatedAt}</p>
        </div>
      </div>
      <div className="topbar-actions">
        {/* Hidden file input for browser import */}
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

