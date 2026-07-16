"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { supabase } from "../../_lib/supabase";

type TransferDetailRecord = Record<string, unknown> & {
  transfer_id: string;
  payee_name?: string | null;
  amount?: number | null;
  status?: string | null;
};

const serifFont = "'Shippori Mincho', 'Noto Serif JP', serif";

export function TransferDetailContent({ transferId }: { transferId: string }) {
  const [result, setResult] = useState<{
    transferId: string;
    row: TransferDetailRecord | null;
    error: string | null;
  }>({ transferId: "", row: null, error: null });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const query = await supabase
        .from("bud_transfers")
        .select("*")
        .eq("transfer_id", transferId)
        .maybeSingle();
      if (cancelled) return;
      setResult({
        transferId,
        row: query.error
          ? null
          : ((query.data as TransferDetailRecord | null) ?? null),
        error: query.error?.message ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [transferId]);

  const loading = result.transferId !== transferId;
  const { row, error } = result;
  if (loading) return <div style={noticeStyle}>詳細を読み込んでいます…</div>;
  if (error) return <div style={errorStyle}>{error}</div>;
  if (!row) return <div style={noticeStyle}>振込データが見つかりません。</div>;

  return (
    <div
      style={{ fontFamily: serifFont }}
      data-transfer-detail-content={transferId}
    >
      <div style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>TRANSFER RECORD</div>
          <h3 style={titleStyle}>{text(row.payee_name)}</h3>
          <div style={idStyle}>{row.transfer_id}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={statusStyle}>{text(row.status)}</span>
          <div style={amountStyle}>{yen(row.amount)}</div>
        </div>
      </div>

      <DetailSection title="振込情報">
        <DetailGrid>
          <Detail label="予定日" value={row.scheduled_date} />
          <Detail label="支払期日" value={row.due_date} />
          <Detail label="依頼日" value={row.request_date} />
          <Detail label="実行日" value={row.executed_date} />
          <Detail label="支払区分" value={row.payment_category} />
          <Detail
            label="振込種別"
            value={row.transfer_type ?? row.transfer_category}
          />
          <Detail
            label="依頼法人"
            value={row.request_company_id ?? row.company_id}
          />
          <Detail
            label="実行法人"
            value={row.execute_company_id ?? row.company_id}
          />
          <Detail label="出金元口座ID" value={row.source_account_id} />
          <Detail label="取引先ID" value={row.vendor_id} />
          <Detail label="摘要" value={row.description} wide />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="振込先口座">
        <DetailGrid>
          <Detail
            label="銀行"
            value={join(row.payee_bank_name, row.payee_bank_code)}
          />
          <Detail
            label="支店"
            value={join(row.payee_branch_name, row.payee_branch_code)}
          />
          <Detail label="口座区分" value={row.payee_account_type} />
          <Detail label="口座番号" value={row.payee_account_number} />
          <Detail
            label="口座名義カナ"
            value={row.payee_account_holder_kana}
            wide
          />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="承認・登録情報">
        <DetailGrid>
          <Detail label="状態" value={row.status} />
          <Detail label="承認者" value={row.approved_by} />
          <Detail label="承認日時" value={formatDateTime(row.approved_at)} />
          <Detail label="差戻し者" value={row.returned_by} />
          <Detail label="差戻し日時" value={formatDateTime(row.returned_at)} />
          <Detail label="差戻し理由" value={row.rejection_reason} wide />
          <Detail label="登録日時" value={formatDateTime(row.created_at)} />
          <Detail label="更新日時" value={formatDateTime(row.updated_at)} />
          <Detail
            label="登録方法"
            value={row.registered_method ?? row.data_source}
          />
          <Detail label="バッチコード" value={row.batch_code} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="添付・関連資料">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <AttachmentLink label="請求書PDFを開く" href={row.invoice_pdf_url} />
          <AttachmentLink
            label="スキャン画像を開く"
            href={row.scan_image_url}
          />
          {!row.invoice_pdf_url && !row.scan_image_url && (
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
              添付資料はありません。
            </span>
          )}
        </div>
      </DetailSection>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={sectionStyle}>
      <h4 style={sectionTitleStyle}>{title}</h4>
      {children}
    </section>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <dl style={gridStyle}>{children}</dl>;
}

function Detail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: unknown;
  wide?: boolean;
}) {
  return (
    <div style={{ ...detailStyle, gridColumn: wide ? "1 / -1" : undefined }}>
      <dt style={labelStyle}>{label}</dt>
      <dd style={valueStyle}>{text(value)}</dd>
    </div>
  );
}

function AttachmentLink({ label, href }: { label: string; href: unknown }) {
  if (typeof href !== "string" || !href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" style={linkStyle}>
      📎 {label}
    </a>
  );
}

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function join(name: unknown, code: unknown) {
  const parts = [name, code].filter(
    (value) => value !== null && value !== undefined && value !== "",
  );
  return parts.length > 0 ? parts.join(" / ") : "—";
}

function yen(value: unknown) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return `¥${Number.isFinite(number) ? number.toLocaleString("ja-JP") : "0"}`;
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ja-JP");
}

const noticeStyle: CSSProperties = {
  padding: 24,
  textAlign: "center",
  color: "var(--text-sub)",
  fontFamily: serifFont,
};
const errorStyle: CSSProperties = {
  ...noticeStyle,
  border: "1px solid rgba(143,59,54,0.25)",
  borderRadius: 8,
  background: "rgba(143,59,54,0.07)",
  color: "#8f3b36",
};
const heroStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "flex-start",
  padding: "4px 2px 18px",
  borderBottom: "1px solid rgba(180,165,130,0.24)",
};
const eyebrowStyle: CSSProperties = {
  color: "#a27a2f",
  fontFamily: "'EB Garamond', serif",
  fontSize: 11,
  letterSpacing: "0.16em",
};
const titleStyle: CSSProperties = {
  margin: "5px 0 2px",
  color: "var(--text-main)",
  fontSize: 21,
  fontWeight: 600,
  letterSpacing: "0.04em",
};
const idStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontFamily: "'EB Garamond', monospace",
  fontSize: 12,
};
const statusStyle: CSSProperties = {
  display: "inline-flex",
  padding: "4px 12px",
  borderRadius: 999,
  border: "1px solid rgba(179,137,46,0.24)",
  background: "rgba(212,165,65,0.12)",
  color: "#8d6a24",
  fontSize: 12,
};
const amountStyle: CSSProperties = {
  marginTop: 8,
  color: "var(--text-main)",
  fontFamily: "'EB Garamond', serif",
  fontSize: 24,
  fontWeight: 600,
};
const sectionStyle: CSSProperties = {
  marginTop: 18,
  padding: "15px 17px",
  border: "1px solid rgba(180,165,130,0.22)",
  borderRadius: 9,
  background: "rgba(255,253,246,0.58)",
};
const sectionTitleStyle: CSSProperties = {
  margin: "0 0 12px",
  paddingBottom: 7,
  borderBottom: "1px dashed rgba(179,137,46,0.3)",
  color: "var(--text-main)",
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: "0.06em",
};
const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px 18px",
  margin: 0,
};
const detailStyle: CSSProperties = { minWidth: 0 };
const labelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: 11,
  letterSpacing: "0.04em",
};
const valueStyle: CSSProperties = {
  margin: "3px 0 0",
  color: "var(--text-main)",
  fontSize: 13,
  overflowWrap: "anywhere",
};
const linkStyle: CSSProperties = {
  display: "inline-flex",
  padding: "7px 12px",
  border: "1px solid rgba(179,137,46,0.28)",
  borderRadius: 999,
  color: "#8d6a24",
  background: "rgba(255,253,246,0.8)",
  fontSize: 12,
  textDecoration: "none",
};
