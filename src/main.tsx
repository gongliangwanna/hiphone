import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

// Android Chromium: ask the virtual keyboard to overlay content rather than
// resize the layout viewport, matching iOS Safari. Without this, opening the
// keyboard shrinks innerHeight / 100dvh while the device shell stays frozen
// at its pre-keyboard size, creating a layout mismatch with black bars.
const vk = (navigator as Navigator & { virtualKeyboard?: { overlaysContent: boolean } }).virtualKeyboard;
if (vk) {
  vk.overlaysContent = true;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
