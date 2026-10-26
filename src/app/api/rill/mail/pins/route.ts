import { requireRillRead } from "@/app/rill/mail/_lib/view-access.server";
import { listPinnedMessages } from "@/app/rill/mail/_lib/graph";
import { errorResponse, requireGardenUser } from "@/app/rill/mail/_lib/server-auth";

export async function GET() {
  try {
    const { supabase, user, readTabs } = await requireRillRead("flagged");
    return Response.json(await listPinnedMessages(supabase, user, readTabs));
  } catch (error) { return errorResponse(error); }
}
