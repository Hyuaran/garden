import { hireResponse, saveCandidate } from "@/app/system/onboarding/_lib/hire-candidates.server";
import { deleteHireCandidate } from "@/app/system/onboarding/_lib/hire-candidate-delete.server";
export async function DELETE(_request: Request, {params}: {params: Promise<{id:string}>}) {
 try { return Response.json(await deleteHireCandidate((await params).id)); }
 catch(error) { return Response.json({error:error instanceof Error ? error.message : "削除できませんでした"},{status: typeof (error as {status?:number})?.status === "number" ? (error as {status:number}).status : 400}); }
}
export async function PATCH(request: Request, {params}: {params: Promise<{id:string}>}) {
 let body; try { body=await request.json(); } catch { return Response.json({error:"入力内容を確認してください"},{status:400}); }
 const tab = body && typeof body === "object" && (Object.hasOwn(body,"checklist") || Object.hasOwn(body,"identity")) ? "confirmations" : "candidates";
 return hireResponse(async c => saveCandidate(c,body,(await params).id),tab);
}
