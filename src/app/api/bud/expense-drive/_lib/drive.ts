/**
 * Google Drive サーバー側クライアント（経費レシート用）
 *
 * 認証は OAuth（東海林さん本人の一度きりの許可・refresh token 方式）。
 *   1. 環境変数 GOOGLE_DRIVE_OAUTH_JSON（本番 Vercel 用・{client_id, client_secret, refresh_token}）
 *   2. ローカルファイル .secrets/garden-bud-oauth-token.json（開発用・gitignore 済み）
 * スコープは既存の画面アップロード用途では drive.file。
 * 複合機→Drive同期ファイルの取り込みでは、外部作成ファイルを読むため
 * drive.readonly 以上へ再認証した refresh_token が必要。
 * ファイルの所有者はユーザー本人になり、本人の保存容量を使う。
 * ※サービスアカウント方式は「SAは保存容量を持たない」Google仕様により廃止（2026-06-11）。
 *
 * 依存ライブラリなし（fetch のみ）。トークンはモジュールスコープでキャッシュ。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

type OAuthCreds = { client_id: string; client_secret: string; refresh_token: string };

let cachedToken: { token: string; expiresAt: number } | null = null;

export type DriveFolderFile = {
  id: string;
  name: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
  createdTime: string | null;
};

const TRANSFER_INBOX_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

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

export type DriveFolderMarker = { key: string; value: string };

/**
 * アプリが作成したルートフォルダを appProperties で再発見する。
 * Drive 上で別フォルダへ手動移動されても、親パスに依存せず同じ ID を使い続けられる。
 */
export async function findOrCreateAppFolder(name: string, marker: DriveFolderMarker): Promise<string> {
  const escapedKey = marker.key.replace(/'/g, "\\'");
  const escapedValue = marker.value.replace(/'/g, "\\'");
  const q = encodeURIComponent(
    `appProperties has { key='${escapedKey}' and value='${escapedValue}' } and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await driveFetch(`/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`);
  if (!res.ok) throw new Error(`Drive list error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { files?: Array<{ id?: string }> };
  const existingId = data.files?.[0]?.id;
  if (existingId) return existingId;

  const createRes = await driveFetch("/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      appProperties: { [marker.key]: marker.value },
    }),
  });
  if (!createRes.ok) throw new Error(`Drive mkdir error: ${createRes.status} ${await createRes.text()}`);
  return ((await createRes.json()) as { id: string }).id;
}

/** 指定フォルダ直下のPDF/JPG/PNGを列挙する。drive.readonly 以上のscopeが必要。 */
export async function listFolderFiles(folderId: string): Promise<DriveFolderFile[]> {
  const q =
    `'${folderId}' in parents and trashed=false and (` +
    "mimeType='application/pdf' or mimeType='image/jpeg' or mimeType='image/png')";
  const fields = "nextPageToken,files(id,name,mimeType,createdTime)";
  const files: DriveFolderFile[] = [];
  let pageToken: string | null = null;

  do {
    const params = new URLSearchParams({
      q,
      fields,
      pageSize: "100",
      orderBy: "createdTime",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await driveFetch(`/drive/v3/files?${params.toString()}`);
    if (!res.ok) throw new Error(`Drive list error: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      nextPageToken?: string;
      files?: Array<{
        id?: string;
        name?: string;
        mimeType?: string;
        createdTime?: string;
      }>;
    };
    for (const file of data.files ?? []) {
      if (
        file.id &&
        file.name &&
        file.mimeType &&
        TRANSFER_INBOX_MIME_TYPES.has(file.mimeType)
      ) {
        files.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType as DriveFolderFile["mimeType"],
          createdTime: file.createdTime ?? null,
        });
      }
    }
    pageToken = data.nextPageToken ?? null;
  } while (pageToken);

  return files;
}

/** Driveファイル本体をダウンロードする。drive.readonly 以上のscopeが必要。 */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const res = await driveFetch(
    `/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
  );
  if (!res.ok) throw new Error(`Drive download error: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
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
