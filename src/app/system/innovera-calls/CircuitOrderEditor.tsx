"use client";
import { useEffect, useRef, useState } from "react";
import type { CircuitGroup } from "@/lib/innovera/circuit-order.server";
import ReorderGrip from "../_components/ReorderGrip/ReorderGrip";
import Modal from "../_components/Modal/Modal";
import styles from "./innovera-calls.module.css";

const otherGroup = (): CircuitGroup => ({ id: null, name: "その他", circuits: [] });
const withOther = (groups: CircuitGroup[]) => groups.some(g => g.id === null) ? groups : [...groups, otherGroup()];
export default function CircuitOrderEditor({ onBusy }: { onBusy: (busy: boolean) => void }) {
  const [groups, setGroups] = useState<CircuitGroup[]>([]);
  const current = useRef<CircuitGroup[]>([]), confirmed = useRef<CircuitGroup[]>([]);
  const queue = useRef<CircuitGroup[][]>([]), running = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<{ kind: "add" | "rename" | "delete"; id?: string; name: string } | null>(null);
  const [nameError, setNameError] = useState("");
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await fetch("/api/system/innovera-calls/circuit-order", { cache: "no-store" });
        const body = await res.json();
        if (!res.ok || !body.ok) throw new Error();
        if (live) { current.current = confirmed.current = withOther(body.circuitGroups); setGroups(current.current); }
      } catch { if (live) setError("並び順を取得できませんでした。もう一度お試しください"); }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, []);

  async function drain() {
    if (running.current) return;
    running.current = true; onBusy(true);
    try {
      while (queue.current.length) {
        const next = queue.current.shift()!;
        const res = await fetch("/api/system/innovera-calls/circuit-order", {
          method: "PUT", headers: { "content-type": "application/json" },
          body: JSON.stringify({ groups: next.filter(g => g.id !== null).map(g => ({ id: g.id, name: g.name, circuitIds: g.circuits.map(c => c.id) })), other: next.find(g => g.id === null)?.circuits.map(c => c.id) ?? [] }),
        });
        const body = await res.json();
        if (!res.ok || !body.ok) throw new Error();
        confirmed.current = withOther(body.circuitGroups);
        if (!queue.current.length) { current.current = confirmed.current; setGroups(current.current); }
      }
    } catch {
      queue.current = []; current.current = confirmed.current; setGroups(current.current);
      setDialog(null);
      setError("並び順を保存できませんでした。もう一度お試しください");
    } finally { running.current = false; onBusy(false); }
  }
  function save(next: CircuitGroup[]) {
    current.current = next; setGroups(next); setError(""); queue.current.push(next); void drain();
  }
  function moveGroup(key: string, target: string) {
    const next = [...current.current]; const from = next.findIndex(g => g.id === key), to = next.findIndex(g => g.id === target);
    if (from < 0 || to < 0) return;
    next.splice(to, 0, next.splice(from, 1)[0]); save(next);
  }
  // 表題の上に落とす＝その表題の先頭（表題の下に線）。同じ表題の中で下へ動かす＝相手の後ろ（下に線）。それ以外は相手の前（上に線）
  function circuitDropSide(key: string, target: string): "before" | "after" {
    if (target.startsWith("g:")) return "after";
    const group = current.current.find(g => g.circuits.some(c => `c:${c.id}` === key));
    const ids = group?.circuits.map(c => `c:${c.id}`) ?? [];
    return ids.includes(target) && ids.indexOf(target) > ids.indexOf(key) ? "after" : "before";
  }
  function moveCircuit(key: string, target: string) {
    const next = current.current.map(g => ({ ...g, circuits: [...g.circuits] }));
    const source = next.find(g => g.circuits.some(c => `c:${c.id}` === key));
    const dest = next.find(g => `g:${g.id ?? "other"}` === target || g.circuits.some(c => `c:${c.id}` === target));
    if (!source || !dest) return;
    const from = source.circuits.findIndex(c => `c:${c.id}` === key);
    const to = target.startsWith("g:") ? 0 : dest.circuits.findIndex(c => `c:${c.id}` === target);
    const item = source.circuits.splice(from, 1)[0]; dest.circuits.splice(to, 0, item); save(next);
  }
  function submitDialog() {
    if (!dialog) return;
    if (dialog.kind === "delete") {
      const deleted = current.current.find(g => g.id === dialog.id)!;
      save(current.current.filter(g => g.id !== dialog.id).map(g => g.id === null ? { ...g, circuits: [...g.circuits, ...deleted.circuits] } : g));
    } else {
      const name = dialog.name.trim();
      if (!name || [...name].length > 30 || current.current.some(g => g.id !== dialog.id && g.id !== null && g.name === name)) { setNameError("表題は重複しない1〜30文字で入力してください"); return; }
      if (dialog.kind === "add") {
        const next = [...current.current]; next.splice(next.length - 1, 0, { id: crypto.randomUUID(), name, circuits: [] }); save(next);
      } else save(current.current.map(g => g.id === dialog.id ? { ...g, name } : g));
    }
    setDialog(null);
  }
  const groupKeys = groups.flatMap(g => g.id === null ? [] : [g.id]);
  const circuitKeys = groups.flatMap(g => [`g:${g.id ?? "other"}`, ...g.circuits.map(c => `c:${c.id}`)]);
  const open = (value: NonNullable<typeof dialog>) => { setNameError(""); setDialog(value); };
  return <section className={styles.orderEditor} aria-label="発信番号の並び順">
    {loading && <p role="status">確認中...</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {groups.map(g => <div key={g.id ?? "other"} data-order-group={g.id ?? "other"}>
      <div className={styles.orderHeading} data-order-item={`g:${g.id ?? "other"}`}>
        {g.id !== null && <ReorderGrip label={g.name} itemKey={g.id} keys={groupKeys} selector="[data-order-group]" attribute="data-order-group" onMove={moveGroup} />}
        <strong>{g.name}</strong>
        {g.id !== null && <><button type="button" onClick={() => open({ kind: "rename", id: g.id!, name: g.name })}>名前を変更する</button><button type="button" onClick={() => open({ kind: "delete", id: g.id!, name: g.name })}>削除する</button></>}
      </div>
      {g.circuits.map(c => <div className={styles.orderCircuit} key={c.id} data-order-item={`c:${c.id}`}>
        <ReorderGrip label={c.name} itemKey={`c:${c.id}`} keys={circuitKeys.filter(key => key !== `g:${g.id ?? "other"}`)} selector="[data-order-item]" attribute="data-order-item" onMove={moveCircuit} dropSide={circuitDropSide} />
        <span>{c.name}</span>
      </div>)}
    </div>)}
    {!loading && groups.length > 0 && <button type="button" onClick={() => open({ kind: "add", name: "" })}>＋ 表題を追加する</button>}
    {dialog && <Modal size="sm" title={dialog.kind === "add" ? "表題を追加する" : dialog.kind === "rename" ? "名前を変更する" : "削除する"} onClose={() => setDialog(null)}>
      {dialog.kind === "delete" ? <p>『{dialog.name}』を削除します。中の番号は『その他』に移ります</p> : <label className={styles.modalField}>表題<input autoFocus value={dialog.name} onChange={e => setDialog({ ...dialog, name: e.target.value })} onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submitDialog(); }} /></label>}
      {nameError && <p className={styles.error} role="alert">{nameError}</p>}
      <div data-modal-actions><button type="button" data-modal-action="secondary" onClick={() => setDialog(null)}>キャンセル</button><button type="button" data-modal-action="primary" onClick={submitDialog}>{dialog.kind === "delete" ? "削除する" : dialog.kind === "add" ? "表題を追加する" : "名前を変更する"}</button></div>
    </Modal>}
  </section>;
}
