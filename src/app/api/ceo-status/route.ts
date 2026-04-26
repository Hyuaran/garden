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

const VALID_STATUS = new Set(["available", "busy", "focused", "away"] as const);
type CeoStatusKey = "available" | "busy" | "focused" | "away";

/**
 * PUT /api/ceo-status — 東海林さん（CEO）ステータス更新（super_admin のみ）
 *
 * 二重防御:
 *   Route Handler 側で auth + role チェック → RLS は最終の砦
 *
 * バリデーション:
 *   - status: 必須、VALID_STATUS の 4 値のみ
 *   - summary: 任意、最大 200 文字
 *
 * レスポンス:
 *   200 OK: { status, summary, updated_at, updated_by_name }
 *   400 Bad Request: 不正な JSON / status / summary
 *   401 Unauthorized: 未認証
 *   403 Forbidden: super_admin 以外
 *   500 Server Error: 既存 row なし or DB エラー
 */
export async function PUT(req: Request) {
  const supabase = await getServerSupabase();

  // 1. auth check
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // 2. role check（Route Handler 側で二重防御。RLS は最終の砦）
  // 最適化: name も一緒に取得し、Step 6 で再利用（DB ラウンドトリップ削減）
  const { data: emp } = await supabase
    .from("root_employees")
    .select("garden_role, name")
    .eq("user_id", userId)
    .maybeSingle();
  if (emp?.garden_role !== "super_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 3. body parse + validate
  let body: { status?: string; summary?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.status || !VALID_STATUS.has(body.status as CeoStatusKey)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  if (body.summary != null && body.summary.length > 200) {
    return NextResponse.json({ error: "summary too long" }, { status: 400 });
  }

  // 4. 既存 row 取得（1 行運用）
  const { data: existing } = await supabase
    .from("bloom_ceo_status")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!existing?.id) {
    return NextResponse.json({ error: "no row to update (run migration seed)" }, { status: 500 });
  }

  // 5. update
  const { data: updated, error: updateErr } = await supabase
    .from("bloom_ceo_status")
    .update({
      status: body.status,
      summary: body.summary ?? null,
      updated_by: userId,
    })
    .eq("id", existing.id)
    .select("status, summary, updated_at, updated_by")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 6. updated_by_name は Step 2 で取得済の emp.name を再利用（追加 query なし）
  return NextResponse.json({
    status: updated?.status,
    summary: updated?.summary,
    updated_at: updated?.updated_at,
    updated_by_name: emp?.name ?? null,
  });
}
