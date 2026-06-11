/**
 * Google Drive サーバー側クライアント（経費レシート用）
 *
 * 認証は OAuth（東海林さん本人の一度きりの許可・refresh token 方式）。
 *   1. 環境変数 GOOGLE_DRIVE_OAUTH_JSON（本番 Vercel 用・{client_id, client_secret, refresh_token}）
 *   2. ローカルファイル .secrets/garden-bud-oauth-token.json（開発用・gitignore 済み）
 * スコープは drive.file（このアプリが作成したフォルダ/ファイルのみ操作可）。
 * ファイルの所有者はユーザー本人になり、本人の保存容量を使う。
 * ※サービスアカウント方式は「SAは保存容量を持たない」Google仕様により廃止（2026-06-11）。
 *
 * 依存ライブラリなし（fetch のみ）。トークンはモジュールスコープでキャッシュ。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

type OAuthCreds = { client_id: string; client_secret: string; refresh_token: string };

let cachedToken: { token: string; expiresAt: number } | null = null;

function loadOAuthCreds(): OAuthCreds {
  const env = process.env.GOOGLE_DRIVE_OAUTH_JSON;
  if (env) return JSON.parse(env) as OAuthCreds;
  const path = join(process.cwd(), ".secrets", "garden-bud-oauth-token.json");
  return JSON.parse(readFileSync(path, "utf-8")) as OAuthCreds;
}

export async function getDriveAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const creds = loadOAuthCreds();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Drive token error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 600) * 1000 };
  return data.access_token;
}

async function driveFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getDriveAccessToken();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(`https://www.googleapis.com${path}`, { ...init, headers });
}

/** フォルダへ画像をアップロードし {id, webViewLink} を返す */
export async function uploadToFolder(
  folderId: string,
  filename: string,
  content: Buffer,
  mimeType: string,
): Promise<{ id: string; webViewLink: string | null }> {
  const boundary = "garden-bud-" + Math.random().toString(36).slice(2);
  const metadata = JSON.stringify({ name: filename, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    ),
    content,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await driveFetch(
    "/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  if (!res.ok) throw new Error(`Drive upload error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id: string; webViewLink?: string };
  return { id: data.id, webViewLink: data.webViewLink ?? null };
}

/** 親フォルダ直下から名前一致の子フォルダを探す（無ければ作成） */
export async function findOrCreateSubfolder(parentId: string, name: string): Promise<string> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await driveFetch(`/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`);
  if (!res.ok) throw new Error(`Drive list error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { files: { id: string }[] };
  if (data.files.length > 0) return data.files[0].id;

  const createRes = await driveFetch("/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parents: [parentId], mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!createRes.ok) throw new Error(`Drive mkdir error: ${createRes.status} ${await createRes.text()}`);
  return ((await createRes.json()) as { id: string }).id;
}

/** ファイルを別フォルダへ移動する */
export async function moveFile(fileId: string, toFolderId: string): Promise<void> {
  // 現在の親を取得
  const meta = await driveFetch(`/drive/v3/files/${fileId}?fields=parents`);
  if (!meta.ok) throw new Error(`Drive meta error: ${meta.status} ${await meta.text()}`);
  const parents = ((await meta.json()) as { parents?: string[] }).parents ?? [];
  const params = new URLSearchParams({ addParents: toFolderId, fields: "id,parents" });
  if (parents.length > 0) params.set("removeParents", parents.join(","));
  const res = await driveFetch(`/drive/v3/files/${fileId}?${params.toString()}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (!res.ok) throw new Error(`Drive move error: ${res.status} ${await res.text()}`);
}
