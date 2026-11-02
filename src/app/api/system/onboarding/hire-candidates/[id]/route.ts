import { hireResponse, saveCandidate } from "@/app/system/onboarding/_lib/hire-candidates.server";
export async function PATCH(request: Request, {params}: {params: Promise<{id:string}>}) {
 let body; try { body=await request.json(); } catch { return Response.json({error:"入力内容を確認してください"},{status:400}); }
 const tab = body && typeof body === "object" && (Object.hasOwn(body,"checklist") || Object.hasOwn(body,"identity")) ? "confirmations" : "candidates";
 return hireResponse(async c => saveCandidate(c,body,(await params).id),tab);
}
