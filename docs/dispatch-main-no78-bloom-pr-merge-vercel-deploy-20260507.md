# dispatch main- No. 78 — a-bloom-003 通知（500 修正後 PR マージ + Vercel デプロイ 追加依頼）

発信元: a-main-013
発信日時: 2026-05-07(木) 14:30
発信先: a-bloom-003
件名: main- No. 77 修正完了後の PR マージ + Vercel 自動デプロイ確認（5/8 後道さん別 PC URL アクセス用）
緊急度: 🔴 高（5/7 中 完了希望、5/8 デモ朝までに Vercel 反映必須）

---

## 1. 追加要件

5/8 後道さんデモは **2 系統運用**になりました：

| 用途 | 環境 |
|---|---|
| 5/8 当日 対面（東海林さん PC）| ローカル dev `localhost:3001` |
| **後道さん別 PC アクセス**（5/8 当日 or 直後）| **Vercel 本番** `garden-chi-ochre.vercel.app/bloom/...` |

Vercel 本番は **Apr 24 のマージ後から更新なし**。/bloom/progress 等の 5/5 新機能は未反映。
**5/7 中に最新コードを Vercel に反映する必要があります。**

---

## 2. main- No. 77 修正完了後の追加作業

### Step 1: 修正完了 → コミット & push

main- No. 77 で依頼した修正 A + C（最低限）+ B（時間あれば）を完了 → コミット & push。

### Step 2: PR 作成 → develop / main へマージ

通常の Garden PR フロー：
1. `feature/bloom-progress-html-bugfix-20260507` 等のブランチ
2. PR 作成 → `develop` へマージ
3. `develop` → `main` PR → マージ
4. main マージで Vercel が自動デプロイ

### Step 3: Vercel 自動デプロイ動作確認 ⚠️ 重要

**GitHub C 垢（shoji-hyuaran）移行後の Vercel 自動デプロイは未検証**です（旧 A/B 垢 ban 後の初動）。

確認手順:
1. Vercel ダッシュボード（Edge ブラウザでログイン済の前提）で `Hyuaran/garden` プロジェクトの Deployments 画面を開く
2. main マージ後 1-3 分以内にビルドが走るか確認
3. Build 成功 → garden-chi-ochre.vercel.app/bloom/progress が 200 で見えるか確認
4. NG の場合、Vercel の GitHub 連携設定を見直し（C 垢の OAuth 連携が必要）

### Step 4: 完了報告

bloom-003- No. NN（次番号）で a-main-013 に：
- 修正完了の commit hash
- マージ済 PR # (develop / main 両方)
- Vercel deploy URL（成功後）
- /bloom/progress on Vercel で **X-Data-Source: supabase** が返ることを確認

---

## 3. Vercel デプロイ NG 時のフォールバック

GitHub 連携が C 垢移行で動かない場合の選択肢:

| # | 方法 | 工数 |
|---|---|---|
| A | Vercel CLI で手動デプロイ（`vercel --prod`）| 5 分 |
| B | Vercel ダッシュボードから手動 redeploy | 3 分 |
| C | GitHub 連携を C 垢で再設定 | 10 分 |

**Vercel ダッシュボードでまず B を試行**、ダメなら C → A の順。

---

## 4. 5/8 朝までのチェックリスト

a-bloom-003 が Step 1-4 完了すると、以下が成立:

- [ ] localhost:3001/bloom/progress → 200 OK + supabase data
- [ ] garden-chi-ochre.vercel.app/bloom/progress → 200 OK + supabase data
- [ ] localhost:3001/bloom/top, /workboard, /roadmap, /monthly-digest, /ceo-status, /daily-report → 全て 200 OK
- [ ] Vercel 側でも同 6 画面 200 OK
- [ ] Vercel デプロイログにエラーなし

---

## 5. main- No. 77 + No. 78 の関係

| dispatch | 内容 | 期限 |
|---|---|---|
| main- No. 77 | 500 エラー本体修正（route.ts 修正 A + C / B 任意）| 5/7 早めに |
| **main- No. 78（本書）** | **修正後 PR マージ + Vercel 反映** | **5/7 中**（5/8 朝まで間に合えば OK）|

No. 77 の修正完了報告と No. 78 完了報告は別々で OK（段階報告で進捗見える化）。

---

ご確認・着手お願いします。判断保留事項あれば即停止 → a-main-013 経由で東海林さんに確認依頼。
