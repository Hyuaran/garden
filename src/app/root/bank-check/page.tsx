"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "../_components/Button";
import { Modal } from "../_components/Modal";
import { PageHeader } from "../_components/PageHeader";
import { TextField, TextareaField } from "../_components/FormField";
import { colors } from "../_constants/colors";
import { useRootState } from "../_state/RootStateContext";

type Finding = {
  id: string;
  source: "history" | "bud";
  employeeId: string | null;
  employeeName: string;
  employeeNumber: string | null;
  sourceLabel: string;
  registeredLabel: string;
  issues: string[];
  issueLabel: string;
  candidateLabel: string;
  candidate: Record<string, unknown>;
  canApply: boolean;
};

type Dataset = {
  id?: string;
  imported_at?: string;
  source_date?: string;
  status?: string;
  bank_count?: number;
  branch_count?: number;
  banks_added?: number;
  banks_expired?: number;
  banks_renamed?: number;
  branches_added?: number;
  branches_expired?: number;
  branches_renamed?: number;
  check_findings?: number;
  note?: string | null;
};

type ApiState = { findings: Finding[]; datasets: Dataset[] };

const ISSUE_OPTIONS = ["すべて", "コード無し", "台帳に無い", "廃止済み", "名前が違う", "支店名なし"];

function Icon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "未確認";
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function datasetSummary(datasets: Dataset[]) {
  const dataset = datasets[0];
  if (!dataset) return "台帳：記録はまだありません";
  // 「変更なし」の記録には件数が無いので、直近の「更新済み」の件数を出す
  const counted = datasets.find((row) => row.status === "ok" && row.bank_count != null) ?? dataset;
  const status = dataset.status === "skipped_same" ? "変更なし" : dataset.status === "ok" ? "更新済み" : "失敗";
  return `台帳：全銀協データ ${counted.source_date ?? dataset.source_date ?? "-"} 版（金融機関 ${counted.bank_count?.toLocaleString("ja-JP") ?? "-"}・支店 ${counted.branch_count?.toLocaleString("ja-JP") ?? "-"}）　最終確認 ${formatDateTime(dataset.imported_at)} ${status}`;
}

export default function BankCheckPage() {
  const { hasRoleAtLeast } = useRootState();
  const [state, setState] = useState<ApiState>({ findings: [], datasets: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("すべて");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [successorTarget, setSuccessorTarget] = useState<Finding | null>(null);
  const [successor, setSuccessor] = useState({ old_bank_code: "", old_branch_code: "", new_bank_code: "", new_branch_code: "", effective_date: "", note: "" });

  const allowed = hasRoleAtLeast("admin");
  const visible = useMemo(() => filter === "すべて" ? state.findings : state.findings.filter((row) => row.issueLabel === filter), [filter, state.findings]);

  async function load() {
    if (!allowed) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/root/bank-check", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "点検結果を読み込めませんでした");
      setState({ findings: body.findings ?? [], datasets: body.datasets ?? [] });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "点検結果を読み込めませんでした");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [allowed]);

  async function refreshLedger() {
    setRefreshing(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/root/bank-check/refresh", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "台帳を更新できませんでした。時間をおいてもう一度お試しください。続くときは管理者へお問い合わせください。");
      setMessage(body.status === "skipped_same" ? "変更なし" : `追加 ${Number(body.banksAdded ?? 0) + Number(body.branchesAdded ?? 0)}・改称 ${Number(body.banksRenamed ?? 0) + Number(body.branchesRenamed ?? 0)}・廃止 ${Number(body.banksExpired ?? 0) + Number(body.branchesExpired ?? 0)}`);
      await load();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "台帳を更新できませんでした。時間をおいてもう一度お試しください。続くときは管理者へお問い合わせください。");
    } finally {
      setRefreshing(false);
    }
  }

  async function apply(row: Finding) {
    if (!row.employeeId) return;
    setError(""); setMessage("");
    const response = await fetch("/api/root/bank-check/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ employee_id: row.employeeId, payload: row.id.endsWith(":sub") ? { sub_account: row.candidate } : row.candidate, issue: row.id.endsWith(":sub") ? `サブ口座 ${row.issueLabel}` : row.issueLabel }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "登録できませんでした");
      return;
    }
    setMessage(body.added ? "履歴に登録しました" : "同じ値のため追加しませんでした");
    await load();
  }

  function openSuccessor(row: Finding) {
    const payload = row.registeredLabel.match(/(\d{4}).*?(\d{3})/);
    setSuccessorTarget(row);
    setSuccessor({ old_bank_code: payload?.[1] ?? "", old_branch_code: payload?.[2] ?? "", new_bank_code: "", new_branch_code: "", effective_date: "", note: "" });
  }

  async function saveSuccessor() {
    const response = await fetch("/api/root/bank-check/successors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(successor),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "後継を登録できませんでした");
      return;
    }
    setSuccessorTarget(null);
    setMessage("後継を登録しました");
    await load();
  }

  if (!allowed) {
    return <div style={{ color: colors.text, background: colors.bgPanel, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 20 }}>この画面は管理者以上が利用できます。</div>;
  }

  return (
    <>
      <PageHeader
        title="Root ／ 口座の点検"
        description={datasetSummary(state.datasets)}
        actions={<Button onClick={refreshLedger} disabled={refreshing}>{refreshing ? "確認中..." : <><Icon path="M21 12a9 9 0 0 1-15 6.7M3 12a9 9 0 0 1 15-6.7M18 3v4h-4M6 21v-4h4" /> 台帳をいま更新</>}</Button>}
      />
      {message && <div style={{ background: colors.successBg, color: colors.success, padding: "9px 12px", borderRadius: 4, marginBottom: 12 }}>{message}</div>}
      {error && <div role="alert" style={{ background: colors.dangerBg, color: colors.danger, padding: "9px 12px", borderRadius: 4, marginBottom: 12 }}>{error}</div>}
      <section style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          <strong style={{ color: colors.text }}>点検結果 {state.findings.length} 件</strong>
          <label style={{ display: "flex", gap: 8, alignItems: "center", color: colors.textMuted, fontSize: 13 }}>
            指摘で絞る：
            <select value={filter} onChange={(event) => setFilter(event.target.value)} style={{ padding: "7px 10px", border: `1px solid ${colors.border}`, borderRadius: 4, background: "#fff" }}>
              {ISSUE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
        {loading ? <div style={{ padding: 32, textAlign: "center", color: colors.textMuted }}>読込中...</div> : visible.length === 0 ? (
          <div style={{ padding: 28, color: colors.textMuted }}>点検結果はありません。登録されている口座はすべて台帳と合っています。</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: colors.text }}>
              <thead><tr>{["氏名", "出どころ", "登録されている値", "指摘", "候補", ""].map((head) => <th key={head} style={{ textAlign: "left", padding: "9px 8px", borderBottom: `1px solid ${colors.border}`, color: colors.textMuted, whiteSpace: "nowrap" }}>{head}</th>)}</tr></thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: "10px 8px", borderBottom: `1px solid ${colors.border}` }}>{row.employeeName}</td>
                    <td style={{ padding: "10px 8px", borderBottom: `1px solid ${colors.border}` }}>{row.sourceLabel}</td>
                    <td style={{ padding: "10px 8px", borderBottom: `1px solid ${colors.border}`, minWidth: 220 }}>{row.registeredLabel}</td>
                    <td style={{ padding: "10px 8px", borderBottom: `1px solid ${colors.border}`, color: row.issueLabel === "廃止済み" ? colors.danger : colors.warning, fontWeight: 700 }}>{row.issueLabel}</td>
                    <td style={{ padding: "10px 8px", borderBottom: `1px solid ${colors.border}`, minWidth: 180 }}>{row.candidateLabel}</td>
                    <td style={{ padding: "10px 8px", borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap" }}>
                      {row.issueLabel === "廃止済み" && !row.canApply ? <Button variant="secondary" onClick={() => openSuccessor(row)}>後継を登録</Button> : null}
                      {row.canApply && row.source === "history" ? <Button onClick={() => void apply(row)}>この値で登録</Button> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ margin: "14px 0 0", color: colors.textMuted, fontSize: 12, lineHeight: 1.7 }}>
          点検の物差し：金融機関コード・支店コードが空、台帳に無いコード、台帳で廃止、名前が台帳と違う、支店名が空。
        </p>
      </section>
      <section style={{ marginTop: 18, background: colors.bgPanel, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 16 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 15, color: colors.text }}>台帳の確認記録</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <tbody>
              {state.datasets.map((row) => (
                <tr key={row.id ?? row.imported_at}>
                  <td style={{ padding: 8, borderTop: `1px solid ${colors.border}` }}>{formatDateTime(row.imported_at)}</td>
                  <td style={{ padding: 8, borderTop: `1px solid ${colors.border}` }}>{row.source_date}</td>
                  <td style={{ padding: 8, borderTop: `1px solid ${colors.border}` }}>{row.status === "skipped_same" ? "変更なし" : row.status === "ok" ? "更新済み" : "失敗"}</td>
                  <td style={{ padding: 8, borderTop: `1px solid ${colors.border}` }}>追加 {(row.banks_added ?? 0) + (row.branches_added ?? 0)}・改称 {(row.banks_renamed ?? 0) + (row.branches_renamed ?? 0)}・廃止 {(row.banks_expired ?? 0) + (row.branches_expired ?? 0)}</td>
                  <td style={{ padding: 8, borderTop: `1px solid ${colors.border}` }}>点検 {row.check_findings ?? "-"} 件</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Modal open={!!successorTarget} onClose={() => setSuccessorTarget(null)} title="後継を登録" width={560}>
        <div style={{ display: "grid", gap: 10 }}>
          <TextField label="廃止された金融機関コード" value={successor.old_bank_code} onChange={(e) => setSuccessor({ ...successor, old_bank_code: e.target.value })} />
          <TextField label="廃止された支店コード" value={successor.old_branch_code} onChange={(e) => setSuccessor({ ...successor, old_branch_code: e.target.value })} />
          <TextField label="後継の金融機関コード" value={successor.new_bank_code} onChange={(e) => setSuccessor({ ...successor, new_bank_code: e.target.value })} />
          <TextField label="後継の支店コード" value={successor.new_branch_code} onChange={(e) => setSuccessor({ ...successor, new_branch_code: e.target.value })} />
          <TextField label="適用日" type="date" value={successor.effective_date} onChange={(e) => setSuccessor({ ...successor, effective_date: e.target.value })} />
          <TextareaField label="メモ" value={successor.note} onChange={(e) => setSuccessor({ ...successor, note: e.target.value })} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>
            <Button variant="secondary" onClick={() => setSuccessorTarget(null)}>やめる</Button>
            <Button onClick={() => void saveSuccessor()}>登録する</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
