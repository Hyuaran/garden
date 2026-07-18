import type { SupabaseClient, User } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "./token-crypto";
import { isAccessTokenCacheValid, SingleFlight, tokenHasScope } from "./token-cache";
import { mergeMessages } from "./format";
import { RillMailHttpError } from "./server-auth";
import type { RillMailAttachment, RillMailBox, RillMailDetail, RillMailMessage, RillMessagesResponse } from "./types";
import { isMailState, isPersonalMailbox, replaceMailState, toggleOwnConfirmation, type MailState, type MailWriteOperation } from "./write-ops";

const GRAPH = "https://graph.microsoft.com/v1.0";
const MESSAGE_SELECT = "id,subject,from,toRecipients,receivedDateTime,hasAttachments,isRead,flag,categories,bodyPreview";
const DELEGATED_SCOPES = "openid profile offline_access User.Read Mail.ReadWrite Mail.ReadWrite.Shared MailboxSettings.ReadWrite";
const REQUIRED_SETTINGS_SCOPE = "MailboxSettings.ReadWrite";

type TokenRow = {
  refresh_token_enc: string;
  access_token_enc: string | null;
  access_token_expires_at: string | null;
  ms_upn: string | null;
};
type GraphList<T> = { value?: T[]; "@odata.nextLink"?: string };
type GraphAddress = { emailAddress?: { name?: string; address?: string } };
type GraphMessage = {
  id: string; subject?: string; from?: GraphAddress; toRecipients?: GraphAddress[];
  receivedDateTime?: string; hasAttachments?: boolean; isRead?: boolean;
  flag?: RillMailMessage["flag"]; categories?: string[]; bodyPreview?: string;
  body?: { contentType?: string; content?: string };
};
type Cursor = Record<string, string | null>;
type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

class MicrosoftTokenError extends Error {
  constructor(public code: string | undefined, message: string) { super(message); }
}

const refreshFlights = new SingleFlight<{ token: string; upn: string | null }>();

function config() {
  const tenantId = process.env.MS_GRAPH_TENANT_ID;
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) throw new RillMailHttpError(503, "Microsoft Graph is not configured");
  return { tenantId, clientId, clientSecret };
}

function callbackUrl(requestUrl: string) {
  return new URL("/api/rill/mail/auth/callback", requestUrl).toString();
}

export function authorizeUrl(requestUrl: string, state: string) {
  const c = config();
  const params = new URLSearchParams({ client_id: c.clientId, response_type: "code", redirect_uri: callbackUrl(requestUrl), response_mode: "query", scope: DELEGATED_SCOPES, state });
  return `https://login.microsoftonline.com/${encodeURIComponent(c.tenantId)}/oauth2/v2.0/authorize?${params}`;
}

async function tokenRequest(params: URLSearchParams) {
  const c = config();
  params.set("client_id", c.clientId);
  params.set("client_secret", c.clientSecret);
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(c.tenantId)}/oauth2/v2.0/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, cache: "no-store" });
  const json = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!response.ok || !json.access_token) throw new MicrosoftTokenError(json.error, json.error_description ?? "Microsoft token exchange failed");
  return { access_token: json.access_token, refresh_token: json.refresh_token, expires_in: json.expires_in ?? 3600 } satisfies TokenResponse;
}

export async function exchangeCode(code: string, requestUrl: string) {
  try {
    return await tokenRequest(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: callbackUrl(requestUrl), scope: DELEGATED_SCOPES }));
  } catch (error) {
    throw new RillMailHttpError(502, error instanceof Error ? error.message : "Microsoft token exchange failed");
  }
}

async function accessToken(supabase: SupabaseClient, user: User) {
  const row = await readTokenRow(supabase, user.id);
  if (row.access_token_enc && isAccessTokenCacheValid(row.access_token_expires_at)) {
    try {
      const token = decryptToken(row.access_token_enc);
      if (tokenHasScope(token, REQUIRED_SETTINGS_SCOPE)) return { token, upn: row.ms_upn };
    }
    catch { /* refresh below when an old/corrupt cache cannot be decrypted */ }
  }

  return refreshFlights.run(user.id, async () => {
    // A request that entered the flight later may find the cache filled by its predecessor.
    const latest = await readTokenRow(supabase, user.id);
    if (latest.access_token_enc && isAccessTokenCacheValid(latest.access_token_expires_at)) {
      try {
        const token = decryptToken(latest.access_token_enc);
        if (tokenHasScope(token, REQUIRED_SETTINGS_SCOPE)) return { token, upn: latest.ms_upn };
      }
      catch { /* refresh below */ }
    }

    try {
      const tokens = await tokenRequest(new URLSearchParams({ grant_type: "refresh_token", refresh_token: decryptToken(latest.refresh_token_enc), scope: DELEGATED_SCOPES }));
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      const update = {
        access_token_enc: encryptToken(tokens.access_token),
        access_token_expires_at: expiresAt,
        refresh_token_enc: tokens.refresh_token ? encryptToken(tokens.refresh_token) : latest.refresh_token_enc,
        updated_at: new Date().toISOString(),
      };
      // Cross-instance guard: an older refresh result cannot overwrite a newer expiry/token pair.
      const { error: updateError } = await supabase.from("rill_mail_tokens").update(update).eq("user_id", user.id).or(`access_token_expires_at.is.null,access_token_expires_at.lt.${expiresAt}`);
      if (updateError) throw new RillMailHttpError(500, updateError.message);
      return { token: tokens.access_token, upn: latest.ms_upn };
    } catch (error) {
      if (error instanceof MicrosoftTokenError && error.code === "invalid_grant") {
        // Delete only the refresh token generation that failed. A different serverless
        // instance may already have persisted a newer rotated token.
        await supabase.from("rill_mail_tokens").delete().eq("user_id", user.id).eq("refresh_token_enc", latest.refresh_token_enc);
        throw new RillMailHttpError(428, "Microsoft account must be reconnected");
      }
      if (error instanceof RillMailHttpError) throw error;
      throw new RillMailHttpError(502, error instanceof Error ? error.message : "Microsoft token refresh failed");
    }
  });
}

async function readTokenRow(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.from("rill_mail_tokens").select("refresh_token_enc,access_token_enc,access_token_expires_at,ms_upn").eq("user_id", userId).maybeSingle<TokenRow>();
  if (error) throw new RillMailHttpError(500, error.message);
  if (!data) throw new RillMailHttpError(428, "Microsoft account is not connected");
  return data;
}

async function graphFetch(urlOrPath: string, token: string) {
  const url = urlOrPath.startsWith("https://") ? urlOrPath : `${GRAPH}${urlOrPath}`;
  if (!url.startsWith(`${GRAPH}/`)) throw new RillMailHttpError(400, "Invalid Graph paging URL");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) throw new RillMailHttpError(response.status === 401 ? 428 : 502, `Microsoft Graph error (${response.status})`);
  return response;
}

async function graphJson(urlOrPath: string, token: string, init?: RequestInit) {
  const url = urlOrPath.startsWith("https://") ? urlOrPath : `${GRAPH}${urlOrPath}`;
  if (!url.startsWith(`${GRAPH}/`)) throw new RillMailHttpError(400, "Invalid Graph URL");
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    cache: "no-store",
  });
  if (!response.ok) throw new RillMailHttpError(response.status === 401 ? 428 : 502, `Microsoft Graph error (${response.status})`);
  if (response.status === 204) return null;
  return response.json() as Promise<unknown>;
}

function sharedBoxes() {
  return (process.env.RILL_MAIL_SHARED_BOXES ?? "").split(",").map((v) => v.trim()).filter(Boolean);
}

function label(address: string) { return address.split("@")[0] || address; }

async function visibleBoxesWithToken(token: string, upn: string | null) {
  const profileResponse = await graphFetch("/me?$select=userPrincipalName,mail,displayName", token);
  const profile = await profileResponse.json() as { userPrincipalName?: string; mail?: string; displayName?: string };
  const address = profile.mail ?? profile.userPrincipalName ?? upn ?? "me";
  const own: RillMailBox = { id: "me", address, label: profile.displayName ?? label(address), kind: "personal" };
  const probes = await Promise.all(sharedBoxes().map(async (mail): Promise<RillMailBox | null> => {
    const params = new URLSearchParams({ "$top": "1", "$select": "id" });
    try { await graphFetch(`/users/${encodeURIComponent(mail)}/mailFolders/inbox/messages?${params}`, token); return { id: mail, address: mail, label: label(mail), kind: "shared" }; }
    catch (error) { if (error instanceof RillMailHttpError && error.status === 502) return null; throw error; }
  }));
  return [own, ...probes.filter((box): box is RillMailBox => box !== null)];
}

export async function listVisibleBoxes(supabase: SupabaseClient, user: User) {
  const { token, upn } = await accessToken(supabase, user);
  return visibleBoxesWithToken(token, upn);
}

function messagePath(box: RillMailBox) { return box.id === "me" ? "/me/mailFolders/inbox/messages" : `/users/${encodeURIComponent(box.address)}/mailFolders/inbox/messages`; }
function oneMessagePath(boxId: string, id: string) { return boxId === "me" ? `/me/messages/${encodeURIComponent(id)}` : `/users/${encodeURIComponent(boxId)}/messages/${encodeURIComponent(id)}`; }

function mapMessage(raw: GraphMessage, box: RillMailBox): RillMailMessage {
  return { id: raw.id, box, subject: raw.subject || "（件名なし）", fromName: raw.from?.emailAddress?.name || raw.from?.emailAddress?.address || "（差出人不明）", fromAddress: raw.from?.emailAddress?.address || "", to: (raw.toRecipients ?? []).map((x) => x.emailAddress?.address ?? "").filter(Boolean), receivedDateTime: raw.receivedDateTime || "", hasAttachments: raw.hasAttachments === true, isRead: raw.isRead === true, flag: raw.flag ?? {}, categories: raw.categories ?? [], bodyPreview: raw.bodyPreview ?? "" };
}

function encodeCursor(cursor: Cursor) { return Object.values(cursor).some(Boolean) ? Buffer.from(JSON.stringify(cursor)).toString("base64url") : null; }
function decodeCursor(value: string | null): Cursor { if (!value) return {}; try { return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor; } catch { throw new RillMailHttpError(400, "Invalid cursor"); } }

export function resolveBoxPageUrl(cursor: Cursor, boxId: string, initialUrl: string) {
  if (!Object.prototype.hasOwnProperty.call(cursor, boxId)) return { exhausted: false, url: initialUrl };
  if (cursor[boxId] === null) return { exhausted: true, url: null };
  return { exhausted: false, url: cursor[boxId] ?? initialUrl };
}

export async function listMessages(supabase: SupabaseClient, user: User, boxId: string, cursorValue: string | null): Promise<RillMessagesResponse> {
  const { token, upn } = await accessToken(supabase, user);
  const boxes = await visibleBoxesWithToken(token, upn);
  const selected = boxId === "all" ? boxes : boxes.filter((box) => box.id === boxId || box.address === boxId);
  if (!selected.length) throw new RillMailHttpError(404, "Mailbox not found");
  const cursor = decodeCursor(cursorValue);
  const groups = await Promise.all(selected.map(async (box) => {
    const params = new URLSearchParams({ "$top": "50", "$select": MESSAGE_SELECT });
    const page = resolveBoxPageUrl(cursor, box.id, `${messagePath(box)}?${params}`);
    if (page.exhausted || !page.url) return { messages: [] as RillMailMessage[], next: null };
    const response = await graphFetch(page.url, token);
    const data = await response.json() as GraphList<GraphMessage>;
    return { messages: (data.value ?? []).map((raw) => mapMessage(raw, box)), next: data["@odata.nextLink"] ?? null };
  }));
  const next = Object.fromEntries(selected.map((box, index) => [box.id, groups[index].next]));
  return { messages: mergeMessages(groups.map((group) => group.messages)), cursor: encodeCursor(next), boxIds: selected.map((box) => box.id) };
}

export async function getMessage(supabase: SupabaseClient, user: User, boxId: string, id: string): Promise<RillMailDetail> {
  const { token, upn } = await accessToken(supabase, user);
  const boxes = await visibleBoxesWithToken(token, upn);
  const box = boxes.find((item) => item.id === boxId || item.address === boxId);
  if (!box) throw new RillMailHttpError(404, "Mailbox not found");
  const response = await graphFetch(`${oneMessagePath(box.id, id)}?$select=${MESSAGE_SELECT},body`, token);
  const raw = await response.json() as GraphMessage;
  let attachments: RillMailAttachment[] = [];
  if (raw.hasAttachments) {
    const ares = await graphFetch(`${oneMessagePath(box.id, id)}/attachments?$select=id,name,contentType,size`, token);
    const data = await ares.json() as GraphList<RillMailAttachment>;
    attachments = (data.value ?? []).filter((item) => item.id && item.name);
  }
  return { ...mapMessage(raw, box), body: { contentType: raw.body?.contentType?.toLowerCase() === "html" ? "html" : "text", content: raw.body?.content ?? "" }, attachments };
}

export async function getAttachment(supabase: SupabaseClient, user: User, boxId: string, messageId: string, attachmentId: string) {
  const { token, upn } = await accessToken(supabase, user);
  const boxes = await visibleBoxesWithToken(token, upn);
  const box = boxes.find((item) => item.id === boxId || item.address === boxId);
  if (!box) throw new RillMailHttpError(404, "Mailbox not found");
  const response = await graphFetch(`${oneMessagePath(box.id, messageId)}/attachments/${encodeURIComponent(attachmentId)}`, token);
  return response.json() as Promise<{ name?: string; contentType?: string; contentBytes?: string }>;
}

export type MailMutation = {
  id: string;
  boxId: string;
  op: MailWriteOperation;
  value: boolean | MailState | null;
};

export type MailMutationResult = {
  id: string;
  boxId: string;
  ok: boolean;
  error?: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  "要対応": "preset0",
  "確認中": "preset7",
  "処理済": "preset8",
};

function categoryPath(box: RillMailBox) {
  return box.id === "me" ? "/me/outlook/masterCategories" : `/users/${encodeURIComponent(box.address)}/outlook/masterCategories`;
}

async function gardenUserName(supabase: SupabaseClient, user: User) {
  const { data, error } = await supabase.from("root_employees").select("name").eq("user_id", user.id).maybeSingle<{ name: string | null }>();
  if (error || !data?.name) throw new RillMailHttpError(403, "Gardenアカウントの氏名を確認できません");
  return data.name;
}

async function runWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await task(item);
    }
  });
  await Promise.all(workers);
}

export async function mutateMailMessages(supabase: SupabaseClient, user: User, mutations: MailMutation[]): Promise<MailMutationResult[]> {
  const { token, upn } = await accessToken(supabase, user);
  const [boxes, ownName] = await Promise.all([visibleBoxesWithToken(token, upn), gardenUserName(supabase, user)]);
  const results: MailMutationResult[] = [];
  const categoryCache = new Map<string, Set<string>>();
  const categoryLocks = new Map<string, Promise<void>>();

  async function ensureCategory(box: RillMailBox, name: string) {
    const previous = categoryLocks.get(box.id) ?? Promise.resolve();
    const current = previous.then(async () => {
      try {
        let known = categoryCache.get(box.id);
        if (!known) {
          const data = await graphJson(categoryPath(box), token) as GraphList<{ displayName?: string }>;
          known = new Set((data.value ?? []).map((category) => category.displayName).filter((value): value is string => Boolean(value)));
          categoryCache.set(box.id, known);
        }
        if (known.has(name)) return;
        await graphJson(categoryPath(box), token, { method: "POST", body: JSON.stringify({ displayName: name, color: CATEGORY_COLORS[name] ?? "preset9" }) });
        known.add(name);
      } catch (error) {
        // Master category color is optional. The message categories PATCH below is
        // still valid with Mail.ReadWrite and must not be blocked by this endpoint.
        console.warn("Rill Mail: master category registration skipped", error instanceof Error ? error.message : error);
      }
    });
    categoryLocks.set(box.id, current);
    await current;
  }

  await runWithConcurrency(mutations, 3, async (mutation) => {
    try {
      const box = boxes.find((item) => item.id === mutation.boxId || item.address === mutation.boxId);
      if (!box) throw new RillMailHttpError(404, "Mailbox not found");
      const path = oneMessagePath(box.id, mutation.id);

      if (mutation.op === "flag") {
        if (typeof mutation.value !== "boolean") throw new RillMailHttpError(400, "flag value must be boolean");
        await graphJson(path, token, { method: "PATCH", body: JSON.stringify({ flag: { flagStatus: mutation.value ? "flagged" : "notFlagged" } }) });
      } else if (mutation.op === "read") {
        if (!isPersonalMailbox(box)) throw new RillMailHttpError(400, "共有箱のisReadは変更できません");
        if (typeof mutation.value !== "boolean") throw new RillMailHttpError(400, "read value must be boolean");
        await graphJson(path, token, { method: "PATCH", body: JSON.stringify({ isRead: mutation.value }) });
      } else {
        const current = await graphJson(`${path}?$select=categories`, token) as { categories?: string[] };
        let categories: string[];
        if (mutation.op === "state") {
          if (mutation.value !== null && !isMailState(mutation.value)) throw new RillMailHttpError(400, "Invalid mail state");
          if (mutation.value) await ensureCategory(box, mutation.value);
          categories = replaceMailState(current.categories ?? [], mutation.value as MailState | null);
        } else {
          if (typeof mutation.value !== "boolean") throw new RillMailHttpError(400, "confirm value must be boolean");
          if (mutation.value) await ensureCategory(box, ownName);
          categories = toggleOwnConfirmation(current.categories ?? [], ownName, mutation.value);
        }
        await graphJson(path, token, { method: "PATCH", body: JSON.stringify({ categories }) });
      }
      results.push({ id: mutation.id, boxId: box.id, ok: true });
    } catch (error) {
      results.push({ id: mutation.id, boxId: mutation.boxId, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
  return results;
}
