/**
 * Native notification abstraction layer.
 *
 * - Web: uses the browser Notification API
 */

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

interface NativeNotificationOptions {
  id?: number;
  ongoing?: boolean;
}

/** Get the current native notification permission status. */
export async function getNotificationPermission(): Promise<NotificationPermissionStatus> {
  return getWebPermission();
}

/** Request native notification permission. Returns the resulting status. */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  return requestWebPermission();
}

/** Send a native notification. */
export async function sendNativeNotification(title: string, body: string, options: NativeNotificationOptions = {}): Promise<void> {
  return sendWebNotification(title, body);
}

// ---------------------------------------------------------------------------
// Web (browser Notification API)
// ---------------------------------------------------------------------------

function getWebPermission(): NotificationPermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return mapWebStatus(Notification.permission);
}

async function requestWebPermission(): Promise<NotificationPermissionStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const result = await Notification.requestPermission();
  return mapWebStatus(result);
}

function sendWebNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Notification API not available');
  }
  if (Notification.permission !== 'granted') {
    throw new Error(`Notification permission is "${Notification.permission}", not "granted"`);
  }
  try {
    const n = new Notification(title, { body, icon: '/favicon.ico' });
    n.onerror = () => {
      console.warn('[NativeNotification] browser notification error event');
    };
  } catch (err) {
    throw new Error(`Failed to create Notification: ${err instanceof Error ? err.message : err}`);
  }
}

function mapWebStatus(permission: NotificationPermission): NotificationPermissionStatus {
  switch (permission) {
    case 'granted': return 'granted';
    case 'denied': return 'denied';
    default: return 'default';
  }
}
