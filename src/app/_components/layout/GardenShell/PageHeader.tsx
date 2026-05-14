"use client";

/**
 * PageHeader — 中央エリア上部 (⑤ 見出し + ⑦ お気に入り + ⑧ 限定公開バッジ)
 */

interface PageHeaderProps {
  /** 大見出し (例: "銀行口座管理") */
  title: string;
  /** 見出し横の和 サブタイトル (例: "お金の通り道を、見渡す") */
  titleJp?: string;
  /** 見出し下のサブテキスト (例: "法人 × 口座 マトリクス + 残高推移 + 口座マスタ") */
  subtitle?: string;
  /** 限定公開バッジ表示 */
  accessBadge?: { icon?: string; label: string };
  /** お気に入り押下中の状態 */
  isFavorite?: boolean;
}

export default function PageHeader({
  title,
  titleJp,
  subtitle,
  accessBadge,
  isFavorite = false,
}: PageHeaderProps) {
  return (
    <div className="page-header">
      <button className="page-favorite-btn" type="button" title="このページをお気に入りに追加" aria-pressed={isFavorite}>
        <img
          src={isFavorite
            ? "/themes/garden-shell/images/header_icons/D-01_favorite_simple.png"
            : "/themes/garden-shell/images/header_icons/D-01a_favorite_outline.png"}
          alt=""
          className={isFavorite ? "page-favorite-icon-on" : "page-favorite-icon-off"}
        />
      </button>
      <div className="page-title-block">
        <div className="page-title-row">
          <h1 className="page-title">
            {title}
            {titleJp && (
              <>
                {" "}<span style={{ color: "var(--text-muted)", fontSize: "1.6rem" }}>—</span>{" "}
                <span className="page-title-jp">{titleJp}</span>
              </>
            )}
            <span className="page-title-flower">
              <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <g fill="#e8b4b8" opacity="0.85">
                  <ellipse cx="16" cy="9" rx="3.5" ry="6.5" transform="rotate(0 16 16)" />
                  <ellipse cx="16" cy="9" rx="3.5" ry="6.5" transform="rotate(72 16 16)" />
                  <ellipse cx="16" cy="9" rx="3.5" ry="6.5" transform="rotate(144 16 16)" />
                  <ellipse cx="16" cy="9" rx="3.5" ry="6.5" transform="rotate(216 16 16)" />
                  <ellipse cx="16" cy="9" rx="3.5" ry="6.5" transform="rotate(288 16 16)" />
                </g>
                <circle cx="16" cy="16" r="2.8" fill="#d4a541" opacity="0.9" />
              </svg>
            </span>
          </h1>
        </div>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {accessBadge && (
        <span className="access-badge">
          {accessBadge.icon && <span className="access-badge-icon">{accessBadge.icon}</span>}
          <span>{accessBadge.label}</span>
        </span>
      )}
    </div>
  );
}
