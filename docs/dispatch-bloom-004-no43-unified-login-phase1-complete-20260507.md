# 🟢 bloom-004- No. 43
【a-bloom-004 から a-main-013 への dispatch（Garden 統一認証 Phase 1 = /login 完成 + 視覚確認 OK + Phase 2 着手判断仰ぎ）】
発信日時: 2026-05-07(木) 18:24

main- No. 84 GO 受領、即着手で **Phase 1 (/login) 完成**しました。所要 27 分（17:57 → 18:24）。

## 完了内容

| 項目 | 結果 |
|---|---|
| 画像 3 枚コピー | ✅ `public/themes/garden-login/` (bg-login-twilight-with-card.png 2.7MB / bg-night-garden-with-stars.png 2.7MB / logo-garden-series.png 480KB) |
| 既存 page.tsx legacy 保持 | ✅ `src/app/login/page.legacy-bloom-original-login-20260507.tsx` (削除禁止ルール準拠) |
| 新 `/login/page.tsx` 実装 | ✅ claude.ai 起草版そのまま React 化 (576 insertions / 240 deletions) |
| 画像座標方式 | ✅ CARD_COORDS 1870×841 基準、useEffect で window resize 再計算 |
| 目アイコン (👁/🙈) | ✅ 世界観ゴールド (#e8c069) 配色、押下で type=password ⇄ text 切替 |
| 状態保持 checkbox | ✅ カード枠下に Cormorant Garamond italic + ゴールド枠で世界観統合 |
| 認証フロー | ✅ signInBloom + fetchBloomUser + getPostLoginRedirect 流用継続 |
| 廃止機能 (dispatch §3-5 通り) | ✅ パスワード忘れ / E-/P- prefix / microcopy 完全廃止 |
| commit + push | ✅ `aa7a76c` feature/bloom-6screens-vercel-2026-05 |

## Chrome MCP 視覚確認 結果

`http://localhost:3001/login` で 200 + Garden Series ロゴ + Welcome to the Garden + 入力欄 / Enter ボタン / 状態保持 checkbox 全て画像枠と完璧に重なって表示。

動作確認テスト全 PASS:
- 社員番号「12345」入力 → 画像内の金色枠にぴったり重畳表示 ✅
- パスワード「0801」入力 → ●●●● マスキング表示 ✅
- 目アイコン click → ●●●● → 「0801」 text 切替 + 👁 → 🙈 アイコン変化 ✅
- 状態保持 checkbox click → ✓ チェック状態切替 ✅
- 全要素 ARIA label + data-testid 完備 (login-form / login-empid / login-password / login-password-toggle / login-keep / login-submit / login-error)

世界観: claude.ai 起草版（夕暮れアーチ + バラ + 流れ星 + Welcome to the Garden + Garden Series ロゴ）完璧再現。微調整不要。

## 残作業 (5/8 朝着手 or 今夜継続)

| Phase | 内容 | 工数見込 | 破壊リスク |
|---|---|---|---|
| **Phase 2** | garden-home.html (29.3 KB) → `/page.tsx` 化 (Bloom routing 統合) | 約 1.0d | 中 (`/` ルートが現在 Bloom リダイレクトに使われている可能性) |
| **Phase 3** | BloomGate.tsx redirect 先変更 (`BLOOM_PATHS.FOREST_LOGIN` → `/login`) | 約 0.2d | 低 (1 行差分) |
| 後続 (各モジュール) | `/[module]/login` 廃止 + redirect 統一 | a-bloom-004 担当外 | — |

## 今夜の続行判断 3 案

| 案 | 内容 | 完了想定 |
|---|---|---|
| **D 案（推奨）**| Phase 3 (BloomGate redirect 変更) のみ今夜完走、Phase 2 は明朝 | 今夜 18:50 |
| E 案 | Phase 2 (garden-home) + Phase 3 まで今夜完走 | 今夜 21:00-22:00 |
| F 案 | Phase 1 完成で今夜停止、Phase 2/3 は明朝着手 | 今夜 18:25 終了 |

## ご判断

D/E/F 案いずれかご指示ください（推奨は D 案：BloomGate 変更は 0.2d で短時間、Phase 2 garden-home は 29.3 KB で慎重実装が望ましい）。

完了予定:
- D 案 → 今夜中に Phase 1 + Phase 3 まで、明朝 garden-home 着手
- E 案 → 今夜中に全 Phase 完走、5/8 朝はテスト + Vercel 確認
- F 案 → 今夜停止、5/8 朝に Phase 2 + Phase 3 着手 → 5/9 完成
