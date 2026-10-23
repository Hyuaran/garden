"use client";
import { useEffect, useState } from "react";
import styles from "../onboarding.module.css";
type LinkState = { linked: boolean; name?: string; message?: string; svg?: string };
export default function LineLink() {
  const [state, setState] = useState<LinkState>();
  const [notice, setNotice] = useState("");
  const [completed, setCompleted] = useState(false);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const deadline = Date.now() + 600_000;
    let sawUnlinked = false;
    async function check() {
      try {
        const response = await fetch("/api/system/onboarding/line-link", { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(body.error);
        setState(body); setNotice("");
        if (body.linked) { setCompleted(sawUnlinked); return; }
        sawUnlinked = true;
      } catch {
        if (!active) return;
        setNotice("公式 LINE のご案内を確認できませんでした。時間をおいて画面を開き直してください。");
      }
      if (active && Date.now() + 5000 < deadline) timer = setTimeout(check, 5000);
    }
    void check();
    const stop = setTimeout(() => { active = false; clearTimeout(timer); controller.abort(); }, 600_000);
    return () => { active = false; clearTimeout(timer); clearTimeout(stop); controller.abort(); };
  }, []);
  if (state?.linked) return <section className={styles.panel} role="status">{completed ? "登録できました" : `公式 LINE は登録済みです（${state.name || "ご本人"}さん）`}</section>;
  return <section className={styles.panel} aria-label="公式 LINE の登録">
    <h2>最後に、公式 LINE を登録してください</h2>
    {state?.svg && <div role="img" aria-label="公式 LINE 登録用の QR コード" style={{ width: 220, maxWidth: "100%" }} dangerouslySetInnerHTML={{ __html: state.svg }} />}
    <p>スマホのカメラで読み取ると LINE が開きます。</p>
    <p>開いたら、次の文をそのまま送ってください。</p>
    {state?.message && <><p style={{ fontSize: "1.75rem", fontWeight: 700, overflowWrap: "anywhere" }}>{state.message}</p><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(state.message!); setNotice("コピーしました。"); } catch { setNotice("表示されている文を選んでコピーしてください。"); } }}>コピーする</button></>}
    <p>※友だち追加の画面が出たら、追加してから送ってください。</p>
    <p>登録できると、ここが「登録できました」に変わります。</p>
    {notice && <p role="status">{notice}</p>}
  </section>;
}
