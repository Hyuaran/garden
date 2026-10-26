import { requireRillRead } from "@/app/rill/mail/_lib/view-access.server";
import { NextRequest } from "next/server";
import { listMessages } from "@/app/rill/mail/_lib/graph";
import { errorResponse, requireGardenUser } from "@/app/rill/mail/_lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, readTabs } = await requireRillRead(request.nextUrl.searchParams.get("box") ?? "all");
    return Response.json(await listMessages(supabase, user, request.nextUrl.searchParams.get("box") ?? "all", request.nextUrl.searchParams.get("cursor"), readTabs));
  } catch (error) { return errorResponse(error); }
}
