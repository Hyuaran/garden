import { NextRequest } from "next/server";
import { searchMessages } from "@/app/rill/mail/_lib/graph";
import { errorResponse, requireGardenUser } from "@/app/rill/mail/_lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireGardenUser();
    return Response.json(await searchMessages(
      supabase,
      user,
      request.nextUrl.searchParams.get("q"),
      request.nextUrl.searchParams.get("box") ?? "all",
    ));
  } catch (error) { return errorResponse(error); }
}
