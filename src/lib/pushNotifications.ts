import { requestNotificationPermission, onForegroundMessage } from './firebase';

const ADMIN_TOKENS_KEY = 'tripleone_admin_tokens';

export function saveAdminToken(token: string): void {
  const tokens = getAdminTokens();
  if (!tokens.includes(token)) {
    tokens.push(token);
    localStorage.setItem(ADMIN_TOKENS_KEY, JSON.stringify(tokens));
  }
}

export function getAdminTokens(): string[] {
  try {
    const tokens = localStorage.getItem(ADMIN_TOKENS_KEY);
    return tokens ? JSON.parse(tokens) : [];
  } catch {
    return [];
  }
}

export function removeAdminToken(token: string): void {
  const tokens = getAdminTokens().filter(t => t !== token);
  localStorage.setItem(ADMIN_TOKENS_KEY, JSON.stringify(tokens));
}

export async function subscribeAdminToNotifications(): Promise<string | null> {
  const token = await requestNotificationPermission();
  if (token) {
    saveAdminToken(token);
  }
  return token;
}

export async function sendPushToAdmin(title: string, body: string, data?: Record<string, string>): Promise<boolean> {
  const tokens = getAdminTokens();
  
  if (tokens.length === 0) {
    console.warn('No admin tokens registered');
    showLocalNotification(title, body);
    return false;
  }

  try {
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokens,
        notification: { title, body },
        data
      })
    });

    if (!response.ok) {
      throw new Error('Failed to send notification');
    }
    
    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    showLocalNotification(title, body);
    return false;
  }
}

function showLocalNotification(title: string, body: string): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/icon-192x192.png',
      vibrate: [100, 50, 100]
    });
  }
}

export function setupForegroundNotifications(callback?: (payload: unknown) => void): () => void {
  return onForegroundMessage((payload) => {
    console.log('Foreground message received:', payload);
    callback?.(payload);
  });
}
