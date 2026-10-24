import { timingSafeEqual } from 'node:crypto';
import { ingestBaitoru } from '@/lib/sprout/baitoru.server';
export const runtime='nodejs';
export const maxDuration=300;
export async function POST(request: Request) {
 const secret=process.env.RELAY_SECRET;
 const received=Buffer.from(request.headers.get('authorization') || '');
 const expected=Buffer.from(`Bearer ${secret || ''}`);
 if(!secret || received.length!==expected.length || !timingSafeEqual(received,expected)) return Response.json({ok:false,error:'Unauthorized'},{status:401});
 let body: unknown;
 try {body=await request.json();} catch {return Response.json({ok:false,error:'本文を確認してください'},{status:400});}
 if(!body || typeof body!=='object' || !('rows' in body) || !Array.isArray(body.rows) || body.rows.length>10000 || ('dryRun' in body && typeof body.dryRun!=='boolean') || body.rows.some(r=>!r || typeof r!=='object' || Array.isArray(r) || Object.values(r).some(v=>typeof v!=='string'))) return Response.json({ok:false,error:'応募の行を確認してください'},{status:400});
 try {return Response.json(await ingestBaitoru(body.rows, 'dryRun' in body && body.dryRun===true));}
 catch {return Response.json({ok:false,error:'取り込みに失敗しました。取り込みの記録を確認してください'},{status:500});}
}
