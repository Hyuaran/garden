import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { verifyLiffEmployee } from '@/lib/line/liff-verify.server';
import { encryptMyNumber } from '@/lib/my-number/crypto.server';
import { validMyNumber } from '@/lib/my-number/validation';
import sharp from 'sharp';
export const runtime = 'nodejs';
const headers = {'Cache-Control':'private, no-store'};
const reply = (body: unknown, status = 200) => Response.json(body,{status,headers});
async function readForm(request: Request) {
  const reader=request.body?.getReader();
  if(!reader) return null;
  const chunks:Uint8Array[]=[];let size=0;
  try {
    for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>5*1024*1024+20000){await reader.cancel();return null;}chunks.push(value);}
    return await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
  }catch{return null;}finally{reader.releaseLock();}
}
export async function GET(request: Request) {
  const employee = await verifyLiffEmployee(request.headers.get('authorization')?.replace(/^Bearer /i,''),'forms');
  if(employee instanceof Response) return employee;
  const {data,error} = await getSupabaseAdmin().from('root_employee_my_numbers').select('my_number_last4,status,submitted_at,rejection_reason').eq('employee_id',employee.employee_id).maybeSingle();
  return error ? reply({error:'提出の状況を読み込めませんでした。'},503) : reply({name:employee.name,row:data});
}
export async function POST(request: Request) {
  const employee = await verifyLiffEmployee(request.headers.get('authorization')?.replace(/^Bearer /i,''),'forms');
  if(employee instanceof Response) return employee;
  if(Number(request.headers.get('content-length')) > 5*1024*1024+20000) return reply({error:'写真は5MBまでです。'},413);
  const form = await readForm(request);
  const number = form?.get('my_number'), photo = form?.get('photo');
  if(form?.get('consent') !== 'true' || !validMyNumber(number) || !(photo instanceof File) || !['image/jpeg','image/png'].includes(photo.type) || !photo.size || photo.size>5*1024*1024) return reply({error:'利用目的への同意、12桁の番号、5MBまでの写真を確認してください。'},400);
  const db = getSupabaseAdmin();
  const {data:allowed,error:limitError} = await db.rpc('consume_liff_submission_limit',{p_employee_id:employee.employee_id});
  if(limitError) return reply({error:'送信できませんでした。'},503);
  if(!allowed) return Response.json({error:'少し時間をおいてから送信してください。'},{status:429,headers:{...headers,'Retry-After':'60'}});
  let image: Buffer;
  try {
    const bytes = Buffer.from(await photo.arrayBuffer());
    const metadata = await sharp(bytes,{limitInputPixels:25000000}).metadata();
    if(!['jpeg','png'].includes(metadata.format || '')) return reply({error:'写真はJPEGかPNGを選んでください。'},400);
    image = await sharp(bytes,{limitInputPixels:25000000}).rotate().resize({width:3000,height:3000,fit:'inside',withoutEnlargement:true}).jpeg({quality:90}).toBuffer();
  } catch { return reply({error:'写真を読み取れませんでした。'},400); }
  let encrypted;
  try { encrypted = encryptMyNumber(number); } catch { return reply({error:'現在は提出を受け付けられません。'},503); }
  const path = `${employee.employee_id}/${globalThis.crypto.randomUUID()}.jpg`;
  const bucket = db.storage.from('my-number-photos');
  const {error:uploadError} = await bucket.upload(path,image,{contentType:'image/jpeg',upsert:false});
  if(uploadError) return reply({error:'写真を保存できませんでした。'},503);
  const now = new Date().toISOString();
  const {error} = await db.from('root_employee_my_numbers').upsert({employee_id:employee.employee_id,...encrypted,my_number:null,photo_path:path,source:'liff',status:'pending',submitted_at:now,consented_at:now,confirmed_at:null,confirmed_by:null,rejection_reason:null},{onConflict:'employee_id'});
  if(error) { await bucket.remove([path]); return reply({error:'送信できませんでした。'},503); }
  return reply({row:{my_number_last4:encrypted.my_number_last4,status:'pending',submitted_at:now,rejection_reason:null}});
}
