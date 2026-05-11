# dispatch main- No. 127 — 横断 broadcast（CLAUDE.md §20-23 追加 + 再読込推奨）

> 起草: a-main-014
> 用途: 全モジュールセッション宛 横断 broadcast、CLAUDE.md §20-23 追加告知 + 再読込推奨
> 番号: main- No. 127
> 起草時刻: 2026-05-08(金) 13:08

---

## 投下用短文（東海林さんが 全モジュールセッション + 自身に各 1 回コピペ）

宛先候補: a-soil / a-root-002 / a-tree（or a-tree-002）/ a-leaf-002 / a-bud / a-bloom-004 / a-forest-002 / a-rill / a-seed / a-auto-004 / a-review / b-main + 作業日報セッション

各セッションに同一短文を投下、`<セッション名>-N` で受領確認依頼（簡潔で OK）。

~~~
🟢 main- No. 127
【a-main-014 から 全モジュールセッション への 横断 broadcast（CLAUDE.md §20-23 追加 + 再読込推奨）】
発信日時: 2026-05-08(金) 13:08

CLAUDE.md に §20-23 を新規追加しました（東海林さん承認済、43 箇所一括反映完了）。
全セッションで再読込推奨です。

詳細は以下ファイル参照（git fetch --all 後に閲覧可能）:
[docs/dispatch-main-no127-cross-modules-claude-md-update-broadcast-20260508.md](docs/dispatch-main-no127-cross-modules-claude-md-update-broadcast-20260508.md)

## 追加された §20-23

| § | 内容 | 主要要点 |
|---|---|---|
| §20 | Claude 使用環境 + ChatGPT 連携 | Claude.ai = HTML/UI 起草 + ChatGPT 投下用テキスト発行、ChatGPT = 画像生成、添付指示はコピーテキスト外で東海林さんへ明示 |
| §21 | **通常モード = 旧ガンガン常態モード**（デフォルト）| 解除のみ東海林さん声かけ時、別概念導入なしでルール簡素化 |
| §22 | コンテキスト超過アラート + 引っ越し基準 | **a-main 50-60% / モジュール 60-70% / 80% 最終** + §22-7 RTK 削減集計報告必須 |
| §23 | メモリー main 判断ルール | **main のみ memory 更新権限**、モジュールは参照のみ、main 引っ越し時にクリーンアップ |

## モジュールセッションへの影響（要点）

### A. memory 書込権限変更（§23）

- これまで: 各セッションが学びを memory ファイルに直接編集する場合あり
- これから: **モジュールセッションは memory 参照のみ**、書込は禁止
- 学び・改善提案は **dispatch で a-main-014 に上げる** → main + 東海林さんが採用判断 → main が memory 更新

### B. 引っ越し基準変更（§22）

- これまで: 80% 警戒ライン中心
- これから: **モジュールセッションは 60% 引っ越し準備、70% 引っ越し実行**
- 引っ越し時に `rtk gain` 結果を main に dispatch 報告（§22-7）
- 80% は最終ライン、強制終了直前のバックアップ用

### C. 通常モード = デフォルト（§21）

- これまで: 「ガンガン常態モード」を別概念として明示
- これから: **通常モード = デフォルト動作**、解除のみ東海林さん声かけ時
- メモリー / dispatch / handoff の「ガンガン」表現は徐々に「通常モード」に統一（後追い、main 引っ越し時にクリーンアップ）

### D. ChatGPT 連携（§20）

- 主に作業日報セッション / Claude.ai 関連
- ChatGPT 投下用テキストを起草する際、添付指示は **コピーテキスト外** で東海林さんへ明示

## 各セッション 受領アクション

1. `git fetch --all` 後、CLAUDE.md を再読込（変更を認識）
2. 受領確認 dispatch（`<セッション名>-N` 形式、判定:適用済 / 質問あり 等）
3. 通常モード継続（解除指示なければデフォルト）

## 関連 docs

- [docs/claude-md-additions-20260508-v2.md](docs/claude-md-additions-20260508-v2.md) — 追加版 v2（東海林さん承認版）
- [docs/rtk-cumulative-tracking.md](docs/rtk-cumulative-tracking.md) — RTK 累計トラッキングファイル（5/7 baseline 記録済）
- [docs/scripts/claude-md-additions-apply-20260508.py](docs/scripts/claude-md-additions-apply-20260508.py) — 一括反映スクリプト

## 報告フォーマット（簡潔）

~~~
🟢 <セッション名>-N
【<セッション名> から a-main-014 への CLAUDE.md §20-23 受領確認】
発信日時: YYYY-MM-DD(曜) HH:MM

- §20-23 再読込: ✅ 完了
- §22 引っ越し基準: 60-70% で対応了解
- §23 memory 書込禁止: 了解、今後は dispatch 経由で main に提案
- 通常モード: 継続中

判断保留 / 質問: なし or [内容]
~~~

## 制約遵守（再掲）

- 動作変更なし（CLAUDE.md ルール変更のみ）
- 新規 npm install 禁止
- ガンガン → 通常モードの表記変更は徐々に（既存 dispatch / memory への即時反映は不要、main 引っ越し時にクリーンアップ）

ご確認お願いします。判断保留即上げ歓迎です。
~~~

---

## 1. 背景

### 1-1. 5/8 朝 東海林さんからの新ルール 4 件

東海林さん指示（5/8 12:50-13:05、a-main-014 chat）:
- Claude.ai vs ChatGPT 役割分担明確化（添付指示外出し）
- ガンガン = 通常モードでデフォルト化
- メモリー main 判断（重複防止 + 東海林さん時間削減）
- main 引っ越し 50-60% / モジュール 60-70% の 3 段階基準
- 引っ越し時 RTK 集計報告必須（main へ累計集約）

### 1-2. 反映実施

- §20-23 v2 起草（[docs/claude-md-additions-20260508-v2.md](docs/claude-md-additions-20260508-v2.md)）
- 東海林さん「OK進めて」承認
- 一括反映スクリプト（[docs/scripts/claude-md-additions-apply-20260508.py](docs/scripts/claude-md-additions-apply-20260508.py)）で 43 箇所更新

---

## 2. 配布対象セッション

| セッション | 配布優先度 | 想定状態 |
|---|---|---|
| a-bud | ⭐ 高（本日 D-12 着手中）| memory 書込制約変更影響 |
| a-soil | ⭐ 高（本日 admin UI 着手中）| 同上 |
| a-leaf-002 | ⭐ 高（本日 8 PR conflict 解消中）| 同上 |
| a-bloom-004 | ⭐ 高（本日 PowerShell 代行待ち）| 同上 |
| a-forest-002 | ⭐ 高（本日 #2 4 月仕訳化 着手中）| 同上 |
| a-tree（or a-tree-002）| 🟢 中 | tree-17 待機中 |
| a-root-002 | 🟢 中（本日 5/8 タイムテーブル進行中）| 同上 |
| a-rill / a-seed | 🟡 低（休眠中）| 次回起動時 |
| a-auto-004 | 🟢 中（休眠中）| 次回発動時 |
| a-review | 🟢 中 | レビュー時 |
| b-main | 🟡 低（バックアップ）| 次回起動時 |
| 作業日報セッション | ⭐ 高（§20 ChatGPT 連携 直接影響）| Forest UI 試作着手前に必読 |

---

## 3. dispatch counter

- a-main-014: main- No. 127 → 次は **128**

---

## 4. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 111（RTK 横断 broadcast）| ✅ 5/7 投下済（9/9 応答完了）|
| main- No. 122（report- No. 13 回答、Forest v1 発見）| ✅ 5/8 投下済 |
| **main- No. 127（本書、CLAUDE.md §20-23 追加 broadcast）** | 🟢 投下中 |

---

## 5. 想定される返信パターン

| 返信 | 対応 |
|---|---|
| ✅ 受領 + 適用済 | カウント、横断サマリ更新 |
| 🟡 質問あり | 個別 dispatch で回答 |
| ❌ 異論あり | a-main-014 + 東海林さんで議論、必要なら CLAUDE.md 改訂 |

全セッション返信揃ったら、横断サマリを別 dispatch で報告。
