import { requireRillRead } from "@/app/rill/mail/_lib/view-access.server";
import { listMailAnomalies } from "@/app/rill/mail/_lib/graph";
import { errorResponse, requireGardenUser } from "@/app/rill/mail/_lib/server-auth";

export async function GET() {
  try {
    const { supabase, user, readTabs } = await requireRillRead();
    return Response.json(await listMailAnomalies(supabase, user, new Date(), readTabs));
  } catch (error) {
    return errorResponse(error);
  }
}
