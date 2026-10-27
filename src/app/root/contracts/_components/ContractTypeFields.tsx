"use client";
import { CONTRACT_TYPES, contractDefaults, type EmploymentContractPayload } from "../_lib/employment-contract";
export function ContractTypeFields({value:p,onChange}:{value:Partial<EmploymentContractPayload>;onChange:(p:Partial<EmploymentContractPayload>)=>void}) {
 const employee=p.templateType && p.templateType!=="part_time";
 return <>
  <label>契約書の種類<select value={p.templateType??"part_time"} onChange={e=>onChange({...p,...contractDefaults(e.target.value as NonNullable<EmploymentContractPayload["templateType"]>)})}>{Object.entries(CONTRACT_TYPES).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
  <label>雇用期間<select value={p.indefinite?"yes":"no"} onChange={e=>onChange({...p,indefinite:e.target.value==="yes"})}><option value="no">定めあり</option><option value="yes">定めなし</option></select></label>
  <label>契約更新<input value={p.renewalText??""} onChange={e=>onChange({...p,renewalText:e.target.value})}/></label>
  <label>通勤手当の月額上限（円）<input type="number" min="0" value={p.commuteCap??20000} onChange={e=>onChange({...p,commuteCap:Number(e.target.value)})}/></label>
  {employee&&<>
   <label>業務内容<textarea required value={p.duties??""} onChange={e=>onChange({...p,duties:e.target.value})}/></label>
   <label>就業時間<textarea required value={p.workHours??""} onChange={e=>onChange({...p,workHours:e.target.value})}/></label>
   <label>固定残業<select value={p.fixedOvertime?"yes":"no"} onChange={e=>onChange({...p,fixedOvertime:e.target.value==="yes"})}><option value="no">なし</option><option value="yes">あり（30時間・超過分別途支給）</option></select></label>
   {p.templateType==="nhk_dispatch"&&<>
    <label>始業<input type="time" required value={p.startTime??""} onChange={e=>onChange({...p,startTime:e.target.value})}/></label>
    <label>終業<input type="time" required value={p.endTime??""} onChange={e=>onChange({...p,endTime:e.target.value})}/></label>
    <label>休憩（分）<input type="number" min="0" required value={p.breakMinutes??60} onChange={e=>onChange({...p,breakMinutes:Number(e.target.value)})}/></label>
   </>}
  </>}
 </>;
}
