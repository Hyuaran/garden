/**
 * 月次ダイジェスト PDF エクスポート Route Handler
 *
 * §10.3 判2: Node ランタイム（日本語フォント埋込のため）。
 * 認可: request の Authorization: Bearer <jwt> を使い、RLS 越しに取得。
 *       サーバー側で service_role は使わない（§10.3 方針）。
 *
 * レスポンス:
 *   - 200 + application/pdf: 正常
 *   - 400: 月フォーマット不正
 *   - 401: Authorization ヘッダ欠如/不正
 *   - 404: 対象月のダイジェスト未作成（または RLS 越しに見えない）
 *   - 500: 取得/レンダリングエラー
 */

import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";

import {
  DigestDocument,
  digestFilename,
} from "../../_lib/pdf-renderer";
import { fetchDigestByMonth } from "../../_lib/digest-queries";
import { createSupabaseFromRequest } from "../../../_lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ month: string }> },
) {
  const { month } = await context.params;

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return Response.json(
      { ok: false, error: "invalid month format (expected YYYY-MM)" },
      { status: 400 },
    );
  }

  let client;
  try {
    client = createSupabaseFromRequest(request);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: msg }, { status: 401 });
  }

  let digest;
  try {
    digest = await fetchDigestByMonth(month, client);
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
    const element = createElement(DigestDocument, { digest }) as ReactElement<DocumentProps>;
    buffer = await renderToBuffer(element);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bloom/pdf] render failed:", msg);
    return Response.json({ ok: false, error: `render: ${msg}` }, { status: 500 });
  }

  const filename = digestFilename(month);
  // Node の Buffer / Uint8Array はランタイムでは BodyInit として受理されるが、
  // 現環境の Response 型定義では URLSearchParams 系オーバーロードが選択される
  // ため明示的に型断定する。
  const body = new Uint8Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  ) as unknown as BodyInit;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
