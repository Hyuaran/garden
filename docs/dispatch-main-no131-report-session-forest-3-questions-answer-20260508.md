# dispatch main- No. 131 — 作業日報セッション（Forest v2 着手前 3 件回答 + 並行進行 GO）

> 起草: a-main-014
> 用途: report- No. 14 受領 + 構造分割 / データ層 / CSS プレフィックス 3 件回答
> 番号: main- No. 131
> 起草時刻: 2026-05-08(金) 13:21

---

## 投下用短文（東海林さんが 作業日報セッション にコピペ）

~~~
🟢 main- No. 131
【a-main-014 から 作業日報セッション への dispatch（Forest v2 着手前 3 件回答 + 並行進行 GO）】
発信日時: 2026-05-08(金) 13:21

report- No. 14 受領、Forest v1 精読 + 3 件確認 ありがとうございます。
構造分割 / データ層 / CSS プレフィックス 3 件すべて回答 + 並行進行 GO です。

詳細は以下ファイル参照:
[docs/dispatch-main-no131-report-session-forest-3-questions-answer-20260508.md](docs/dispatch-main-no131-report-session-forest-3-questions-answer-20260508.md)

## 質問 1 回答: 構造分割 → **B 案（Bud 同様の複数 HTML 分割）採用**

| 案 | 採否 | 理由 |
|---|---|---|
| A | 単一 HTML 内タブ化 | ❌ Bud v2 統一ワークフロー / デザイン一貫性に劣る |
| **B** | **Bud 同様の複数 HTML 分割（タブごとに HTML ファイル）** | ✅ **採用** |
| C | 中間案（メイン HTML + 重い機能のみ別 HTML）| ❌ 中途半端 |

### B 案採用理由

- 東海林さん指示「Bud と同じようにして背景画像の変化で差別化」= 字義通り B 案
- Bud v2 = 10 画面分割の precedent 確立済、Forest は 6 タブで負担少ない
- 各タブ専用の背景画像差別化が明確（森 / 納税 / 税理士連携 / 決算書 / マクロ / ミクロ）
- a-forest-002 が Phase 1 min（仕訳帳 12 口座統合）並行実装中、UI 側は B 案で統一

### Forest v2 タブ構成（推奨、6 タブ）

| # | タブ | ファイル名（推奨）| 背景画像（案）|
|---|---|---|---|
| 1 | グループサマリー | `chat-ui-forest-summary-v2-20260508.html` | 樹冠俯瞰（森全体）|
| 2 | 納税カレンダー | `chat-ui-forest-tax-v2-20260508.html` | 季節の樹木（春夏秋冬）|
| 3 | 税理士連携データ | `chat-ui-forest-cpa-v2-20260508.html` | 落ち葉 / 木陰 |
| 4 | 決算書 ZIP | `chat-ui-forest-archive-v2-20260508.html` | 古木の年輪 |
| 5 | グループ全体合算利益推移（マクロ）| `chat-ui-forest-macro-v2-20260508.html` | 森全体の俯瞰（マクロ）|
| 6 | 6 法人決算ワンビュー（ミクロ）| `chat-ui-forest-micro-v2-20260508.html` | 個別の樹（ミクロ）|

### パス参照: **35 箇所相当の構造に変更**

- Bud v2 precedent 踏襲（35 パス参照ルール、月曜始まりカレンダー / tabular-nums / プレフィックス分離 等）
- 各タブ HTML 内で他タブへのリンク参照を整備

## 質問 2 回答: データ層

### 2-1. Garden Root 集約: **未確定**（spec 起草必要、5/9 以降）

- a-root-002 が認証統一 plan 1429 行起草中（5/9 朝着手）
- 5/10 集約役で root_module_design_status migration（7 モジュール .md 集約）
- **法人マスタ + 決算実績の集約 spec は未起草** = a-root-002 と連携して 5/9-13 で起草必要
- Forest 関連テーブル（kessan_kakutei / tax_schedule 等）は **未実装**

### 2-2. Forest からの参照方法: **DB 直接参照（Supabase Client）+ SSR（Next.js）**

| 方式 | 採否 | 理由 |
|---|---|---|
| **DB 直接参照（Supabase Client）+ SSR** | ✅ **採用** | Forest は既に Next.js 稼働中、Supabase Client で SELECT、REST API 不要 |
| REST API（/api/garden-root/kessan?company=hyuaran）| ❌ | 中間層追加で複雑化、Garden 内なら DB 直接で十分 |
| 静的 JSON ファイル経由 | ❌ | 決算データは更新頻度高、ビルド時固定不適 |
| SSR（Next.js）/ ビルド時データ取込 | △ | SSR は採用、ビルド時取込は不採用（更新頻度の問題）|

### 2-3. Chat 側試作段階のデータ扱い: **ダミーデータで起こす**

| 方式 | 採否 |
|---|---|
| 実データを HTML に埋め込んだまま試作 → Code 側で Root 連携に置換 | ❌ Bud v2 precedent と異なる、機密データ含む可能性 |
| **Chat 側からはダミーデータで起こす → Code 側が Root 連携実装** | ✅ **採用**（Bud v2 precedent 踏襲）|
| Root が未整備なら、v2 では現状の埋め込みデータ維持 | ❌ 試作段階の汚染、機密データ暴露リスク |

→ Chat 側は **ダミーデータ**（例: 「ヒュアラン株式会社」→「サンプル法人 A」、決算金額もダミー）で v2 起草、Code 側で a-root-002 と連携してダミー → 実データ置換。

## 質問 3 回答: CSS プレフィックス → **C 案（機能別プレフィックス）採用**

| 案 | 採否 | 理由 |
|---|---|---|
| A | 全 150 セレクタに gf- プレフィックス追加 | ❌ 機能識別不能、リファクタ規模大 |
| B | 既存維持 + 新規追加分のみ | ❌ 統一感欠如、同居時 conflict リスク |
| **C** | **機能別プレフィックス（gf-tax-, gf-dl-, gf-summary- 等）** | ✅ **採用** |

### Forest プレフィックス命名（推奨）

| タブ | プレフィックス |
|---|---|
| グループサマリー | `gf-summary-` |
| 納税カレンダー | `gf-tax-` |
| 税理士連携データ | `gf-cpa-` |
| 決算書 ZIP | `gf-archive-` |
| マクロビュー | `gf-macro-` |
| ミクロビュー | `gf-micro-` |
| 共通基盤 | `gf-base-`（ヘッダー / ナビ / フッター 等）|

### 3-1. Code 側 CSS 設計方針

- **グローバル CSS**（素の CSS、Bud v2 precedent 踏襲）
- Tailwind / CSS Modules / styled-components は不採用（HTML 試作との往復が複雑化）
- 各タブ HTML に `<style>` ブロック直書き、Code 側 Next.js で globals.css に統合

### 3-2. Garden 全体（Bud/Bloom/Forest）が将来同一ページに同居する可能性

- ✅ **あり**（5/14-16 デモで Garden Series 統一 home + 各モジュール画面）
- → プレフィックス必須、conflict 防止

### 3-3. a-forest-002 が Phase 1 min で採用予定の命名規則

- **未統一**（Phase 1 min は仕訳帳 12 口座統合の機能実装中心、CSS は既存 Forest スタイル継続）
- Chat 側 v2 試作で C 案採用 → Code 側で a-forest-002 が C 案に追従する形（Bud v2 precedent 通り）

### 3-4. Chat 側試作で従うプレフィックス方針: **C 案**

- 既存 `.section` `.summary-grid` 等は段階的に置換（v2 では `gf-summary-section` `gf-summary-grid` 等）
- 新規追加は必ず `gf-XXX-` プレフィックス
- 共通要素は `gf-base-`

## 並行進行 GO（Chat 側で即着手 OK）

質問 1-3 回答後、並行で以下を着手 OK:

| # | 作業 | 工数 |
|---|---|---|
| 1 | v1 の CSS / HTML 構造のリファクタ準備（タブ化基盤の HTML 雛形）| 0.2d |
| 2 | Bud v2 統一デザイントークン抽出（Forest 適用版）| 0.1d |
| 3 | 背景画像差別化の方針確認（Forest = 森・樹冠の表現、ChatGPT 投下用テキスト準備）| 0.2d |
| 4 | 6 タブの v2 起草（5/8 中に 1-2 タブ完成、優先順位は推奨表示順 1-3）| 0.3-0.5d |

## ChatGPT 連携（§20 適用）

背景画像生成は ChatGPT 担当（東海林さん + ChatGPT）:

```
【ChatGPT に投下するテキスト】
（背景画像生成プロンプト本文）

---

【東海林さんへ - コピーテキスト外】
このテキストを ChatGPT に投下する際、以下のファイルを添付してください:
- chat-ui-bud-summary-v2-20260507.html（参考: Bud v2 のデザイントーン）
- 既存 garden-forest_v9.html の該当セクション（参考: Forest 既存スタイル）
```

→ 作業日報セッションが ChatGPT 投下用テキストを生成する際、**添付指示はコピーテキスト外で東海林さんへ明示**（CLAUDE.md §20-3 厳守）。

## 5/8 期待アウトプット

- 1-2 タブの v2 完成（claude.ai 起草版、Bud v2 ルール踏襲、C 案プレフィックス、ダミーデータ）
- _chat_workspace/garden-forest/ui_drafts/ に配置
- 進捗報告 dispatch（report- No. 15）

## 5/9-12 タイムライン

| 日 | アクション |
|---|---|
| **5/8 残時間** | 1-2 タブ v2 完成（質問 1 推奨表示順 1-3 から優先）|
| 5/9 | 残 4-5 タブ v2 完成 + a-root-002 連携 spec 起草着手 |
| 5/10 | a-root-002 集約役 + Forest 用 root テーブル spec 起草 |
| 5/11-12 | Code 側で v2 → Next.js コンポーネント化（a-forest-002 が整理移送）|
| 5/13 | 統合テスト |
| 5/14-16 | 後道さんデモ（Forest UI も組込候補）|

## 関連 docs

- demo-rehearsal-garden-20260514-16.md（5/14-16 デモリハ）
- main- No. 122（Forest v1 発見回答）
- garden-forest_v9.html（Drive `015_Gardenシリーズ/08_Garden-Forest/`）
- a-forest-002 進行状況（Phase B-min #4 弥生 CSV パーサー完成、#2 4 月仕訳化 着手中）

回答後、即着手お願いします。判断保留即上げ歓迎です。
~~~

---

## 1. 背景

### 1-1. report- No. 14 受領（13:12）

作業日報セッションから:
- ✅ Forest v1（garden-forest_v9.html、81.3KB）受領 + 精読完了
- 質問 1: 構造分割（A/B/C 案）
- 質問 2: 実データのミラー方式（Root 集約 / 参照方法 / 試作段階のデータ扱い）
- 質問 3: CSS プレフィックス（A/B/C 案）

### 1-2. 私の判断

- 質問 1: B 案（Bud 同様の複数 HTML 分割、6 タブ）
- 質問 2: DB 直接参照 + SSR、Chat 側はダミーデータ
- 質問 3: C 案（機能別プレフィックス、gf-XXX-）
- ChatGPT 連携は §20-3 厳守（添付指示はコピーテキスト外）

---

## 2. dispatch counter

- a-main-014: main- No. 131 → 次は **132**

---

## 3. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 116（A 案 + 部分的 B 案折衷推奨）| ✅ 投下済 |
| main- No. 122（Forest v1 発見回答）| ✅ 投下済 |
| report- No. 14（Forest v2 着手前 3 件確認）| ✅ → 本書で回答 |
| **main- No. 131（本書、3 件回答 + 並行進行 GO）** | 🟢 投下中 |
