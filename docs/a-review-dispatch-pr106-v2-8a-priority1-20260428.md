# a-review dispatch - PR #106 v2.8a 完成形 priority 1 レビュー依頼 - 2026-04-28

> 起草: a-main-009
> 用途: a-bloom-002 が dispatch v6 + v7 + v2.8a 全完走、PR #106 が最新化（13 commits push 済）
> 前提: GitHub Team プラン課金完了 + C 垢認証復旧済、push block 解除

## 投下短文（東海林さんが a-review にコピペ）

```
【a-main-009 から a-review へ】PR #106 v2.8a 完成形 priority 1 レビュー依頼

▼ 経緯
- 4/27 GitHub crisis（A/B 垢同日 ban）→ C 垢 (shoji-hyuaran) + Team プラン化で復旧
- 4/27-4/28 で a-bloom-002 が dispatch v6 + v7 + v2.8a 仕様 全完走
- 4/28 朝 GitHub Team プラン課金完了、push block 解除
- 4/28 11:30 頃 13 commits 一括 push (ababd29..2a00c79)
- PR #106 が v2.8a 完成形に最新化、5/5 後道さんデモ ready

▼ 対象 PR

- branch: feature/garden-common-ui-and-shoji-status
- 最新 SHA: 2a00c79
- URL: https://github.com/Hyuaran/garden/pull/106

▼ 含まれる範囲（13 commits）

dispatch v7 系（8 commits）:
- 500538d: V7-B ログイン画面（社員番号またはID + 6 atmospheres + 目アイコン）
- 353e5d1: V7-C 離席中/休憩中 中央レイアウト
- 82b7223 + a4fe66a: V7-D A 案 v4 画像 overlay
- 7021195: V7-D-fix 座標修正 + 全 12 件 Link
- e2f7570: V7-D-fix2 aspect-ratio 16/9 container
- 41f51bc: develop merge (Bud 取込)
- 0ab9aa0: V7-E Coming Soon 6 件

dispatch v2.8a 系（5 commits）:
- f5fa07b: Step 1 CSS 変数 + 4 Google Fonts + ダーク基盤
- c928c30: Step 2 画像アセット 8 カテゴリ 51 ファイル移植
- d8454d0: Step 3 静的コンポーネント 9 件
- df8cc24: Step 4 動的 lib/hook 6 件
- 2a00c79: Step 5 page.tsx 全面組み上げ + ThemeProvider 配線

▼ priority

**priority 1（最重要）**。理由:
- 5/5 後道さんデモ用 完成形（4/26 確定方針）
- ChatGPT v4 画像背景 + 12 module 透明 hit area + v2.8a 仕様（CSS 変数 + EB Garamond + 5 背景切替 + 音演出 + 天気時刻ベース + Activity 高さ自動調整）
- 既存 V7-D / V7-E と v2.8a の両方が同 PR に含まれる
- Bud merge 含む（develop と整合）

▼ レビュー観点（推奨）

1. v2.8a の動的機能（音 / 天気 / 背景切替）が next-themes 不在で自家製 ThemeProvider で動作するか
2. CSS 変数の light/dark 切替整合性
3. EB Garamond / Cormorant Garamond / Shippori Mincho / Noto Serif JP の next/font 設定整合性
4. 12 module の hit area 座標（v4 画像と整合）
5. 認証フロー (login → home) と 12 module Link 遷移
6. Coming Soon 6 件の min-height + 中央レイアウト
7. ForestGate.tsx は uncommitted（out-of-scope、無視）

▼ 期待アクション

- 5/3 GW 中盤までに APPROVE 期待
- CHANGE REQUEST あれば a-bloom-002 に追加修正 dispatch
- 5/5 後道さんデモ前 merge（Vercel production deploy）

▼ Vercel preview

push 完了で自動 deploy（2-3 分後）。preview URL は PR #106 コメントで Vercel bot が投稿予定。

▼ 報告先

レビュー結果を a-main-009 に共有してください。
```

## 投下後の進行

| Step | 内容 | 担当 |
|---|---|---|
| 1 | 東海林さんが a-review に上記短文投下 | 東海林さん |
| 2 | a-review が dispatch v6 + v7 + v2.8a 累計 13 commits をレビュー | a-review |
| 3 | レビュー結果を a-main に共有 | a-review → a-main-009 |
| 4 | APPROVE → 5/5 デモ前 merge（東海林さん操作）| 東海林さん |

## 改訂履歴

- 2026-04-28 初版（a-main-009、PR #106 v2.8a 完成形 priority 1 レビュー依頼）
