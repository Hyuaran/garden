"use server";
import { requireSproutUser } from '@/lib/sprout/access.server';
import { queryPg } from '@/lib/db/pg';
import { resendBaitoru } from '@/lib/sprout/baitoru.server';
import { dateKey, type BaitoruSettings } from '@/lib/sprout/baitoru';
export async function loadBaitoru() {
 await requireSproutUser();
 const [settings,runs,failed]=await Promise.all([
  queryPg<BaitoruSettings & {last_called_at:string|null}>('select * from sprout_baitoru_settings where id=true',[]),
  queryPg<{id:string;started_at:string;counts:Record<string,number>;dedup_by_reason:Record<string,number>;error:string|null}>('select * from sprout_baitoru_runs order by id desc limit 50',[]),
  queryPg<{kintone_record_id:string;name:string;notify_error:string}>("select kintone_record_id,name,notify_error from sprout_applicants where source='baitoru' and notified_at is null and notify_error is not null order by applied_date",[]),
 ]);
 return JSON.parse(JSON.stringify({settings:settings.rows[0],runs:runs.rows,failed:failed.rows})) as {settings:BaitoruSettings & {last_called_at:string|null};runs:typeof runs.rows;failed:typeof failed.rows};
}
export async function saveBaitoru(s: BaitoruSettings) {
 const user=await requireSproutUser();
 if(typeof s.enabled!=='boolean' || dateKey(s.period_start)!==s.period_start || !['dev','production'].includes(s.notify_room) || !Number.isInteger(s.max_per_run) || s.max_per_run<1 || s.max_per_run>100 || typeof s.chatwork_title!=='string' || s.chatwork_title.length>500 || typeof s.mentions!=='string' || s.mentions.length>10000 || !Array.isArray(s.exclude_inquiry_nos) || s.exclude_inquiry_nos.some(n=>typeof n!=='string' || !/^\d+$/.test(n))) throw new Error('設定の内容を確認してください');
 await queryPg('update sprout_baitoru_settings set enabled=$1,period_start=$2,chatwork_title=$3,exclude_inquiry_nos=$4,notify_room=$5,mentions=$6,max_per_run=$7,updated_at=now(),updated_by=$8 where id=true',[s.enabled,s.period_start,s.chatwork_title,s.exclude_inquiry_nos,s.notify_room,s.mentions,s.max_per_run,user.id]);
}
export async function retryBaitoru(id:string) {
 await requireSproutUser();
 return resendBaitoru(id);
}
