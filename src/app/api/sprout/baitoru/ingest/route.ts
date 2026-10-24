import { timingSafeEqual } from 'node:crypto';
import { baitoruEnabled, ingestBaitoru, reportBaitoruFailure } from '@/lib/sprout/baitoru.server';
export const runtime='nodejs';
export const maxDuration=300;
function authorized(request: Request) {
 const secret=process.env.RELAY_SECRET;
 const received=Buffer.from(request.headers.get('authorization') || '');
 const expected=Buffer.from(`Bearer ${secret || ''}`);
 return !!secret && received.length===expected.length && timingSafeEqual(received,expected);
}
// ホスト PC が 10 分おきに最初に聞く：取り込みを動かしてよいか
export async function GET(request: Request) {
 if(!authorized(request)) return Response.json({ok:false,error:'Unauthorized'},{status:401});
 try {return Response.json({ok:true,enabled:await baitoruEnabled()});} catch {return Response.json({ok:false,error:'設定を読めませんでした'},{status:500});}
}
export async function POST(request: Request) {
 if(!authorized(request)) return Response.json({ok:false,error:'Unauthorized'},{status:401});
 let body: unknown;
 try {body=await request.json();} catch {return Response.json({ok:false,error:'本文を確認してください'},{status:400});}
 if(!body || typeof body!=='object' || !('rows' in body) || !Array.isArray(body.rows) || body.rows.length>10000 || ('dryRun' in body && typeof body.dryRun!=='boolean') || body.rows.some(r=>!r || typeof r!=='object' || Array.isArray(r) || Object.values(r).some(v=>typeof v!=='string'))) return Response.json({ok:false,error:'応募の行を確認してください'},{status:400});
 if('error' in body) {
  if(typeof body.error!=='string' || !body.error.trim() || body.error.length>500 || body.rows.length || ('dryRun' in body && body.dryRun===true)) return Response.json({ok:false,error:'失敗の知らせの形を確認してください'},{status:400});
  try {return Response.json(await reportBaitoruFailure(body.error));} catch {return Response.json({ok:false,error:'失敗の知らせを記録できませんでした'},{status:500});}
 }
 try {return Response.json(await ingestBaitoru(body.rows, 'dryRun' in body && body.dryRun===true));}
 catch {return Response.json({ok:false,error:'取り込みに失敗しました。取り込みの記録を確認してください'},{status:500});}
}
