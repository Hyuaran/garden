/**
 * Garden-Tree 半円ゲージ
 *
 * KPIヘッダーの「当日目標」「月間目標」で使用される進捗ゲージ。
 *
 * - 半円の SVG アーク（0〜100%）
 * - color プロパティで色切替（達成時にゴールド/レッドへ）
 * - 中央にパーセント表示、下にサブテキスト（例: "2.5P / 4.2P"）
 */

type SemiGaugeProps = {
  label: string;
  percent: number;
  sub?: string;
  color?: string;
};

export function SemiGauge({
  label,
  percent,
  sub,
  color = "rgba(255,255,255,0.9)",
}: SemiGaugeProps) {
  const r = 22;
  const stroke = 6;
  const circ = Math.PI * r;
  const offset = circ - (circ * Math.min(100, percent)) / 100;

  return (
    <div style={{ textAlign: "center", minWidth: 64 }}>
      <div
        style={{
          fontSize: 9,
          color: "rgba(255,255,255,0.6)",
          marginBottom: -1,
          lineHeight: 1,
        }}
      >
        {label}
      </div>
      <svg
        width={60}
        height={34}
        viewBox="0 0 60 34"
        style={{ display: "block", margin: "0 auto" }}
      >
        {/* 背景アーク（薄い） */}
        <path
          d={`M ${30 - r} 30 A ${r} ${r} 0 0 1 ${30 + r} 30`}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* 進捗アーク */}
        <path
          d={`M ${30 - r} 30 A ${r} ${r} 0 0 1 ${30 + r} 30`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        {/* 中央パーセント */}
        <text
          x="30"
          y="28"
          textAnchor="middle"
          fill="white"
          fontWeight="800"
          fontFamily="'Noto Sans JP', sans-serif"
        >
          <tspan fontSize="13">{percent}</tspan>
          <tspan fontSize="8">%</tspan>
        </text>
      </svg>
      {sub && (
        <div
          style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.5)",
            marginTop: -1,
          }}
        >
          {sub.split("P").map((s, i, arr) =>
            i < arr.length - 1 ? (
              <span key={i}>
                {s}
                <span style={{ fontSize: 7 }}>P</span>
              </span>
            ) : (
              s
            ),
          )}
        </div>
      )}
    </div>
  );
}
