# dispatch main- No. 116 — 作業日報セッション（Garden Forest 現状仕様化 進め方 回答）

> 起草: a-main-014
> 用途: report- No. 12（5/7 17:37、main-012 宛）への遅延回答、Forest 進め方相談 A-D 案への判断
> 番号: main- No. 116
> 起草時刻: 2026-05-08(金) 12:33

---

## 投下用短文（東海林さんが 作業日報セッション にコピペ）

~~~
🟢 main- No. 116
【a-main-014 から 作業日報セッション への dispatch（report- No. 12 回答: Garden Forest 現状仕様化 進め方）】
発信日時: 2026-05-08(金) 12:33

report- No. 12（5/7 17:37 起草、main-012 宛）受領しました。
回答が遅れて申し訳ありません（a-main-013 → 014 引き継ぎ + ガンガン常態モード進行で遅延、12 → 014 への伝達が不十分でした）。

詳細は以下ファイル参照:
[docs/dispatch-main-no116-report-session-forest-direction-answer-20260508.md](docs/dispatch-main-no116-report-session-forest-direction-answer-20260508.md)

## 状況更新（5/7 17:37 → 5/8 12:33 で進展）

- 5/7 17:00 頃 Vercel /bloom 系全画面が「Garden Forest」表示で混乱リスク発覚
- → 5/8 後道さんデモ → **5/14-16 に延期決定**
- 5/8-13 で認証統一実装 + Garden Series 統一世界観整備に集中
- a-forest-002 が Phase 1 min（仕訳帳 12 口座統合）を 5/8 着手中（B-min #4 → #2 → #1 → #3 → #5、1.6d）
- Forest v9 機能移植（T-F6 + 納税カレンダー + 決算書 ZIP + 派遣資産要件）は Phase A の中核（CLAUDE.md §18）

## 質問への回答

### 1. A〜D 案 推奨: **A 案 + 部分的 B 案折衷（D 案バリエーション）**

**A 案ベース**（Bud v2 パターンを Forest に適用、HTML/CSS 試作 → Code 整理移送）+ **部分的 B 案**（Garden 全体方針 = 認証統一 + 樹冠レイヤー世界観反映）

理由:
- Bud v2 で **A 案ワークフローは Garden 標準として確立**（claude.ai 起草版 → Code 側で 015_Gardenシリーズ/000_GardenUI_<module>/ 配置）
- a-forest-002 が現在 Phase 1 min 実装中（B-min #4 弥生 CSV パーサー）、UI は claude.ai 起草版を整備する余地あり
- B 案（Garden 全体方針）は a-forest-002 が並行で実装中、UI 試作と直接干渉しない
- C 案（Next.js 化）は **Forest は既に Next.js 稼働中**、技術スタック変更不要

### 2. Forest 現状実装

- ✅ Forest v9 完成済（FileMaker 移植、本番稼働中、Vercel デプロイ済）
- ✅ 仕訳帳 Phase 1 min 実装中（B-min #4 → #5、1.6d、a-forest-002 5/8 完走目標）
- 🔵 v9 機能移植 残（T-F6 + 納税カレンダー + 決算書 ZIP + 派遣資産要件）= Phase A 残作業
- 🔵 UI 整備（claude.ai 起草版 → 015_Gardenシリーズ/000_GardenUI_forest/）= **未着手**

### 3. 5/14-16 後道さんデモとの優先度関係

- 5/14-16 デモは Bloom + 全体ダッシュボード中心、**Forest は表示順 7（任意）**
- Forest UI 整備は 5/14-16 デモには間に合わなくても OK、5/15-16 までに磨き込み可
- **claude.ai 起草版（Bud v2 パターン）が間に合えば、5/14-16 デモで Forest UI も披露可能**
- 優先度: Bloom > 認証統一 > Forest UI 整備

### 4. 作業日報セッション（Chat 側）の関与範囲

**A 案ベースで強推奨**:

| 段階 | 主体 | 内容 |
|---|---|---|
| Phase 1: HTML/CSS 試作 | **作業日報セッション（Chat）** | claude.ai 起草版 Forest UI を 015_Gardenシリーズ/000_GardenUI_forest/ に配置 |
| Phase 2: Code 側で整理移送 | a-forest-002 | Drive HTML を Next.js コンポーネントに変換、A 案配置先確定（Bloom/Bud precedent 整合）|
| Phase 3: 動作確認 | a-forest-002 | localhost / Vercel で動作確認、Bloom と同様の世界観統一 |

→ **Chat 側の主導で先行可能**、a-forest-002 は B-min Phase 1 min 完成後の Phase A 残実装で対応。

## 推奨タイムライン

| 日 | アクション |
|---|---|
| **5/8（金）** | Chat 側で Forest UI 試作着手（claude.ai 起草版、月曜始まりカレンダー / tabular-nums / プレフィックス分離 / 35 パス参照 等の Bud v2 ルール踏襲）|
| 5/9-10 | Chat 側で Forest UI 全画面試作完成（経営ダッシュボード / 決算資料 / 仕訳帳 / 納税カレンダー 等）|
| 5/11-12 | a-forest-002 が Drive HTML を 015_Gardenシリーズ/000_GardenUI_forest/ に整理移送（Bud v2 precedent）|
| 5/13 | 認証統一 + 統合テスト |
| 5/14-16 | 後道さんデモ（Forest UI も披露可能なら表示順 7-9 に組込）|

## 着手 OK か?

東海林さんの判断仰ぎ:
1. A 案 + 部分的 B 案折衷で進める OK?（推奨）
2. Chat 側で Forest UI 試作着手 OK?
3. 5/8 中に試作 1-2 画面完成目標 OK?

回答後、私（Chat 側）の動き方を確定して着手します。
~~~

---

## 1. 背景

### 1-1. report- No. 12 受領（5/7 17:37 起草、main-012 宛）

作業日報セッションから main-012 への質問。
- a-main-013 → 014 引き継ぎで伝達遅延
- 12 → 013 → 014 の世代経由で 5/8 12:33 に発見

### 1-2. 状況の進展（5/7 17:37 → 5/8 12:33）

- 後道さん 5/8 デモ → 5/14-16 延期決定
- a-forest-002 Phase 1 min 着手中（B-min 1.6d）
- Forest UI 整備（claude.ai 起草版 → 015_Gardenシリーズ/000_GardenUI_forest/）は未着手

### 1-3. 私の判断（A 案 + 部分的 B 案折衷推奨）

- Bud v2 で A 案ワークフローは Garden 標準として確立
- C 案（Next.js 化）不要（Forest は既に Next.js 稼働中）
- B 案は a-forest-002 が並行実装中、UI 試作と直接干渉しない
- Chat 側主導で先行可能、a-forest-002 は B-min 完成後の Phase A 残で対応

---

## 2. dispatch counter

- a-main-014: main- No. 116 → 次は **117**

---

## 3. 関連 dispatch

| dispatch | 状態 |
|---|---|
| report- No. 12（5/7 17:37、main-012 宛、Forest 進め方相談）| ⚠️ 遅延発見、本書で回答 |
| **main- No. 116（本書、A 案 + 部分的 B 案折衷推奨）** | 🟢 投下中 |
