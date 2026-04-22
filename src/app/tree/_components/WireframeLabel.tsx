/**
 * Garden-Tree ワイヤーフレームラベル
 *
 * 「画面1: ログイン」のような、カードの左上に貼る小さなタブラベル。
 * 開発中の画面特定用で、本番ビルド（production）では自動的に非表示になる。
 *
 * 表示/非表示は _constants/flags.ts の SHOW_WIREFRAME_LABELS で制御する。
 */

import type { ReactNode } from "react";
import { C } from "../_constants/colors";
import { SHOW_WIREFRAME_LABELS } from "../_constants/flags";

type WireframeLabelProps = {
  children: ReactNode;
  color?: string;
};

export function WireframeLabel({
  children,
  color = C.midGreen,
}: WireframeLabelProps) {
  if (!SHOW_WIREFRAME_LABELS) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: -10,
        left: 12,
        background: color,
        color: C.white,
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 10px",
        borderRadius: 10,
        zIndex: 10,
      }}
    >
      {children}
    </div>
  );
}
