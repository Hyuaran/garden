import { hireResponse } from "@/app/system/onboarding/_lib/hire-candidates.server";
import { requestFilemakerAccount } from "@/app/system/onboarding/_lib/filemaker-accounts.server";
export async function POST(_req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 return hireResponse(c=>requestFilemakerAccount(c.db,id,c.userId));
}
