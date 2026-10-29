import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { encryptMyNumber } from '@/lib/my-number/crypto.server';
import { validMyNumber } from '@/lib/my-number/validation';
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
export async function submitMyNumber(request: Request, employee: {employee_id:string}) {
  if(Number(request.headers.get('content-length')) > 5*1024*1024+20000) return reply({error:'写真は5MBまでです。'},413);
  const form = await readForm(request);
  const number = form?.get('my_number'), photo = form?.get('photo');
  if(form?.get('consent') !== 'true' || !validMyNumber(number) || !(photo instanceof File) || !['image/jpeg','image/png'].includes(photo.type) || !photo.size || photo.size>5*1024*1024) return reply({error:'利用目的への同意、12桁の番号、5MBまでの写真を確認してください。'},400);
  const db = getSupabaseAdmin();
  const {data:allowed,error:limitError} = await db.rpc('consume_liff_submission_limit',{p_employee_id:employee.employee_id});
  if(limitError) return reply({error:'送信できませんでした。'},503);
  if(!allowed) return Response.json({error:'少し時間をおいてから送信してください。'},{status:429,headers:{...headers,'Retry-After':'60'}});
  const bytes = Buffer.from(await photo.arrayBuffer());
  // 中身が JPEG／PNG かをファイルの先頭で確かめる（拡張子や申告の種類だけを信じない）。
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if(!isJpeg && !isPng) return reply({error:'写真はJPEGかPNGを選んでください。'},400);
  let image: Buffer = bytes, contentType = isPng ? 'image/png' : 'image/jpeg';
  // sharp はネイティブ依存で本番の環境では読み込めないことがあるため、使うときだけ読み込み、失敗したら元の写真のまま保存する（expense-ocr と同じ）。
  try {
    const sharp = (await import('sharp')).default;
    image = await sharp(bytes,{limitInputPixels:25000000}).rotate().resize({width:3000,height:3000,fit:'inside',withoutEnlargement:true}).jpeg({quality:90}).toBuffer();
    contentType = 'image/jpeg';
  } catch (error) { console.error('[my-number] sharp unavailable; storing original photo', error instanceof Error ? error.message : ''); }
  let encrypted;
  try { encrypted = encryptMyNumber(number); } catch { return reply({error:'現在は提出を受け付けられません。'},503); }
  const path = `${employee.employee_id}/${globalThis.crypto.randomUUID()}.${contentType === 'image/png' ? 'png' : 'jpg'}`;
  const bucket = db.storage.from('my-number-photos');
  const {error:uploadError} = await bucket.upload(path,image,{contentType,upsert:false});
  if(uploadError) return reply({error:'写真を保存できませんでした。'},503);
  const now = new Date().toISOString();
  const {error} = await db.from('root_employee_my_numbers').upsert({employee_id:employee.employee_id,...encrypted,my_number:null,photo_path:path,source:'liff',status:'pending',submitted_at:now,consented_at:now,confirmed_at:null,confirmed_by:null,rejection_reason:null},{onConflict:'employee_id'});
  if(error) { await bucket.remove([path]); return reply({error:'送信できませんでした。'},503); }
  return reply({row:{my_number_last4:encrypted.my_number_last4,status:'pending',submitted_at:now,rejection_reason:null}});
}
