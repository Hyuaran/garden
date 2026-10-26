import { hireResponse, hireAdminContext, HireError, listCandidates, saveCandidate } from "@/app/system/onboarding/_lib/hire-candidates.server";
export async function GET(request: Request) {
 const tab = new URL(request.url).searchParams.get("tab") === "confirmations" ? "confirmations" : "candidates";
 try { return Response.json(await listCandidates(await hireAdminContext(tab), tab), {headers:{"Cache-Control":"private, no-store"}}); }
 catch(e) { return Response.json({error:e instanceof Error ? e.message : "読み込めませんでした"},{status:e instanceof HireError ? e.status : 403}); }
}
export async function POST(request: Request) { return hireResponse(async c => saveCandidate(c,await request.json())); }
