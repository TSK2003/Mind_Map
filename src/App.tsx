import { lazy, Suspense, useEffect, useState } from 'react';
import { AppShell } from './app/AppShell';
import appIconUrl from './assets/ic_launcher.png';
import { getDesktopApi } from './services/desktop';
import { useBrainStore } from './store/useBrainStore';

const localVaultKey = 'mindmap:vault';
const localChatSettingsKey = 'mindmap:chat-settings';
const appTitle = 'Aescion Mapping App';
const localVaultPersistenceDelayMs = 700;
const desktopAutosaveDelayMs = 1500;
const localSettingsPersistenceDelayMs = 250;

const CommandPalette = lazy(async () => ({
  default: (await import('./components/dialogs/CommandPalette')).CommandPalette,
}));
const SettingsDialog = lazy(async () => ({
  default: (await import('./components/dialogs/SettingsDialog')).SettingsDialog,
}));

export default function App() {
  const activeView = useBrainStore((s) => s.activeView);
  const isCommandPaletteOpen = useBrainStore((s) => s.isCommandPaletteOpen);
  const isSettingsOpen = useBrainStore((s) => s.isSettingsOpen);
  const vault = useBrainStore((s) => s.vault);
  const chatSettings = useBrainStore((s) => s.chatSettings);
  const vaultPath = useBrainStore((s) => s.vaultPath);
  const setVault = useBrainStore((s) => s.setVault);
  const setChatSettings = useBrainStore((s) => s.setChatSettings);
  const selectedMapNodeId = useBrainStore((s) => s.selectedMapNodeId);
  const addMindNode = useBrainStore((s) => s.addMindNode);
  const deleteMindNode = useBrainStore((s) => s.deleteMindNode);
  const toggleCommandPalette = useBrainStore((s) => s.toggleCommandPalette);
  const closeCommandPalette = useBrainStore((s) => s.closeCommandPalette);
  const closeSettings = useBrainStore((s) => s.closeSettings);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Set document title and icon
  useEffect(() => {
    document.title = appTitle;
    let iconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!iconLink) {
      iconLink = document.createElement('link');
      iconLink.rel = 'icon';
      document.head.appendChild(iconLink);
    }
    iconLink.type = 'image/png';
    iconLink.href = appIconUrl;
  }, []);

  // Hydrate vault and chat settings from localStorage
  useEffect(() => {
    const savedVault = localStorage.getItem(localVaultKey);
    if (savedVault) {
      try { setVault(JSON.parse(savedVault)); } catch { localStorage.removeItem(localVaultKey); }
    }
    const savedChat = localStorage.getItem(localChatSettingsKey);
    if (savedChat) {
      try { setChatSettings(JSON.parse(savedChat)); } catch { localStorage.removeItem(localChatSettingsKey); }
    }
    setHasHydrated(true);
  }, [setChatSettings, setVault]);

  // Warn before closing browser tab (non-Electron)
  useEffect(() => {
    if (!hasHydrated) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasHydrated]);

  // Persist vault to localStorage
  useEffect(() => {
    if (!hasHydrated || vaultPath) return;
    const id = window.setTimeout(() => localStorage.setItem(localVaultKey, JSON.stringify(vault)), localVaultPersistenceDelayMs);
    return () => window.clearTimeout(id);
  }, [hasHydrated, vault, vaultPath]);

  // Persist vault to desktop file
  useEffect(() => {
    if (!hasHydrated || !vaultPath) return;
    const api = getDesktopApi();
    if (!api) return;
    const id = window.setTimeout(() => {
      void api.saveVault(vaultPath, vault).catch(() => { /* silent */ });
    }, desktopAutosaveDelayMs);
    return () => window.clearTimeout(id);
  }, [hasHydrated, vault, vaultPath]);

  // Persist chat settings
  useEffect(() => {
    if (!hasHydrated) return;
    const id = window.setTimeout(() => localStorage.setItem(localChatSettingsKey, JSON.stringify(chatSettings)), localSettingsPersistenceDelayMs);
    return () => window.clearTimeout(id);
  }, [chatSettings, hasHydrated]);

  // Apply theme
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const t = vault.settings.theme === 'system' ? (mq.matches ? 'dark' : 'light') : vault.settings.theme;
      document.documentElement.dataset.theme = t;
    };
    apply();
    if (vault.settings.theme !== 'system') return;
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [vault.settings.theme]);

  // Keyboard shortcuts
  useEffect(() => {
    function isEditable(target: EventTarget | null) {
      const el = target as HTMLElement | null;
      return el ? Boolean(el.closest('input, textarea, [contenteditable="true"]')) : false;
    }
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }
      if (isEditable(e.target)) return;
      if (activeView === 'map' && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        addMindNode('New idea', 'Add details, links, or branch it further.', undefined, 'sibling');
        return;
      }
      if (activeView === 'map' && e.key === 'Tab') {
        e.preventDefault();
        addMindNode('New idea', 'Add details, links, or branch it further.');
        return;
      }
      if (activeView === 'map' && selectedMapNodeId && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        deleteMindNode(selectedMapNodeId);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeView, addMindNode, deleteMindNode, selectedMapNodeId, toggleCommandPalette]);

  return (
    <>
      <AppShell />
      {isCommandPaletteOpen ? (
        <Suspense fallback={null}>
          <CommandPalette onClose={closeCommandPalette} />
        </Suspense>
      ) : null}
      {isSettingsOpen ? (
        <Suspense fallback={null}>
          <SettingsDialog onClose={closeSettings} />
        </Suspense>
      ) : null}
    </>
  );
}
