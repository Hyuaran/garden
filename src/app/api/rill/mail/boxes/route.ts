import { listVisibleBoxes } from "@/app/rill/mail/_lib/graph";
import { errorResponse, requireGardenUser } from "@/app/rill/mail/_lib/server-auth";

export async function GET() {
  try {
    const { supabase, user } = await requireGardenUser();
    const [boxes, employees] = await Promise.all([
      listVisibleBoxes(supabase, user),
      supabase.from("root_employees").select("name,user_id").not("name", "is", null),
    ]);
    const reviewers = [...new Set((employees.data ?? []).map((employee) => employee.name).filter((name): name is string => Boolean(name)))];
    const ownName = employees.data?.find((employee) => employee.user_id === user.id)?.name ?? null;
    return Response.json({ boxes, reviewers, ownName });
  }
  catch (error) { return errorResponse(error); }
}
