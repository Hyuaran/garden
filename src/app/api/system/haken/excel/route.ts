import { generateHakenExcel } from "@/lib/haken/haken-excel.server";
import { hakenContext, hakenError, loadHakenData } from "@/lib/haken/server";
import { todayJst } from "@/lib/haken/rules";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { db } = await hakenContext();
    const input: unknown = await request.json();
    if (!Array.isArray(input) || input.some((id) => typeof id !== "string")) {
      return Response.json(
        { error: "出力する人を選んでください。" },
        { status: 400 },
      );
    }
    const data = await loadHakenData(db);
    const ids = new Set(input);
    const workers = data.workers.filter((w) => !w.deleted_at && ids.has(w.id));
    const bytes = await generateHakenExcel(data, workers);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return hakenError(error);
  }
}
export async function GET(request: Request) {
  try {
    const { db } = await hakenContext();
    const data = await loadHakenData(db);
    const query = new URL(request.url).searchParams;
    const ids = query.getAll("id");
    const workers = data.workers.filter(
      (w) => !w.deleted_at && (!ids.length || ids.includes(w.id)),
    );
    const bytes = await generateHakenExcel(data, workers);
    const name = `派遣先管理台帳_${todayJst().replaceAll("-", "")}.xlsx`;
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return hakenError(error);
  }
}
