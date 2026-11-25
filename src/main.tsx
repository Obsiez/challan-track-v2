import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import './index.css';

// Disable default browser contextmenu (desktop right-click menu & mobile long-press callout)
// while allowing native editable inputs and custom in-app press-and-hold gestures to operate
if (typeof window !== 'undefined') {
  window.addEventListener('contextmenu', (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    const isEditable = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
    if (!isEditable) {
      e.preventDefault();
    }
  });
}

// Register Service Worker for reliable cross-device PWA installability (WebAPK on Pixel/Android & offline shell)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
 <StrictMode>
 <ErrorBoundary>
 <App />
 </ErrorBoundary>
 </StrictMode>,
);
