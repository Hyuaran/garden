"use client";

import { useMemo, useState } from "react";
import { isValidEmailAddress, recipientSuggestions, type ComposeDraft } from "../_lib/compose";
import styles from "./RillMailScreen.module.css";

const MODE_LABEL = { new: "新規", reply: "返信", replyAll: "全員に返信", forward: "転送" } as const;

function SendIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>;
}

export function RillComposePane({ draft, addresses, error, onChange, onSend, onMinimize, onClose, onDiscard }: {
  draft: ComposeDraft;
  addresses: string[];
  error: string;
  onChange: (draft: ComposeDraft) => void;
  onSend: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onDiscard: () => void;
}) {
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const suggestions = useMemo(() => recipientSuggestions(addresses, toInput || ccInput), [addresses, ccInput, toInput]);
  const add = (field: "to" | "cc", raw: string) => {
    const values = raw.split(/[,;\s]+/u).map((value) => value.trim()).filter(Boolean);
    if (!values.length || !values.every(isValidEmailAddress)) return;
    onChange({ ...draft, [field]: [...new Set([...draft[field], ...values])] });
    if (field === "to") setToInput(""); else setCcInput("");
  };
  const keyDown = (field: "to" | "cc", value: string) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "," || event.key === ";") { event.preventDefault(); add(field, value); }
  };
  const chips = (field: "to" | "cc") => draft[field].map((address) => <span className={styles.composeChip} key={address}>{address}<button aria-label={`${address}を削除`} onClick={() => onChange({ ...draft, [field]: draft[field].filter((item) => item !== address) })}>×</button></span>);

  return <section className={styles.composePane} aria-label={`${MODE_LABEL[draft.mode]}メール`}>
    <header className={styles.composeTop}><b>{MODE_LABEL[draft.mode]}：{draft.subject || "件名なし"}</b><button title="未送信として折りたたむ" onClick={onMinimize}>−</button><button title="閉じる" onClick={onClose}>×</button></header>
    <div className={styles.composeHead}>
      <button className={styles.composeSend} onClick={onSend}><SendIcon />送信</button>
      <div className={styles.composeFields}>
        <div className={styles.composeRow}><span>差出人</span><div>{draft.fromLabel}</div></div>
        <div className={styles.composeRow}><span>宛先</span><div className={styles.composeChips}>{chips("to")}<input list={`suggest-${draft.id}`} value={toInput} onChange={(event) => setToInput(event.target.value)} onKeyDown={keyDown("to", toInput)} onBlur={() => add("to", toInput)} placeholder="メールアドレス" /></div><button className={styles.ccToggle} onClick={() => onChange({ ...draft, ccVisible: true })}>＋Cc</button></div>
        {draft.ccVisible && <div className={styles.composeRow}><span>Cc</span><div className={styles.composeChips}>{chips("cc")}<input list={`suggest-${draft.id}`} value={ccInput} onChange={(event) => setCcInput(event.target.value)} onKeyDown={keyDown("cc", ccInput)} onBlur={() => add("cc", ccInput)} placeholder="メールアドレス" /></div></div>}
        <div className={styles.composeRow}><span>件名</span><input value={draft.subject} onChange={(event) => onChange({ ...draft, subject: event.target.value })} /></div>
        <datalist id={`suggest-${draft.id}`}>{suggestions.map((address) => <option value={address} key={address} />)}</datalist>
      </div>
    </div>
    <div className={styles.composeBody}><textarea autoFocus value={draft.bodyText} onChange={(event) => onChange({ ...draft, bodyText: event.target.value })} placeholder="本文を入力" />{draft.mode !== "new" && <div className={styles.composeQuote}><small>{draft.mode === "forward" ? "-----転送する元のメッセージ（添付ファイルは含まれません）-----" : "-----元のメッセージ（引用ごと送られます）-----"}</small>{draft.quote}</div>}</div>
    <footer className={styles.composeFoot}><button onClick={onDiscard}>破棄</button><span>添付（次段階）</span><small>「−」で畳めば未送信として残ります</small></footer>
    {error && <div className={styles.composeError}>{error}</div>}
  </section>;
}
