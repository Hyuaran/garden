"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import OnboardingReview from "../../_components/OnboardingReview";
import { ADMIN_ALLOWANCE_LIMIT, ADMIN_SELECT_OPTIONS, commutePaymentMonthly, formatDeclaredCommutePassMonthly, missingOnboardingItems, type AdminAllowance, type AdminInput, type AdminOnboardingRecord } from "../../_lib/onboarding-admin";
import { formatWarnings } from "../../_lib/onboarding";
import styles from "../../onboarding.module.css";

function emptyAllowance(): AdminAllowance {
  return { name: "", amount: "" };
}

export default function OnboardingAdminDetailClient({ record }: { record: AdminOnboardingRecord }) {
  const router = useRouter();
  const [reviewValues, setReviewValues] = useState(record.values);
  const [admin, setAdmin] = useState<AdminInput>(() => ({
    ...record.admin,
    commute_fixed_monthly: record.admin.commute_fixed_monthly || commutePaymentMonthly(record.values, record.admin.commute_cap_monthly),
  }));
  const [commutePaymentEdited, setCommutePaymentEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailDraft, setEmailDraft] = useState(record.values.email);
  const [emailNotice, setEmailNotice] = useState("");
  const [emailError, setEmailError] = useState("");
  const [fuyouBusy, setFuyouBusy] = useState(false);
  const [renrakuhyoBusy, setRenrakuhyoBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [fuyouNotice, setFuyouNotice] = useState<{ kind: "success" | "error"; message: string; filename?: string; folderLabel?: string } | null>(null);
  const [renrakuhyoNotice, setRenrakuhyoNotice] = useState<{ kind: "success" | "error"; message: string; xlsxFilename?: string; pdfFilename?: string; folderLabel?: string } | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmFuyou, setConfirmFuyou] = useState(false);
  const [confirmRenrakuhyo, setConfirmRenrakuhyo] = useState(false);
  const [revealedMyNumbers, setRevealedMyNumbers] = useState<Record<string, string>>({});
  const [myNumberBusy, setMyNumberBusy] = useState<Record<string, boolean>>({});
  const missing = missingOnboardingItems(record.values);

  function myNumberKey(kind: "self" | "dependent", index?: number) {
    return kind === "self" ? "self" : `dependent-${index ?? -1}`;
  }
  async function showMyNumber(kind: "self" | "dependent", index?: number) {
    const key = myNumberKey(kind, index);
    setMyNumberBusy(previous => ({ ...previous, [key]: true }));
    try {
      const response = await fetch(`/api/system/onboarding/admin/${encodeURIComponent(record.employee.employee_id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "myNumber", target: kind === "self" ? { kind } : { kind, index } }),
      });
      const body = await response.json();
      if (response.ok && typeof body.myNumber === "string") setRevealedMyNumbers(previous => ({ ...previous, [key]: body.myNumber }));
    } catch {
      // 監査や取得に失敗しても詳細画面はマスク表示のまま維持する。
    } finally {
      setMyNumberBusy(previous => ({ ...previous, [key]: false }));
    }
  }
  function hideMyNumber(kind: "self" | "dependent", index?: number) {
    const key = myNumberKey(kind, index);
    setRevealedMyNumbers(previous => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  function change(key: keyof AdminInput, value: string) {
    setConfirmApply(false);
    if (key === "commute_fixed_monthly") {
      setCommutePaymentEdited(true);
      setAdmin(previous => ({ ...previous, commute_fixed_monthly: value }));
      return;
    }
    if (key === "commute_cap_monthly") {
      setAdmin(previous => ({
        ...previous,
        commute_cap_monthly: value,
        commute_fixed_monthly: commutePaymentEdited ? previous.commute_fixed_monthly : commutePaymentMonthly(record.values, value),
      }));
      return;
    }
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
  function editEmail() {
    setEmailDraft(reviewValues.email);
    setEmailNotice("");
    setEmailError("");
    setEmailEditing(true);
  }
  function cancelEmailEdit() {
    setEmailDraft(reviewValues.email);
    setEmailNotice("");
    setEmailError("");
    setEmailEditing(false);
  }
  async function saveEmail() {
    setEmailBusy(true); setEmailNotice(""); setEmailError("");
    try {
      const response = await fetch(`/api/system/onboarding/admin/${encodeURIComponent(record.employee.employee_id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "email", email: emailDraft }),
      });
      const body = await response.json();
      if (!response.ok) { setEmailError(body.error ?? "保存できませんでした。もう一度お試しください。"); return; }
      const savedEmail = typeof body.email === "string" ? body.email : emailDraft.trim();
      setReviewValues(previous => ({ ...previous, email: savedEmail }));
      setEmailDraft(savedEmail);
      setEmailEditing(false);
      setEmailNotice("保存しました");
      router.refresh();
    } catch {
      setEmailError("保存できませんでした。入力内容はこの画面に残っています。もう一度保存してください。");
    } finally {
      setEmailBusy(false);
    }
  }
  async function createFuyouPdf() {
    setFuyouBusy(true); setFuyouNotice(null);
    try {
      const response = await fetch(`/api/system/onboarding/admin/${encodeURIComponent(record.employee.employee_id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fuyou" }),
      });
      const body = await response.json();
      if (!response.ok) {
        setFuyouNotice({ kind: "error", message: body.error ?? "保存先のフォルダに書き込めませんでした。管理者へお問い合わせください。" });
        return;
      }
      setConfirmFuyou(false);
      setFuyouNotice({ kind: "success", message: "保存しました。", filename: body.filename, folderLabel: body.folderLabel });
    } catch {
      setFuyouNotice({ kind: "error", message: "保存先のフォルダに書き込めませんでした。管理者へお問い合わせください。" });
    } finally {
      setFuyouBusy(false);
    }
  }
  async function createRenrakuhyo() {
    setRenrakuhyoBusy(true); setRenrakuhyoNotice(null);
    try {
      const response = await fetch(`/api/system/onboarding/admin/${encodeURIComponent(record.employee.employee_id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "renrakuhyo" }),
      });
      const body = await response.json();
      if (!response.ok) {
        setRenrakuhyoNotice({ kind: "error", message: body.error ?? "保存先のフォルダに書き込めませんでした。" });
        return;
      }
      setConfirmRenrakuhyo(false);
      setRenrakuhyoNotice({ kind: "success", message: "保存しました。", xlsxFilename: body.xlsxFilename, pdfFilename: body.pdfFilename, folderLabel: body.folderLabel });
    } catch {
      setRenrakuhyoNotice({ kind: "error", message: "保存先のフォルダに書き込めませんでした。" });
    } finally {
      setRenrakuhyoBusy(false);
    }
  }

  return <div className={styles.detailStack}>
    <section className={styles.adminSection}>
      <h2>本人が入れた内容</h2>
      <OnboardingReview values={reviewValues} emailSlot={<span className={styles.emailReviewValue}>
        {emailEditing ? <>
          <input aria-label="メールアドレス" value={emailDraft} maxLength={2000} disabled={emailBusy} onChange={event => { setEmailDraft(event.target.value); setEmailNotice(""); setEmailError(""); }} />
          <button type="button" disabled={emailBusy} onClick={() => void saveEmail()}>保存</button>
          <button type="button" disabled={emailBusy} onClick={cancelEmailEdit}>やめる</button>
        </> : <>
          {reviewValues.email ? <span>{reviewValues.email}</span> : <span className={styles.empty}>未入力</span>}
          <button type="button" onClick={editEmail}>修正</button>
        </>}
        <span className={styles.hint}>事務が入れられます</span>
        {formatWarnings({ ...reviewValues, email: emailDraft }).email ? <span className={styles.warning}>{formatWarnings({ ...reviewValues, email: emailDraft }).email}</span> : null}
        {emailNotice ? <span role="status" className={styles.saveStatus}>{emailNotice}</span> : null}
        {emailError ? <span role="alert" className={styles.warning}>{emailError}</span> : null}
      </span>} myNumberReveal={{
        value: (kind, index) => revealedMyNumbers[myNumberKey(kind, index)] ?? "",
        busy: (kind, index) => Boolean(myNumberBusy[myNumberKey(kind, index)]),
        onShow: (kind, index) => void showMyNumber(kind, index),
        onHide: hideMyNumber,
      }} />
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
          <div className={styles.field}>本人の申告（1か月定期代）<span>{formatDeclaredCommutePassMonthly(record.values)}</span></div>
          <label className={styles.field}>交通費の上限（1か月・円）<input value={admin.commute_cap_monthly} maxLength={2000} inputMode="numeric" onChange={event => change("commute_cap_monthly", event.target.value)} /></label>
          <label className={styles.field}>支給額（1か月・円）<input value={admin.commute_fixed_monthly} maxLength={2000} inputMode="numeric" onChange={event => change("commute_fixed_monthly", event.target.value)} /><span className={styles.hint}>上限以下なら申告額、超えたら上限</span></label>
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

    <section className={styles.adminSection}>
      <h2>扶養控除申告書</h2>
      <p>令和8年分の用紙に、本人が入れた内容を書き込んで、経理のフォルダへ保存します。マイナンバーが入ります。</p>
      <p className={styles.hint}>税務署名・市区町村名・世帯主・扶養親族の欄は空欄です。手書きで足してください。</p>
      <div className={styles.actions}>
        <button className={styles.primary} type="button" disabled={fuyouBusy} onClick={() => { setFuyouNotice(null); setConfirmFuyou(true); }}>扶養控除申告書を作る</button>
      </div>
      {confirmFuyou && <div className={styles.inlineConfirm} role="group" aria-label="扶養控除申告書の保存確認">
        <p>マイナンバーが入った書類を、経理のフォルダに保存します。よろしいですか</p>
        <div className={styles.actions}>
          <button className={styles.primary} type="button" disabled={fuyouBusy} onClick={() => void createFuyouPdf()}>{fuyouBusy ? "作っています。" : "作って保存する"}</button>
          <button type="button" disabled={fuyouBusy} onClick={() => setConfirmFuyou(false)}>やめる</button>
        </div>
      </div>}
      <div role="status" className={fuyouNotice?.kind === "success" ? styles.resultNotice : styles.saveStatus}>
        {fuyouNotice ? <>
          <p>{fuyouNotice.message}</p>
          {fuyouNotice.filename ? <p>{fuyouNotice.filename}</p> : null}
          {fuyouNotice.folderLabel ? <p>{fuyouNotice.folderLabel} に入っています</p> : null}
        </> : null}
      </div>
    </section>

    <section className={styles.adminSection}>
      <h2>入社連絡表（TLCC様提出用）</h2>
      <p>入社手続きの内容から、TLCC様へ出す連絡表を作ります。</p>
      <p>ExcelとPDFの両方を、経理のフォルダへ保存します。</p>
      <p className={styles.hint}>扶養家族の欄は空欄です。手書きで足してください。</p>
      <div className={styles.actions}>
        <button className={styles.primary} type="button" disabled={renrakuhyoBusy} onClick={() => { setRenrakuhyoNotice(null); setConfirmRenrakuhyo(true); }}>入社連絡表を作る</button>
      </div>
      {confirmRenrakuhyo && <div className={styles.inlineConfirm} role="group" aria-label="入社連絡表の保存確認">
        <p>マイナンバーが入った書類を、経理のフォルダに保存します。よろしいですか</p>
        <div className={styles.actions}>
          <button className={styles.primary} type="button" disabled={renrakuhyoBusy} onClick={() => void createRenrakuhyo()}>{renrakuhyoBusy ? "作っています。" : "作って保存する"}</button>
          <button type="button" disabled={renrakuhyoBusy} onClick={() => setConfirmRenrakuhyo(false)}>やめる</button>
        </div>
      </div>}
      <div role="status" className={renrakuhyoNotice?.kind === "success" ? styles.resultNotice : styles.saveStatus}>
        {renrakuhyoNotice ? <>
          <p>{renrakuhyoNotice.message}</p>
          {renrakuhyoNotice.xlsxFilename ? <p>{renrakuhyoNotice.xlsxFilename}</p> : null}
          {renrakuhyoNotice.pdfFilename ? <p>{renrakuhyoNotice.pdfFilename}</p> : null}
          {renrakuhyoNotice.folderLabel ? <p>{renrakuhyoNotice.folderLabel} に入っています</p> : null}
        </> : null}
      </div>
    </section>
  </div>;
}
