/**
 * Garden-Tree ワイヤーフレームラベル
 *
 * プロトタイプの <WireframeLabel /> をそのまま移植。
 * 「画面1: ログイン」のような、カードの左上に貼る小さなタブラベル。
 *
 * 実装本番ではおそらく消すが、移植中は画面ごとの識別として便利なので残す。
 */

import type { ReactNode } from "react";
import { C } from "../_constants/colors";

type WireframeLabelProps = {
  children: ReactNode;
  color?: string;
};

export function WireframeLabel({
  children,
  color = C.midGreen,
}: WireframeLabelProps) {
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
