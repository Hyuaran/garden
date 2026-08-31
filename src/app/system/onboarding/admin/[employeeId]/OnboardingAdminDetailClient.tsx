"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import OnboardingReview from "../../_components/OnboardingReview";
import { ADMIN_ALLOWANCE_LIMIT, ADMIN_SELECT_OPTIONS, missingOnboardingItems, type AdminAllowance, type AdminInput, type AdminOnboardingRecord } from "../../_lib/onboarding-admin";
import styles from "../../onboarding.module.css";

function emptyAllowance(): AdminAllowance {
  return { name: "", amount: "" };
}

export default function OnboardingAdminDetailClient({ record }: { record: AdminOnboardingRecord }) {
  const router = useRouter();
  const [admin, setAdmin] = useState(record.admin);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmApply, setConfirmApply] = useState(false);
  const missing = missingOnboardingItems(record.values);

  function change(key: keyof AdminInput, value: string) {
    setConfirmApply(false);
    setAdmin(previous => ({ ...previous, [key]: value }));
  }
  function changeAllowance(index: number, key: keyof AdminAllowance, value: string) {
    setConfirmApply(false);
    setAdmin(previous => {
      const allowances = previous.allowances.length ? previous.allowances : [emptyAllowance()];
      return { ...previous, allowances: allowances.map((allowance, i) => i === index ? { ...allowance, [key]: value } : allowance) };
    });
  }
  function addAllowance() {
    setConfirmApply(false);
    setAdmin(previous => previous.allowances.length >= ADMIN_ALLOWANCE_LIMIT ? previous : { ...previous, allowances: [...previous.allowances, emptyAllowance()] });
  }
  function removeAllowance(index: number) {
    setConfirmApply(false);
    setAdmin(previous => ({ ...previous, allowances: previous.allowances.filter((_, i) => i !== index) }));
  }
  async function post(action: "save" | "apply") {
    setBusy(true); setNotice("");
    const values = { ...admin, allowances: admin.allowances.filter(allowance => allowance.name.trim() || allowance.amount.trim()) };
    try {
      const response = await fetch(`/api/system/onboarding/admin/${encodeURIComponent(record.employee.employee_id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, values }),
      });
      const body = await response.json();
      if (!response.ok) { setNotice(body.error ?? "保存できませんでした。もう一度お試しください。"); return; }
      setNotice(action === "apply" ? "従業員台帳に反映しました" : "保存しました。");
      if (action === "apply") setConfirmApply(false);
      router.refresh();
    } catch {
      setNotice("保存できませんでした。入力内容はこの画面に残っています。もう一度保存してください。");
    } finally {
      setBusy(false);
    }
  }

  return <div className={styles.detailStack}>
    <section className={styles.adminSection}>
      <h2>本人が入れた内容（読むだけ）</h2>
      <OnboardingReview values={record.values} />
    </section>

    <section className={styles.adminSection}>
      <h2>未入力の項目（{missing.length}件）</h2>
      {missing.length ? <ul className={styles.missingList}>{missing.map(item => <li key={item}>{item}</li>)}</ul> : <p>未入力はありません。</p>}
    </section>

    <section className={styles.adminSection}>
      <h2>事務が入れる</h2>
      <form onSubmit={event => { event.preventDefault(); void post("save"); }}>
        <fieldset disabled={busy} className={styles.adminFields}>
          <label className={styles.field}>所属店舗<input value={admin.office} maxLength={2000} onChange={event => change("office", event.target.value)} /></label>
          <label className={styles.field}>週の所定労働時間<input value={admin.weekly_hours} maxLength={2000} inputMode="decimal" onChange={event => change("weekly_hours", event.target.value)} /></label>
          <label className={styles.field}>健康保険<select value={admin.health_insurance} onChange={event => change("health_insurance", event.target.value)}><option value="">選んでください</option>{ADMIN_SELECT_OPTIONS.insurance.map(label => <option key={label}>{label}</option>)}</select></label>
          <label className={styles.field}>厚生年金<select value={admin.pension_insurance} onChange={event => change("pension_insurance", event.target.value)}><option value="">選んでください</option>{ADMIN_SELECT_OPTIONS.insurance.map(label => <option key={label}>{label}</option>)}</select></label>
          <label className={styles.field}>雇用保険<select value={admin.employment_insurance} onChange={event => change("employment_insurance", event.target.value)}><option value="">選んでください</option>{ADMIN_SELECT_OPTIONS.insurance.map(label => <option key={label}>{label}</option>)}</select></label>
          <label className={styles.field}>税区分<select value={admin.tax_class} onChange={event => change("tax_class", event.target.value)}><option value="">選んでください</option>{ADMIN_SELECT_OPTIONS.taxClass.map(label => <option key={label}>{label}</option>)}</select></label>
          <label className={styles.field}>給与の区分<select value={admin.salary_kind} onChange={event => change("salary_kind", event.target.value)}><option value="">選んでください</option>{ADMIN_SELECT_OPTIONS.salaryKind.map(label => <option key={label}>{label}</option>)}</select></label>
          <label className={styles.field}>基本給（円）<input value={admin.base_salary} maxLength={2000} inputMode="numeric" onChange={event => change("base_salary", event.target.value)} /></label>
          <div className={styles.allowanceBlock}>
            <div className={styles.reviewHeading}><h3>手当</h3><button type="button" disabled={admin.allowances.length >= ADMIN_ALLOWANCE_LIMIT} onClick={addAllowance}>もう1つ足す</button></div>
            {(admin.allowances.length ? admin.allowances : [emptyAllowance()]).map((allowance, index) => <div className={styles.allowanceRow} key={index}>
              <label className={styles.field}>名前<input value={allowance.name} maxLength={2000} onChange={event => changeAllowance(index, "name", event.target.value)} /></label>
              <label className={styles.field}>金額（円）<input value={allowance.amount} maxLength={2000} inputMode="numeric" onChange={event => changeAllowance(index, "amount", event.target.value)} /></label>
              <button type="button" onClick={() => removeAllowance(index)}>消す</button>
            </div>)}
          </div>
          <label className={styles.field}>交通費の確定額（1か月・円）<input value={admin.commute_fixed_monthly} maxLength={2000} inputMode="numeric" onChange={event => change("commute_fixed_monthly", event.target.value)} /></label>
          <label className={styles.field}>交通費の上限（1か月・円）<input value={admin.commute_cap_monthly} maxLength={2000} inputMode="numeric" onChange={event => change("commute_cap_monthly", event.target.value)} /></label>
          <div className={styles.actions}>
            <button type="submit">保存</button>
            <button className={styles.primary} type="button" onClick={() => setConfirmApply(true)}>従業員台帳に反映する</button>
          </div>
          {confirmApply && <div className={styles.inlineConfirm} role="group" aria-label="従業員台帳への反映確認">
            <p>従業員台帳に反映します。よろしいですか</p>
            <div className={styles.actions}>
              <button className={styles.primary} type="button" onClick={() => void post("apply")}>反映する</button>
              <button type="button" onClick={() => setConfirmApply(false)}>やめる</button>
            </div>
          </div>}
        </fieldset>
      </form>
      <p role="status" className={styles.saveStatus}>{busy ? "保存しています。" : notice}</p>
    </section>
  </div>;
}
