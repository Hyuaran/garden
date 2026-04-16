import { Icons } from "./_components/Icons";
import { SemiGauge } from "./_components/SemiGauge";
import { C } from "./_constants/colors";

export default function TreeHomePage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="text-6xl">🌳</div>
        <h1 className="text-3xl font-bold tracking-tight">Garden Tree</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">架電アプリ</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          Under construction — プロトタイプから移植中
        </p>

        {/* 共通コンポーネント動作確認 */}
        <div
          style={{
            background: C.darkGreen,
            padding: "16px 24px",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            gap: 24,
            color: "white",
          }}
        >
          <SemiGauge
            label="当日目標"
            percent={60}
            sub="2.5P / 4.2P"
            color={C.gold}
          />
          <SemiGauge
            label="月間目標"
            percent={100}
            sub="3.0P / 3.0P"
            color={C.red}
          />
          <div style={{ display: "flex", gap: 8 }}>
            {Icons.dashboard}
            {Icons.phone}
            {Icons.trophy}
            {Icons.bell}
          </div>
        </div>
      </div>
    </div>
  );
}
