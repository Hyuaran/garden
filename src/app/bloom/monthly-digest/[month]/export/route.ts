/**
 * 月次ダイジェスト PDF エクスポート Route Handler (stub)
 *
 * §10.3 判2: Node ランタイム採用（日本語フォント埋込のため）。
 * 実装は T9 以降で行う（pdf-lib + IPA フォント 埋込 / または puppeteer）。
 *
 * MVP stub: 501 を返して UI からの導線のみ通す。
 */

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  _context: { params: Promise<{ month: string }> },
) {
  return new Response(
    JSON.stringify({
      error: "not_implemented",
      message: "PDF エクスポートは T9 以降で実装予定です",
    }),
    {
      status: 501,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    },
  );
}
