export const SUBSCRIPTION_RENEW_WINDOW_MS = 24 * 60 * 60 * 1000;

export function shouldRenewSubscription(expiresAt: string | null | undefined, now = Date.now()) {
  if (!expiresAt) return true;
  const expiry = Date.parse(expiresAt);
  return !Number.isFinite(expiry) || expiry - now <= SUBSCRIPTION_RENEW_WINDOW_MS;
}

export function notificationIsNew(lastSeen: string | null, notifiedAt: string | null) {
  if (!notifiedAt) return false;
  if (!lastSeen) return true;
  return Date.parse(notifiedAt) > Date.parse(lastSeen);
}

export function isPublicNotificationOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
  } catch { return false; }
}

export type ChangeNotification = { subscriptionId?: string; clientState?: string };

export function validateClientStates(notifications: ChangeNotification[], states: Map<string, string>) {
  return notifications.length > 0 && notifications.every((item) => Boolean(item.subscriptionId) && states.get(item.subscriptionId!) === item.clientState);
}

export function validationTokenResponse(token: string | null) {
  return token === null ? null : new Response(token, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export const acceptedNotificationResponse = () => new Response(null, { status: 202 });
