"use client";

import { useEffect, useRef, useState } from "react";
import SalesIcon from "./SalesIcon";
import HelpButton from "@/app/system/_components/HelpButton/HelpButton";
import { SystemViewButton } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import { buildSupplyPoint, digits, formatCustomerNumber, formatSupplyPoint, pdKey } from "@/lib/leaf-kanden/sales-form";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import {
  EMPTY_CUSTOMER, EMPTY_FORM, MAX_PHOTOS, MAX_PHOTO_BYTES,
  PRODUCTS, submissionError, UUID, type CustomerFields, type FormInput, type ListCustomer, type PhotoKind, type PhotoSlot, type Submission,
} from "@/lib/leaf-kanden/submissions";
import {
  ActionButton, ActionRow, CheckboxField, FieldLabel, FormDialog, FormPage, FormRow, PhotoPreview, RadioGroup,
  ResultMessage, SelectField, SubmitButton, TextArea, TextField,
} from "../_components/form-kit";
import { preparePhotoUploads, reserveKandenSpecsSlots, sendKandenForm } from "./actions";
import { compressKandenPhoto } from "./photo-client";
import KandenSummary from "./KandenSummary";
import GuideCapture from "./GuideCapture";
import KandenMypage from "./KandenMypage";
import { findSalesCase, lookupKandenPd, unlockKandenForm } from "./sales-actions";
import styles from "./sales-form.module.css";

const photoKinds = [
  { key: "receipt", label: "受領書" },
  ...PRODUCTS,
  { key: "specs", label: "諸元" },
] as const;
const acquisitionOptions = [
  ["囲込", "関電利用中のプラン変更", "repeat"],
  ["奪還", "他電力→関電へ乗り換え", "target"],
] as const;
const idleLimit = 5 * 60_000;
type PdResult = { query: string; customer?: ListCustomer | null; error?: string };

type Attachment = PhotoSlot & {
  file: File; status: "sending" | "ready" | "failed"; preview?: string; signedUrl?: string;
};
const slotKey = (photo: PhotoSlot) => `${photo.kind}-${photo.index}`;
const uploadError = "送れなかった写メがあります。再送するか、取り除いてください。";

function useAttachments(firstSpecsIndex = 1) {
  const [photos, setPhotos] = useState<Attachment[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sequence = useRef<Partial<Record<PhotoKind, number>>>({ specs: firstSpecsIndex - 1 });
  const previews = useRef(new Set<string>());
  const working = useRef(false);
  useEffect(() => {
    const urls = previews.current;
    return () => { for (const url of urls) URL.revokeObjectURL(url); };
  }, []);

  function update(slot: PhotoSlot, patch: Partial<Attachment>) {
    setPhotos(current => current.map(photo => slotKey(photo) === slotKey(slot) ? { ...photo, ...patch } : photo));
  }

  async function upload(id: string, batch: Attachment[], append: boolean) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const unsigned = batch.filter(photo => !photo.signedUrl);
      const signed = unsigned.length ? await preparePhotoUploads(id, unsigned.map(({ kind, index }) => ({ kind, index })), append) : { uploads: [] };
      if (signed.error || !signed.uploads) throw new Error(uploadError);
      const urls = new Map(unsigned.map((photo, index) => [slotKey(photo), signed.uploads[index].url]));
      for (const photo of batch) {
        let signedUrl = photo.signedUrl ?? urls.get(slotKey(photo))!;
        try {
          update(photo, { status: "sending" });
          const image = await compressKandenPhoto(photo.file);
          if (!photo.preview) {
            const preview = URL.createObjectURL(image);
            previews.current.add(preview);
            update(photo, { preview });
          }
          const response = await fetch(signedUrl, {
            method: "PUT", headers: { "Content-Type": "image/jpeg", "x-upsert": "false" },
            body: image, signal: AbortSignal.timeout(30_000),
          });
          const duplicate = response.status === 409 || (!response.ok &&
            Number((await response.json().catch(() => null))?.statusCode) === 409);
          if (!response.ok && !duplicate) {
            if (response.status === 400 || response.status === 401 || response.status === 403) signedUrl = "";
            throw new Error(uploadError);
          }
          update(photo, { status: "ready" });
        } catch {
          update(photo, { status: "failed", signedUrl });
          setError(uploadError);
        }
      }
    } catch {
      for (const photo of batch) update(photo, { status: "failed" });
      setError(uploadError);
    } finally {
      setBusy(false);
      working.current = false;
    }
  }

  function add(id: string, kind: PhotoKind, files: File[], limit: number, append: boolean) {
    if (working.current || !files.length) return;
    if (files.length + photos.length > limit) {
      setError(`写メはあと ${Math.max(0, limit - photos.length)} 枚まで添付できます。`);
      return;
    }
    if ((sequence.current[kind] ?? 0) + files.length >= firstSpecsIndex + 10_000) {
      setError("写メの選び直しが上限に達しました。画面を開き直してください。");
      return;
    }
    if (files.some(file => file.size > MAX_PHOTO_BYTES)) {
      setError("写メは1枚10MBまでです。大きい写メを外して選び直してください。");
      return;
    }
    const batch: Attachment[] = files.map(file => {
      const index = (sequence.current[kind] ?? 0) + 1;
      sequence.current[kind] = index;
      return { kind, index, file, status: "sending" };
    });
    setPhotos(current => [...current, ...batch]);
    void upload(id, batch, append);
  }

  function remove(photo: Attachment) {
    if (photo.preview) {
      URL.revokeObjectURL(photo.preview);
      previews.current.delete(photo.preview);
    }
    setPhotos(current => current.filter(item => slotKey(item) !== slotKey(photo)));
    setError("");
  }

  function clear() {
    for (const url of previews.current) URL.revokeObjectURL(url);
    previews.current.clear();
    sequence.current = {};
    setPhotos([]);
    setError("");
  }

  return { photos, busy, error, add, upload, remove, clear };
}

function PhotoPicker({ kind, label, uploader, getId, limit, append = false, disabled = false }: {
  kind: PhotoKind; label: string; uploader: ReturnType<typeof useAttachments>; getId: () => string;
  limit: number; append?: boolean; disabled?: boolean;
}) {
  const choose = useRef<HTMLInputElement>(null);
  const capture = useRef<HTMLInputElement>(null);
  const [guide, setGuide] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const photos = uploader.photos.filter(photo => photo.kind === kind);
  const single = kind !== "specs";
  const blocked = disabled || uploader.busy;
  const canAdd = !blocked && (!single || photos.length === 0);
  function add(files: File[]) {
    if (!canAdd || !files.length) return;
    uploader.add(getId(), kind, single ? files.slice(0, 1) : files, limit, append);
  }
  const input = { accept: "image/*,.heic,.heif", type: "file", hidden: true, disabled: !canAdd,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      add(Array.from(event.currentTarget.files ?? []));
      event.currentTarget.value = "";
    } };
  const readyCount = photos.filter(photo => photo.status === "ready").length;
  return <div className={styles.attachment} data-attached={readyCount > 0}>
    <div className={styles.attachmentHead}>
      <strong><span className={styles.attachmentNumber} aria-hidden="true">{photoKinds.findIndex(type => type.key === kind) + 1}</span>
        {label}
        {kind === "receipt" && <small>（1枚のみ・任意・OCR対象外）</small>}
        {kind === "specs" && <small>（複数可・任意）</small>}
      </strong>
      <span role="status">{readyCount || kind === "specs" ? `${readyCount} 枚` : "未添付"}</span>
    </div>
    <input {...input} ref={choose} multiple={!single} />
    <input {...input} ref={capture} capture="environment" />
    <div className={styles.attachmentActions}>
      <ActionButton className={styles.captureButton} disabled={!canAdd} onClick={() => setGuide(true)} aria-label={`${label}を撮る`}>
        <SalesIcon name="camera" /> ガイド枠で撮影
      </ActionButton>
      {kind === "specs" && <ActionButton disabled={!canAdd} onClick={() => choose.current?.click()} aria-label={`${label}を選ぶ`}>
        <SalesIcon name="image" /> ファイル選択
      </ActionButton>}
    </div>
    {photos.map(photo => <ActionRow key={slotKey(photo)}>
      {photo.preview && <ActionButton aria-label={`${label}の写メを拡大`} onClick={() => setPreview(photo.preview!)}>
        <PhotoPreview src={photo.preview} alt={`${label}の写メ`} />
      </ActionButton>}
      {photo.status === "sending" && <span role="status">送信中…</span>}
      {photo.status === "failed" && <ActionButton disabled={blocked}
        onClick={() => void uploader.upload(getId(), [photo], append)}>再送</ActionButton>}
      <ActionButton disabled={blocked} onClick={() => uploader.remove(photo)}>
        <SalesIcon name="trash" /> 取り除く
      </ActionButton>
    </ActionRow>)}
    {guide && !disabled && <GuideCapture label={label} close={() => setGuide(false)}
      fallback={() => { capture.current?.click(); setGuide(false); }}
      choose={() => { choose.current?.click(); setGuide(false); }}
      captured={file => { setGuide(false); add([file]); }} />}
    {preview && !disabled && <FormDialog title={`${label}の写メ`} onClose={() => setPreview(null)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.image} src={preview} alt={`${label}の写メ`} {...CLARITY_MASK} />
    </FormDialog>}
  </div>;
}

function slotsFor(photos: Attachment[]) {
  return photos.map(({ kind, index }) => ({ kind, index }));
}

function AppendSpecs({ row, first, close, saved, locked, inline = false }: {
  row: Submission; first: number; inline?: boolean; close: () => void; saved: (recent: Submission[] | null, updated?: Submission | null) => void; locked: boolean;
}) {
  const uploader = useAttachments(first);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  function dismiss() {
    uploader.clear();
    close();
  }
  async function submit() {
    setSending(true);
    setError("");
    try {
      const result = await sendKandenForm(row.id, null, slotsFor(uploader.photos), false);
      if ("error" in result) setError(result.error);
      else {
        dismiss();
        saved(result.recent, result.updated);
      }
    } catch {
      setError("諸元を送信できませんでした。もう一度お試しください。");
    } finally {
      setSending(false);
    }
  }

  if (locked) return null;
  const busy = sending || uploader.busy;
  const send = <SubmitButton busy={sending} disabled={!uploader.photos.length || uploader.photos.some(photo => photo.status !== "ready")}
    onClick={() => void submit()}>{inline ? "この案件に諸元を追加送信" : "諸元を送信する"}</SubmitButton>;
  const content = <>
    <ResultMessage>{error || uploader.error}</ResultMessage>
    <p className={styles.foundCase} {...CLARITY_MASK}>{row.kanri_no ?? row.kanri_no_raw} {row.customer_name}</p>
    <PhotoPicker kind="specs" label={inline ? "諸元（後付け）" : "諸元"} uploader={uploader} getId={() => row.id}
      append limit={MAX_PHOTOS - row.photo_count} disabled={sending || locked} />
  </>;
  return inline ? <>
    <PostAddHeading close={dismiss} disabled={busy} />
    {content}
    {send}
  </> : <FormDialog className={styles.salesDialog} title="諸元を追加" size="sm" onClose={dismiss} dismissible={!busy} actions={send}>
    {content}
  </FormDialog>;
}

function PostAddHeading({ close, disabled }: { close: () => void; disabled: boolean }) {
  return <div className={styles.modeBanner}>
    <strong><SalesIcon name="clip" /> 諸元後付けモード</strong>
    <ActionButton aria-label="通常モードに戻る" disabled={disabled} onClick={close}>×</ActionButton>
  </div>;
}

export default function KandenForm({ name, number, mobile, initialRecent, initialUrgentCount = null }: {
  name: string; number: string; mobile: boolean; initialRecent: Submission[] | null; initialUrgentCount?: number | null;
}) {
  const draft = useRef<string | null>(null);
  const warningPicker = useRef<HTMLInputElement>(null);
  const getId = () => draft.current ??= crypto.randomUUID();
  const [input, setInput] = useState(EMPTY_FORM);
  const [checkedPd, setCheckedPd] = useState<PdResult | null>(null);
  const [ocrRequested, setOcrRequested] = useState(false);
  const [tab, setTab] = useState<"form" | "mypage" | "cases">("form");
  const [outsideChoice, setOutsideChoice] = useState("");
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [lockError, setLockError] = useState("");
  const [postAdd, setPostAdd] = useState(false);
  const [caseNumber, setCaseNumber] = useState("");
  const [foundCase, setFoundCase] = useState<Submission | null>(null);
  const [caseError, setCaseError] = useState("");
  const [findingCase, setFindingCase] = useState(false);
  const [recent, setRecent] = useState(initialRecent);
  const [updatedCases, setUpdatedCases] = useState<Submission[]>([]);
  const [newUrgent, setNewUrgent] = useState(0);
  const [dialog, setDialog] = useState<"specs" | "confirm" | null>(null);
  const [adding, setAdding] = useState<{ row: Submission; first: number; inline: boolean } | null>(null);
  const [opening, setOpening] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const uploader = useAttachments();

  const customer = input.customer ?? EMPTY_CUSTOMER;
  const parsed = pdKey(input.kanri_no_raw);
  const query = parsed ? `PD${parsed.number.padStart(7, "0")}${parsed.branch ? `(${parsed.branch})` : ""}` : "";
  const pd = checkedPd?.query === query ? checkedPd : null;
  const hasPhoto = (kind: PhotoKind) => uploader.photos.some(photo => photo.kind === kind);
  const hasSpecs = hasPhoto("specs");
  const submission: FormInput = {
    ...input, has_denki: hasPhoto("denki"), has_douryoku: hasPhoto("douryoku"), has_gas: hasPhoto("gas"),
  };

  useEffect(() => {
    if (!query || locked || pd) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      let result: Awaited<ReturnType<typeof lookupKandenPd>>;
      try {
        result = await lookupKandenPd(query);
      } catch {
        result = { error: "リストを照合できませんでした。もう一度お試しください。" };
      }
      if (!active) return;
      setCheckedPd({ query, ...result });
      if ("customer" in result && result.customer) {
        const { name, ...match } = result.customer;
        setInput(current => ({ ...current, customer_name: name, customer: {
          ...match, supply: match.supply || buildSupplyPoint(match.number),
        } }));
      }
    }, 450);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, pd, locked]);

  useEffect(() => {
    if (locked) return;
    let lastActivity = Date.now();
    let timer: number;
    function check() {
      const remaining = idleLimit - (Date.now() - lastActivity);
      if (remaining <= 0) setLocked(true);
      else timer = window.setTimeout(check, remaining);
    }
    function activity() {
      window.clearTimeout(timer);
      if (Date.now() - lastActivity >= idleLimit) {
        setLocked(true);
        return;
      }
      lastActivity = Date.now();
      check();
    }
    function checkVisibility() {
      if (document.visibilityState === "visible" && Date.now() - lastActivity >= idleLimit) setLocked(true);
    }
    const events = ["pointerdown", "pointermove", "keydown", "scroll"];
    for (const event of events) document.addEventListener(event, activity, { passive: true });
    document.addEventListener("visibilitychange", checkVisibility);
    check();
    return () => {
      window.clearTimeout(timer);
      for (const event of events) document.removeEventListener(event, activity);
      document.removeEventListener("visibilitychange", checkVisibility);
    };
  }, [locked]);

  function change(patch: Partial<FormInput>) {
    setInput(current => ({ ...current, ...patch }));
    setError("");
    setSuccess("");
  }

  function changeCustomer(patch: Partial<CustomerFields>) {
    change({ customer: { ...customer, ...patch } });
  }

  function setPd(value: string) {
    const next = pdKey(value);
    if (next?.number !== parsed?.number || next?.branch !== parsed?.branch) {
      setCheckedPd(null);
      setOutsideChoice("");
      change({ kanri_no_raw: value, ...(pd && !pd.error && { customer: EMPTY_CUSTOMER, customer_name: "" }) });
    } else change({ kanri_no_raw: value });
  }

  async function unlock() {
    if (unlocking || !password) return;
    setUnlocking(true);
    try {
      if (await unlockKandenForm(password)) {
        setLockError("");
        setLocked(false);
      } else setLockError("解除できませんでした。Gardenのパスワードを確認してください。");
    } catch {
      setLockError("解除できませんでした。もう一度お試しください。");
    } finally {
      setPassword("");
      setUnlocking(false);
    }
  }

  function review() {
    setSuccess("");
    const error = !query ? "PD番号を入力してください。"
      : !pd || pd.error ? "PD番号の照合結果を確認してください。"
      : !pd.customer && !customer.outside ? "リスト外の案件か確認してください。"
      : uploader.photos.some(photo => photo.status !== "ready") ? uploadError
      : submissionError(submission, uploader.photos);
    setError(error);
    if (!error) setDialog(uploader.photos.some(photo => photo.kind === "specs") ? "confirm" : "specs");
  }

  async function submit() {
    setSending(true);
    try {
      const result = await sendKandenForm(getId(), submission, slotsFor(uploader.photos), !hasSpecs);
      if ("error" in result) setError(result.error);
      else {
        setRecent(result.recent);
        if (input.urgent_sw) setNewUrgent(value => value + 1);
        setInput(EMPTY_FORM);
        setCheckedPd(null);
        setOutsideChoice("");
        setOcrRequested(false);
        setSuccess("送信しました。事務に知らせました。");
        draft.current = null;
        uploader.clear();
      }
    } catch {
      setError("送信できませんでした。もう一度お試しください。");
    } finally {
      setSending(false);
      setDialog(null);
    }
  }

  async function findCase() {
    setFindingCase(true);
    setCaseError("");
    try {
      const result = await findSalesCase(caseNumber.trim());
      setFoundCase(result.row ?? null);
      setCaseError(result.error ?? "");
    } catch {
      setCaseError("案件を確認できませんでした。もう一度お試しください。");
    } finally {
      setFindingCase(false);
    }
  }

  async function openSpecs(row: Submission, inline = false) {
    setError("");
    setSuccess("");
    setOpening(true);
    try {
      const result = await reserveKandenSpecsSlots(row.id);
      if (result.error || !result.first) setError(result.error ?? "諸元の追加を始められませんでした。");
      else {
        setPostAdd(false);
        setCaseNumber("");
        setFoundCase(null);
        setAdding({ row, first: result.first, inline });
      }
    } catch {
      setError("諸元の追加を始められませんでした。もう一度お試しください。");
    } finally {
      setOpening(false);
    }
  }

  function savedSpecs(rows: Submission[] | null, updated?: Submission | null) {
    setRecent(rows);
    if (updated) setUpdatedCases(current => [...current.filter(row => row.id !== updated.id), updated]);
    setError("");
    setSuccess("諸元を追加しました。");
  }

  return <FormPage title="関電 申込の送信" submitterName="" employeeNumber="" mobile={mobile} embedded hideHeading>
    <div className={styles.salesForm} hidden={locked} inert={locked}>
      <header className={styles.pageHeader}>
        <h1>関電 申込の送信</h1>
        <div className={styles.headerActions}>
          <HelpButton />
          <SystemViewButton />
          <ActionButton className={styles.leaveButton} onClick={() => setLocked(true)}><SalesIcon name="lock" /> 離席</ActionButton>
        </div>
      </header>
      <nav className={styles.tabs} aria-label="関電の画面">
        <ActionButton aria-pressed={tab === "mypage"} onClick={() => setTab("mypage")}>
          <SalesIcon name="person" /> マイページ
        </ActionButton>
        <ActionButton aria-pressed={tab === "form"} onClick={() => setTab("form")}>
          <SalesIcon name="camera" /> 新規送信
        </ActionButton>
        <ActionButton aria-pressed={tab === "cases"} onClick={() => setTab("cases")}>
          <SalesIcon name="folder" /> 案件一覧
        </ActionButton>
      </nav>
      <div className={styles.phone}>
        <div className={styles.phoneBar}>{tab === "form" ? "関電業務委託" : tab === "mypage" ? "マイページ" : "案件一覧"}</div>
        <div className={styles.phoneBody}>
          <ResultMessage>{error || uploader.error}</ResultMessage>
          <ResultMessage success>{success}</ResultMessage>
          <div hidden={tab !== "form"}>
            {postAdd && <>
              <PostAddHeading close={() => setPostAdd(false)} disabled={findingCase || opening} />
              <div className={styles.postAddForm}>
                <FieldLabel label="対象の既存案件番号" required>
                  <div className={styles.caseLookup}>
                    <TextField aria-label="案件番号" {...CLARITY_MASK} autoComplete="off" maxLength={50} value={caseNumber}
                      disabled={findingCase || opening} onChange={event => { setCaseNumber(event.target.value); setFoundCase(null); setCaseError(""); }} />
                    <ActionButton disabled={findingCase || opening || !UUID.test(caseNumber.trim())}
                      onClick={() => void findCase()}>案件を確認</ActionButton>
                  </div>
                </FieldLabel>
                <p>案件一覧から案件番号を確認できます。</p>
                {findingCase && <p role="status">案件を確認しています。</p>}
                {foundCase && <>
                  <p className={styles.foundCase} {...CLARITY_MASK}>{foundCase.kanri_no_raw ?? foundCase.kanri_no}　{foundCase.customer_name}</p>
                  <ActionButton disabled={opening || uploader.busy || foundCase.photo_count >= MAX_PHOTOS}
                    onClick={() => void openSpecs(foundCase, true)}>諸元を追加する</ActionButton>
                </>}
                <ResultMessage>{caseError || (foundCase && foundCase.photo_count >= MAX_PHOTOS && "写メの上限に達しています。")}</ResultMessage>
              </div>
            </>}
            {adding?.inline && <AppendSpecs inline locked={locked} row={adding.row} first={adding.first}
              close={() => setAdding(null)} saved={savedSpecs} />}
            <div hidden={postAdd || adding?.inline}>
              <div className={styles.modeBar}><ActionButton onClick={() => { setPostAdd(true); setCaseError(""); }}>
                <SalesIcon name="clip" /> 諸元のみ後付け送信
              </ActionButton></div>
              <FormRow label="① 獲得種類" required>
                <div className={styles.acquisition}>
                  <p>この案件の獲得種類を選択（手数料単価に影響）</p>
                  <div className={styles.acquisitionOptions} role="radiogroup" aria-label="獲得種類" aria-required="true">
                    {acquisitionOptions.map(([acquisition, description, icon]) => <label key={acquisition}>
                      <input type="radio" name="acquisition" aria-label={acquisition} required
                        checked={input.acquisition === acquisition} onChange={() => change({ acquisition })} />
                      <span><SalesIcon name={icon} /> {acquisition}<small>{description}</small></span>
                    </label>)}
                  </div>
                </div>
              </FormRow>
              <FormRow label="② 申込書・証憑を撮影・添付（電灯・動力・ガスのいずれか必須）">
                <div className={styles.attachments}>{photoKinds.map(type => <PhotoPicker key={type.key} kind={type.key}
                  label={type.label} uploader={uploader} getId={getId} limit={MAX_PHOTOS} disabled={locked} />)}</div>
                <div className={styles.ocr}>
                  <FieldLabel label="書類の読み取り">
                    <ActionRow><ActionButton onClick={() => setOcrRequested(true)}>
                      <SalesIcon name="scan" /> 読み取り結果
                    </ActionButton>
                    <ActionButton onClick={() => setOcrRequested(true)}>再読み取り</ActionButton></ActionRow>
                    <p role={ocrRequested ? "status" : undefined}>
                      読み取りは準備中です。{ocrRequested && "下の入力欄から手入力で進めてください。"}
                    </p>
                  </FieldLabel>
                  <div className={styles.urgent} data-urgent={input.urgent_sw}>
                    <CheckboxField checked={input.urgent_sw}
                      onChange={event => change({ urgent_sw: event.target.checked, sw_month: null })}>至急SWを手入力</CheckboxField>
                    <FieldLabel label="希望月" required={input.urgent_sw}>
                      <SelectField aria-label="希望月" disabled={!input.urgent_sw} required={input.urgent_sw} value={input.sw_month ?? ""}
                        onChange={event => change({ sw_month: Number(event.target.value) || null })}>
                        {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}月</option>)}
                      </SelectField>
                    </FieldLabel>
                  </div>
                  <FieldLabel label="供給地点番号（22桁）">
                    <TextField {...CLARITY_MASK} aria-label="供給地点番号" inputMode="numeric" value={formatSupplyPoint(customer.supply)}
                      onChange={event => {
                        const supply = digits(event.target.value, 22);
                        changeCustomer({ supply, ...(supply.length === 22 && { number: supply.slice(3, 17) }) });
                      }} />
                    <small>{customer.supply.length} / 22 桁</small>
                  </FieldLabel>
                  <FieldLabel label="関電お客様番号（14桁）" required={customer.outside}>
                    <TextField {...CLARITY_MASK} aria-label="関電お客様番号" inputMode="numeric" value={formatCustomerNumber(customer.number)}
                      onChange={event => changeCustomer({ number: digits(event.target.value, 14) })} />
                    <small>{customer.number.length} / 14 桁</small>
                  </FieldLabel>
                </div>
              </FormRow>
              <FormRow label="③ PD番号を入力" required>
                <TextField {...CLARITY_MASK} aria-label="PD番号" autoComplete="off" placeholder="PD1527680" maxLength={50}
                  value={input.kanri_no_raw} onChange={event => setPd(event.target.value)} />
                <div className={styles.pdResult} data-state={pd?.customer ? "matched" : pd?.error || (!query && input.kanri_no_raw.trim()) ? "error" : pd ? "outside" : "pending"}>
                  {!input.kanri_no_raw.trim() && <p className={styles.pdEmpty}>PD番号を入力すると<br />リアルタイム照合します</p>}
                  {input.kanri_no_raw.trim() && !query && <p>PDに続けて数字7桁を入力してください。枝番がある場合は括弧で入力できます。</p>}
                  {query && !pd && <p role="status">リストを照合しています。</p>}
                  {pd?.error && <><ResultMessage>{pd.error}</ResultMessage>
                    <ActionButton onClick={() => { setCheckedPd(null); }}>再照合</ActionButton></>}
                  {pd && pd.customer === null && <>
                    <p>リストに見つかりません。リスト外の案件ですか？</p>
                    <RadioGroup name="outside" label="リスト外の案件ですか？" options={["はい", "いいえ"]}
                      value={outsideChoice}
                      onChange={value => {
                        setOutsideChoice(value);
                        changeCustomer({ outside: value === "はい",
                          ...(value === "はい" && !customer.supply && { supply: buildSupplyPoint(customer.number) }),
                        });
                      }} />
                    {outsideChoice === "いいえ" && <p>申込書を確認し、PD番号を入力し直してください。</p>}
                    {customer.outside && <FieldLabel label="リスト外のお客様番号（14桁）" required>
                      <TextField {...CLARITY_MASK} aria-label="リスト外のお客様番号" inputMode="numeric"
                        value={formatCustomerNumber(customer.number)}
                        onChange={event => {
                          const number = digits(event.target.value, 14);
                          changeCustomer({ number, supply: buildSupplyPoint(number) });
                        }} />
                    </FieldLabel>}
                  </>}
                  {pd?.customer && <div className={styles.customerFields} {...CLARITY_MASK}>
                    <strong>リスト照合済み</strong><br />
                    リスト名　{pd.customer.listName || "—"}
                  </div>}
                  {(pd?.customer || customer.outside) && <>
                    <FieldLabel label="お客様名" required>
                      <TextField {...CLARITY_MASK} aria-label="お客様名" required maxLength={120}
                        value={input.customer_name} onChange={event => change({ customer_name: event.target.value })} />
                    </FieldLabel>
                    {([["kana", "カナ"], ["address", "住所"], ["phone", "電話"], ["contract", "契約種別"]] as const).map(([key, label]) =>
                      <FieldLabel key={key} label={label}>
                        <TextField {...CLARITY_MASK} aria-label={label} type={key === "phone" ? "tel" : "text"} maxLength={500}
                          value={customer[key]} onChange={event => changeCustomer({ [key]: event.target.value })} />
                      </FieldLabel>)}
                  </>}
                </div>
                <FieldLabel label="メモ">
                  <TextArea {...CLARITY_MASK} aria-label="メモ" value={input.note} maxLength={2000} onChange={event => change({ note: event.target.value })} />
                </FieldLabel>
              </FormRow>
              <SubmitButton busy={sending} disabled={uploader.busy} onClick={review}>送信する</SubmitButton>
            </div>
          </div>
          <div hidden={tab === "form"}>
            <KandenMypage name={name} number={number} recent={recent} screen={tab === "cases" ? "cases" : "profile"}
              initialUrgentCount={initialUrgentCount} newUrgent={newUrgent} updatedCases={updatedCases}
              active={!locked && tab !== "form"} disabled={opening || uploader.busy || !!adding} append={row => void openSpecs(row)} />
          </div>
        </div>
      </div>
    </div>
    {locked && <FormDialog className={styles.lockDialog} title="画面がロックされています" size="sm" onClose={() => {}} dismissible={false}
      actions={<SubmitButton busy={unlocking} disabled={!password} onClick={() => void unlock()}>ロックを解除</SubmitButton>}>
      <p>Gardenのパスワードを入力してください。</p>
      <TextField type="password" autoComplete="current-password" aria-label="Gardenのパスワード"
        value={password} onChange={event => setPassword(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter") void unlock(); }} />
      <ResultMessage>{lockError}</ResultMessage>
    </FormDialog>}
    {!locked && dialog === "specs" && <FormDialog className={styles.salesDialog} title="諸元が添付されていません" size="sm" onClose={() => setDialog(null)}
      actions={<><ActionButton onClick={() => warningPicker.current?.click()}>添付する</ActionButton>
        <ActionButton onClick={() => setDialog("confirm")}>諸元待ちで送信</ActionButton></>}>
      <p>諸元は送信したあとでも追加できます。</p>
      <input ref={warningPicker} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={event => {
        const files = Array.from(event.currentTarget.files ?? []);
        if (!files.length) return;
        setDialog(null);
        uploader.add(getId(), "specs", files, MAX_PHOTOS, false);
      }} />
    </FormDialog>}
    {!locked && dialog === "confirm" && <FormDialog className={styles.salesDialog} title="送信内容の確認" size="sm" onClose={() => setDialog(null)} dismissible={!sending}
      actions={<><ActionButton disabled={sending} onClick={() => setDialog(null)}>戻る</ActionButton>
        <SubmitButton busy={sending} onClick={() => void submit()}>送信する</SubmitButton></>}>
      <KandenSummary row={submission} count={uploader.photos.length} specs={hasSpecs ? "あり" : "諸元待ち"} />
    </FormDialog>}
    {adding && !adding.inline && <AppendSpecs locked={locked} row={adding.row} first={adding.first}
      close={() => setAdding(null)} saved={savedSpecs} />}
  </FormPage>;
}
