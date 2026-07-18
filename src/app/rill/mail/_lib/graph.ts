import type { SupabaseClient, User } from "@supabase/supabase-js";
import { decryptRefreshToken, encryptRefreshToken } from "./token-crypto";
import { mergeMessages } from "./format";
import { RillMailHttpError } from "./server-auth";
import type { RillMailAttachment, RillMailBox, RillMailDetail, RillMailMessage, RillMessagesResponse } from "./types";

const GRAPH = "https://graph.microsoft.com/v1.0";
const MESSAGE_SELECT = "id,subject,from,toRecipients,receivedDateTime,hasAttachments,isRead,flag,categories,bodyPreview";

type TokenRow = { refresh_token_enc: string; ms_upn: string | null };
type GraphList<T> = { value?: T[]; "@odata.nextLink"?: string };
type GraphAddress = { emailAddress?: { name?: string; address?: string } };
type GraphMessage = {
  id: string; subject?: string; from?: GraphAddress; toRecipients?: GraphAddress[];
  receivedDateTime?: string; hasAttachments?: boolean; isRead?: boolean;
  flag?: RillMailMessage["flag"]; categories?: string[]; bodyPreview?: string;
  body?: { contentType?: string; content?: string };
};
type Cursor = Record<string, string | null>;

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
  const params = new URLSearchParams({ client_id: c.clientId, response_type: "code", redirect_uri: callbackUrl(requestUrl), response_mode: "query", scope: "openid profile offline_access User.Read Mail.ReadWrite Mail.ReadWrite.Shared", state });
  return `https://login.microsoftonline.com/${encodeURIComponent(c.tenantId)}/oauth2/v2.0/authorize?${params}`;
}

async function tokenRequest(params: URLSearchParams) {
  const c = config();
  params.set("client_id", c.clientId);
  params.set("client_secret", c.clientSecret);
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(c.tenantId)}/oauth2/v2.0/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, cache: "no-store" });
  const json = await response.json() as { access_token?: string; refresh_token?: string; error_description?: string };
  if (!response.ok || !json.access_token) throw new RillMailHttpError(502, json.error_description ?? "Microsoft token exchange failed");
  return json as { access_token: string; refresh_token?: string };
}

export function exchangeCode(code: string, requestUrl: string) {
  return tokenRequest(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: callbackUrl(requestUrl), scope: "openid profile offline_access User.Read Mail.ReadWrite Mail.ReadWrite.Shared" }));
}

async function accessToken(supabase: SupabaseClient, user: User) {
  const { data, error } = await supabase.from("rill_mail_tokens").select("refresh_token_enc,ms_upn").eq("user_id", user.id).maybeSingle<TokenRow>();
  if (error) throw new RillMailHttpError(500, error.message);
  if (!data) throw new RillMailHttpError(428, "Microsoft account is not connected");
  const tokens = await tokenRequest(new URLSearchParams({ grant_type: "refresh_token", refresh_token: decryptRefreshToken(data.refresh_token_enc), scope: "openid profile offline_access User.Read Mail.ReadWrite Mail.ReadWrite.Shared" }));
  if (tokens.refresh_token) {
    const { error: updateError } = await supabase.from("rill_mail_tokens").update({ refresh_token_enc: encryptRefreshToken(tokens.refresh_token), updated_at: new Date().toISOString() }).eq("user_id", user.id);
    if (updateError) throw new RillMailHttpError(500, updateError.message);
  }
  return { token: tokens.access_token, upn: data.ms_upn };
}

async function graphFetch(urlOrPath: string, token: string) {
  const url = urlOrPath.startsWith("https://") ? urlOrPath : `${GRAPH}${urlOrPath}`;
  if (!url.startsWith(`${GRAPH}/`)) throw new RillMailHttpError(400, "Invalid Graph paging URL");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) throw new RillMailHttpError(response.status === 401 ? 428 : 502, `Microsoft Graph error (${response.status})`);
  return response;
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

export async function listMessages(supabase: SupabaseClient, user: User, boxId: string, cursorValue: string | null): Promise<RillMessagesResponse> {
  const { token, upn } = await accessToken(supabase, user);
  const boxes = await visibleBoxesWithToken(token, upn);
  const selected = boxId === "all" ? boxes : boxes.filter((box) => box.id === boxId || box.address === boxId);
  if (!selected.length) throw new RillMailHttpError(404, "Mailbox not found");
  const cursor = decodeCursor(cursorValue);
  const groups = await Promise.all(selected.map(async (box) => {
    const params = new URLSearchParams({ "$top": "50", "$select": MESSAGE_SELECT });
    const url = cursor[box.id] ?? `${messagePath(box)}?${params}`;
    if (cursorValue && !cursor[box.id]) return { messages: [] as RillMailMessage[], next: null };
    const response = await graphFetch(url, token);
    const data = await response.json() as GraphList<GraphMessage>;
    return { messages: (data.value ?? []).map((raw) => mapMessage(raw, box)), next: data["@odata.nextLink"] ?? null };
  }));
  const next = Object.fromEntries(selected.map((box, index) => [box.id, groups[index].next]));
  return { messages: mergeMessages(groups.map((group) => group.messages)), cursor: encodeCursor(next) };
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
