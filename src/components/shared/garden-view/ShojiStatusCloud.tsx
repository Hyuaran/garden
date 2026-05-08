"use client";

/**
 * 盆栽ビュー — ShojiStatusWidget の雲型ラッパー
 *
 * 右上の空に浮かぶ雲のような floating card で東海林さんの現在状態を表示。
 * 既存 ShojiStatusWidget (compact mode) を雲形 wrapper でくるんで世界観統合。
 *
 * 雲形 = border-radius を非対称な楕円で柔らかく、box-shadow は薄水色で「空の影」感。
 */

import { ShojiStatusWidget } from "../ShojiStatusWidget";

export function ShojiStatusCloud() {
  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        right: 24,
        zIndex: 10,
        background: "rgba(255, 255, 255, 0.92)",
        // 非対称な楕円で雲っぽい柔らかさ
        borderRadius: "32px 28px 32px 24px / 28px 32px 24px 32px",
        padding: "10px 14px",
        boxShadow:
          "0 8px 24px rgba(135, 206, 235, 0.28), 0 2px 8px rgba(0, 0, 0, 0.06)",
        backdropFilter: "blur(8px)",
        maxWidth: 380,
      }}
    >
      <ShojiStatusWidget mode="compact" />
    </div>
  );
}
