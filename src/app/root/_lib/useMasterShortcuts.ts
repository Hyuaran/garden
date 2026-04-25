/**
 * Garden Root — マスタ画面共通のキーボードショートカット
 *
 * Ctrl+F: 検索入力へフォーカス
 * Ctrl+↓: 次の行を選択（activeIndex インクリメント）
 * Ctrl+↑: 前の行を選択
 * Ctrl+Enter: 選択行を編集モーダルで開く
 *
 * モーダル表示中（modalOpen=true）は本フック全体が無効。Modal.tsx 側の Esc/Enter に委譲。
 */

import { RefObject, useCallback, useEffect, useState } from "react";

export type MasterShortcutsOptions<T> = {
  rows: T[];
  modalOpen: boolean;
  searchRef?: RefObject<HTMLInputElement | null>;
  onEditRow?: (row: T) => void;
};

export function useMasterShortcuts<T>({
  rows,
  modalOpen,
  searchRef,
  onEditRow,
}: MasterShortcutsOptions<T>) {
  const [rawActiveIndex, setActiveIndex] = useState<number>(-1);

  // 行数が減った場合に備えてクランプ（setState を effect で呼ばないための派生値）
  const activeIndex = rows.length === 0 ? -1 : Math.min(rawActiveIndex, rows.length - 1);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (modalOpen) return;
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;

      if (e.key === "f" || e.key === "F") {
        if (searchRef?.current) {
          e.preventDefault();
          searchRef.current.focus();
          searchRef.current.select();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, rows.length - 1));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, rows.length > 0 ? 0 : -1));
        return;
      }

      if (e.key === "Enter" && onEditRow && activeIndex >= 0 && activeIndex < rows.length) {
        e.preventDefault();
        onEditRow(rows[activeIndex]);
        return;
      }
    },
    [modalOpen, rows, searchRef, onEditRow, activeIndex],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);

  return { activeIndex, setActiveIndex };
}
