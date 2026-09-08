export const ADMIN_SESSION_CHANGED_EVENT = 'atehna-admin-session-settings-changed';
const ACTIVITY_THROTTLE_MS = 30_000;
const USER_ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'input'] as const;

export function startAdminSessionActivityTracking() {
  let disposed = false;
  let redirecting = false;
  let lastActivityRequestAt = -Infinity;
  let requestSequence = 0;
  let lastAppliedRequest = 0;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();

  const redirectToLogin = () => {
    if (disposed || redirecting) return;
    redirecting = true;
    window.location.replace('/admin');
  };

  const updateExpiry = (expiresAt: unknown, atExpiry = false) => {
    if (disposed || typeof expiresAt !== 'string') return;
    const deadline = Date.parse(expiresAt);
    if (!Number.isFinite(deadline)) return;
    if (expiryTimer !== undefined) clearTimeout(expiryTimer);
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      // A delayed response may describe a deadline another request has renewed.
      if (atExpiry) redirectToLogin();
      else void readSession(true);
      return;
    }
    // The expiry check is read-only: another active tab may have renewed this session.
    expiryTimer = setTimeout(() => void readSession(true), Math.min(remaining, 2_147_483_647));
  };

  async function readSession(atExpiry = false) {
    const sequence = ++requestSequence;
    try {
      const response = await fetch('/api/admin/session', {
        cache: 'no-store', signal: controller.signal
      });
      if (disposed || sequence < lastAppliedRequest) return;
      if (response.status === 401) { redirectToLogin(); return; }
      if (!response.ok) { if (atExpiry) redirectToLogin(); return; }
      const payload = await response.json() as { expiresAt?: unknown };
      if (disposed || sequence < lastAppliedRequest) return;
      lastAppliedRequest = sequence;
      updateExpiry(payload.expiresAt, atExpiry);
    } catch {
      if (atExpiry && sequence >= lastAppliedRequest) redirectToLogin();
    }
  }

  async function reportActivity() {
    const sequence = ++requestSequence;
    try {
      const response = await fetch('/api/admin/session/activity', {
        method: 'POST', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-Admin-Activity': '1' },
        body: '{}'
      });
      if (disposed || sequence < lastAppliedRequest) return;
      if (response.status === 401) { redirectToLogin(); return; }
      if (!response.ok) return;
      const payload = await response.json() as { expiresAt?: unknown };
      if (disposed || sequence < lastAppliedRequest) return;
      lastAppliedRequest = sequence;
      updateExpiry(payload.expiresAt);
    } catch {
      // Failed requests do not extend the last confirmed session deadline.
    }
  }

  const handleActivity = (event: Event) => {
    if (disposed || redirecting || !event.isTrusted || document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (now - lastActivityRequestAt < ACTIVITY_THROTTLE_MS) return;
    lastActivityRequestAt = now;
    void reportActivity();
  };
  const refreshPolicyDeadline = () => void readSession();
  for (const event of USER_ACTIVITY_EVENTS) {
    document.addEventListener(event, handleActivity, { capture: true, passive: true });
  }
  window.addEventListener(ADMIN_SESSION_CHANGED_EVENT, refreshPolicyDeadline);
  void readSession();

  return () => {
    disposed = true;
    controller.abort();
    if (expiryTimer !== undefined) clearTimeout(expiryTimer);
    for (const event of USER_ACTIVITY_EVENTS) {
      document.removeEventListener(event, handleActivity, true);
    }
    window.removeEventListener(ADMIN_SESSION_CHANGED_EVENT, refreshPolicyDeadline);
  };
}
