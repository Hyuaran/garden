export type RegistrationCategory = 'commute' | 'bank_account';
export function registrationText(category: RegistrationCategory, p: Record<string, unknown> = {}): string {
 const s=(key:string)=>typeof p[key]==='string'?String(p[key]):'';
 const n=(key:string)=>typeof p[key]==='number'?Number(p[key]):null;
 if(category==='bank_account')return [s('bank_name'),s('branch_name'),({ordinary:'普通',current:'当座',savings:'貯蓄'} as Record<string,string>)[s('account_type')]??s('account_type'),s('account_number')?'****'+s('account_number').slice(-4):''].filter(Boolean).join(' ')||'未登録';
 const one=n('one_way'),round=n('round_trip'),cap=n('monthly_cap');
 return round===null&&one===null?'未登録':'日額 '+(round??(one??0)*2).toLocaleString('ja-JP')+'円（片道 '+(one??Math.floor((round??0)/2)).toLocaleString('ja-JP')+'円・'+(cap===null?'上限なし':'上限 '+cap.toLocaleString('ja-JP')+'円')+'）'+(s('nearest_station')?' / 最寄り駅：'+s('nearest_station'):'');
}
