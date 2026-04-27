import { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { CommandPalette } from './components/CommandPalette';
import { SettingsDialog } from './components/SettingsDialog';
import { useBrainStore } from './store/useBrainStore';

const localVaultKey = 'mind-map:vault';
const localChatSettingsKey = 'mind-map:chat-settings';

export default function App() {
  const isCommandPaletteOpen = useBrainStore((state) => state.isCommandPaletteOpen);
  const isSettingsOpen = useBrainStore((state) => state.isSettingsOpen);
  const vault = useBrainStore((state) => state.vault);
  const chatSettings = useBrainStore((state) => state.chatSettings);
  const setVault = useBrainStore((state) => state.setVault);
  const setChatSettings = useBrainStore((state) => state.setChatSettings);
  const toggleCommandPalette = useBrainStore((state) => state.toggleCommandPalette);
  const closeCommandPalette = useBrainStore((state) => state.closeCommandPalette);
  const closeSettings = useBrainStore((state) => state.closeSettings);
  const [hasHydrated, setHasHydrated] = useState(false);

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
    if (!hasHydrated) {
      return;
    }

    localStorage.setItem(localVaultKey, JSON.stringify(vault));
  }, [hasHydrated, vault]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    localStorage.setItem(localChatSettingsKey, JSON.stringify(chatSettings));
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
    function onKeyDown(event: KeyboardEvent) {
      const isPaletteShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (isPaletteShortcut) {
        event.preventDefault();
        toggleCommandPalette();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleCommandPalette]);

  return (
    <>
      <AppShell />
      {isCommandPaletteOpen ? <CommandPalette onClose={closeCommandPalette} /> : null}
      {isSettingsOpen ? <SettingsDialog onClose={closeSettings} /> : null}
    </>
  );
}
