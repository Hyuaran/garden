/**
 * Greeting (v2.8a Step 3 — 静的版)
 *
 * DESIGN_SPEC §4-3
 *
 * 時刻別挨拶 + 芽アイコン
 *   朝（5-10）: おはようございます
 *   昼（10-17）: こんにちは
 *   夜（17-24, 0-5）: お疲れさまです
 *
 * Step 3 では「朝」テキスト固定（東海林さん、おはようございます）。
 * Step 4 で時刻ベースの動的化を予定。
 */
export default function Greeting() {
  return (
    <section className="greeting">
      <h2 className="greeting-title">
        東海林さん、おはようございます
        <span className="leaf-icon">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/decor/greeting_sprout.png" alt="" />
        </span>
      </h2>
      <p className="greeting-sub">
        今日も素敵な一日を。業務の成長をサポートします。
      </p>
    </section>
  );
}
