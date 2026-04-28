# a-bloom-002 dispatch - v2.8a ダークモード 透明度調整 - 2026-04-28

> 起草: a-main-009
> 用途: localhost:3000 (Next.js v2.8a) のダークモード時、ヘッダー / カード等が透けすぎ → HTML/CSS v2.8a 最終版に合わせて不透明度を上げる
> 前提: pixel-perfect 調整 dispatch と並行 / 後続で実施

## 投下短文（東海林さんが a-bloom-002 にコピペ）

```
【a-main-009 から a-bloom-002 へ】v2.8a ダークモード 透明度調整

▼ 経緯
- 東海林さんが localhost:3000 ダークモードと HTML/CSS v2.8a 最終版を比較
- フィードバック「ヘッダーとカード等の箇所が透けすぎ、HTML/CSS 版に合わせて」
- ダーク時の背景大樹画像が透けすぎてコンテンツ（KPI 値・Orb 文字・ヘッダー要素）が読みにくい

▼ 調整対象（推定 NG 箇所）

1. **Topbar（ヘッダー）背景** が透けすぎ
2. **KPI カード背景** が透けすぎ
3. **Orb カード背景** が透けすぎ
4. **Sidebar 背景** が透けすぎ
5. **Activity Panel 背景** が透けすぎ

→ ダーク時のコンテンツ可読性を確保するため、不透明度を上げる。

▼ 参照する正典

G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\000_GardenUI\
├── index.html             # HTML/CSS v2.8a 最終版（東海林さん確認済の正解）
├── css/style.css          # CSS 透明度の正典
└── DESIGN_SPEC.md §1-2    # ダークモード CSS 変数

▼ DESIGN_SPEC.md §1-2 ダーク CSS 変数（参考）

[data-theme="dark"] {
  --bg-paper: #1f2419;
  --bg-paper-soft: #2a302a;
  --bg-card: rgba(38, 44, 32, 0.55);          ← 透明度 0.55
  --bg-card-hover: rgba(50, 58, 42, 0.85);
  --bg-card-solid: #2c322a;
  --bg-sidebar: rgba(30, 36, 24, 0.6);        ← 透明度 0.6
  --bg-activity: rgba(38, 44, 32, 0.7);       ← 透明度 0.7
  --bg-overlay: rgba(25, 30, 20, 0.25);
}

▼ 確認手順（a-bloom-002 が実行）

1. HTML/CSS v2.8a 版を Edge で開く（ダークモード切替で確認）
2. DevTools (F12) → Inspector → 各要素の computed CSS で背景色を取得
   - Topbar: 実際の background-color rgba 値
   - .kpi-card: 同上
   - .orb-card: 同上
   - .sidebar: 同上
   - .activity-panel: 同上
3. Next.js 側 (localhost:3000) で同等要素の background 値を比較
4. 差分があれば globals.css の CSS 変数 or 個別 component の Tailwind class を修正

▼ 想定修正方針

a) globals.css の `[data-theme="dark"]` 変数値が DESIGN_SPEC §1-2 と一致しているか確認
b) 不一致があれば DESIGN_SPEC §1-2 の値で globals.css を更新
c) component 側で Tailwind class（bg-card, bg-card-solid 等）を使っているか確認、CSS 変数を参照するスタイルに統一

▼ 期待結果

東海林さんが localhost:3000 ダーク表示と HTML/CSS 版ダーク表示を並べて、「**透け感が同じ**」と感じる状態。

▼ 完了基準

- [ ] Topbar 背景の透明度が HTML/CSS 版と一致
- [ ] KPI カード背景の透明度が一致
- [ ] Orb カード背景の透明度が一致
- [ ] Sidebar 背景の透明度が一致
- [ ] Activity Panel 背景の透明度が一致
- [ ] ライトモードは現状維持（影響しない）
- [ ] ダーク表示でコンテンツ（KPI 値・Orb 文字・ヘッダー要素）が読みやすい

▼ 注意

- ファイル削除厳禁
- 既存 globals.css 編集（CSS 変数値の微修正なら別名保存不要、ただし大幅変更時は別名保存）
- ライトモードに影響しないこと
- ローカル commit OK
- TypeScript / ESLint clean 維持

▼ 完了報告先

修正完了 + ローカル commit + SHA 共有 + 「localhost:3000 ダーク再確認お願いします」を a-main-009 に共有。
```

## 詳細 spec

### 想定する修正箇所

| ファイル | 想定修正 |
|---|---|
| `src/app/globals.css` | `[data-theme="dark"]` ブロックの CSS 変数値を DESIGN_SPEC §1-2 に揃える |
| 各 component の Tailwind class | `bg-card`, `bg-card-solid`, `bg-sidebar` 等が CSS 変数を参照しているか確認 |

### 推定される NG パターン

- a-bloom-002 が独自の透明度（例: 0.3 や 0.4）にしている場合 → DESIGN_SPEC §1-2（0.55 / 0.6 / 0.7）に揃える
- Tailwind の `bg-white/30` 等のハードコード透明度を使っている場合 → CSS 変数参照に切替

### コミット推奨

```
fix(home): v2.8a ダーク透明度調整 - DESIGN_SPEC §1-2 値に統一
```

## 改訂履歴

- 2026-04-28 初版（a-main-009、ダーク透けすぎ問題への修正、HTML/CSS 版に揃える）
