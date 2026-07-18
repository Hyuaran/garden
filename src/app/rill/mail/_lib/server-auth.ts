import { createServerClient } from "@/app/_lib/supabase/server";

export class RillMailHttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function requireGardenUser() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new RillMailHttpError(401, "Garden login required");
  return { supabase, user: data.user };
}

export function errorResponse(error: unknown) {
  const status = error instanceof RillMailHttpError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Unexpected error";
  return Response.json({ error: message }, { status });
}
