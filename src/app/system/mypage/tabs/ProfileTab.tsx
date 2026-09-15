"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { GARDEN_ROLE_LABELS, type GardenRole } from "@/app/root/_constants/types";
import type { MyPageProfile } from "../types";
import styles from "../mypage.module.css";
import SubmissionModal from "../_components/SubmissionModal";
import type {SubmissionRow,SubmissionType} from "../_lib/submission-types";

const MYPAGE_CONFIRM_INTERVAL_DAYS = 90;
type ProfileIcon = "lock" | "phone" | "route" | "bank" | "document";
type ConfirmCategory = "address" | "contact" | "emergency_contact" | "bank_account" | "commute" | "dependents";
const CONFIRM_CATEGORIES: Array<{ category: ConfirmCategory; label: string }> = [
  { category: "address", label: "住所" },
  { category: "contact", label: "連絡先" },
  { category: "emergency_contact", label: "緊急連絡先" },
  { category: "bank_account", label: "給与受取口座" },
  { category: "commute", label: "交通費" },
  { category: "dependents", label: "扶養の人数" },
];
const SOURCE_LABELS: Record<string, string> = { roster: "従業員名簿", bank_list: "口座一覧", transfer_group: "振込グループ", mf_contract: "電子契約の書類", employee_confirm: "本人確認", submission: "届出", onboarding: "入社手続き", admin: "事務の入力" };

function LineIcon({ icon, className }: { icon: ProfileIcon; className?: string }) {
  const paths: Record<ProfileIcon, ReactNode> = {
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
    phone: <path d="M7.2 3.5l2.4 4-2.1 1.8a15.5 15.5 0 0 0 7.2 7.2l1.8-2.1 4 2.4-1.2 3a2 2 0 0 1-2.2 1.2C9.8 19.8 4.2 14.2 3 6.9a2 2 0 0 1 1.2-2.2z"/>,
    route: <><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18h2a3 3 0 0 0 3-3v-6a3 3 0 0 1 3-3"/></>,
    bank: <><path d="M3 9l9-5 9 5M4 20h16M6 9v8M10 9v8M14 9v8M18 9v8"/></>,
    document: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5"/><path d="M9 13h6M9 17h5"/></>,
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[icon]}</svg>;
}

function InfoRow({ label, value, pending = false }: { label: string; value: string; pending?: boolean }) {
  return <div className={styles.infoRow}><dt>{label}</dt><dd className={pending ? styles.pending : undefined}>{value}</dd></div>;
}

export default function ProfileTab({ birthdayRegistered, profile, registered, onUnlocked }: {
  birthdayRegistered: boolean;
  profile: MyPageProfile | null;
  registered: boolean;
  onUnlocked: (profile: MyPageProfile) => void;
}) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [unlockError, setUnlockError] = useState(false);
  const submissionsRef = useRef<HTMLElement>(null);
  const [submissionType,setSubmissionType]=useState<SubmissionType|null>(null);const [submissionMessage,setSubmissionMessage]=useState("");const [submissions,setSubmissions]=useState<SubmissionRow[]>([]);const [confirming,setConfirming]=useState<string|null>(null);const [confirmError,setConfirmError]=useState("");const [submissionInitialValues,setSubmissionInitialValues]=useState<Record<string,string>|undefined>();
  async function loadSubmissions(){try{const response=await fetch("/api/system/mypage/submissions",{cache:"no-store"});if(response.ok)setSubmissions((await response.json()).rows??[])}catch{/* 届出一覧が取得できなくてもプロフィール表示は継続 */}}
  useEffect(()=>{if(profile)void loadSubmissions()},[profile]);

  async function unlock() {
    if (!/^\d{4}$/.test(code)) { setUnlockError(true); return; }
    setChecking(true); setUnlockError(false);
    try {
      const response = await fetch("/api/system/mypage/unlock", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }),
      });
      const result = await response.json() as { ok?: boolean; profile?: MyPageProfile };
      if (!response.ok || !result.ok || !result.profile) setUnlockError(true);
      else { onUnlocked(result.profile); setCode(""); }
    } catch { setUnlockError(true); }
    finally { setChecking(false); }
  }

  if (!profile && !birthdayRegistered && !registered) {
    return <section className={styles.comingSoon}><h2>従業員情報がありません</h2><p>従業員情報が登録されていません。管理者にご連絡ください。</p></section>;
  }

  if (!profile) return <section className={styles.unlockPanel} aria-label="個人情報を開く">
    <LineIcon icon="lock" className={styles.lockIcon}/>
    <p>個人情報を閲覧するには、キーワードを入力してください。</p>
    <input className={styles.unlockCode} aria-label="誕生日の月日4桁" placeholder="誕生日を入力　例：12/1の場合1201" inputMode="numeric" autoComplete="one-time-code" type="text"
      value={code} maxLength={4} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
      onKeyDown={(event) => { if (event.key === "Enter") void unlock(); }} />
    {unlockError && <p role="alert" className={styles.error}>4桁が一致しません。</p>}
    <button type="button" disabled={checking} onClick={() => void unlock()}>{checking ? "確認中…" : "マイページを開く"}</button>
  </section>;

  const unlockedProfile = profile;
  const roleLabel = GARDEN_ROLE_LABELS[unlockedProfile.gardenRole as GardenRole] ?? unlockedProfile.gardenRole;
  const commute=unlockedProfile.commuteDailyAllowance===null?"未登録":`日額 ${unlockedProfile.commuteDailyAllowance.toLocaleString("ja-JP")}円（${unlockedProfile.commuteMonthlyCap===null?"上限なし":`月の上限 ${unlockedProfile.commuteMonthlyCap.toLocaleString("ja-JP")}円`}）`;
  const bank=unlockedProfile.bankName&&unlockedProfile.branchName?`${unlockedProfile.bankName} ${unlockedProfile.branchName}`:"未登録";
  const isConfirmed = (category: ConfirmCategory) => {
    const value = unlockedProfile.confirmations?.[category];
    if (!value) return false;
    const days = (Date.now() - new Date(value).getTime()) / 86_400_000;
    return Number.isFinite(days) && days < MYPAGE_CONFIRM_INTERVAL_DAYS;
  };
  const pendingByCategory = (category: ConfirmCategory) => {
    const types: Record<ConfirmCategory, string[]> = { address:["emergency_contact"], contact:["emergency_contact"], emergency_contact:["emergency_contact"], bank_account:["bank_account"], commute:["commute_route"], dependents:[] };
    return unlockedProfile.pendingSubmissions?.find((row)=>types[category].includes(row.type));
  };
  const remaining = CONFIRM_CATEGORIES.filter(({category}) => !isConfirmed(category) && !pendingByCategory(category)).length;
  async function refreshProfile(){try{const response=await fetch("/api/system/mypage/profile-current",{cache:"no-store"});if(response.ok){const result=await response.json() as {profile?:MyPageProfile};if(result.profile)onUnlocked(result.profile)}}catch{/* 再取得に失敗しても楽観更新の表示は維持する */}}
  async function confirmCategory(category:ConfirmCategory){setConfirmError("");setConfirming(category);const before=unlockedProfile;try{const response=await fetch("/api/system/mypage/profile-confirm",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({category})});if(!response.ok)throw new Error();const result=await response.json() as {confirmedAt?:string};onUnlocked({...unlockedProfile,confirmations:{...(unlockedProfile.confirmations??{}),[category]:result.confirmedAt??new Date().toISOString()}});void refreshProfile()}catch{onUnlocked(before);setConfirmError("保存できませんでした。もう一度お試しください")}finally{setConfirming(null)}}
  function textValue(category:ConfirmCategory){const p=unlockedProfile.current?.[category]?.payload??{};const s=(key:string)=>typeof p[key]==="string"?String(p[key]):"";const n=(key:string)=>typeof p[key]==="number"?Number(p[key]):null;if(category==="address")return s("full")||"未登録";if(category==="contact")return [s("phone"),s("email")].filter(Boolean).join(" / ")||"未登録";if(category==="emergency_contact")return [s("name"),s("relation")?`（${s("relation")}）`:"",s("phone"),s("same_address_as_employee")==="true"?"本人と同じ":s("address")].join(" ").trim()||"未登録";if(category==="bank_account")return [s("bank_name"),s("branch_name"),({ordinary:"普通",current:"当座",savings:"貯蓄"} as Record<string,string>)[s("account_type")]??s("account_type"),s("account_number")].filter(Boolean).join(" ")||"未登録";if(category==="commute"){const one=n("one_way"), round=n("round_trip"), cap=n("monthly_cap");return round===null&&one===null? "未登録":`日額 ${(round??(one??0)*2).toLocaleString("ja-JP")}円（片道 ${(one??Math.floor((round??0)/2)).toLocaleString("ja-JP")}円・${cap===null?"上限なし":`上限 ${cap.toLocaleString("ja-JP")}円`}）${s("nearest_station")?` / 最寄り駅：${s("nearest_station")}`:""}`;}return p.count===undefined?"未登録":`${String(p.count)} 人`;}
  function sourceText(category:ConfirmCategory){const item=unlockedProfile.current?.[category];if(!item)return "";return `出どころ：${SOURCE_LABELS[item.source]??item.source}${item.effectiveFrom?`（${item.effectiveFrom}）`:""}`;}
  function openDifferent(category:ConfirmCategory){const current=unlockedProfile.current??{};const payload=(key:string)=>current[key]?.payload??{};const s=(obj:Record<string,unknown>,key:string)=>typeof obj[key]==="string"?String(obj[key]):"";if(category==="dependents"){setSubmissionMessage("扶養の変更は事務までご連絡ください");return;}if(["address","contact","emergency_contact"].includes(category)){const a=payload("address"),c=payload("contact"),e=payload("emergency_contact");setSubmissionInitialValues({selfAddress:s(a,"full"),selfPhone:s(c,"phone"),ecName:s(e,"name"),ecRelationship:s(e,"relation"),ecAddress:Boolean(e.same_address_as_employee)?"同上":s(e,"address"),ecPhone:s(e,"phone")});setSubmissionType("emergency_contact");return;}if(category==="bank_account"){const b=payload("bank_account");setSubmissionInitialValues({bankName:s(b,"bank_name"),bankCode:s(b,"bank_code"),branchName:s(b,"branch_name"),branchCode:s(b,"branch_code"),holderKana:s(b,"holder_kana")});setSubmissionType("bank_account");return;}const commutePayload=payload("commute");setSubmissionInitialValues({station:s(commutePayload,"nearest_station")});setSubmissionType("commute_route");}
  return <div className={styles.profileContent}>
    {!birthdayRegistered && <p className={styles.unlockedNotice}>生年月日が未登録のため確認を省略しています。</p>}
    {remaining>0 && <section className={styles.confirmationBanner} aria-label="登録内容の確認"><div><h2>登録内容の確認が済んでいません（残り {remaining} 件）</h2><p>会社に登録されているあなたの情報です。区分ごとに確認してください。</p></div></section>}
    {remaining>0 && <section className={styles.card}><h2>登録内容の確認</h2>{confirmError?<p role="alert" className={styles.error}>{confirmError}</p>:null}<div className={styles.confirmGrid}>{CONFIRM_CATEGORIES.map(({category,label})=>{const current=profile.current?.[category];const confirmed=isConfirmed(category);const pending=pendingByCategory(category);return <article className={styles.confirmCard} key={category}><h3>{label}</h3><p>{textValue(category)}</p>{sourceText(category)?<small>{sourceText(category)}</small>:null}{confirmed?<div className={styles.confirmedMark}>確認済み（{(profile.confirmations?.[category]??"").slice(0,10)}）</div>:pending?<div className={styles.confirmedMark}>届出済み（{pending.createdAt.slice(0,10)}）</div>:<div className={styles.confirmButtons}>{current?<button type="button" disabled={confirming===category} onClick={()=>void confirmCategory(category)}>{confirming===category?"保存中":"合っている"}</button>:null}{category!=="dependents"?<button type="button" className={styles.secondaryButton} onClick={()=>openDifferent(category)}>違う</button>:null}</div>}</article>})}</div></section>}

    <section className={styles.card}><h2>基本情報</h2><dl className={styles.infoGrid}>
      <InfoRow label="氏名" value={profile.name} /><InfoRow label="氏名カナ" value={profile.nameKana} />
      <InfoRow label="社員番号" value={profile.employeeNumber} /><InfoRow label="雇用形態" value={profile.employmentType} />
      <InfoRow label="生年月日" value={profile.birthday ?? "未登録"} /><InfoRow label="Garden権限" value={roleLabel} />
      <InfoRow label="メール" value={profile.email||"未登録"} /><InfoRow label="マイナンバー" value={profile.mynaSubmitted?"提出済み":"未提出"} />
      <InfoRow label="交通費" value={commute} /><InfoRow label="給与受取口座" value={bank} />
    </dl></section>

    <section className={`${styles.card} ${styles.previewCard}`}><span className={styles.preparingBadge}>準備中</span><h2>緊急連絡先</h2><p>緊急連絡先の登録・確認がマイページでできるようになります</p></section>

    <section className={`${styles.card} ${styles.previewCard}`}><span className={styles.preparingBadge}>準備中</span><h2>パフォーマンス推移</h2><p>架電数・有効率・順位の6ヶ月推移がここで見られるようになります</p></section>

    <section className={styles.card} ref={submissionsRef}><h2>提出・登録情報</h2><div className={styles.actionGrid}>
      {([ ["phone","emergency_contact","緊急連絡先変更"], ["route","commute_route","通勤経路変更"], ["bank","bank_account","給与受取口座の変更"], ["document","resignation","退職届"], ["lock","nda","秘密保持誓約書"] ] as Array<[ProfileIcon,SubmissionType,string]>).map(([icon,type,label])=><button type="button" key={type} onClick={()=>{setSubmissionMessage("");setSubmissionInitialValues(undefined);setSubmissionType(type)}}><LineIcon icon={icon}/>{label}</button>)}
    </div>{submissionMessage?<p role="status" className={styles.receivedMessage}>{submissionMessage}</p>:null}</section>
    {submissions.filter(row=>row.submission_type==="commute_route"&&row.status==="awaiting_employee").map(row=><section className={`${styles.card} ${styles.proposalCard}`} key={row.id}><h2>通勤交通費のご提案</h2><p>日額{((row.proposed_one_way??0)*2).toLocaleString("ja-JP")}円（片道{(row.proposed_one_way??0).toLocaleString("ja-JP")}円）で申請します。よろしいですか？</p><div className={styles.modalActions}><button type="button" onClick={async()=>{await fetch(`/api/system/mypage/submissions/${row.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"accept"})});await loadSubmissions()}}>この金額でお願いする</button><button type="button" className={styles.secondaryButton} onClick={async()=>{await fetch(`/api/system/mypage/submissions/${row.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"withdraw"})});await loadSubmissions()}}>取りやめる</button></div></section>)}
    {submissionType?<SubmissionModal type={submissionType} employeeName={profile.name} initialValues={submissionInitialValues} onClose={()=>setSubmissionType(null)} onSent={()=>{setSubmissionType(null);setSubmissionMessage("受け付けました。事務から連絡します");void loadSubmissions();void refreshProfile()}}/>:null}

  </div>;
}
