import { NextResponse } from "next/server";
import { getPublicCompany } from "../_lib/public-company";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_CACHE = "public, s-maxage=300, stale-while-revalidate=600";

function headers(cacheControl = PUBLIC_CACHE) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": cacheControl,
    "Content-Type": "application/json; charset=utf-8",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: headers() });
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  const cacheControl = url.searchParams.get("nocache") === "1" ? "no-store" : PUBLIC_CACHE;
  const company = await getPublicCompany(slug);

  if (!company) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404, headers: headers(cacheControl) },
    );
  }

  return NextResponse.json(company, { headers: headers(cacheControl) });
}
