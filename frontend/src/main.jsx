import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'

if (Capacitor.isNativePlatform()) {
  CapacitorApp.addListener('appUrlOpen', ({ url }) => {
    if (!url.startsWith('mathify://oauth/callback')) return;
    const callback = new URL(url.replace('mathify://', 'https://oauth.invalid/'));
    window.history.replaceState({}, '', `/oauth/callback${callback.search}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is an enhancement; the app remains usable online.
    });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
