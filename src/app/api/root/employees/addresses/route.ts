import { systemViewResponse } from "@/lib/auth/view-permission.server";
import { NextResponse } from "next/server";
import { getCurrentAddresses } from "@/app/root/_lib/profile-history.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await systemViewResponse("root-employees");
  if (denied) return denied;
  const addresses = await getCurrentAddresses(getSupabaseAdmin());
  return NextResponse.json(addresses);
}
