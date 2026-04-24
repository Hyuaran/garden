/**
 * 月次ダイジェスト PDF エクスポート Route Handler
 *
 * §10.3 判2: Node ランタイム採用（日本語フォント埋込のため）。
 * 実装: @react-pdf/renderer で Document を PDF バッファに変換して返却。
 *
 * 認可方針:
 *   - staff+ は閲覧可（bloom_monthly_digests RLS と整合）
 *   - 現状 Chatwork Cron 経由 / ブラウザ直アクセスのどちらでもトリガ
 *   - 将来的に Chatwork プッシュ配信時の署名付き URL 化を検討
 *
 * レスポンス:
 *   - 200 + application/pdf: 正常
 *   - 404: 対象月のダイジェスト未作成
 *   - 500: レンダリングエラー
 */

import { renderToBuffer } from "@react-pdf/renderer";

import { createElement } from "react";

import {
  DigestDocument,
  digestFilename,
} from "../../_lib/pdf-renderer";
import { fetchDigestByMonth } from "../../_lib/digest-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ month: string }> },
) {
  const { month } = await context.params;

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return Response.json(
      { ok: false, error: "invalid month format (expected YYYY-MM)" },
      { status: 400 },
    );
  }

  let digest;
  try {
    digest = await fetchDigestByMonth(month);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bloom/pdf] fetch failed:", msg);
    return Response.json({ ok: false, error: `fetch: ${msg}` }, { status: 500 });
  }

  if (!digest) {
    return Response.json(
      { ok: false, error: `monthly digest not found: ${month}` },
      { status: 404 },
    );
  }

  let buffer: Buffer;
  try {
    buffer = await renderToBuffer(createElement(DigestDocument, { digest }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bloom/pdf] render failed:", msg);
    return Response.json({ ok: false, error: `render: ${msg}` }, { status: 500 });
  }

  const filename = digestFilename(month);
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
