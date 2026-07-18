const DEFAULT_SKEW_MS = 5 * 60 * 1000;

export function isAccessTokenCacheValid(expiresAt: string | null | undefined, nowMs = Date.now(), skewMs = DEFAULT_SKEW_MS) {
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry - nowMs > skewMs;
}

export function isNewerTokenExpiry(candidate: string, current: string | null | undefined) {
  const candidateMs = Date.parse(candidate);
  const currentMs = current ? Date.parse(current) : Number.NEGATIVE_INFINITY;
  return Number.isFinite(candidateMs) && candidateMs > currentMs;
}

export class SingleFlight<T> {
  private readonly inFlight = new Map<string, Promise<T>>();

  run(key: string, task: () => Promise<T>) {
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const promise = task().finally(() => {
      if (this.inFlight.get(key) === promise) this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }
}
