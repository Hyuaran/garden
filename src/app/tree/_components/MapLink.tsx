/**
 * Garden-Tree Google Maps リンク
 *
 * 住所テキストをタップすると Google Maps 検索を新しいタブで開く。
 * プロトタイプの MapLink をそのまま TypeScript 化。
 */

import type { CSSProperties } from "react";

import { C } from "../_constants/colors";

type MapLinkProps = {
  address: string;
  style?: CSSProperties;
};

export function MapLink({ address, style = {} }: MapLinkProps) {
  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: "inherit",
        textDecoration: "underline",
        textDecorationColor: C.midGreen,
        textUnderlineOffset: 3,
        cursor: "pointer",
        ...style,
      }}
    >
      📍 {address}
    </a>
  );
}
