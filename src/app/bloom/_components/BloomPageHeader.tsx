"use client";

/**
 * BloomPageHeader — 試作版 1:1 移植版 ページヘッダー (dispatch main- No.16)
 *
 * プロト 015_Gardenシリーズ/000_GardenUI_bloom/02_BloomTop/index.html line 254-281 移植。
 *
 * 構造:
 *   - page-favorite-btn (右上 PNG icon ボタン、aria-pressed 切替)
 *   - page-title-block:
 *     - page-title-row > page-title (Bloom — 花咲く業務の庭) + 桜花 SVG
 *   - page-subtitle (グループの動きを、咲かせる。)
 *
 * D15 対応: 暫定 ☆/★ 絵文字 → 実 PNG icon (D-01_favorite_simple.png + D-01a_favorite_outline.png)
 */

import { useCallback, useState } from "react";

export default function BloomPageHeader() {
  const [pressed, setPressed] = useState(false);
  const toggle = useCallback(() => setPressed((p) => !p), []);

  return (
    <div className="page-header">
      <button
        type="button"
        className="page-favorite-btn"
        title="このページをお気に入りに追加"
        aria-pressed={pressed}
        onClick={toggle}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/header_icons/D-01a_favorite_outline.png"
          alt=""
          className="page-favorite-icon-off"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/header_icons/D-01_favorite_simple.png"
          alt=""
          className="page-favorite-icon-on"
        />
      </button>

      <div className="page-title-block">
        <div className="page-title-row">
          <h1 className="page-title">
            Bloom{" "}
            <span style={{ color: "var(--text-muted)", fontSize: "1.6rem" }}>—</span>
            <span className="page-title-jp">花咲く業務の庭</span>
            <span className="page-title-flower" aria-hidden>
              <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <g fill="#e8b4b8" opacity="0.85">
                  <ellipse cx="16" cy="9" rx="3.5" ry="6.5" transform="rotate(0 16 16)" />
                  <ellipse cx="16" cy="9" rx="3.5" ry="6.5" transform="rotate(72 16 16)" />
                  <ellipse cx="16" cy="9" rx="3.5" ry="6.5" transform="rotate(144 16 16)" />
                  <ellipse cx="16" cy="9" rx="3.5" ry="6.5" transform="rotate(216 16 16)" />
                  <ellipse cx="16" cy="9" rx="3.5" ry="6.5" transform="rotate(288 16 16)" />
                </g>
                <circle cx="16" cy="16" r="2.8" fill="#d4a541" opacity="0.95" />
              </svg>
            </span>
          </h1>
        </div>
        <p className="page-subtitle">グループの動きを、咲かせる。</p>
      </div>
    </div>
  );
}
