/**
 * Garden-Bud / Phase D #07 会計連携レポート CSV 生成（純関数）
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-07-bank-transfer.md §3.4 + 4 次 follow-up 8 区分階層
 *
 * Cat 4 #27 反映: 振込ファイル生成と同時に出力（exportPayrollBatchHybrid）。
 *
 * 出力形式:
 *   - 8 大区分階層構造（役員報酬 / 給与 / 賞与 / 交通費 / 会社負担社保等 / 外注費 / 販売促進費 / 固定費等）
 *   - 各大区分に items[]（小区分明細）+ subtotal（小計）
 *   - 総合計行は「役員給与系を除く」（後道さんへの実務報告慣行）
 *   - エンコーディング: UTF-8 BOM 付き（マネーフォワードクラウド会計の標準受入形式）
 *   - 改行: CRLF（Windows、MFC 互換）
 */

import {
  type CategoryHierarchy,
  type AccountingCategory,
  ACCOUNTING_CATEGORIES_ORDER,
} from "./transfer-types";

// ============================================================
// CSV エスケープ
// ============================================================

/**
 * CSV 1 セルのエスケープ（カンマ・改行・ダブルクオート対応）。
 */
export function escapeCsvCell(value: string | number): string {
  const s = String(value);
  if (s.includes(",") || s.includes("\n") || s.includes("\r") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ============================================================
// 階層構造から CSV 行生成
// ============================================================

/**
 * 階層構造から CSV 行群を生成（ヘッダ行は別途、本関数は明細 + 小計のみ）。
 *
 * 出力例:
 *   役員報酬,役員報酬(後道翔太),500000
 *   役員報酬,役員報酬(後道愛美),128000
 *   役員報酬,小計,628000
 *   給与,基本給,5047577
 *   給与,小計,5047577
 *   賞与,(将来発生時),0
 *   賞与,小計,0
 *   ...
 *   総合計,(役員給与系を除く),N
 */
export function buildAccountingCsvLines(hierarchy: CategoryHierarchy): string[] {
  const lines: string[] = [];

  for (const category of ACCOUNTING_CATEGORIES_ORDER) {
    const entry = hierarchy[category];
    if (!entry) continue; // 8 区分のいずれか欠ける = 不正、本関数では空 entry をスキップ

    if (entry.isFutureUse || entry.items.length === 0) {
      // 将来枠 or 当月該当なし → "(将来発生時)" 行のみ
      lines.push(
        `${escapeCsvCell(category)},${escapeCsvCell("(将来発生時)")},${escapeCsvCell(0)}`,
      );
    } else {
      // 小区分明細
      for (const item of entry.items) {
        lines.push(
          `${escapeCsvCell(category)},${escapeCsvCell(item.name)},${escapeCsvCell(item.amount)}`,
        );
      }
    }
    // 小計行（各大区分に必ず付く）
    lines.push(`${escapeCsvCell(category)},${escapeCsvCell("小計")},${escapeCsvCell(entry.subtotal)}`);
  }

  // 総合計（役員給与系を除く、後道さん運用慣行）
  const grandTotalExceptExecutive = ACCOUNTING_CATEGORIES_ORDER.filter(
    (c) => c !== "役員報酬",
  ).reduce((s, c) => s + (hierarchy[c]?.subtotal ?? 0), 0);
  lines.push(
    `${escapeCsvCell("総合計")},${escapeCsvCell("(役員給与系を除く)")},${escapeCsvCell(grandTotalExceptExecutive)}`,
  );

  return lines;
}

// ============================================================
// CSV 全体生成（ヘッダ + 行群）
// ============================================================

export interface AccountingCsvOutput {
  /** UTF-8 BOM 付きの CSV 文字列（呼び出し側で Buffer 化、Storage upload）*/
  content: string;
  /** 当月対象（YYYY-MM）の表示用、ヘッダにも反映 */
  yearMonth: string;
  /** 総合計（役員給与系除く）*/
  grandTotalExceptExecutive: number;
}

/**
 * 8 区分階層レポートの CSV 全体を生成。
 *
 * @param hierarchy 8 大区分の階層構造
 * @param yearMonth 'YYYY-MM' 形式（ヘッダ行に反映）
 */
export function buildAccountingCsv(
  hierarchy: CategoryHierarchy,
  yearMonth: string,
): AccountingCsvOutput {
  const headerLine = `大区分,小区分,${yearMonth}`;
  const dataLines = buildAccountingCsvLines(hierarchy);
  const allLines = [headerLine, ...dataLines];
  // CRLF 改行 + UTF-8 BOM
  const content = "﻿" + allLines.join("\r\n") + "\r\n";

  const grandTotalExceptExecutive = ACCOUNTING_CATEGORIES_ORDER.filter(
    (c) => c !== "役員報酬",
  ).reduce((s, c) => s + (hierarchy[c]?.subtotal ?? 0), 0);

  return {
    content,
    yearMonth,
    grandTotalExceptExecutive,
  };
}

// ============================================================
// 階層構造のヘルパー（空 hierarchy 構築）
// ============================================================

/**
 * 8 大区分すべてに空 entry を持つ初期 hierarchy を作成（is_future_use=true）。
 * 呼び出し側で各区分に items[] を追加する開始点。
 */
export function createEmptyHierarchy(): CategoryHierarchy {
  const empty: Partial<CategoryHierarchy> = {};
  for (const c of ACCOUNTING_CATEGORIES_ORDER) {
    empty[c] = { items: [], subtotal: 0, isFutureUse: true };
  }
  return empty as CategoryHierarchy;
}

/**
 * 区分に items を追加し、subtotal 自動計算 + isFutureUse=false に切り替え。
 */
export function addItemsToCategory(
  hierarchy: CategoryHierarchy,
  category: AccountingCategory,
  items: Array<{ name: string; amount: number }>,
): CategoryHierarchy {
  const existing = hierarchy[category] ?? { items: [], subtotal: 0, isFutureUse: true };
  const newItems = [...existing.items, ...items];
  const subtotal = newItems.reduce((s, i) => s + i.amount, 0);
  return {
    ...hierarchy,
    [category]: {
      items: newItems,
      subtotal,
      isFutureUse: newItems.length === 0,
    },
  };
}
