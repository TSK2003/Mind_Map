import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

/* CSS imports — order matters, loaded by Vite bundler */
import './styles/index.css';
import './styles/layout.css';
import './styles/canvas.css';
import './styles/editor.css';
import './styles/dialogs.css';
import './styles/animations.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
