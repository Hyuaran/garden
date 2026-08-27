"use client";

import { useEffect, useRef, useState } from "react";
import { GARDEN_ROLE_LABELS, type GardenRole } from "@/app/root/_constants/types";
import type { MyPageProfile } from "../types";
import styles from "../mypage.module.css";
import SubmissionModal from "../_components/SubmissionModal";
import type {SubmissionRow,SubmissionType} from "../_lib/submission-types";

const LS_MYPAGE_LAST_CONFIRM = "gardenTree_mypageLastConfirm";
const MYPAGE_CONFIRM_INTERVAL_DAYS = 90;

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
  const [mypageLocked, setMypageLocked] = useState(false);
  const submissionsRef = useRef<HTMLElement>(null);
  const [submissionType,setSubmissionType]=useState<SubmissionType|null>(null);const [submissionMessage,setSubmissionMessage]=useState("");const [submissions,setSubmissions]=useState<SubmissionRow[]>([]);
  async function loadSubmissions(){try{const response=await fetch("/api/system/mypage/submissions",{cache:"no-store"});if(response.ok)setSubmissions((await response.json()).rows??[])}catch{/* 届出一覧が取得できなくてもプロフィール表示は継続 */}}

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_MYPAGE_LAST_CONFIRM);
      if (!raw) return setMypageLocked(true);
      const last = new Date(raw);
      const days = (Date.now() - last.getTime()) / 86_400_000;
      setMypageLocked(!Number.isFinite(days) || days >= MYPAGE_CONFIRM_INTERVAL_DAYS);
    } catch { setMypageLocked(true); }
  }, []);
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

  function confirmUnchanged() {
    setMypageLocked(false);
    try { window.localStorage.setItem(LS_MYPAGE_LAST_CONFIRM, new Date().toISOString()); } catch { /* ignore */ }
  }

  if (!profile && !birthdayRegistered && !registered) {
    return <section className={styles.comingSoon}><h2>従業員情報がありません</h2><p>従業員情報が登録されていません。管理者にご連絡ください。</p></section>;
  }

  if (!profile) return <section className={styles.unlockPanel} aria-label="本人確認">
    <span className={styles.lockIcon} aria-hidden="true">🔒</span><h2>本人確認</h2>
    <p>個人情報を閲覧するには、生年月日の月日4桁を入力してください。</p>
    <label>生年月日の月日4桁<input aria-label="生年月日の月日4桁" inputMode="numeric" autoComplete="off" type="password"
      value={code} maxLength={4} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
      onKeyDown={(event) => { if (event.key === "Enter") void unlock(); }} /></label>
    {unlockError && <p role="alert" className={styles.error}>4桁が一致しません。</p>}
    <button type="button" disabled={checking} onClick={() => void unlock()}>{checking ? "確認中…" : "認証してマイページを開く"}</button>
  </section>;

  const roleLabel = GARDEN_ROLE_LABELS[profile.gardenRole as GardenRole] ?? profile.gardenRole;
  const commute=profile.commuteDailyAllowance===null?"未登録":`日額 ${profile.commuteDailyAllowance.toLocaleString("ja-JP")}円（${profile.commuteMonthlyCap===null?"上限なし":`月の上限 ${profile.commuteMonthlyCap.toLocaleString("ja-JP")}円`}）`;
  const bank=profile.bankName&&profile.branchName?`${profile.bankName} ${profile.branchName}`:"未登録";
  return <div className={styles.profileContent}>
    {!birthdayRegistered && <p className={styles.unlockedNotice}>生年月日が未登録のため本人確認を省略しています。</p>}
    {mypageLocked && <section className={styles.confirmationBanner} aria-label="個人情報の定期確認">
      <div><h2>個人情報の定期確認中（3ヶ月に1度）</h2><p>登録内容に変更がないかご確認ください。変更がある場合は届出から申請できます。</p></div>
      <div className={styles.confirmationActions}><button type="button" onClick={confirmUnchanged}>変更はありません</button>
        <button type="button" className={styles.secondaryButton} onClick={() => submissionsRef.current?.scrollIntoView({ behavior: "smooth" })}>変更する</button></div>
    </section>}

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
      {[["📞","emergency_contact","緊急連絡先変更"],["🚃","commute_route","通勤経路変更"],["🏦","bank_account","給与受取口座の変更"],["📄","resignation","退職届"],["🔒","nda","秘密保持誓約書"]].map(([icon,type,label])=><button type="button" key={type} onClick={()=>{setSubmissionMessage("");setSubmissionType(type as SubmissionType)}}><span aria-hidden="true">{icon}</span>{label}</button>)}
    </div>{submissionMessage?<p role="status" className={styles.receivedMessage}>{submissionMessage}</p>:null}</section>
    {submissions.filter(row=>row.submission_type==="commute_route"&&row.status==="awaiting_employee").map(row=><section className={`${styles.card} ${styles.proposalCard}`} key={row.id}><h2>通勤交通費のご提案</h2><p>日額{((row.proposed_one_way??0)*2).toLocaleString("ja-JP")}円（片道{(row.proposed_one_way??0).toLocaleString("ja-JP")}円）で申請します。よろしいですか？</p><div className={styles.modalActions}><button type="button" onClick={async()=>{await fetch(`/api/system/mypage/submissions/${row.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"accept"})});await loadSubmissions()}}>この金額でお願いする</button><button type="button" className={styles.secondaryButton} onClick={async()=>{await fetch(`/api/system/mypage/submissions/${row.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"withdraw"})});await loadSubmissions()}}>取りやめる</button></div></section>)}
    {submissionType?<SubmissionModal type={submissionType} employeeName={profile.name} onClose={()=>setSubmissionType(null)} onSent={()=>{setSubmissionType(null);setSubmissionMessage("受け付けました。事務から連絡します");void loadSubmissions()}}/>:null}

  </div>;
}
