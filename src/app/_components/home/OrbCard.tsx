/**
 * OrbCard (v2.8a Step 5 — 動的版)
 *
 * DESIGN_SPEC §4-5
 *
 * 1 つのモジュールを表すガラス玉カード。
 * Hover 演出（CSS transform scale + shadow）は v2.8a CSS 側で対応。
 *
 * Step 5: 動的 prop 配線済み
 *   - onMouseEnter : hover 時の音再生 hook
 *   - onClick      : click 時の音再生 hook (Link 遷移は href で実行)
 */

import Link from "next/link";

export type OrbStatusTone = "default" | "alert" | "warn";

type Props = {
  /** モジュール識別子（icon ファイル名と data-name 属性に利用） */
  moduleKey: string;
  /** カード上部に表示するアイコン画像の path */
  iconSrc: string;
  /** 表示名（h3） */
  label: string;
  /** カード本文（p） */
  description: string;
  /** ステータスラベル（左） */
  statusLabel: string;
  /** ステータス値（右） */
  statusValue: string;
  /** ステータス値の色調（alert/warn は CSS で色変化） */
  statusTone?: OrbStatusTone;
  /** 遷移先 href */
  href: string;
  /** hover 時 callback (音再生用) */
  onMouseEnter?: () => void;
  /** click 時 callback (音再生用、Link 遷移は href で実行) */
  onClick?: () => void;
};

export default function OrbCard({
  moduleKey,
  iconSrc,
  label,
  description,
  statusLabel,
  statusValue,
  statusTone = "default",
  href,
  onMouseEnter,
  onClick,
}: Props) {
  const valueClass =
    statusTone === "alert"
      ? "orb-status-value alert"
      : statusTone === "warn"
      ? "orb-status-value warn"
      : "orb-status-value";

  return (
    <Link
      href={href}
      className="orb-card"
      data-name={moduleKey}
      data-module-key={moduleKey.toLowerCase()}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      <div className="orb-img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconSrc} alt={label} />
      </div>
      <div className="orb-text">
        <h3>{label}</h3>
        <p>{description}</p>
      </div>
      <div className="orb-status">
        <span className="orb-status-label">{statusLabel}</span>
        <span className={valueClass}>{statusValue}</span>
      </div>
    </Link>
  );
}
