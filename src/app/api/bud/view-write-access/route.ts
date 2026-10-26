import { budWriteResponse } from "@/lib/auth/bud-view.server";

export async function GET() {
  return await budWriteResponse() ?? new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
}
