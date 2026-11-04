import {
  hakenContext,
  hakenError,
  loadHakenData,
  mutateHaken,
} from "@/lib/haken/server";
export const runtime = "nodejs";
export async function GET() {
  try {
    const { db } = await hakenContext();
    return Response.json(await loadHakenData(db), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return hakenError(error);
  }
}
export async function POST(request: Request) {
  try {
    const context = await hakenContext(true);
    return Response.json(await mutateHaken(await request.json(), context));
  } catch (error) {
    return hakenError(error);
  }
}
