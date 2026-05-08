/**
 * BloomPageHeader — Bloom Top のページヘッダー
 *
 * プロト 015_Gardenシリーズ/000_GardenUI_bloom/02_BloomTop/index.html line 254-281 移植
 *   - お気に入りボタン（Phase 1 では UI のみ、永続化は Phase 2 で）
 *   - ページタイトル「Bloom — 花咲く業務の庭」+ 桜花 SVG
 *   - サブタイトル「グループの動きを、咲かせる。」
 */

export default function BloomPageHeader() {
  return (
    <div className="page-header">
      <button
        className="page-favorite-btn"
        type="button"
        title="このページをお気に入りに追加"
        aria-pressed="false"
      >
        {/* Phase 1: アイコン画像差し替えは Phase 2、暫定で星絵文字 */}
        <span className="page-favorite-icon-off" aria-hidden>
          ☆
        </span>
        <span className="page-favorite-icon-on" aria-hidden>
          ★
        </span>
      </button>

      <div className="page-title-block">
        <div className="page-title-row">
          <h1 className="page-title">
            Bloom <span style={{ color: "var(--text-muted)", fontSize: "1.6rem" }}>—</span>
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
