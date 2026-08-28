"use client";
import { useEffect, useState, type FormEvent } from "react";
import type {
  ContractCompany,
  ContractDraft,
  ContractRow,
} from "./_lib/contract-types";
const card = {
  border: "1px solid #dbe5dc",
  borderRadius: 12,
  padding: 18,
  background: "#fff",
  marginBottom: 18,
} as const;
const input = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: 9,
  border: "1px solid #b9c9bc",
  borderRadius: 6,
};
export default function ContractsPage() {
  const [companies, setCompanies] = useState<ContractCompany[]>([]),
    [rows, setRows] = useState<ContractRow[]>([]),
    [file, setFile] = useState<File | null>(null),
    [draft, setDraft] = useState<ContractDraft | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [template, setTemplate] = useState<ContractRow | null>(null),
    [issuerId, setIssuerId] = useState(""),
    [product, setProduct] = useState(""),
    [hiddenTerms, setHiddenTerms] = useState(""),
    [maskMoney, setMaskMoney] = useState(true);
  async function load() {
    const r = await fetch("/api/system/contracts");
    if (r.ok) {
      const j = await r.json();
      setCompanies(j.companies ?? []);
      setRows(j.rows ?? []);
    }
  }
  useEffect(() => {
    // Initial API hydration is intentionally performed once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);
  async function choose(next: File | null) {
    setFile(next);
    setDraft(null);
    setMessage("");
    if (!next) return;
    const form = new FormData();
    form.set("action", "analyze");
    form.set("file", next);
    setBusy(true);
    const r = await fetch("/api/system/contracts", {
        method: "POST",
        body: form,
      }),
      j = await r.json();
    setBusy(false);
    if (!r.ok) return setMessage(j.error);
    setDraft(j.draft);
  }
  async function register(e: FormEvent) {
    e.preventDefault();
    if (!file || !draft) return;
    const form = new FormData();
    form.set("action", "register");
    form.set("file", file);
    for (const [k, v] of Object.entries({
      counterparty: draft.counterparty,
      companyId: draft.companyId,
      contractType: draft.contractType,
      concludedOn: draft.concludedOn,
      note: draft.note,
    }))
      form.set(k, String(v));
    setBusy(true);
    const r = await fetch("/api/system/contracts", {
        method: "POST",
        body: form,
      }),
      j = await r.json();
    setBusy(false);
    if (!r.ok) return setMessage(j.error);
    setMessage(
      j.driveStatus === "skipped"
        ? "台帳へ登録しました。Drive保存は設定後に行ってください。"
        : "契約書を登録し、Driveへ保存しました。",
    );
    setFile(null);
    setDraft(null);
    await load();
  }
  function openTemplate(row: ContractRow) {
    setTemplate(row);
    setIssuerId(
      row.company_id === "ALL"
        ? (companies[0]?.company_id ?? "")
        : row.company_id,
    );
    setProduct(row.contract_type);
    setHiddenTerms(row.counterparty);
    setMaskMoney(true);
  }
  async function generate() {
    if (!template) return;
    const form = new FormData();
    form.set("action", "template");
    form.set("id", template.id);
    form.set("issuerId", issuerId);
    form.set("product", product);
    form.set("hiddenTerms", hiddenTerms);
    form.set("maskMoney", String(maskMoney));
    setBusy(true);
    const r = await fetch("/api/system/contracts", {
      method: "POST",
      body: form,
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json();
      return setMessage(j.error);
    }
    const blob = await r.blob(),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${template.contract_type}_ひな形_DRAFT.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(
      r.headers.get("x-contract-scanned") === "true"
        ? "画像PDFのため自動マスクはできませんでした。透かしと発行元を追加しました。"
        : "ひな形を生成し、Drive保存とダウンロードを行いました。",
    );
    setTemplate(null);
    await load();
  }
  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: 24,
        color: "#243329",
      }}
    >
      <h1>契約書の登録＆パートナー配布用ひな形の生成</h1>
      <p>
        上位店との契約書を登録し、パートナーへ配布するドラフトを作成します。
      </p>
      {message ? (
        <p role="status" style={{ padding: 10, background: "#eef6ef" }}>
          {message}
        </p>
      ) : null}
      <section style={card}>
        <h2>1. 上位店契約の登録</h2>
        <label>
          PDFを選ぶ
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => void choose(e.target.files?.[0] ?? null)}
          />
        </label>
        {busy && !draft ? <p>読み取り中…</p> : null}
        {draft ? (
          <form onSubmit={register}>
            <h3>読み取り結果を確認してください</h3>
            {draft.scanned ? (
              <p role="alert">
                このPDFは画像のため読み取れませんでした。各項目を入力してください。
              </p>
            ) : null}
            {draft.ownPartyWarning ? (
              <p role="alert" style={{ color: "#a33" }}>
                自社が甲になっています。甲乙を確認してください。
              </p>
            ) : null}
            <p>
              甲: {draft.partyA || "読み取れませんでした。入力してください"}
              <br />
              乙: {draft.partyB || "読み取れませんでした。入力してください"}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2,minmax(220px,1fr))",
                gap: 12,
              }}
            >
              <label>
                相手先
                <input
                  required
                  style={input}
                  value={draft.counterparty}
                  onChange={(e) =>
                    setDraft({ ...draft, counterparty: e.target.value })
                  }
                />
              </label>
              <label>
                自社法人
                <select
                  required
                  style={input}
                  value={draft.companyId}
                  onChange={(e) =>
                    setDraft({ ...draft, companyId: e.target.value })
                  }
                >
                  <option value="">選択してください</option>
                  {companies.map((c) => (
                    <option key={c.company_id} value={c.company_id}>
                      {c.company_name}
                    </option>
                  ))}
                  <option value="ALL">複数法人（ALL）</option>
                </select>
              </label>
              <label>
                契約種別
                <input
                  required
                  style={input}
                  value={draft.contractType}
                  onChange={(e) =>
                    setDraft({ ...draft, contractType: e.target.value })
                  }
                />
              </label>
              <label>
                締結日
                <input
                  required
                  type="date"
                  style={input}
                  value={draft.concludedOn}
                  onChange={(e) =>
                    setDraft({ ...draft, concludedOn: e.target.value })
                  }
                />
              </label>
              <label style={{ gridColumn: "1/-1" }}>
                メモ
                <textarea
                  style={input}
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                />
              </label>
            </div>
            <button
              disabled={busy}
              style={{ marginTop: 14, padding: "10px 18px" }}
            >
              これで登録する
            </button>
          </form>
        ) : null}
      </section>
      <section style={card}>
        <h2>2. 登録済み契約</h2>
        {rows.map((row) => (
          <div
            key={row.id}
            style={{ borderTop: "1px solid #ddd", padding: "12px 0" }}
          >
            <strong>{row.counterparty}</strong> ／{" "}
            {row.root_companies?.company_name ?? row.company_id} ／{" "}
            {row.contract_type} ／ {row.concluded_on}　
            {row.drive_url ? (
              <a href={row.drive_url} target="_blank" rel="noreferrer">
                元PDF
              </a>
            ) : (
              "Drive未保存"
            )}
            　
            {row.template_url ? (
              <a href={row.template_url} target="_blank" rel="noreferrer">
                ひな形
              </a>
            ) : (
              <button
                onClick={() => openTemplate(row)}
                disabled={!row.drive_file_id}
              >
                ひな形を作る
              </button>
            )}
          </div>
        ))}
      </section>
      {template ? (
        <section role="dialog" aria-modal="true" style={card}>
          <h2>パートナー配布用ひな形</h2>
          <label>
            隠す語句（1行に1つ）
            <textarea
              style={{ ...input, minHeight: 100 }}
              value={hiddenTerms}
              onChange={(e) => setHiddenTerms(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={maskMoney}
              onChange={(e) => setMaskMoney(e.target.checked)}
            />{" "}
            金額を隠す
          </label>
          <label>
            発行元（ひな形の甲）
            <select
              style={input}
              value={issuerId}
              onChange={(e) => setIssuerId(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.company_id} value={c.company_id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            商材
            <input
              style={input}
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            />
          </label>
          <p>DRAFT透かしは全ページへ自動で入ります。</p>
          <button
            onClick={() => void generate()}
            disabled={busy || !issuerId || !product}
          >
            生成してダウンロード
          </button>{" "}
          <button onClick={() => setTemplate(null)}>閉じる</button>
        </section>
      ) : null}
    </main>
  );
}
