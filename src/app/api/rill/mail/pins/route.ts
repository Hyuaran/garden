import { listPinnedMessages } from "@/app/rill/mail/_lib/graph";
import { errorResponse, requireGardenUser } from "@/app/rill/mail/_lib/server-auth";

export async function GET() {
  try {
    const { supabase, user } = await requireGardenUser();
    return Response.json(await listPinnedMessages(supabase, user));
  } catch (error) { return errorResponse(error); }
}
