"use client";

import { useEffect, useRef, useState } from "react";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import {
  ACQUISITIONS, acquisitionLabel, dateInJapan, EMPTY_FORM, MAX_PHOTOS, MAX_PHOTO_BYTES,
  PHOTO_TYPES, PRODUCTS, submissionError, type FormInput, type PhotoKind, type PhotoSlot, type Submission,
} from "@/lib/leaf-kanden/submissions";
import {
  ActionButton, ActionRow, CheckboxField, FieldLabel, FormDialog, FormPage, FormRow, PhotoPreview, RadioGroup,
  RecentList, ResultMessage, SelectField, SubmitButton, TextArea, TextField,
} from "../_components/form-kit";
import { preparePhotoUploads, reserveKandenSpecsSlots, sendKandenForm } from "./actions";
import { compressKandenPhoto } from "./photo-client";
import KandenSummary from "./KandenSummary";

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
  const blocked = disabled || uploader.busy;
  const photos = uploader.photos.filter(photo => photo.kind === kind);
  const input = { accept: "image/*,.heic,.heif", type: "file", hidden: true, disabled: blocked,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      uploader.add(getId(), kind, Array.from(event.currentTarget.files ?? []), limit, append);
      event.currentTarget.value = "";
    } };
  return <FieldLabel label={label}>
    <input {...input} ref={choose} multiple />
    <input {...input} ref={capture} capture="environment" />
    <ActionRow>
      <ActionButton disabled={blocked} onClick={() => capture.current?.click()} aria-label={`${label}を撮る`}>＋撮る</ActionButton>
      <ActionButton disabled={blocked} onClick={() => choose.current?.click()} aria-label={`${label}を選ぶ`}>＋選ぶ</ActionButton>
    </ActionRow>
    {photos.map(photo => <ActionRow key={slotKey(photo)}>
      {photo.preview && <PhotoPreview src={photo.preview} alt={`${label}の写メ`} />}
      {photo.status === "sending" && <span role="status">送信中…</span>}
      {photo.status === "failed" && <ActionButton disabled={blocked}
        onClick={() => void uploader.upload(getId(), [photo], append)}>再送</ActionButton>}
      <ActionButton disabled={blocked} onClick={() => uploader.remove(photo)}>取り除く</ActionButton>
    </ActionRow>)}
  </FieldLabel>;
}

function slotsFor(photos: Attachment[]) {
  return photos.map(({ kind, index }) => ({ kind, index }));
}

function AppendSpecs({ row, first, close, saved }: {
  row: Submission; first: number; close: () => void; saved: (recent: Submission[] | null) => void;
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
        saved(result.recent);
      }
    } catch {
      setError("諸元を送信できませんでした。もう一度お試しください。");
    } finally {
      setSending(false);
    }
  }

  return <FormDialog title="諸元を追加" size="sm" onClose={dismiss} dismissible={!sending && !uploader.busy}
    actions={<SubmitButton busy={sending} disabled={!uploader.photos.length || uploader.photos.some(photo => photo.status !== "ready")}
      onClick={() => void submit()}>諸元を送信する</SubmitButton>}>
    <ResultMessage>{error || uploader.error}</ResultMessage>
    <p {...CLARITY_MASK}>{row.kanri_no ?? row.kanri_no_raw} {row.customer_name}</p>
    <PhotoPicker kind="specs" label="諸元" uploader={uploader} getId={() => row.id}
      append limit={MAX_PHOTOS - row.photo_count} disabled={sending} />
  </FormDialog>;
}

export default function KandenForm({ name, number, mobile, initialRecent }: {
  name: string; number: string; mobile: boolean; initialRecent: Submission[] | null;
}) {
  const draft = useRef<string | null>(null);
  const warningPicker = useRef<HTMLInputElement>(null);
  const getId = () => draft.current ??= crypto.randomUUID();
  const [input, setInput] = useState(EMPTY_FORM);
  const [recent, setRecent] = useState(initialRecent);
  const [dialog, setDialog] = useState<"specs" | "confirm" | null>(null);
  const [adding, setAdding] = useState<{ row: Submission; first: number } | null>(null);
  const [opening, setOpening] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const uploader = useAttachments();

  function change(patch: Partial<FormInput>) {
    setInput(current => ({ ...current, ...patch }));
    setError("");
    setSuccess("");
  }

  function review() {
    setSuccess("");
    const error = uploader.photos.some(photo => photo.status !== "ready") ? uploadError : submissionError(input, uploader.photos);
    setError(error);
    if (!error) setDialog(uploader.photos.some(photo => photo.kind === "specs") ? "confirm" : "specs");
  }

  async function submit() {
    setSending(true);
    try {
      const result = await sendKandenForm(getId(), input, slotsFor(uploader.photos), true);
      if ("error" in result) setError(result.error);
      else {
        setRecent(result.recent);
        setInput(EMPTY_FORM);
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

  async function openSpecs(row: Submission) {
    setError("");
    setSuccess("");
    setOpening(true);
    try {
      const result = await reserveKandenSpecsSlots(row.id);
      if (result.error || !result.first) setError(result.error ?? "諸元の追加を始められませんでした。");
      else setAdding({ row, first: result.first });
    } catch {
      setError("諸元の追加を始められませんでした。もう一度お試しください。");
    } finally {
      setOpening(false);
    }
  }

  const hasSpecs = uploader.photos.some(photo => photo.kind === "specs");
  return <FormPage title="関電 申込の送信" submitterName={name} employeeNumber={number} mobile={mobile}>
    <ResultMessage>{error || uploader.error || (recent === null && "最近の送信を読み込めませんでした。")}</ResultMessage>
    <ResultMessage success>{success}</ResultMessage>
    <FormRow label="1 区分" required>
      <RadioGroup name="acquisition" label="区分" options={ACQUISITIONS} value={input.acquisition}
        onChange={acquisition => change({ acquisition })} required />
    </FormRow>
    <FormRow label="2 管理番号">
      <TextField {...CLARITY_MASK} aria-label="管理番号" placeholder="不明なら空欄で送れます" maxLength={50}
        value={input.kanri_no_raw} onChange={event => change({ kanri_no_raw: event.target.value })} />
    </FormRow>
    <FormRow label="3 お客様名" required>
      <TextField {...CLARITY_MASK} aria-label="お客様名" required maxLength={120}
        value={input.customer_name} onChange={event => change({ customer_name: event.target.value })} />
    </FormRow>
    <FormRow label="4 獲得内容" required>
      <ActionRow>{PRODUCTS.map(product => <CheckboxField key={product.key} checked={input[product.field]}
        onChange={event => change({ [product.field]: event.target.checked })}>{product.label}</CheckboxField>)}</ActionRow>
    </FormRow>
    <FormRow label="5 至急SW" grouped>
      <RadioGroup name="urgent" label="至急SW" options={["なし", "あり"]} value={input.urgent_sw ? "あり" : "なし"}
        onChange={value => change({ urgent_sw: value === "あり", sw_month: null })} />
      {input.urgent_sw && <FieldLabel label="希望月" required>
        <SelectField aria-label="希望月" required value={input.sw_month ?? ""}
          onChange={event => change({ sw_month: Number(event.target.value) || null })}>
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}月</option>)}
        </SelectField>
      </FieldLabel>}
    </FormRow>
    <FormRow label="6 写メ" grouped expanded required>
      {PHOTO_TYPES.map(type => <PhotoPicker key={type.key} kind={type.key}
        label={type.key === "receipt" ? "受領書" : type.label} uploader={uploader} getId={getId} limit={MAX_PHOTOS} />)}
    </FormRow>
    <FormRow label="7 メモ">
      <TextArea {...CLARITY_MASK} aria-label="メモ" value={input.note} maxLength={2000} onChange={event => change({ note: event.target.value })} />
    </FormRow>
    <SubmitButton busy={sending} disabled={uploader.busy} onClick={review}>送信する</SubmitButton>
    {recent && <RecentList title="自分の最近の送信" items={recent.map(row => <ActionRow key={row.id}>
      <span {...CLARITY_MASK}>{dateInJapan(new Date(row.submitted_at)).slice(5).replace("-", "/")} {row.kanri_no ?? "管理番号なし"} {row.customer_name}
        {"　"}{acquisitionLabel(row)}{"　"}写メ {row.photo_count} 枚{"　"}{row.specs_status === "あり" ? "諸元あり" : row.specs_status}</span>
      {row.specs_status === "諸元待ち" && row.photo_count < MAX_PHOTOS &&
        <ActionButton disabled={opening || uploader.busy} onClick={() => void openSpecs(row)}>諸元を追加</ActionButton>}
    </ActionRow>)} />}
    {dialog === "specs" && <FormDialog title="諸元が添付されていません" size="sm" onClose={() => setDialog(null)}
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
    {dialog === "confirm" && <FormDialog title="送信内容の確認" size="md" onClose={() => setDialog(null)} dismissible={!sending}
      actions={<><ActionButton disabled={sending} onClick={() => setDialog(null)}>戻る</ActionButton>
        <SubmitButton busy={sending} onClick={() => void submit()}>送信する</SubmitButton></>}>
      <KandenSummary row={input} count={uploader.photos.length} specs={hasSpecs ? "あり" : "諸元待ち"} />
    </FormDialog>}
    {adding && <AppendSpecs row={adding.row} first={adding.first} close={() => setAdding(null)} saved={rows => {
      setRecent(rows);
      setError("");
      setSuccess("諸元を追加しました。");
    }} />}
  </FormPage>;
}
