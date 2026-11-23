"use client";

import { useEffect, useRef, useState } from "react";
import SalesIcon from "./SalesIcon";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { acquisitionLabel, dateInJapan, MAX_PHOTOS, urgentLabel, type SalesProfile, type Submission } from "@/lib/leaf-kanden/submissions";
import {
  ActionButton, ActionRow, FormDialog, FieldLabel, ResultMessage,
  StatusBadge, SubmitButton, TextArea, TextField,
} from "../_components/form-kit";
import { loadSalesCases, loadSalesPhotos, loadSalesProfile, submitKandenInfoUpdate } from "./sales-actions";
import styles from "./sales-form.module.css";

export default function KandenMypage({ name, number, recent, screen, active, disabled, append, initialUrgentCount, newUrgent, updatedCases }:  {
  name: string; number: string; recent: Submission[] | null; active: boolean;
  screen: "cases" | "profile"; disabled: boolean; append: (row: Submission) => void;
  initialUrgentCount: number | null; newUrgent: number; updatedCases: Submission[];
}) {
  const [profile, setProfile] = useState<SalesProfile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const photoRequest = useRef(0);

  useEffect(() => {
    if (!active || screen !== "profile") return;
    let current = true;
    void loadSalesProfile().then(result => {
      if (!current) return;
      if (result) setProfile(result);
      setProfileError(result === null);
    }).catch(() => { if (current) setProfileError(true); });
    return () => { current = false; };
  }, [active, screen]);

  const [older, setOlder] = useState<Submission[]>([]);
  const [offset, setOffset] = useState<number | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [urgentSnapshot, setUrgentSnapshot] = useState<{ count: number; added: number } | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [request, setRequest] = useState("");
  const [sending, setSending] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [viewing, setViewing] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ url: string; category: string | null }[] | null>(null);
  const [selected, setSelected] = useState(0);
  const byId = new Map(older.map(row => [row.id, row]));
  for (const row of [...(recent ?? []), ...updatedCases]) {
    const loaded = byId.get(row.id);
    if (!loaded || loaded.updated_at < row.updated_at) byId.set(row.id, row);
  }
  const cases = [...byId.values()].sort((a, b) =>
    b.submitted_at.localeCompare(a.submitted_at) || b.id.localeCompare(a.id));
  const urgentCount = urgentSnapshot ? urgentSnapshot.count + newUrgent - urgentSnapshot.added
    : initialUrgentCount === null ? cases.filter(row => row.urgent_sw).length : initialUrgentCount + newUrgent;
  const today = dateInJapan(new Date());
  const term = query.normalize("NFKC").trim().toLowerCase();
  const filtered = cases.filter(row => (!urgent || row.urgent_sw) && [
    row.id, row.kanri_no_raw, row.kanri_no, row.customer_name,
  ].some(value => value?.normalize("NFKC").toLowerCase().includes(term)));

  async function load(refresh = false, filter = urgent) {
    setLoading(true);
    setError("");
    try {
      const start = refresh ? 0 : offset ?? recent?.length ?? 0;
      const result = await loadSalesCases(start, filter);
      if (result === null) throw new Error();
      setOlder(current => refresh ? result.rows : [...current, ...result.rows]);
      setOffset(start + result.rows.length);
      setExhausted(result.rows.length < 50);
      setUrgent(filter);
      setUrgentSnapshot({ count: result.urgentCount, added: newUrgent });
    } catch {
      setError("案件一覧を読み込めませんでした。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  async function showPhotos(row: Submission) {
    const key = ++photoRequest.current;
    setError("");
    setViewing(row.id);
    setSelected(0);
    setPhotos(null);
    try {
      const result = await loadSalesPhotos(row.id);
      if (key !== photoRequest.current) return;
      setPhotos(result.photos ?? []);
      if (result.error) setError(result.error);
    } catch {
      if (key !== photoRequest.current) return;
      setPhotos([]);
      setError("写メを読み込めませんでした。");
    }
  }

  async function sendRequest() {
    setSending(true);
    setRequestError("");
    setNotice("");
    try {
      const result = await submitKandenInfoUpdate(request);
      if (result.error) setRequestError(result.error);
      else {
        setEditing(false);
        setRequest("");
        setNotice("情報更新の申請を送信しました。");
      }
    } catch {
      setRequestError("情報更新の申請を送信できませんでした。");
    } finally {
      setSending(false);
    }
  }

  const photo = photos?.[selected];
  return <>
    <ResultMessage>{screen === "profile" ? profileError && "プロフィールを読み込めませんでした。"
      : error || (recent === null && offset === null && "案件一覧を読み込めませんでした。")}</ResultMessage>
    <ResultMessage success>{notice}</ResultMessage>
    {screen === "profile" && <div className={styles.profile}>
      <section className={styles.profileCard}><h2><SalesIcon name="person" /> プロフィール</h2>
        <div className={styles.profileRows}>
          <FieldLabel label="氏名"><span {...CLARITY_MASK}>{name}</span></FieldLabel>
          <FieldLabel label="ふりがな"><span {...CLARITY_MASK}>{profile?.kana || "—"}</span></FieldLabel>
          <FieldLabel label="社員番号"><span {...CLARITY_MASK}>{number}</span></FieldLabel>
          <FieldLabel label="入社日"><span {...CLARITY_MASK}>{profile?.hireDate || "—"}</span></FieldLabel>
        </div>
      </section>
      <section className={styles.profileCard}><h2>連絡先</h2><div className={styles.profileRows}><FieldLabel label="メール">
        <span className={styles.customerFields} {...CLARITY_MASK}>{profile?.email || "—"}</span>
      </FieldLabel></div></section>
      <section className={styles.profileCard}><h2>今月の実績</h2>
        <div className={styles.profileStats}>
          {([["送信件数", "sent"], ["完了件数", "completed"], ["諸元待ち", "awaiting"], ["至急SW", "urgent"]] as const)
            .map(([label, key]) => <FieldLabel key={key} label={label}>{profile ? `${profile[key]} 件` : "—"}</FieldLabel>)}
        </div>
      </section>
      <section className={styles.profileCard}><h2>設定</h2>
        <ActionButton onClick={() => setEditing(true)}><SalesIcon name="edit" /> 情報更新を申請</ActionButton>
      </section>
    </div>}
    {screen === "cases" && <section className={styles.caseList} aria-label="案件一覧">
      <div className={styles.caseTools}>
        <ActionButton className={styles.urgentFilter} aria-pressed={urgent} disabled={loading} onClick={() => void load(true, !urgent)}>至急SW {urgentCount} 件</ActionButton>
        <ActionButton disabled={loading} onClick={() => void load(true)}>一覧を更新</ActionButton>
      </div>
      <TextField {...CLARITY_MASK} aria-label="案件を検索" placeholder="案件番号・PD番号・お客様名で検索"
        type="search" value={query} onChange={event => setQuery(event.target.value)} />
      {!filtered.length && <p>表示する案件はありません。</p>}
      {filtered.map(row => {
        const submitted = dateInJapan(new Date(row.submitted_at));
        const waiting = row.order_status === "諸元待ち" ||
          ((!row.order_status || row.order_status === "受付待ち") && row.specs_status === "諸元待ち");
        const stale = waiting && Date.parse(today) - Date.parse(submitted) >= 30 * 86_400_000;
        return <details className={styles.case} key={row.id}>
          <summary><strong {...CLARITY_MASK}>{row.kanri_no_raw ?? row.kanri_no ?? "PD番号なし"}　{row.customer_name}</strong>
            <small>{submitted}</small>
            <span className={styles.caseStatuses}><StatusBadge>{row.order_status ?? "受付待ち"}</StatusBadge>
            {row.urgent_sw && <> <StatusBadge>至急SW</StatusBadge></>}
            {stale && <> <StatusBadge>諸元待ち30日以上</StatusBadge></>}</span>
          </summary>
          <p {...CLARITY_MASK}>案件番号　{row.id}</p>
          <p>{row.acquisition}　{acquisitionLabel(row)}　写メ {row.photo_count} 枚　{row.specs_status === "あり" ? "諸元あり" : row.specs_status}</p>
          {row.urgent_sw && <p>至急SW　{urgentLabel(row)}</p>}
          <ActionRow>
            <ActionButton disabled={!row.photo_count || viewing !== null} onClick={() => void showPhotos(row)}>
              <SalesIcon name="image" /> 写メを見る
            </ActionButton>
            {row.photo_count < MAX_PHOTOS && <ActionButton disabled={disabled} onClick={() => append(row)}>
              <SalesIcon name="clip" /> 諸元を追加
            </ActionButton>}
          </ActionRow>
        </details>;
      })}
      {!exhausted && (offset !== null || (recent?.length ?? 0) >= 10) &&
        <ActionButton disabled={loading} onClick={() => void load()}>さらに表示</ActionButton>}
    </section>}
    {editing && screen === "profile" && active && <FormDialog className={styles.salesDialog} title="情報更新を申請" onClose={() => setEditing(false)} dismissible={!sending}
      actions={<SubmitButton busy={sending} disabled={!request.trim()} onClick={() => void sendRequest()}>申請する</SubmitButton>}>
      <FieldLabel label="変更内容" required><TextArea aria-label="変更内容" {...CLARITY_MASK}
        maxLength={2000} value={request} onChange={event => setRequest(event.target.value)} /></FieldLabel>
      <ResultMessage>{requestError}</ResultMessage>
    </FormDialog>}
    {viewing && active && screen === "cases" && <FormDialog title="送信した写メ" onClose={() => {
      photoRequest.current++;
      setViewing(null);
      setPhotos(null);
    }}
      actions={photos && photos.length > 1 && <>
        <ActionButton disabled={selected === 0} onClick={() => setSelected(value => value - 1)}>前の写メ</ActionButton>
        <ActionButton disabled={selected === photos.length - 1} onClick={() => setSelected(value => value + 1)}>次の写メ</ActionButton>
      </>}>
      {photos === null ? <p role="status">写メを読み込んでいます。</p> : photo ? <>
        <p>{photo.category || "写メ"}　{selected + 1} / {photos.length}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} className={styles.image} alt={photo.category || "送信した写メ"} {...CLARITY_MASK} />
      </> : <p>{error || "写メはありません。"}</p>}
    </FormDialog>}
  </>;
}
