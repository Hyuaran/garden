"use client";

/**
 * Garden-Forest TaxDetailModal: 納税スケジュール詳細表示。
 *
 * spec: docs/specs/2026-04-24-forest-t-f11-01-tax-detail-modal.md
 *
 * - 1 件の forest_nouzei_schedules + items + files を表示
 * - 法人色ドット + 法人短縮名 + 種別ラベル + 済みバッジ
 * - YYYY年M月末 期限 サブ行
 * - 税目内訳テーブル（2 行以上で合計行追加）
 * - 添付ファイル一覧（signedURL）
 * - Esc / 背景クリック / 閉じるボタンで閉じる
 *
 * Forest 規約に従い Tailwind ではなくインラインスタイル。
 */

import { useEffect, useState } from "react";

import type { Company } from "../_constants/companies";
import { C } from "../_constants/colors";
import { FOREST_THEME } from "../_constants/theme";
import {
  createNouzeiFileSignedUrl,
  fetchNouzeiDetail,
} from "../_lib/queries";
import type { NouzeiScheduleDetail } from "../_lib/types";

type Props = {
  scheduleId: string;
  /** 法人色ドット + 短縮名のため */
  company: Company;
  onClose: () => void;
};

export function TaxDetailModal({ scheduleId, company, onClose }: Props) {
  const [detail, setDetail] = useState<NouzeiScheduleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchNouzeiDetail(scheduleId)
      .then(async (result) => {
        if (cancelled) return;
        setDetail(result);
        if (result?.files.length) {
          const urls: Record<string, string> = {};
          for (const f of result.files) {
            try {
              urls[f.id] = await createNouzeiFileSignedUrl(f.storage_path, 3600);
            } catch (e) {
              console.error("[TaxDetailModal] signedUrl error:", e);
            }
          }
          if (!cancelled) setSignedUrls(urls);
        }
      })
      .catch((err) => {
        console.error("[TaxDetailModal] fetchNouzeiDetail error:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scheduleId]);

  // Esc で閉じる
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // ローディング / エラー / 該当なし
  if (loading || error || !detail) {
    return (
      <div onClick={onClose} style={overlayStyle}>
        <div onClick={(e) => e.stopPropagation()} style={smallBoxStyle}>
          {error
            ? `エラー: ${error}`
            : loading
              ? "読み込み中…"
              : "データがありません"}
        </div>
      </div>
    );
  }

  const isPaid = detail.status === "paid";
  const showTotal = detail.items.length >= 2;

  return (
    <div
      onClick={onClose}
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`tax-title-${detail.id}`}
    >
      <div onClick={(e) => e.stopPropagation()} style={boxStyle}>
        {/* タイトル行 */}
        <div id={`tax-title-${detail.id}`} style={titleStyle}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: company.color,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span>
            {company.short}　{detail.label}
          </span>
          {isPaid && (
            <span
              style={{
                color: "#d63031",
                marginLeft: 6,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              済み
            </span>
          )}
        </div>

        {/* サブ行: 期限 */}
        <div style={subStyle}>
          {`${detail.year}年${detail.month}月末 期限`}
        </div>

        {/* 税目内訳 */}
        <div style={gridStyle}>
          {detail.items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "contents",
              }}
            >
              <div style={labelStyle}>{item.label}</div>
              <div style={valStyle}>{`${item.amount.toLocaleString()}円`}</div>
            </div>
          ))}
          {showTotal && (
            <>
              <div
                style={{
                  gridColumn: "1 / -1",
                  borderTop: "1px solid #e0e0e0",
                  margin: "2px 0",
                }}
              />
              <div style={totalLabelStyle}>合計</div>
              <div style={totalValStyle}>
                {`${(detail.total_amount ?? 0).toLocaleString()}円`}
              </div>
            </>
          )}
          {detail.items.length === 0 && (
            <div
              style={{
                gridColumn: "1 / -1",
                fontSize: 12,
                color: FOREST_THEME.textMuted,
                padding: "12px 0",
              }}
            >
              金額未確定
            </div>
          )}
        </div>

        {/* 添付ファイル */}
        {detail.files.length > 0 && (
          <div
            style={{
              marginTop: 16,
              paddingTop: 12,
              borderTop: "1px solid #e0e0e0",
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: FOREST_THEME.textMuted,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              添付
            </div>
            {detail.files.map((f) => (
              <a
                key={f.id}
                href={signedUrls[f.id] ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  fontSize: 13,
                  color: C.darkGreen,
                  textDecoration: "underline",
                  padding: "4px 0",
                }}
              >
                {f.doc_name}
              </a>
            ))}
          </div>
        )}

        {/* notes */}
        {detail.notes && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: FOREST_THEME.textMuted,
            }}
          >
            {detail.notes}
          </div>
        )}

        {/* 閉じる */}
        <button onClick={onClose} type="button" style={closeBtnStyle}>
          閉じる
        </button>
      </div>
    </div>
  );
}

/* ---- スタイル定数 ---- */
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const boxStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 32,
  width: "90%",
  maxWidth: 340,
  boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
};

const smallBoxStyle: React.CSSProperties = {
  ...boxStyle,
  fontSize: 13,
  color: C.textSub,
};

const titleStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 16,
  color: C.darkGreen,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const subStyle: React.CSSProperties = {
  fontSize: 12,
  color: C.textMuted,
  margin: "4px 0 14px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "8px 20px",
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: C.textDark,
};

const valStyle: React.CSSProperties = {
  fontSize: 13,
  color: C.darkGreen,
  textAlign: "right",
  fontWeight: 500,
};

const totalLabelStyle: React.CSSProperties = {
  ...labelStyle,
  fontWeight: 700,
  fontSize: 14,
};

const totalValStyle: React.CSSProperties = {
  ...valStyle,
  fontWeight: 700,
  fontSize: 14,
};

const closeBtnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 16,
  padding: 10,
  border: "1px solid #e0e0e0",
  borderRadius: 8,
  background: "transparent",
  fontSize: 13,
  color: C.textSub,
  cursor: "pointer",
  fontFamily: "inherit",
};
