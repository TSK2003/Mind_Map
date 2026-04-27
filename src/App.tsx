import { lazy, Suspense, useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import appIconUrl from './ic_launcher.png';
import { getDesktopApi } from './services/desktop';
import { useBrainStore } from './store/useBrainStore';

const localVaultKey = 'mind-map:vault';
const localChatSettingsKey = 'mind-map:chat-settings';
const appTitle = 'Second Brain OS';
const localVaultPersistenceDelayMs = 700;
const desktopAutosaveDelayMs = 1500;
const localSettingsPersistenceDelayMs = 250;
const CommandPalette = lazy(async () => ({ default: (await import('./components/CommandPalette')).CommandPalette }));
const SettingsDialog = lazy(async () => ({ default: (await import('./components/SettingsDialog')).SettingsDialog }));

export default function App() {
  const activeView = useBrainStore((state) => state.activeView);
  const isCommandPaletteOpen = useBrainStore((state) => state.isCommandPaletteOpen);
  const isSettingsOpen = useBrainStore((state) => state.isSettingsOpen);
  const vault = useBrainStore((state) => state.vault);
  const chatSettings = useBrainStore((state) => state.chatSettings);
  const vaultPath = useBrainStore((state) => state.vaultPath);
  const setVault = useBrainStore((state) => state.setVault);
  const setChatSettings = useBrainStore((state) => state.setChatSettings);
  const selectedMapNodeId = useBrainStore((state) => state.selectedMapNodeId);
  const addMindNode = useBrainStore((state) => state.addMindNode);
  const deleteMindNode = useBrainStore((state) => state.deleteMindNode);
  const toggleCommandPalette = useBrainStore((state) => state.toggleCommandPalette);
  const closeCommandPalette = useBrainStore((state) => state.closeCommandPalette);
  const closeSettings = useBrainStore((state) => state.closeSettings);
  const [hasHydrated, setHasHydrated] = useState(false);

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

  useEffect(() => {
    const savedVault = localStorage.getItem(localVaultKey);
    if (savedVault) {
      try {
        setVault(JSON.parse(savedVault));
      } catch {
        localStorage.removeItem(localVaultKey);
      }
    }
    const savedChatSettings = localStorage.getItem(localChatSettingsKey);
    if (savedChatSettings) {
      try {
        setChatSettings(JSON.parse(savedChatSettings));
      } catch {
        localStorage.removeItem(localChatSettingsKey);
      }
    }
    setHasHydrated(true);
  }, [setChatSettings, setVault]);

  useEffect(() => {
    if (!hasHydrated || vaultPath) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      localStorage.setItem(localVaultKey, JSON.stringify(vault));
    }, localVaultPersistenceDelayMs);

    return () => window.clearTimeout(timeoutId);
  }, [hasHydrated, vault, vaultPath]);

  useEffect(() => {
    if (!hasHydrated || !vaultPath) {
      return;
    }

    const desktopApi = getDesktopApi();
    if (!desktopApi) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void desktopApi.saveVault(vaultPath, vault).catch(() => {
        // Keep the UI responsive even if autosave fails; manual save remains available.
      });
    }, desktopAutosaveDelayMs);

    return () => window.clearTimeout(timeoutId);
  }, [hasHydrated, vault, vaultPath]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      localStorage.setItem(localChatSettingsKey, JSON.stringify(chatSettings));
    }, localSettingsPersistenceDelayMs);

    return () => window.clearTimeout(timeoutId);
  }, [chatSettings, hasHydrated]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const resolvedTheme = vault.settings.theme === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : vault.settings.theme;
      document.documentElement.dataset.theme = resolvedTheme;
    };

    applyTheme();

    if (vault.settings.theme !== 'system') {
      return;
    }

    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [vault.settings.theme]);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      const element = target as HTMLElement | null;
      if (!element) {
        return false;
      }

      return Boolean(element.closest('input, textarea, [contenteditable="true"]'));
    }

    function onKeyDown(event: KeyboardEvent) {
      const isPaletteShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (isPaletteShortcut) {
        event.preventDefault();
        toggleCommandPalette();
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (activeView === 'map' && event.key === 'Tab') {
        event.preventDefault();
        addMindNode('New idea', 'Add details, links, or branch it further.');
        return;
      }

      if (activeView === 'map' && selectedMapNodeId && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
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
