/**
 * Garden-Leaf 関電業務委託 — 添付ファイル管理
 *
 * spec: docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md §3 (v3)
 *
 * 公開 API (13 関数):
 *   D.8: generateAttachmentId / softDeleteAttachment / undoSoftDelete
 *   D.9: createAttachmentSignedUrl / createAttachmentSignedUrls
 *   D.10: fetchAttachmentsByCase
 *   D.11: uploadAttachments / getUploadConcurrency
 *   D.13: restoreAttachment / hardDeleteAttachment / verifyImageDownloadPassword /
 *         verifyUserPasswordAndDownload / isMobileDevice / getCurrentGardenRole
 *
 * v3 改訂事項:
 * - 論理削除は Client ガードなし（事業所属者全員可、Garden 共通パターン）
 * - 物理削除 / 復元は admin+ Client ガード（UI 側で表示制御）
 * - DL 専用 PW は root_settings + bcrypt + RPC（verify_image_download_password）
 * - 全変更は history trigger で自動記録（attachments.ts 側は何もしなくていい）
 *
 * RLS: 8 ロール × 事業スコープ（spec §2.3 v3 / migration §6-§12）
 */

import { getSupabaseClient } from "@/lib/supabase/client";
import type { AttachmentCategory, KandenAttachment } from "./types";
import {
  RECENT_BUCKET,
  recentPath,
  recentThumbPath,
} from "./kanden-storage-paths";
import {
  compressWithWorker,
  thumbnailWithWorker,
  convertHeicToJpeg,
  isHeicFile,
} from "./image-compression";

// ─── D.8: ID 生成 + 論理削除 ────────────────────────────────────────────────────

/** UUID v4 形式の attachment_id を生成 */
export function generateAttachmentId(): string {
  return crypto.randomUUID();
}

/**
 * 論理削除（v3: Client ガードなし、事業所属者全員可）。
 * RLS で事業所属チェック、history trigger で自動記録。
 */
export async function softDeleteAttachment(attachmentId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const user = (await supabase.auth.getUser()).data.user;
  const { error } = await supabase
    .from("leaf_kanden_attachments")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user?.id ?? null,
    })
    .eq("attachment_id", attachmentId);
  if (error) throw new Error(`softDeleteAttachment failed: ${error.message}`);
}

/** 論理削除の取消（UNDO snackbar / admin 復元から呼ばれる）*/
export async function undoSoftDelete(attachmentId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("leaf_kanden_attachments")
    .update({ deleted_at: null, deleted_by: null })
    .eq("attachment_id", attachmentId);
  if (error) throw new Error(`undoSoftDelete failed: ${error.message}`);
}

// ─── D.9: signedURL 発行 ────────────────────────────────────────────────────────

/**
 * 単発 signedURL（Lightbox の 1500px 本体用）。
 * @param path - bucket 内のオブジェクト path（例: 'CASE-0001/aaa.jpg'）
 * @param expiresInSeconds - TTL（既定 600 = 10 分、spec §3.3）
 */
export async function createAttachmentSignedUrl(
  path: string,
  expiresInSeconds: number = 600,
): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(RECENT_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data)
    throw new Error(`createSignedUrl failed: ${error?.message ?? "no data"}`);
  return data.signedUrl;
}

/**
 * サムネ等の一括 signedURL 発行。grid マウント時に全サムネ分を 1 API で取得。
 * @param paths - bucket 内のオブジェクト path 配列
 * @param expiresInSeconds - TTL（既定 600 = 10 分）
 */
export async function createAttachmentSignedUrls(
  paths: string[],
  expiresInSeconds: number = 600,
): Promise<string[]> {
  if (paths.length === 0) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(RECENT_BUCKET)
    .createSignedUrls(paths, expiresInSeconds);
  if (error)
    throw new Error(`createSignedUrls failed: ${error.message}`);
  return (data ?? []).map((d) => d.signedUrl);
}

// ─── D.10: case_id で取得 ──────────────────────────────────────────────────────

/**
 * case_id で添付一覧取得（v3: 削除済も含めて全件返す、UI 側でバッジ分類）。
 * RLS で事業所属判定済。
 */
export async function fetchAttachmentsByCase(
  caseId: string,
): Promise<KandenAttachment[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("leaf_kanden_attachments")
    .select("*")
    .eq("case_id", caseId)
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(`fetchAttachmentsByCase failed: ${error.message}`);
  return (data ?? []) as KandenAttachment[];
}

// ─── D.11: upload (並列 + リトライ) ─────────────────────────────────────────────

export type UploadOptions = {
  /** 並列数（既定: デバイス判定）*/
  concurrency?: number;
  /** 失敗時のリトライ回数（既定: 3）*/
  maxRetries?: number;
  /** 圧縮済 blob を渡す場合 true（テスト用）*/
  preCompressed?: boolean;
  /** 進捗コールバック（done / total）*/
  onProgress?: (done: number, total: number) => void;
};

export type UploadResult = {
  succeeded: KandenAttachment[];
  failed: { file: File; reason: string }[];
};

/**
 * デバイス判定で並列数を返す（spec §3.1）:
 * - モバイル UA → 2
 * - effectiveType が 2g/3g/4g → 2
 * - PC or 判定不能 → 3
 */
export function getUploadConcurrency(): number {
  if (typeof navigator === "undefined") return 3;
  const isMobileUA = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const effectiveType = (
    navigator as { connection?: { effectiveType?: string } }
  ).connection?.effectiveType;
  if (isMobileUA) return 2;
  if (effectiveType && /^(2g|3g|4g)$/.test(effectiveType)) return 2;
  return 3;
}

/**
 * 画像を並列 PUT（recent bucket）+ metadata insert。
 * HEIC は変換、圧縮は Worker 経由（preCompressed=true 時はスキップ）。
 *
 * @returns 成功 / 失敗の分離集計（Promise.allSettled で独立処理）
 */
export async function uploadAttachments(
  files: File[],
  caseId: string,
  category: AttachmentCategory,
  opts: UploadOptions = {},
): Promise<UploadResult> {
  const concurrency = opts.concurrency ?? getUploadConcurrency();
  const maxRetries = opts.maxRetries ?? 3;
  const succeeded: KandenAttachment[] = [];
  const failed: UploadResult["failed"] = [];
  let done = 0;

  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      chunk.map((f) =>
        uploadOne(f, caseId, category, maxRetries, opts.preCompressed ?? false),
      ),
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      done += 1;
      opts.onProgress?.(done, files.length);
      if (r.status === "fulfilled") succeeded.push(r.value);
      else
        failed.push({
          file: chunk[j],
          reason: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
    }
  }

  return { succeeded, failed };
}

async function uploadOne(
  file: File,
  caseId: string,
  category: AttachmentCategory,
  maxRetries: number,
  preCompressed: boolean,
): Promise<KandenAttachment> {
  const supabase = getSupabaseClient();
  let working: Blob = file;
  if (isHeicFile(file)) {
    working = await convertHeicToJpeg(file);
  }
  const mainBlob = preCompressed
    ? working
    : await compressWithWorker(working, { maxWidth: 1500, quality: 0.85 });
  const thumbBlob = preCompressed ? working : await thumbnailWithWorker(working);

  const attachmentId = generateAttachmentId();
  const mainPath = recentPath(caseId, attachmentId);
  const thumbPathValue = recentThumbPath(caseId, attachmentId);

  await putWithRetry(mainPath, mainBlob, maxRetries);
  await putWithRetry(thumbPathValue, thumbBlob, maxRetries);

  const user = (await supabase.auth.getUser()).data.user;
  const row: Partial<KandenAttachment> = {
    attachment_id: attachmentId,
    case_id: caseId,
    category,
    storage_url: mainPath,
    thumbnail_url: thumbPathValue,
    mime_type: "image/jpeg",
    archived_tier: "recent",
    uploaded_by: user?.id ?? null,
    uploaded_at: new Date().toISOString(),
    is_guide_capture: false,
    is_post_added: false,
    ocr_processed: false,
    archived_at: null,
    deleted_at: null,
    deleted_by: null,
  };
  const { data, error } = await supabase
    .from("leaf_kanden_attachments")
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(`insert failed: ${error.message}`);
  return data as KandenAttachment;
}

async function putWithRetry(
  path: string,
  blob: Blob,
  maxRetries: number,
): Promise<void> {
  const supabase = getSupabaseClient();
  const delays = [1000, 3000, 9000];
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { error } = await supabase.storage
      .from(RECENT_BUCKET)
      .upload(path, blob);
    if (!error) return;
    lastError = new Error(error.message);
    if (attempt < maxRetries) {
      await sleep(delays[Math.min(attempt, delays.length - 1)]);
    }
  }
  throw lastError ?? new Error("upload failed");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── D.13: v3 追加関数 ─────────────────────────────────────────────────────────

/**
 * admin の論理削除取消（UNDO 期限後の復元）。
 * undoSoftDelete の alias、Client 側で admin ガード必須。
 */
export async function restoreAttachment(attachmentId: string): Promise<void> {
  return undoSoftDelete(attachmentId);
}

/**
 * 物理削除（DB + Storage 両方）。admin+ のみ Client ガード必須。
 * Storage 削除失敗は cleanup job で補正するため ignore。
 */
export async function hardDeleteAttachment(
  attachmentId: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: row, error: selErr } = await supabase
    .from("leaf_kanden_attachments")
    .select("storage_url, thumbnail_url")
    .eq("attachment_id", attachmentId)
    .single();
  if (selErr || !row)
    throw new Error(
      `hardDelete: row not found (${selErr?.message ?? "no row"})`,
    );

  const paths: string[] = [];
  if (row.storage_url) paths.push(row.storage_url);
  if (row.thumbnail_url) paths.push(row.thumbnail_url);
  if (paths.length > 0) {
    await supabase.storage.from(RECENT_BUCKET).remove(paths);
  }

  const { error: delErr } = await supabase
    .from("leaf_kanden_attachments")
    .delete()
    .eq("attachment_id", attachmentId);
  if (delErr) throw new Error(`hardDelete DB failed: ${delErr.message}`);
}

/**
 * デバイス判定（DL PW 分岐 / 並列 upload 数の両方で利用）。
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/**
 * 画像 DL 専用 PW を RPC で検証する薄いラッパ。
 */
export async function verifyImageDownloadPassword(
  password: string,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("verify_image_download_password", {
    input_password: password,
  });
  if (error)
    throw new Error(
      `verify_image_download_password failed: ${error.message}`,
    );
  return data === true;
}

/**
 * スマホ DL 時のパスワード認証 + ダウンロード。
 * 3 回失敗で sessionStorage に lock、5 分経過で自動解除。
 */
export async function verifyUserPasswordAndDownload(
  attachmentId: string,
  password: string,
): Promise<void> {
  const LOCK_KEY = "leaf-dl-lock";
  const FAIL_KEY = "leaf-dl-fail-count";
  const LOCK_MS = 5 * 60 * 1000;

  // ロック判定
  const lockAt = Number(sessionStorage.getItem(LOCK_KEY) ?? "0");
  if (lockAt && Date.now() - lockAt < LOCK_MS) {
    throw new Error(
      "5 分間ロックされています。しばらくしてから再度お試しください。",
    );
  } else if (lockAt) {
    sessionStorage.removeItem(LOCK_KEY);
    sessionStorage.removeItem(FAIL_KEY);
  }

  // RPC で DL 専用 PW 検証
  const ok = await verifyImageDownloadPassword(password);
  if (!ok) {
    const count = Number(sessionStorage.getItem(FAIL_KEY) ?? "0") + 1;
    sessionStorage.setItem(FAIL_KEY, String(count));
    if (count >= 3) sessionStorage.setItem(LOCK_KEY, String(Date.now()));
    throw new Error(
      `パスワードが一致しません（残り ${Math.max(3 - count, 0)} 回）`,
    );
  }

  sessionStorage.removeItem(FAIL_KEY);

  // signedURL 発行 + DL 起動
  const supabase = getSupabaseClient();
  const { data: row, error: selErr } = await supabase
    .from("leaf_kanden_attachments")
    .select("storage_url")
    .eq("attachment_id", attachmentId)
    .single();
  if (selErr || !row) throw new Error("画像情報を取得できませんでした");
  const signedUrl = await createAttachmentSignedUrl(row.storage_url, 600);
  const link = document.createElement("a");
  link.href = signedUrl;
  link.download = `${attachmentId}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 現在ロール取得（RPC 経由、RoleContext 未使用時のユーティリティ）。
 */
export async function getCurrentGardenRole(): Promise<string | null> {
  const supabase = getSupabaseClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;
  const { data, error } = await supabase.rpc("garden_role_of", {
    uid: user.id,
  });
  if (error) return null;
  return (data as string) ?? null;
}
