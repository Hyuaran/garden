import { requireRillWrite } from "@/app/rill/mail/_lib/view-access.server";
import { importLegacyFlagsAsOwnPins } from "@/app/rill/mail/_lib/graph";
import { errorResponse, requireGardenUser } from "@/app/rill/mail/_lib/server-auth";

export async function POST() {
  try {
    const { supabase, user } = await requireRillWrite();
    return Response.json(await importLegacyFlagsAsOwnPins(supabase, user));
  } catch (error) {
    return errorResponse(error);
  }
}
