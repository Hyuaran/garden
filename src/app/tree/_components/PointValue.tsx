/**
 * Garden-Tree ポイント表示（数字大きめ + "P" 小さめ）
 *
 * プロトタイプの PJ(n, sz) JSX ヘルパーを React コンポーネント化。
 * 小数1桁で数字を表示し、末尾に約 60% サイズで "P" を添える。
 *
 * 色は親の `color` を継承するため、通常は color prop を渡さなくてよい。
 */

import type { CSSProperties } from "react";

type PointValueProps = {
  /** 表示するポイント値（小数1桁に丸めて表示） */
  n: number;
  /** 数字側のフォントサイズ (px)。"P" は 60% サイズになる */
  size?: number;
  /** 数字を bold にするか（既定 true） */
  bold?: boolean;
  /** 追加スタイル（span 全体に適用） */
  style?: CSSProperties;
  /** 明示的に色を上書きしたい場合のみ指定。未指定なら親の color を継承 */
  color?: string;
};

export function PointValue({
  n,
  size = 18,
  bold = true,
  style,
  color,
}: PointValueProps) {
  return (
    <span style={{ color, ...style }}>
      <span style={{ fontSize: size, fontWeight: bold ? 700 : 600 }}>
        {Number(n).toFixed(1)}
      </span>
      <span
        style={{
          fontSize: Math.round(size * 0.6),
          fontWeight: 600,
          marginLeft: 1,
        }}
      >
        P
      </span>
    </span>
  );
}
