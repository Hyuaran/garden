import { listVisibleBoxes } from "@/app/rill/mail/_lib/graph";
import { errorResponse, requireGardenUser } from "@/app/rill/mail/_lib/server-auth";

export async function GET() {
  try {
    const { supabase, user } = await requireGardenUser();
    const [boxes, employees] = await Promise.all([
      listVisibleBoxes(supabase, user),
      supabase.from("root_employees").select("name").not("name", "is", null),
    ]);
    const reviewers = [...new Set((employees.data ?? []).map((employee) => employee.name).filter((name): name is string => Boolean(name)))];
    return Response.json({ boxes, reviewers });
  }
  catch (error) { return errorResponse(error); }
}
