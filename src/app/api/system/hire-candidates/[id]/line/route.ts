import { hireResponse } from "@/app/system/onboarding/_lib/hire-candidates.server";
import { checkHireLine } from "@/app/system/onboarding/_lib/hire-line.server";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params;
 return hireResponse(async c=>checkHireLine(c,id,await req.json()));
}
