/**
 * Garden-Tree ガラスパネル（背景ぼかしカード）
 *
 * プロトタイプの <GlassPanel /> をそのまま移植。
 * 各画面で本文ブロックの背景として使用する半透明カード。
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  style?: CSSProperties;
};

export function GlassPanel({
  children,
  style = {},
  ...rest
}: GlassPanelProps) {
  return (
    <div
      {...rest}
      style={{
        background: "rgba(255,255,255,0.75)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.8)",
        borderRadius: 20,
        padding: 24,
        boxShadow: "0 8px 32px rgba(27,67,50,0.06)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
