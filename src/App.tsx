import { useEffect } from 'react';
import { AppShell } from './components/AppShell';
import { CommandPalette } from './components/CommandPalette';
import { useBrainStore } from './store/useBrainStore';

const localVaultKey = 'mind-map:vault';

export default function App() {
  const isCommandPaletteOpen = useBrainStore((state) => state.isCommandPaletteOpen);
  const vault = useBrainStore((state) => state.vault);
  const setVault = useBrainStore((state) => state.setVault);
  const toggleCommandPalette = useBrainStore((state) => state.toggleCommandPalette);
  const closeCommandPalette = useBrainStore((state) => state.closeCommandPalette);

  useEffect(() => {
    const savedVault = localStorage.getItem(localVaultKey);
    if (savedVault) {
      try {
        setVault(JSON.parse(savedVault));
      } catch {
        localStorage.removeItem(localVaultKey);
      }
    }
  }, [setVault]);

  useEffect(() => {
    localStorage.setItem(localVaultKey, JSON.stringify(vault));
  }, [vault]);

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
    </>
  );
}
