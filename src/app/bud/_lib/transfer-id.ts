/**
 * Garden-Bud / 振込 ID 生成・パース
 *
 * Kintone 既存運用を継承する ID 形式:
 *   - 通常振込（regular）: FK-YYYYMMDD-NNNNNN（連番 6 桁）
 *   - キャッシュバック（cashback）: CB-YYYYMMDD-G-NNN（連番 3 桁）
 *
 * 連番は DB 側で「その日その種別の最大連番+1」で採番する想定
 * （別ファイルの transfer-mutations.ts で実装）。本ファイルは
 * 純関数的な組立・分解のみ提供。
 */

import type { TransferCategory } from "../_constants/types";

function formatDate(date: Date): string {
  const y = date.getFullYear().toString();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function padSequence(seq: number, width: number): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`連番は 1 以上の整数である必要があります: ${seq}`);
  }
  const s = seq.toString();
  if (s.length > width) {
    throw new Error(`連番が ${width} 桁を超えています: ${seq}`);
  }
  return s.padStart(width, "0");
}

/** 通常振込 ID を組立: FK-YYYYMMDD-NNNNNN */
export function buildRegularTransferId(date: Date, sequence: number): string {
  return `FK-${formatDate(date)}-${padSequence(sequence, 6)}`;
}

/** キャッシュバック振込 ID を組立: CB-YYYYMMDD-G-NNN */
export function buildCashbackTransferId(date: Date, sequence: number): string {
  return `CB-${formatDate(date)}-G-${padSequence(sequence, 3)}`;
}

export interface ParsedTransferId {
  category: TransferCategory;
  datePart: string; // YYYYMMDD
  sequence: number;
}

/** 振込 ID を分解（不正な形式なら null） */
export function parseTransferId(id: string): ParsedTransferId | null {
  const regularMatch = /^FK-(\d{8})-(\d{6})$/.exec(id);
  if (regularMatch) {
    return {
      category: "regular",
      datePart: regularMatch[1],
      sequence: parseInt(regularMatch[2], 10),
    };
  }

  const cashbackMatch = /^CB-(\d{8})-G-(\d{3})$/.exec(id);
  if (cashbackMatch) {
    return {
      category: "cashback",
      datePart: cashbackMatch[1],
      sequence: parseInt(cashbackMatch[2], 10),
    };
  }

  return null;
}
