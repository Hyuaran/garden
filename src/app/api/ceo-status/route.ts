/**
 * GET /api/ceo-status — 東海林さん（CEO）現在ステータス取得
 *
 * Garden 全モジュール横断ヘッダの ShojiStatusWidget が 30 秒ごとにポーリングする
 * エンドポイント。`bloom_ceo_status` の最新 1 行を返し、`updated_by` が居れば
 * `root_employees.name` を別クエリで JOIN して返す。
 *
 * 認証方式（RLS server-side）:
 *   `@supabase/ssr` の `createServerClient` を使い、Cookie からセッションを引き継ぐ。
 *   ※ ブラウザ用 anon supabase クライアントを Route Handler で流用すると RLS で
 *     100% ブロックされる既知ピットフォール（cross-cutting RLS 監査メモリ参照）。
 *
 * Next.js 16 注意点:
 *   `cookies()` が async 化されているため `await cookies()` 必須。
 *   plan-shoji-status-and-cross-ui-skeleton-20260426.md の擬似コードからこの点のみ
 *   調整している。
 *
 * レスポンス:
 *   200 OK 通常: { status, summary, updated_at, updated_by_name }
 *   200 OK レコードなし: { status: "available", summary: null, updated_at: null, updated_by_name: null }
 *   500 Server Error: { error: string }
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {
          /* Route Handler では no-op（レスポンス Cookie 書き込みは行わない） */
        },
        remove() {
          /* no-op */
        },
      },
    },
  );
}

export async function GET() {
  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from("bloom_ceo_status")
    .select("status, summary, updated_at, updated_by")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      {
        status: "available",
        summary: null,
        updated_at: null,
        updated_by_name: null,
      },
      { status: 200 },
    );
  }

  // updated_by_name を別クエリで JOIN（PostgREST 直接 JOIN は FK 認識依存のため避ける）
  let updated_by_name: string | null = null;
  if (data.updated_by) {
    const { data: emp } = await supabase
      .from("root_employees")
      .select("name")
      .eq("user_id", data.updated_by)
      .maybeSingle();
    updated_by_name = emp?.name ?? null;
  }

  return NextResponse.json({
    status: data.status,
    summary: data.summary,
    updated_at: data.updated_at,
    updated_by_name,
  });
}
