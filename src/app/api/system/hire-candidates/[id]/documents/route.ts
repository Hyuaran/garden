import { hireResponse } from "@/app/system/onboarding/_lib/hire-candidates.server";
import { hireDocuments } from "@/app/system/onboarding/_lib/hire-documents.server";
export async function POST(_req:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params;
 let body; try { body=await _req.json(); } catch { body={}; }
 return hireResponse(c=>hireDocuments(c,id,body.contract ?? {}));
}
