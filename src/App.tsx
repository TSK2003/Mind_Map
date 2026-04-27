import { useEffect } from 'react';
import { AppShell } from './components/AppShell';
import { CommandPalette } from './components/CommandPalette';
import { useBrainStore } from './store/useBrainStore';

export default function App() {
  const isCommandPaletteOpen = useBrainStore((state) => state.isCommandPaletteOpen);
  const toggleCommandPalette = useBrainStore((state) => state.toggleCommandPalette);
  const closeCommandPalette = useBrainStore((state) => state.closeCommandPalette);

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

