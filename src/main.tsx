import { createRoot } from 'react-dom/client';
import App from "./App.tsx";
import "./index.css";

if (typeof window !== "undefined") {
  const sendToParent = (data: any) => {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(data, "*");
      }
    } catch {}
  };

  window.addEventListener("error", (event) => {
    console.log("[Runtime Error]", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });

    // Send structured payload to parent iframe
    sendToParent({
      type: "ERROR_CAPTURED",
      error: {
        message: event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        source: "window.onerror",
      },
      timestamp: Date.now(),
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.log("[Unhandled Promise Rejection]", event.reason);

    const reason: any = event.reason;
    const message =
      typeof reason === "object" && reason?.message
        ? String(reason.message)
        : String(reason);
    const stack = typeof reason === "object" ? reason?.stack : undefined;

    // Mirror to parent iframe as well
    sendToParent({
      type: "ERROR_CAPTURED",
      error: {
        message,
        stack,
        filename: undefined,
        lineno: undefined,
        colno: undefined,
        source: "unhandledrejection",
      },
      timestamp: Date.now(),
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for PWA and offline functionality
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