/**
 * Greeting (v2.8a Step 5 — 動的版)
 *
 * DESIGN_SPEC §4-3
 *
 * 時刻別挨拶 + 芽アイコン
 *   朝（5-10）: おはようございます
 *   昼（10-17）: こんにちは
 *   夜（17-24, 0-5）: お疲れさまです
 *
 * Step 5: 動的 prop 配線済み（page.tsx で 1 分毎更新）
 *   - greeting: 挨拶テキスト（既定: おはようございます）
 *   - userName: 表示する名前（既定: 東海林さん）
 *   - sub: サブテキスト
 */
type Props = {
  greeting?: string;
  userName?: string;
  sub?: string;
};

export default function Greeting({
  greeting = "おはようございます",
  userName = "東海林さん",
  sub = "今日も素敵な一日を。業務の成長をサポートします。",
}: Props = {}) {
  return (
    <section className="greeting">
      <h2 className="greeting-title">
        {userName}、{greeting}
        <span className="leaf-icon">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/decor/greeting_sprout.png" alt="" />
        </span>
      </h2>
      <p className="greeting-sub">{sub}</p>
    </section>
  );
}
