import { importLegacyFlagsAsOwnPins } from "@/app/rill/mail/_lib/graph";
import { errorResponse, requireGardenUser } from "@/app/rill/mail/_lib/server-auth";

export async function POST() {
  try {
    const { supabase, user } = await requireGardenUser();
    return Response.json(await importLegacyFlagsAsOwnPins(supabase, user));
  } catch (error) {
    return errorResponse(error);
  }
}
