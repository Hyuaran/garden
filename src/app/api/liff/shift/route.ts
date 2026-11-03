import { shiftRoute } from "@/lib/shift/route.server";
export const GET = (r: Request) => shiftRoute(r, "my", true);
export const PUT = GET;
