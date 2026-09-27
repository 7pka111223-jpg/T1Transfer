import { createRoot } from 'react-dom/client';
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register the service worker (offline fallback page for the PWA). The file
// name is historical; installed apps already point at it, so keep it.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);
        console.log('Service Worker state:', registration.active?.state);

        // Force update if needed
        registration.update();

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          console.log('Service Worker update found');
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              console.log('Service Worker state changed to:', newWorker.state);
            });
          }
        });
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
} else {
  console.log('Service Worker not supported');
}