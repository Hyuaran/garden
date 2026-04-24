/**
 * 月次ダイジェスト CRUD
 *
 * - fetchDigests: 一覧（status 降順 = 未公開を上に）
 * - fetchDigestByMonth: 1 月分取得（"YYYY-MM" 文字列）
 * - createDigest / updateDigest / publishDigest / archiveDigest
 *
 * digest_month は DATE 型の月初（YYYY-MM-01）で DB 保存する。
 * URL 上は "YYYY-MM" 形式で扱う（[month] セグメント）。
 */

import { supabase } from "../../_lib/supabase";
import type {
  DigestPage,
  MonthlyDigest,
  MonthlyDigestStatus,
} from "../../_types/monthly-digest";

/** "2026-05" or "2026-05-01" を "2026-05-01" に正規化 */
export function toMonthStart(input: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return `${input.slice(0, 7)}-01`;
  }
  if (/^\d{4}-\d{2}$/.test(input)) {
    return `${input}-01`;
  }
  throw new Error(`invalid month format: ${input}`);
}

/** DB の YYYY-MM-01 → URL 用 "YYYY-MM" に戻す */
export function toMonthKey(monthStart: string): string {
  return monthStart.slice(0, 7);
}

export async function fetchDigests(): Promise<MonthlyDigest[]> {
  const { data, error } = await supabase
    .from("bloom_monthly_digests")
    .select("*")
    .order("digest_month", { ascending: false });
  if (error) {
    console.error("[bloom] fetchDigests failed:", error.message);
    return [];
  }
  return (data ?? []) as MonthlyDigest[];
}

export async function fetchDigestByMonth(month: string): Promise<MonthlyDigest | null> {
  const monthStart = toMonthStart(month);
  const { data, error } = await supabase
    .from("bloom_monthly_digests")
    .select("*")
    .eq("digest_month", monthStart)
    .maybeSingle();
  if (error) {
    console.error("[bloom] fetchDigestByMonth failed:", error.message);
    return null;
  }
  return (data as MonthlyDigest | null) ?? null;
}

type CreateInput = {
  digest_month: string;             // "YYYY-MM" or "YYYY-MM-01"
  title: string;
  summary?: string | null;
  pages?: DigestPage[];
};

export async function createDigest(input: CreateInput): Promise<MonthlyDigest | null> {
  const payload = {
    digest_month: toMonthStart(input.digest_month),
    title: input.title,
    summary: input.summary ?? null,
    pages: input.pages ?? [],
    status: "draft" as MonthlyDigestStatus,
  };
  const { data, error } = await supabase
    .from("bloom_monthly_digests")
    .insert(payload)
    .select()
    .maybeSingle();
  if (error) {
    console.error("[bloom] createDigest failed:", error.message);
    return null;
  }
  return (data as MonthlyDigest | null) ?? null;
}

type UpdateInput = {
  title?: string;
  summary?: string | null;
  pages?: DigestPage[];
};

export async function updateDigest(
  id: string,
  patch: UpdateInput,
): Promise<MonthlyDigest | null> {
  const payload = {
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("bloom_monthly_digests")
    .update(payload)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    console.error("[bloom] updateDigest failed:", error.message);
    return null;
  }
  return (data as MonthlyDigest | null) ?? null;
}

export async function publishDigest(id: string, userId: string): Promise<MonthlyDigest | null> {
  const payload = {
    status: "published" as MonthlyDigestStatus,
    published_at: new Date().toISOString(),
    published_by: userId,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("bloom_monthly_digests")
    .update(payload)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    console.error("[bloom] publishDigest failed:", error.message);
    return null;
  }
  return (data as MonthlyDigest | null) ?? null;
}

export async function archiveDigest(id: string): Promise<MonthlyDigest | null> {
  const payload = {
    status: "archived" as MonthlyDigestStatus,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("bloom_monthly_digests")
    .update(payload)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    console.error("[bloom] archiveDigest failed:", error.message);
    return null;
  }
  return (data as MonthlyDigest | null) ?? null;
}
