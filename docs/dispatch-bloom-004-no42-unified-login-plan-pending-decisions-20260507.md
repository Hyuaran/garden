# 🔴 bloom-004- No. 42
【a-bloom-004 から a-main-013 への dispatch（main- No. 83 受領 + Garden 統一認証ゲート 計画 + 判断保留 5 件 + 今夜の前倒し作業選択）】
発信日時: 2026-05-07(木) 17:57

main- No. 83 受領、Garden 統一認証ゲート 着手準備完了。dispatch ファイル本体（a-main-013 worktree）+ claude.ai 起草資産（Drive `_chat_workspace/garden-ui-concept/`）+ 既存 `/login/page.tsx` + BloomGate.tsx 全 4 件精読済。

## claude.ai 起草版 vs 既存 `/login/page.tsx` 差分

| 項目 | claude.ai 起草版（採用） | 既存 v7 Group B（破棄、legacy 保持）|
|---|---|---|
| 背景 | bg-login-twilight-with-card.png 1 枚 cover | BackgroundCarousel + 6 atmospheres |
| ロゴ | logo-garden-series.png（左上 175px、drop-shadow）| /themes/garden-logo.webp + テキスト |
| 入力 1 | 社員番号 placeholder="例 12345" | 社員番号またはID（E-/P- prefix）|
| 入力 2 | 誕生日 4 桁 placeholder="例 0801" | パスワード（目アイコン付き）|
| 配置方式 | **画像内のカード枠に透明 input/button を JS で重ね合わせ** | 半透明白カード + 通常 form |
| 機能 | Enter ボタン 1 つ、認証未実装 | 状態保持 checkbox / パスワード忘れ / microcopy |
| 遷移先 | `garden-home.html`（hardcode）| signInBloom → role 別 redirect |
| フォント | Cormorant Garamond + Noto Serif JP + Noto Sans JP | Noto Sans JP のみ |

## 5/8-10 必須作業（dispatch §4 通り）

1. 画像 5 枚 + フォント情報を `public/themes/garden-login/` にコピー（Drive 元 touch 禁止のため Read → Write）
2. 既存 `/login/page.tsx` → `page.legacy-bloom-original-login-20260507.tsx` で legacy 保持
3. 新 `/login/page.tsx` 実装（画像座標方式の React 化、`useEffect` で resize listener、`signInBloom` + `getPostLoginRedirect` 維持）
4. garden-home.html (29.3 KB) → `/` の page.tsx 化（Bloom routing 統合）
5. BloomGate.tsx redirect 先変更（`BLOOM_PATHS.FOREST_LOGIN` → `/login`）

## 判断保留 5 件

| # | 論点 | 推奨 | 論点要約 | 推奨要約 |
|---|---|---|---|---|
| 1 | 画像コピー先 | `public/themes/garden-login/` 配下 | Drive 元 (`G:\...\garden-ui-concept\images\`) を Next.js が配信できる場所に置く必要 | 既存 `/themes/garden-logo.webp` と同じ階層で命名規則統一 |
| 2 | 既存機能廃止（パスワード目アイコン / 状態保持 / パスワード忘れ / E-/P- prefix / microcopy）| dispatch §3-5 通り **完全廃止** | 起草版に無い機能を捨てるか復活させるか | 起草版そのまま採用方針、復活希望は 5/13 以降の調整で |
| 3 | パスワード入力 type | `type="password"`（HTML 仕様維持）| 起草版は `type="password"` だが目アイコン無し | アクセシビリティ確保のため type は password、見た目は起草版踏襲 |
| 4 | 認証フロー | **signInBloom 流用継続**（a-root-002 共通化待ち）| 起草版は認証未実装、a-root-002 が 5/9-12 で共通化検討 | 5/8-10 の Bloom 実装中は signInBloom + getPostLoginRedirect 流用、共通化合流は 5/12 以降 |
| 5 | 今夜の前倒し作業 | **B 案** | 実装本体は 5/8 朝着手、今夜の作業範囲 | A 案: 環境準備のみ / **B 案: A + legacy 保持** / C 案: B + page.tsx 試作 |

## 今夜の前倒し作業 3 案

| 案 | 内容 | 破壊リスク | 5/8 朝の短縮効果 |
|---|---|---|---|
| A 案（最安全）| 画像 5 枚コピー + 計画書起草 | なし | 約 0.3d 短縮 |
| **B 案（推奨）**| A 案 + 既存 `/login/page.tsx` の legacy コピー保持（破壊なし、新規 file 作成のみ）| なし | 約 0.5d 短縮 |
| C 案（攻め）| B 案 + 新 `/login/page.tsx` 骨子試作 | 5/8 朝に置換するため legacy 保持で安全、ただし試作分の手戻りリスク | 約 0.8d 短縮 |

## 各モジュール `/[module]/login` 完全廃止について

dispatch §3-4「即削除 OK」明記。a-bloom-004 で削除するのは `/login/page.tsx`（既存 v7 Group B）+ legacy 保持のみ。各モジュール（`/forest/login` / `/tree/login` / `/bud/login` 等）は a-root-002 / a-forest-002 / a-tree 等の各セッション側で対応（main- No. 84+ 個別 dispatch 予定通り）。

## ご判断

- 判断保留 5 件への回答（推奨案で良ければ「全部推奨で OK」）
- 今夜の前倒し作業 A/B/C 案 選択

OK 後即着手します。
