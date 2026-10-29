'use client';
import { FormRow, TextField, SelectField, RadioGroup } from '@/app/system/forms/_components/form-kit';
import { ROSTER_FIELDS, ROSTER_CHOICES } from '../_lib/roster-fields';
export type ProfileDraft = Record<string,Record<string,unknown>>;
const labels: Record<string,string> = {postal_code:'郵便番号',prefecture:'都道府県',city:'市町村',town:'町域',building:'建物名',room:'部屋番号',phone:'連絡先',phone_1:'連絡先1',phone_2:'連絡先2',phone_3:'連絡先3',bank_name:'銀行名',bank_code:'金融機関コード',branch_name:'支店名',branch_code:'支店コード',account_type:'種別',account_number:'口座番号',holder_kana:'名義カナ',one_way:'交通費 片道',monthly_cap:'交通費上限',nearest_station:'最寄り駅',route:'通勤経路',paid:'交通費支給',business:'事業名（旧区分・Root の「事業」とは別の項目）',department:'部署名',affiliation:'所属',base_hourly:'基準時給',training_hourly:'研修時給',training_cap:'研修上限',year_end_adjustment:'年末調整',social_insurance:'社会保険',employment_insurance:'雇用保険',employment_insurance_no:'雇用保険番号',pension_no:'年金番号',advance_pay:'前払い希望',call_type:'架電区分'};
export default function RosterProfileFields({categories,draft,onChange,disabled}:{categories:string[];draft:ProfileDraft;onChange:(category:string,key:string,value:unknown)=>void;disabled:boolean}) {
  return <fieldset disabled={disabled} style={{border:0,padding:0,margin:0}}>{categories.map(category => <div key={category}>
    {category === 'sub_account' && <h3>口座2</h3>}
    {Object.entries(ROSTER_FIELDS[category]).filter(([key]) => labels[key]).map(([key,code]) => {
      const payload = category === 'sub_account' ? draft.bank_account?.sub_account as Record<string,unknown> : draft[category];
      const raw = payload?.[key];
      const value = key === 'account_type' ? ({ordinary:'普通',current:'当座'} as Record<string,string>)[String(raw)] ?? String(raw ?? '') : String(raw ?? '');
      const label = category === 'sub_account' ? '口座2 '+labels[key] : labels[key];
      const choices = ROSTER_CHOICES[code];
      const change = (v:string) => onChange(category,key,key === 'account_type' ? ({普通:'ordinary',当座:'current'} as Record<string,string>)[v] ?? v : v);
      return <FormRow key={key} label={label}>{choices ? choices.length <= 3 ? <RadioGroup name={`${category}-${key}`} label={label} options={choices} value={value} onChange={change}/> : <SelectField aria-label={label} value={value} onChange={e=>change(e.target.value)}><option value="">選んでください</option>{value && !choices.includes(value) && <option value={value}>{value}（現在の値）</option>}{choices.map(v=><option key={v}>{v}</option>)}</SelectField> : <TextField aria-label={label} value={value} onChange={e=>change(e.target.value)}/>}</FormRow>;
    })}
  </div>)}</fieldset>;
}
