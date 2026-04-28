# a-bloom-002 dispatch - v2.8a pixel-perfect 調整 - 2026-04-28

> 起草: a-main-009
> 用途: localhost:3000 (Next.js v2.8a 実装) と HTML/CSS v2.8a 最終版の細部差分を埋める
> 前提: 東海林さんから「おおむね OK」+「メニューバー横幅、中央カードの縦幅が違う」フィードバック

## 投下短文（東海林さんが a-bloom-002 にコピペ）

```
【a-main-009 から a-bloom-002 へ】v2.8a pixel-perfect 調整

▼ 経緯
- 東海林さんが localhost:3000 (Next.js 実装) と HTML/CSS v2.8a 最終版を並べて比較
- フィードバック「おおむね OK、ただし以下 2 点の差分あり」
  1. メニューバー（左サイドバー）の横幅が異なる
  2. 中央部のカード（KPI / Orb）の縦の幅が異なる
- HTML/CSS v2.8a 版に **pixel-perfect で揃える** 調整依頼

▼ 参照する正典

G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\000_GardenUI\
├── index.html             # HTML/CSS v2.8a 最終版（東海林さん確認済の正解）
├── css/style.css          # CSS 寸法・余白の正典
└── DESIGN_SPEC.md         # 寸法仕様書

▼ 調整対象

▼ 調整 1: 左サイドバー幅

DESIGN_SPEC.md §3-2 / index.html / style.css の値:
- --sidebar-w: 210px

確認ポイント:
- src/app/_components/layout/Sidebar.tsx の width / 親 grid の sidebar 幅指定
- globals.css の --sidebar-w 変数定義
- main エリアの margin-left が var(--sidebar-w) になっているか

▼ 調整 2: KPI カード縦幅

DESIGN_SPEC.md §3-2 / §3-4:
- --kpi-card-h: 144px（参考値、内容で伸びる）
- KPI カード padding（参照: index.html の .kpi-card class）

確認ポイント:
- src/app/_components/home/KpiCard.tsx の高さ / padding
- 4 type variant（sales / income / achievement / warning）すべてで HTML/CSS 版と同じ縦幅
- 内部要素（label / value / trend / chart）の余白も合わせる
- KpiGrid の gap = 14px

▼ 調整 3: Orb カード縦幅 + その他

DESIGN_SPEC.md §3-5:
- --orb-card-h: 140px（固定高）
- padding: 16px 18px
- 1 カード内 grid: grid-template-columns: 96px 1fr
- gap: 14px

確認ポイント:
- src/app/_components/home/OrbCard.tsx の固定高 = 140px
- 画像（96×96）+ テキスト 配置
- ホバー時 transform: translateY(-6px) scale(1.025)

▼ 調整方針

1. **HTML/CSS index.html を Edge / Chrome の DevTools で開く**
2. 該当要素を Inspector で確認、computed CSS 値を取得
3. **Next.js 側の同等要素**を **同じ CSS 値**に合わせる
4. localhost:3000 と HTML/CSS 版を**同時に開いて並べて比較**
5. 完全に同じ見た目になるまで微調整

▼ 期待結果

- 東海林さんが localhost:3000 と HTML/CSS 版を並べて見て、「**完全に同じ**」と感じる pixel-perfect 一致
- ただし HTML 直接開きと Next.js dev server で完全一致は理論上難しい部分（フォント rendering 等）は許容、見た目で違和感ない範囲で OK

▼ 完了基準

- [ ] 左サイドバー幅 が HTML/CSS 版と一致（210px）
- [ ] KPI カードの縦幅・padding が一致
- [ ] Orb カードの縦幅・padding が一致
- [ ] メイン領域の margin / padding が一致
- [ ] Activity Panel の位置・幅が一致
- [ ] localhost:3000 で東海林さん最終確認 OK

▼ 注意

- ファイル削除厳禁（CLAUDE.md ルール）
- 既存 globals.css / Sidebar.tsx 等を **編集**（別名保存ルールも考慮、ただし css 変数値だけの微修正なら別名保存不要、東海林さん判断）
- ローカル commit OK、push は次回 5 分間隔遵守
- TypeScript / ESLint clean 維持

▼ 完了報告先

修正完了 + ローカル commit + SHA 共有 + 「localhost:3000 で東海林さん再確認お願いします」を a-main-009 に共有。
```

## 詳細 spec

### 確認手順（a-bloom-002 が実行）

1. HTML/CSS v2.8a 最終版を開く: `G:\...\000_GardenUI\index.html` をブラウザで Edge / Chrome 開く
2. Edge DevTools (F12) → Inspector → 各要素の computed CSS 確認
3. 主要寸法を取得:
   - `.sidebar` の width
   - `.kpi-card` の height / padding / gap
   - `.orb-card` の height / padding / grid
   - `.main` の margin-left / padding
   - `.activity-panel` の width / position
4. localhost:3000 で同等要素の computed CSS 確認
5. 差分を a-bloom-002 worktree の `globals.css` / 各 component で修正
6. リロードして比較

### 想定する修正箇所

| ファイル | 想定修正 |
|---|---|
| `src/app/globals.css` | --sidebar-w / --kpi-card-h / --orb-card-h の値修正 |
| `src/app/_components/layout/Sidebar.tsx` | width 指定の修正 |
| `src/app/_components/home/KpiCard.tsx` | min-height / padding 指定 |
| `src/app/_components/home/OrbCard.tsx` | height / padding 指定 |
| `src/app/page.tsx` | grid 配置の gap / sidebar margin |

### コミット推奨

```
fix(home): v2.8a pixel-perfect 調整 - sidebar 幅 / KPI カード高 / Orb カード高
```

## 改訂履歴

- 2026-04-28 初版（a-main-009、HTML/CSS 版 vs Next.js 版 の細部差分調整）
