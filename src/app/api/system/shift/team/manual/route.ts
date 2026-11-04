import { shiftRoute } from "@/lib/shift/route.server";

export async function POST(request: Request) {
  return shiftRoute(request, "manual");
}
