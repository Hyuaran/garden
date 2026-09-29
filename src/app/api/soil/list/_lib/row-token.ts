import crypto from "node:crypto";

export const ROW_TOKEN_MAX_AGE_MS = 12 * 60 * 60 * 1000;

let cachedKey: Buffer | null = null;

function deriveRowTokenKey(secret: string): Buffer {
  return Buffer.from(crypto.hkdfSync("sha256", Buffer.from(secret), "soil-list-row-token", "v1", 32));
}

function getRowTokenKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  }
  cachedKey = deriveRowTokenKey(secret);
  return cachedKey;
}

export function issueRowToken(phone: string, now = Date.now()): string {
  return issueRowTokenWithKey(phone, getRowTokenKey(), now);
}

export function readRowToken(token: string, now = Date.now()): string | null {
  return readRowTokenWithKey(token, getRowTokenKey(), now);
}

export function issueRowTokenWithKey(phone: string, key: Buffer, now = Date.now()): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify({ p: phone, t: now }), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("base64url");
}

export function readRowTokenWithKey(token: string, key: Buffer, now = Date.now()): string | null {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length <= 12 + 16) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(raw.length - 16);
    const encrypted = raw.subarray(12, raw.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    const payload = JSON.parse(plaintext) as { p?: unknown; t?: unknown };
    if (typeof payload.p !== "string" || !/^\d+$/.test(payload.p)) return null;
    if (typeof payload.t !== "number" || !Number.isFinite(payload.t)) return null;
    if (now - payload.t > ROW_TOKEN_MAX_AGE_MS) return null;
    return payload.p;
  } catch {
    return null;
  }
}
