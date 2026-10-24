import { describe,it,expect } from 'vitest';
import { addKeys,appliedAt,classify,dateKey,emailKey,identity,kanaKey,keys,kintoneValues,nameKey,phoneKey,plan,splitName,type BaitoruSettings,type CsvRow } from './baitoru';
export const config:BaitoruSettings={enabled:true,period_start:'2026-09-22',chatwork_title:'【バイトル新規応募】',exclude_inquiry_nos:[],notify_room:'dev',mentions:'',max_per_run:10};
export const row:CsvRow={'問合せNo':'238839646','応募日時':'2026/10/24 10:12:00','氏名（漢字）':'山田 花子','氏名（ふりがな）':'やまだ はなこ','メールアドレス（PC）':'A@example.com','電話番号':'090-1234-5678','生年月日':'2000/01/01'};
const now=Date.parse('2026-10-24T12:00:00+09:00');
describe('Baitoru original seven dedup examples and five rules',()=>{
 const a=identity(row);
 it.each([
  ['inquiry number',{...a,phone:'',email:'',name:'',kana:'',birthday:''},'inquiryNo_match',false],
  ['current-period phone/name',{...a,inquiry:'other'},'phone_name_period_match',false],
  ['past phone/name bypasses email birth and kana',{...a,inquiry:'other',created:'2026-08-01T00:00:00Z'},'',true],
  ['email/name',{...a,inquiry:'other',phone:''},'email_name_match',false],
  ['kanji/birth',{...a,inquiry:'other',phone:'',email:''},'kanji_birth_match',false],
  ['kana 30 days',{...a,inquiry:'other',phone:'',email:'',birthday:''},'kana_name_match',false],
  ['new person',{...a,inquiry:'other',phone:'',email:'',birthday:'',kana:''},'',false],
 ])('%s',(_label,old,reason,isRepeat)=>{
  const existing=keys();addKeys(existing,old,config.period_start,now);
  expect(classify(a,existing,keys())).toEqual({reason,isRepeat});
 });
 it('detects same-batch inquiry, phone/name, and fallback keys; ignores empty and old kana',()=>{
  const batch=keys();addKeys(batch,a,config.period_start,now,true);
  expect(classify(a,keys(),batch).reason).toBe('batch_inquiryNo_dup');
  expect(classify({...a,inquiry:'other'},keys(),batch).reason).toBe('batch_phone_name_dup');
  expect(classify({...a,inquiry:'other',phone:''},keys(),batch).reason).toBe('email_name_match');
  const old=keys();addKeys(old,{...a,inquiry:'',phone:'',email:'',birthday:'1900-01-01',applied:'2026-08-01T00:00:00Z'},config.period_start,now);
  expect(classify({...a,inquiry:'',phone:'',email:'',birthday:'1900-01-01'},old,keys()).reason).toBe('');
  expect(classify(identity({}),keys(),keys()).reason).toBe('');
 });
});
describe('normalization, filters and mapping',()=>{
 it('normalizes phone, email, kanji, kana and real dates without changing Gmail aliases',()=>{
  expect(phoneKey('＋８１ ９０－１２３４―５６７８')).toBe('09012345678');
  expect(emailKey(' Ａ.Test+Tag@GMAIL.COM ')).toBe('a.test+tag@gmail.com');
  expect(nameKey('山田　花子')).toBe('山田花子');expect(kanaKey('ﾔﾏﾀﾞ はなこ')).toBe('ヤマダハナコ');
  expect(dateKey('2026/2/30')).toBe('');expect(appliedAt('2026/10/24 25:00:00')).toBe('');
  expect(appliedAt(row['応募日時'])).toBe('2026-10-24T01:12:00.000Z');
 });
 it('filters seed, period, exclusion, missing fields and sorts oldest first before limiting',()=>{
  const rows=[{...row,'問合せNo':'238839645'},{...row,'問合せNo':'238839647','応募日時':'2026/09/21 12:00:00'},{...row,'問合せNo':'238839648'},{...row,'問合せNo':'238839649','氏名（漢字）':''}];
  const p=plan(rows,[],{...config,exclude_inquiry_nos:['238839648']},undefined,now);
  expect(p.filtered).toEqual({seed:1,period:1,excluded:1,missing:1});expect(p.selected).toHaveLength(0);
  const older={...row,'問合せNo':'238839650','応募日時':'2026/09/22 00:00:00','氏名（漢字）':'別 人','氏名（ふりがな）':'べつ ひと'};
  const limit=plan([row,older],[],{...config,max_per_run:1},undefined,now);
  expect(limit.selected[0].row).toEqual(older);expect(limit.trimmed).toBe(1);
 });
 it('splits names and writes required fields with optional kana',()=>{
  expect(splitName('林太郎')).toEqual(['林','太郎']);expect(splitName('山田花子')).toEqual(['山田','花子']);expect(splitName('林')).toEqual(['林','-']);
  const v=kintoneValues(row,new Date(now));expect(v).toMatchObject({従業員名_姓:'山田',従業員名_名:'花子',従業員名_姓カナ:'ヤマダ',従業員名_名カナ:'ハナコ',性別:'女性',ドロップダウン:'25～29歳',日付_0:'2026-10-24',生年月日:'2000-01-01'});
  expect(kintoneValues({...row,生年月日:'','氏名（ふりがな）':''})).toMatchObject({生年月日:'1900-01-01',ドロップダウン:'-'});
 });
});
