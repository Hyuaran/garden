"use client";

/**
 * Garden-Forest 詳細モーダル
 *
 * セルクリックで表示する決算情報のポップアップ。
 *   - 主要 6 項目（売上高/外注費/経常利益/純資産/現金/預金）
 *   - T-F10-03: 販管費内訳 8 項目（forest_hankanhi）を最低 1 つ non-null のときのみ表示
 *   - T-F10-04: 進行期のときは reflected note を「進行期」バッジ横に表示
 *   - Google Drive の決算書リンク
 */

import { useEffect, useState } from "react";

import type { CellData } from "../_constants/companies";
import { FOREST_THEME } from "../_constants/theme";
import { C } from "../_constants/colors";
import { fmtYen } from "../_lib/format";
import { writeAuditLog } from "../_lib/audit";
import { fetchHankanhi } from "../_lib/queries";
import { HANKANHI_LABELS, type Hankanhi } from "../_lib/types";

type Props = {
  data: CellData;
  onClose: () => void;
};

export function DetailModal({ data, onClose }: Props) {
  const rows: { label: string; value: string }[] = [
    { label: "売上高", value: fmtYen(data.uriage) },
    { label: "外注費", value: fmtYen(data.gaichuhi) },
    { label: "経常利益", value: fmtYen(data.rieki) },
    { label: "純資産", value: fmtYen(data.junshisan) },
    { label: "現金", value: fmtYen(data.genkin) },
    { label: "預金", value: fmtYen(data.yokin) },
  ];

  const [hankanhi, setHankanhi] = useState<Hankanhi | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHankanhi(data.company.id, data.ki)
      .then((result) => {
        if (!cancelled) setHankanhi(result);
      })
      .catch((err) => {
        console.error("[DetailModal] fetchHankanhi error:", err);
        if (!cancelled) setHankanhi(null);
      });
    return () => {
      cancelled = true;
    };
  }, [data.company.id, data.ki]);

  // 8 科目のうち少なくとも 1 つが non-null のときだけセクションを描画
  const hasAnyHankanhi =
    hankanhi != null &&
    HANKANHI_LABELS.some(({ key }) => hankanhi[key] != null);

  const handleDriveClick = () => {
    writeAuditLog("click_drive_link", `${data.company.id}_ki${data.ki}`);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 32,
          minWidth: 340,
          maxWidth: 420,
          boxShadow: "0 12px 48px rgba(0,0,0,0.2)",
        }}
      >
        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: data.company.color,
              display: "inline-block",
            }}
          />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.darkGreen }}>
              {data.company.short}
            </div>
            <div style={{ fontSize: 12, color: FOREST_THEME.textMuted }}>
              {`第${data.ki}期（${data.period_from}〜${data.period_to}）`}
              {data.isShinkouki && (
                <span
                  style={{
                    marginLeft: 8,
                    padding: "1px 8px",
                    background: FOREST_THEME.shinkouBadge,
                    color: "#fff",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  進行期
                </span>
              )}
              {data.isShinkouki && data.reflected && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    color: FOREST_THEME.negative,
                  }}
                >
                  {`※${data.reflected}`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 主要 6 項目 */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td
                  style={{
                    padding: "8px 0",
                    fontSize: 13,
                    color: FOREST_THEME.textSecondary,
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  {r.label}
                </td>
                <td
                  style={{
                    padding: "8px 0",
                    fontSize: 14,
                    fontWeight: 600,
                    textAlign: "right",
                    borderBottom: "1px solid #f0f0f0",
                    color:
                      r.label === "経常利益" && data.rieki != null && data.rieki < 0
                        ? FOREST_THEME.negative
                        : FOREST_THEME.textPrimary,
                  }}
                >
                  {r.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* T-F10-03: 販管費内訳（≥1 件 non-null の場合のみ） */}
        {hasAnyHankanhi && hankanhi && (
          <>
            <div
              style={{
                borderTop: "1px solid #e0e0e0",
                margin: "12px 0",
              }}
            />
            <div
              style={{
                fontSize: 12,
                color: FOREST_THEME.textMuted,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              販管費内訳
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {HANKANHI_LABELS.map(({ key, label }) => (
                  <tr key={key}>
                    <td
                      style={{
                        padding: "6px 0",
                        fontSize: 13,
                        color: FOREST_THEME.textSecondary,
                        borderBottom: "1px solid #f5f5f5",
                      }}
                    >
                      {label}
                    </td>
                    <td
                      style={{
                        padding: "6px 0",
                        fontSize: 13,
                        textAlign: "right",
                        fontWeight: 500,
                        color: FOREST_THEME.textPrimary,
                        borderBottom: "1px solid #f5f5f5",
                      }}
                    >
                      {fmtYen(hankanhi[key])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Drive リンク */}
        {data.doc_url && (
          <a
            href={data.doc_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleDriveClick}
            style={{
              display: "block",
              marginTop: 20,
              padding: "10px 16px",
              background: `linear-gradient(135deg, ${C.darkGreen}, ${C.midGreen})`,
              color: "#fff",
              borderRadius: 8,
              textAlign: "center",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            決算書を開く（Google Drive）
          </a>
        )}

        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          style={{
            display: "block",
            width: "100%",
            marginTop: 12,
            padding: 10,
            border: `1px solid #e0e0e0`,
            borderRadius: 8,
            background: "transparent",
            fontSize: 13,
            color: FOREST_THEME.textSecondary,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
