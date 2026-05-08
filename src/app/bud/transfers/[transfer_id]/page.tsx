"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BudGate } from "../../_components/BudGate";
import { BudShell } from "../../_components/BudShell";
import { fetchTransferById } from "../../_lib/transfer-queries";
import type { BudTransfer } from "../../_constants/types";
import { StatusBadge } from "../_components/StatusBadge";
import { StatusActionButtons } from "../_components/StatusActionButtons";
import { StatusHistoryTab } from "../_components/StatusHistoryTab";

type Tab = "basic" | "history" | "related";

function TransferDetailContent() {
  const params = useParams();
  const router = useRouter();
  const transferId = Array.isArray(params?.transfer_id)
    ? params.transfer_id[0]
    : (params?.transfer_id as string | undefined) ?? "";

  const [transfer, setTransfer] = useState<BudTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("basic");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!transferId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await fetchTransferById(transferId);
        if (!cancelled) setTransfer(data);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transferId, reloadKey]);

  const handleTransitioned = useCallback(() => {
    setReloadKey((n) => n + 1);
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">読み込み中…</div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-800 rounded p-4"
        >
          {error}
        </div>
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="p-6">
        <p className="text-gray-700">
          振込が見つかりません（ID: {transferId}）
        </p>
        <Link href="/bud/transfers" className="text-emerald-600 hover:underline">
          ← 一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => router.push("/bud/transfers")}
          className="text-sm text-emerald-600 hover:underline"
        >
          ← 一覧に戻る
        </button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 font-mono">
            {transfer.transfer_id}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-gray-500">状態:</span>
            <StatusBadge status={transfer.status} size="md" />
            {transfer.status_changed_at && (
              <span className="text-xs text-gray-400">
                （
                {new Date(transfer.status_changed_at).toLocaleString("ja-JP")}
                更新）
              </span>
            )}
          </div>
        </div>
      </div>

      <section className="mb-4 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">アクション</h2>
        <StatusActionButtons
          transfer={transfer}
          createdBy={transfer.created_by ?? null}
          onTransitioned={handleTransitioned}
        />
      </section>

      <div className="mb-2 border-b border-gray-200">
        <nav className="flex gap-4" role="tablist">
          <TabButton active={tab === "basic"} onClick={() => setTab("basic")}>
            基本情報
          </TabButton>
          <TabButton active={tab === "history"} onClick={() => setTab("history")}>
            ステータス履歴
          </TabButton>
          <TabButton active={tab === "related"} onClick={() => setTab("related")}>
            関連振込
          </TabButton>
        </nav>
      </div>

      <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg p-4">
        {tab === "basic" && <BasicInfoTab transfer={transfer} />}
        {tab === "history" && (
          <StatusHistoryTab transferId={transfer.transfer_id} />
        )}
        {tab === "related" && (
          <div className="text-sm text-gray-500">
            関連振込タブは A-06 明細連携時に実装予定です。
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-3 py-2 text-sm border-b-2 ${
        active
          ? "border-emerald-600 text-emerald-700 font-medium"
          : "border-transparent text-gray-600 hover:text-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

function BasicInfoTab({ transfer }: { transfer: BudTransfer }) {
  return (
    <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <Row label="振込種別">{transfer.transfer_category ?? "—"}</Row>
      <Row label="データソース">{transfer.data_source ?? "—"}</Row>
      <Row label="依頼会社">{transfer.request_company_id ?? "—"}</Row>
      <Row label="実行会社">{transfer.execute_company_id ?? transfer.company_id ?? "—"}</Row>
      <Row label="支払元口座 ID">{transfer.source_account_id ?? "—"}</Row>
      <Row label="取引先 ID">{transfer.vendor_id ?? "—"}</Row>
      <Row label="お支払い先">{transfer.payee_name}</Row>
      <Row label="銀行">
        {transfer.payee_bank_name ?? "—"}（{transfer.payee_bank_code ?? "—"}）
      </Row>
      <Row label="支店">
        {transfer.payee_branch_name ?? "—"}（{transfer.payee_branch_code ?? "—"}）
      </Row>
      <Row label="口座">
        {transfer.payee_account_type} / {transfer.payee_account_number}
      </Row>
      <Row label="名義カナ">{transfer.payee_account_holder_kana ?? "—"}</Row>
      <Row label="金額">¥{transfer.amount.toLocaleString()}</Row>
      <Row label="手数料負担">{transfer.fee_bearer ?? "—"}</Row>
      <Row label="依頼日">{transfer.request_date ?? "—"}</Row>
      <Row label="支払期日">{transfer.due_date ?? "—"}</Row>
      <Row label="振込予定日">{transfer.scheduled_date ?? "—"}</Row>
      <Row label="振込実行日">{transfer.executed_date ?? "—"}</Row>
      <Row label="備考" wide>
        {transfer.description ?? "—"}
      </Row>
      {transfer.invoice_pdf_url && (
        <Row label="請求書 PDF" wide>
          <a
            href={transfer.invoice_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 hover:underline"
          >
            📎 開く
          </a>
        </Row>
      )}
      {transfer.scan_image_url && (
        <Row label="スキャン画像" wide>
          <a
            href={transfer.scan_image_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 hover:underline"
          >
            📎 開く
          </a>
        </Row>
      )}
    </dl>
  );
}

function Row({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "md:col-span-2" : undefined}>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-gray-900 mt-0.5">{children}</dd>
    </div>
  );
}

export default function TransferDetailPage() {
  return (
    <BudGate>
      <BudShell>
        <TransferDetailContent />
      </BudShell>
    </BudGate>
  );
}
