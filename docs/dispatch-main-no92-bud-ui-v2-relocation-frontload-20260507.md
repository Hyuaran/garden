# dispatch main- No. 92 — a-bud 通知（Bud UI v2 整理移送 a-bud 自走 + 5/8 午後前倒し OK）

> 起草: a-main-013
> 用途: a-bud へ「Bud UI v2 整理移送タスクを a-bud 自走で / 5/8 午後 D-05 完走後 着手 GO（5/9 並走 → 5/8 午後 前倒し）」
> 番号: main- No. 92
> 起草時刻: 2026-05-07(木) 18:59

---

## 投下用短文（東海林さんが a-bud にコピペ）

~~~
🟢 main- No. 92
【a-main-013 から a-bud への dispatch（Bud UI v2 整理移送 a-bud 自走 + 5/8 午後前倒し GO）】
発信日時: 2026-05-07(木) 18:59

bud-4 §残課題ロードマップで「5/9 から Bud UI v2 整理移送 並走」と提示済 → 東海林さん指示で **5/8 午後 D-05 完走後への前倒し** + **a-bud 自走（a-forest 案から変更）**で確定です。

詳細は以下ファイル参照:
[docs/dispatch-main-no92-bud-ui-v2-relocation-frontload-20260507.md](docs/dispatch-main-no92-bud-ui-v2-relocation-frontload-20260507.md)

## 確定方針

| # | 項目 | 内容 |
|---|---|---|
| 1 | 担当 | **a-bud 自走**（handoff §3 当初 a-forest 案から変更）|
| 2 | タイミング | **5/8 午後 D-05 完走後**（5/9 並走 → 5/8 午後 前倒し）|
| 3 | 整理移送先 | `015_Gardenシリーズ\` 配下（report- No. 11 既定通り）|

## Bud UI v2 残作業 3 件（report- No. 11 §次の依頼事項）

| # | タスク | 工数 |
|---|---|---|
| ① | v2 ファイル群の `015_Gardenシリーズ\` 配下への整理移送 | 0.3d |
| ② | 整理移送後の v1 / v2 並存を /Bloom/CSS/JS パスで動作確認 | 0.2d |
| ③ | 必要に応じて `_chat_workspace\_archive_202605\` への移送 | 0.1d |
| 計 | | **0.6d** |

## 整理移送 対象ファイル（10 画面 v2、各 100-220 KB）

`_chat_workspace\garden-bud\ui_drafts\` 配下:
- chat-ui-bud-pl-fullscreen-v2-20260507.html（損益管理）
- chat-ui-bud-transfer-fullscreen-v2-20260507.html（振込管理）
- chat-ui-bud-bank-fullscreen-v2-20260507.html（銀行口座管理）
- chat-ui-bud-invoice-fullscreen-v2-20260507.html（請求書管理）
- chat-ui-bud-expense-fullscreen-v2-20260507.html（経費精算）
- chat-ui-bud-payroll-fullscreen-v2-20260507.html（給与管理）
- chat-ui-bud-shiwakechou-fullscreen-v2-20260507.html（仕訳帳）
- chat-ui-bud-audit-fullscreen-v2-20260507.html（監査ログ）
- chat-ui-bud-master-fullscreen-v2-20260507.html（マスタ管理）
- chat-ui-bud-settings-fullscreen-v2-20260507.html（設定）

## 5/8 タイムテーブル（更新案）

| 時間 | タスク |
|---|---|
| 5/8 朝（08:00-12:30）| **D-05 social insurance**（想定 1.0d → 圧縮目標 0.5d）|
| 5/8 午後（13:00-19:00）| **Bud UI v2 整理移送 ① + ② + ③ 完走**（0.6d）|
| 5/9 朝以降 | Day 3 D-02 salary calculation（1.5d、変更なし）|

## 旧コード保持ルール厳守（CLAUDE.md + memory `feedback_no_delete_keep_legacy.md`）

- `_chat_workspace\garden-bud\ui_drafts\` の v1 / v2 ファイルは **削除しない**
- ③ で `_chat_workspace\_archive_202605\` に移送する場合は **コピー + アーカイブ**（元ファイル削除なし、または move でも履歴保持）
- 015_Gardenシリーズ 配下に配置する v2 は新規コピー（_chat_workspace 元は残置）

## 動作確認 ②

整理移送後、Garden Bloom（or 各モジュール）の CSS / JS パスで参照される v1 / v2 が並存して動作することを確認:
- v1 の参照経路（既存の Bloom 画面等）
- v2 の参照経路（新配置先 015_Gardenシリーズ）
- 両方 200 OK + 表示崩れなし

## ガンガンモード継続

判断保留出たら即 bud-N で a-main-013 経由 → 東海林さん即回答 → 即継続。

完了報告は bud-N（次番号）で。
~~~

---

## 1. 背景

### 1-1. 東海林さん指摘（18:54）

> Garden Bud に関しては、UI を Claude.ai で本日の深夜に完成済みをあなたに報告してるし、それも進めたいよね

→ Bud UI v2 整理移送（report- No. 11 / 5/7 02:50 受領）も**ガンガンモードで前倒し対象**と確認。

### 1-2. 私の推奨（18:54-18:58）

| # | 推奨 | 理由 |
|---|---|---|
| 1 | a-bud 自走（a-forest 案から変更）| a-forest-002 が B-min + 認証統一で多忙、a-bud は Day 1 完走済 |
| 2 | 5/8 午後 D-05 完走後 着手 | Day 1 30 分実績 + D-05 0.5d 圧縮目標で午後余裕あり |
| 3 | 015_Gardenシリーズ 配下 | report- No. 11 既定通り |

### 1-3. 東海林さん判断（18:58）

> 推奨で OK

→ 全 3 件採用、main- No. 92 起草確定。

---

## 2. Bud UI v2 整理移送 詳細

### 2-1. 整理移送 ①（0.3d）

`_chat_workspace\garden-bud\ui_drafts\` の v2 全 10 ファイル → `015_Gardenシリーズ\` 配下に新規配置。

配置先パス（推定、a-bud 自走判断）:
- `015_Gardenシリーズ\Bud\ui_drafts\` or
- `015_Gardenシリーズ\Bud\v2\` or
- `015_Gardenシリーズ\modules\Bud\ui\`

a-bud が既存 `015_Gardenシリーズ\` 階層構造を確認 → 整合性ある配置先を自走判断。

### 2-2. 動作確認 ②（0.2d）

整理移送後、Garden Bloom（or 各モジュール）の CSS / JS パスで v1 / v2 並存動作確認:
- v1 参照経路（既存）
- v2 参照経路（新配置先）
- 両方 200 OK + 表示崩れなし
- Chrome MCP 視覚確認 推奨

### 2-3. アーカイブ移送 ③（0.1d、必要に応じて）

`_chat_workspace\garden-bud\ui_drafts\` を `_chat_workspace\_archive_202605\` 配下に移送 or コピー。

判断:
- v1 / v2 両方アーカイブ（_chat_workspace は ui_drafts 関連空に）
- v1 のみアーカイブ（v2 は ui_drafts に残置）
- 全部残置（_chat_workspace を残す）

→ a-bud 自走判断 OK（CLAUDE.md「コードリプレース時の旧版データ保持」厳守）。

---

## 3. 担当判断（a-bud vs a-forest）

### 3-1. handoff §3 当初案

> Q1: claude.ai 先行 UI（ChatGPT 連携可）→ a-forest 後追い実装

→ Bud UI 実装は a-forest 担当案だった。

### 3-2. 現実況での再判断

| 観点 | a-bud | a-forest |
|---|---|---|
| 現在のタスク量 | Day 1 完走、Day 2 D-05 軽量 | B-min 仕訳帳（5/9 朝完走想定）+ 認証統一（5/12）+ Forest v9 残機能（5/10-11）|
| Bud 全体把握 | ◎ Phase D 着手中 | △ Forest 中心 |
| UI 移送タスク量 | 0.6d | 0.6d |
| **総合判断** | **◎ a-bud 自走推奨** | △ |

### 3-3. handoff §3 案からの変更理由

- a-forest-002 のタスク量が想定より多い（B-min 5/8-9 + 認証統一 5/12 + Forest v9 5/10-11）
- a-bud が Day 1 30 分完走で余裕あり、UI 整理移送も自走可能
- 「a-forest 後追い実装」は post-デモで再検討（必要なら）

---

## 4. 5/8 a-bud タイムテーブル（更新案）

| 時間 | タスク | 工数 |
|---|---|---|
| 08:00-12:30 | **D-05 social insurance**（標準報酬月額・健保 / 厚年 / 介護 / 雇用、月変・算定基礎）| 想定 1.0d → 圧縮目標 0.5d |
| 13:00-15:00 | **Bud UI v2 整理移送 ①**（v2 ファイル群を 015_Gardenシリーズ 配下に）| 0.3d |
| 15:00-16:30 | **Bud UI v2 動作確認 ②**（v1 / v2 並存 OK 確認、Chrome MCP）| 0.2d |
| 16:30-17:00 | **Bud UI v2 アーカイブ移送 ③**（必要に応じて）| 0.1d |
| 17:00 | bud-N で完走報告 | — |
| 5/9 朝以降 | Day 3 D-02 salary calculation | 1.5d |

---

## 5. 関連 dispatch / 並行進行

| dispatch | 状態 |
|---|---|
| main- No. 91（4 セッション返答 / bud + bloom-004 + soil + leaf）| 投下準備済 |
| **main- No. 92（本書、Bud UI v2 整理移送 前倒し）** | 🟢 投下中 |

---

## 6. dispatch counter

- a-main-013: main- No. 92 → 次は **93**（counter 更新済）

---

ご確認・着手お願いします。判断保留事項あれば即停止 → a-main-013 経由で東海林さんに確認依頼。
