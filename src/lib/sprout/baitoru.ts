export type CsvRow = Record<string, string>;
export type BaitoruSettings = { enabled: boolean; period_start: string; chatwork_title: string; exclude_inquiry_nos: string[]; notify_room: 'production' | 'dev'; mention_employee_ids: string[]; max_per_run: number };
export const nameKey = (s: string) => s.normalize('NFKC').replace(/[\s　]/g, '');
export const kanaKey = (s: string) => nameKey(s).replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
export const phoneKey = (s: string) => s.normalize('NFKC').replace(/[-―ー－\s　]/g, '').replace(/^\+81/, '0');
export const emailKey = (s: string) => s.trim().normalize('NFKC').toLowerCase();
export function dateKey(s: string) {
 const m = s.normalize('NFKC').match(/^(\d{4})[\/年-](\d{1,2})[\/月-](\d{1,2})/);
 if (!m) return '';
 const d = `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
 return Number.isNaN(Date.parse(d)) || new Date(d).toISOString().slice(0,10) !== d ? '' : d;
}
export function appliedAt(s: string) {
 const d = dateKey(s); if (!d) return '';
 const time = s.match(/[ T日](\d{1,2}):(\d{2})(?::(\d{2}))?/);
 if (!time || Number(time[1])>23 || Number(time[2])>59 || Number(time[3] || 0)>59) return '';
 if (/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s)) return Number.isNaN(Date.parse(s)) ? '' : new Date(s).toISOString();
 const value = `${d}T${time[1].padStart(2,'0')}:${time[2]}:${time[3] || '00'}+09:00`;
 return Number.isNaN(Date.parse(value)) ? '' : new Date(value).toISOString();
}
export const email = (r: CsvRow) => r['メールアドレス（PC）']?.trim() || r['メールアドレス（携帯）']?.trim() || '';
export type Identity = { inquiry: string; phone: string; name: string; email: string; birthday: string; kana: string; created: string; applied: string };
export function identity(r: CsvRow): Identity {
 return { inquiry: r['問合せNo']?.trim() || '', phone: phoneKey(r['電話番号'] || ''), name: nameKey(r['氏名（漢字）'] || ''), email: emailKey(email(r)), birthday: dateKey(r['生年月日'] || ''), kana: kanaKey(r['氏名（ふりがな）'] || ''), created: appliedAt(r['応募日時'] || ''), applied: appliedAt(r['応募日時'] || '') };
}
const join = (a: string,b: string) => a && b ? `${a}|${b}` : '';
export function keys() { return { inquiry: new Set<string>(), phone: new Set<string>(), period: new Set<string>(), email: new Set<string>(), birth: new Set<string>(), kana: new Set<string>() }; }
type Keys = ReturnType<typeof keys>;
export function addKeys(k: Keys, a: Identity, period: string, now: number, batch = false) {
 const put = (s: Set<string>, value: string) => { if (value) s.add(value); };
 put(k.inquiry,a.inquiry); put(k.phone,join(a.phone,a.name));
 if (batch || Date.parse(a.created) >= Date.parse(`${period}T00:00:00+09:00`)) put(k.period,join(a.phone,a.name));
 put(k.email,join(a.email,a.name)); if(a.birthday !== '1900-01-01') put(k.birth,join(a.name,a.birthday));
 if (batch || Date.parse(a.applied) >= now - 30*86400000) put(k.kana,a.kana);
}
export function classify(a: Identity, existing: Keys, batch: Keys) {
 if(a.inquiry && existing.inquiry.has(a.inquiry)) return { reason:'inquiryNo_match', isRepeat:false };
 if(a.inquiry && batch.inquiry.has(a.inquiry)) return { reason:'batch_inquiryNo_dup', isRepeat:false };
 const phone = join(a.phone,a.name);
 if(phone && existing.period.has(phone)) return { reason:'phone_name_period_match', isRepeat:false };
 if(phone && batch.phone.has(phone)) return { reason:'batch_phone_name_dup', isRepeat:false };
 if(phone && existing.phone.has(phone)) return { reason:'', isRepeat:true };
 for (const [key,value,reason] of [['email',join(a.email,a.name),'email_name_match'],['birth',a.birthday === '1900-01-01' ? '' : join(a.name,a.birthday),'kanji_birth_match'],['kana',a.kana,'kana_name_match']] as const)
  if(value && (existing[key].has(value) || batch[key].has(value))) return {reason,isRepeat:false};
 return {reason:'',isRepeat:false};
}
export function plan(rows: CsvRow[], existingRows: Identity[], settings: BaitoruSettings, seed = '238839645', now = Date.now()) {
 const existing=keys(),batch=keys(), dedup: Record<string,number> = {}, filtered: Record<string,number> = {seed:0,period:0,excluded:0,missing:0};
 existingRows.forEach(a=>addKeys(existing,a,settings.period_start,now));
 const candidates: {row:CsvRow; isRepeat:boolean}[]=[];
 for(const row of rows) {
  const a=identity(row);
  if(/^\d+$/.test(a.inquiry) && BigInt(a.inquiry)<=BigInt(seed)) { filtered.seed++; continue; }
  if(dateKey(row['応募日時'] || '') && dateKey(row['応募日時'])<settings.period_start) {filtered.period++;continue;}
  if(settings.exclude_inquiry_nos.includes(a.inquiry)) {filtered.excluded++;continue;}
  const d=classify(a,existing,batch); if(d.reason) {dedup[d.reason]=(dedup[d.reason] || 0)+1;continue;}
  addKeys(batch,a,settings.period_start,now,true);
  if(!/^\d+$/.test(a.inquiry) || !a.name || !a.email || !a.phone || !a.applied) {filtered.missing++;continue;}
  candidates.push({row,isRepeat:d.isRepeat});
 }
 candidates.sort((a,b)=>appliedAt(a.row['応募日時']).localeCompare(appliedAt(b.row['応募日時'])));
 return {selected:candidates.slice(0,settings.max_per_run), dedup, filtered, trimmed:candidates.length-Math.min(candidates.length,settings.max_per_run)};
}
export function splitName(name: string) {
 const p=name.trim().normalize('NFKC').split(/\s+/); if(p.length>1) return [p[0],p.slice(1).join('')];
 const n=nameKey(name), cut=n.length>=4 ? 2 : 1; return [n.slice(0,cut),n.slice(cut) || '-'];
}
export function kintoneValues(row: CsvRow, now = new Date()) {
 const [last,first]=splitName(row['氏名（漢字）']);
 const kana=row['氏名（ふりがな）'] || '', parts=kana.trim().normalize('NFKC').split(/\s+/);
 const spaced=/\s/.test(row['氏名（漢字）'].trim()), cut=Math.round(kanaKey(kana).length*last.length/(last.length+first.length));
 const kp=parts.length>1 ? [kanaKey(parts[0]),kanaKey(parts.slice(1).join(''))] : spaced ? [kanaKey(kana),''] : [kanaKey(kana).slice(0,cut),kanaKey(kana).slice(cut)];
 const birth=dateKey(row['生年月日'] || ''), today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(now);
 let age=birth ? Number(today.slice(0,4))-Number(birth.slice(0,4))-(today.slice(5)<birth.slice(5)?1:0) : 0;
 if(birth==='1900-01-01') age=0;
 const group=age<15?'-':age<40?`${Math.floor(age/5)*5}～${Math.floor(age/5)*5+4}歳`:age<60?`${Math.floor(age/10)*10}歳代`:'60歳以上';
 const values: Record<string,unknown>={従業員名_姓:last,従業員名_名:first,メールアドレス:email(row),性別:['男性','女性'].includes(row['性別'])?row['性別']:'女性',連絡先_ハイフンなし:phoneKey(row['電話番号']),ドロップダウン_1:'①面接未決',ドロップダウン:group,日付_0:dateKey(row['応募日時']),生年月日:birth || '1900-01-01'};
 if(kana) { values['従業員名_姓カナ']=kp[0]; values['従業員名_名カナ']=kp[1]; }
 return values;
}
export const optionalMappings: Record<string,string> = {INQUIRY_NO:'問合せNo',APPLIED_AT:'応募日時',NAME_KANJI:'氏名（漢字）',NAME_KANA:'氏名（ふりがな）',BIRTHDAY:'生年月日',GENDER:'性別',EMAIL:'メールアドレス（PC）',PHONE:'電話番号',CURRENT_JOB:'現在の職業',JOB_NAME:'業務名',STATUS:'対応状況区分',APPLY_TYPE:'応募区分'};
