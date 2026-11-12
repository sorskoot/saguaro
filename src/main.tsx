import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { registerServiceWorker } from './pwa';
import { initDataStore } from './services/db/DataStore';

function requestNotificationPermission(): void {
    if (typeof window === 'undefined' || typeof Notification === 'undefined')
        return;
    if (Notification.permission === 'default') {
        void Notification.requestPermission();
    }
}

// Load everything from IndexedDB before the first render so hooks can read it synchronously.
void initDataStore().then(() => {
    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
});

registerServiceWorker();
requestNotificationPermission();
