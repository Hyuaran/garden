# dispatch main- No. 306 / Bud Phase D-3/4/5 名称確定 + 並行起草継続指示

---

## 投下情報（先頭明示）

| 項目 | 値 |
|---|---|
| 投下先 | a-bud-002 |
| dispatch 番号 | main- No. 306 |
| 緊急度 | 🟡 中（待機モード解除 + 並行起草継続） |
| 発信日時 | 2026-05-11 18:50 |
| 種別 | 名称確定 + 作業優先度明示 + 次タスク指示 |
| 添付 | なし（spec docs/specs/ 配下で起草） |
| 関連ファイル | docs/specs/bud-phase-d-bank-spec.md / docs/specs/bud-phase-d-shiwakechou-spec.md（apply 完了後 起草開始） |
| 関連 dispatch | bud # 47-ack（確認事項 1 件への回答） |
| ACK 期限 | 19:00 まで（apply 進行中につき短め） |

---

~~~

# 【横断セッション(a-main)からの共有】to: a-bud-002

発信日時: 2026-05-11 18:50
発信元: a-main-023
dispatch 番号: main- No. 306
緊急度: 🟡 中

## A. bud # 47-ack 確認事項 回答

### 提示された 3 可能性への判定

| 可能性 | 内容 | 判定 |
|---|---|---|
| A | # 276 Bank 後続 = D-3 CSV 連動 / D-4 手入力 UI / D-5 Chatwork 通知 | ✅ 採択 |
| B | # 277 Shiwakechou 後続 = D-3 CSV→仕訳 / D-4 弥生 encoder / D-5 検索 UI | ✅ 採択 |
| C | 全く別 Phase | ❌ 不採用 |

### 採択方針

**可能性 A + B 両方を並行起草対象に確定**

= Bank 後続 3 件（CSV 連動 / 手入力 UI / Chatwork 通知）
+ Shiwakechou 後続 3 件（CSV→仕訳 / 弥生 encoder / 検索 UI）
を **同時並行で spec 詳細化** する。

### 採択理由

| # | 理由 | 補足 |
|---|---|---|
| 1 | Bank と Shiwakechou は独立、依存関係なし | 並行起草で衝突しない |
| 2 | Bud Phase D 13 件 apply 完了（5/11 19:30）後に即着手可能 | apply 直後の空白時間に詳細化を充てる |
| 3 | 5/13 仕訳帳本番運用後の改良タスクとして位置づけ | 本番フィードバック反映の余地を残す |
| 4 | critical path ② 残高 UI 完成（5/18 見込み）に組込み可能 | Bank 後続 D-3/D-4/D-5 が ② 範囲に含まれる |

---

## B. Phase D-3/4/5 名称確定

### Bank 系列（# 276 後続）

| Phase | 仮名 | 確定名 | 概要 |
|---|---|---|---|
| D-3a | CSV 連動 | bud-phase-d-bank-csv-import | 銀行 CSV 取込 → bank_transactions 反映 |
| D-4a | 手入力 UI | bud-phase-d-bank-manual-entry | 手動仕訳 UI、CSV で取れない取引補完 |
| D-5a | Chatwork 通知 | bud-phase-d-bank-chatwork-notify | 残高変動・大口入金時の通知 Bot 連動 |

### Shiwakechou 系列（# 277 後続）

| Phase | 仮名 | 確定名 | 概要 |
|---|---|---|---|
| D-3b | CSV→仕訳 | bud-phase-d-shiwake-csv-to-entry | CSV → 仕訳エントリ自動生成 |
| D-4b | 弥生 encoder | bud-phase-d-shiwake-yayoi-encoder | 弥生会計フォーマットへの出力変換 |
| D-5b | 検索 UI | bud-phase-d-shiwake-search-ui | 仕訳帳の高度検索 + フィルタ |

### 命名規則の確認

- D-3a / D-3b の suffix で Bank / Shiwakechou を区別
- spec ファイル名は `docs/specs/bud-phase-d-{bank|shiwake}-{topic}.md` 統一
- 既存の # 276 / # 277 の連番継承（# 278 = D-3a Bank CSV / # 279 = D-3b Shiwake CSV から開始想定）

---

## C. apply 中の作業優先度（5/11 18:40-19:30）

### 即時優先（apply 進行中の peripheral 対応）

| # | 種別 | 例 | 対応 |
|---|---|---|---|
| 1 | エラー解析 | migration 失敗 / SQL エラー / 型不一致 | 即停止 → 原因報告 → 東海林さん判断 |
| 2 | 検証 SQL | apply 後の row count / FK 整合性チェック | 即実行可、結果を bud # XX で報告 |
| 3 | migration 質問 | 順序・依存・rollback の確認 | 即回答、apply 続行 / 中断を東海林さんに提示 |

### 並行 OK（apply に影響しない作業）

| # | 作業 | 制約 |
|---|---|---|
| 1 | spec 詳細化（docs/specs/ 配下） | ファイル新規作成のみ、既存ファイル変更禁止 |
| 2 | 既存 spec 読み込み・参照 | Read のみ、編集禁止 |
| 3 | dispatch 文書起草 | docs/ 配下、apply 対象外パス |

### 待機モード継続（apply 完了まで NG）

| # | 作業 | 理由 |
|---|---|---|
| 1 | src/ 配下の実装変更 | apply 対象と衝突可能性 |
| 2 | supabase/migrations/ 編集 | 進行中の migration と競合 |
| 3 | テスト実行（npm test） | DB 状態が不安定 |
| 4 | git commit / push | apply 完了後にまとめて |

---

## D. apply 完了後（5/11 19:30）次タスク

### 次タスク = Bank + Shiwakechou 後続 spec 詳細化（並行起草）

| 順 | タスク | 担当 | 想定時間 |
|---|---|---|---|
| 1 | apply 完了確認（migration 全件成功 / row count 検証） | a-bud-002 | 15 分 |
| 2 | docs/specs/bud-phase-d-bank-csv-import.md 起草 | a-bud-002 | 60 分 |
| 3 | docs/specs/bud-phase-d-shiwake-csv-to-entry.md 起草 | a-bud-002（並行） | 60 分 |
| 4 | docs/specs/bud-phase-d-bank-manual-entry.md 起草 | a-bud-002 | 45 分 |
| 5 | docs/specs/bud-phase-d-shiwake-yayoi-encoder.md 起草 | a-bud-002（並行） | 45 分 |
| 6 | docs/specs/bud-phase-d-bank-chatwork-notify.md 起草 | a-bud-002 | 30 分 |
| 7 | docs/specs/bud-phase-d-shiwake-search-ui.md 起草 | a-bud-002（並行） | 30 分 |

### 並行起草の進め方

- Bank 系列（D-3a/4a/5a）と Shiwake 系列（D-3b/4b/5b）を **同一セッション内で交互に起草**
- 1 件 30-60 分を目安に区切り、commit & push を都度実施
- 起草完了時点で main 宛に「Bank D-3a spec 完成」「Shiwake D-3b spec 完成」と段階報告
- 5/12 23:59 までに 6 件全完成を目標（実働 4-5 時間想定）

### spec フォーマット（既存 # 276 / # 277 準拠）

| セクション | 内容 |
|---|---|
| 1. 目的 | Phase の達成ゴール |
| 2. スコープ | in / out of scope 明示 |
| 3. データモデル | 新規テーブル / 既存テーブル変更 |
| 4. API 設計 | endpoint / request / response |
| 5. UI 設計 | 画面遷移 / コンポーネント構成 |
| 6. テスト方針 | unit / integration / E2E |
| 7. 受入基準 | 完了判定の条件 |
| 8. 想定リスク | 実装上の懸念点 |
| 9. 見積 | 工数（時間 or 日）|

---

## E. 5/14 以降実装スケジュール（参考）

### 5/13 仕訳帳本番運用後 → 5/14 以降 改良タスク着手

| 日付 | 作業 | 担当 |
|---|---|---|
| 5/13 | 仕訳帳本番運用開始（# 277 Shiwakechou 適用） | a-bud-002 + 東海林さん |
| 5/13 終日 | 本番運用フィードバック収集 | 東海林さん |
| 5/14 AM | フィードバック反映 spec 微修正 | a-bud-002 |
| 5/14 PM | D-3a Bank CSV import 実装着手 | a-bud-002 |
| 5/15-17 | D-3a / D-3b / D-4a / D-4b 実装 | a-bud-002 |
| 5/18 | D-5a / D-5b 実装 + 統合テスト | a-bud-002 |
| 5/18 EOD | ② 残高 UI 完成判定 | 東海林さん |

### 注意

- 5/13 本番運用で重大バグが出た場合、5/14 のスケジュールは**全停止**して bugfix 最優先
- 上記は順調進行時の理想シナリオ、変動前提

---

## F. 1 週間 critical path ② への影響

### critical path ② = 残高 UI 完成（5/18 見込み）

| 影響要因 | 評価 | 補足 |
|---|---|---|
| Bank D-3a/4a/5a が ② に含まれる | ✅ 維持 | Bank 後続 3 件は ② 範囲内 |
| Shiwake D-3b/4b/5b は ② 範囲外 | - | ③ 仕訳改良として別 path |
| apply 5/11 19:30 完了見込み | ✅ オンタイム | 遅延なし |
| 5/13 本番運用フィードバック反映 1 日 | ✅ 想定内 | 5/14 AM に組込み |
| 並行起草 6 件 5/12 中完成 | ⚠️ 要監視 | 4-5 時間想定、半日確保必要 |

### ② 完成見込み = 5/18 維持

- Bank 後続 3 件（D-3a/4a/5a）が ② 範囲、Shiwake 系列は ③ で別管理
- 並行起草が 5/12 中に完成すれば 5/14 実装開始可能
- 5/18 までの 5 日間で Bank 3 件 + Shiwake 3 件の実装 → ② のみなら余裕、③ 込みなら tight

---

## G. ACK 形式

bud-002 から main へ ACK を以下フォーマットで返信:

| 項目 | 値 |
|---|---|
| ACK 番号 | bud # 48-ack（# 47-ack の次） |
| ACK 期限 | 2026-05-11 19:00 |
| ACK 内容 1 | Phase D-3/4/5 = 可能性 A + B 両方並行 採択 確認 |
| ACK 内容 2 | apply 中 peripheral 即時優先 / spec 起草 並行 OK の理解 |
| ACK 内容 3 | apply 完了後 6 件 spec 詳細化 開始予定 5/12 中完成目標 |
| ACK 内容 4 | 5/14 以降 実装スケジュール の理解 |
| ACK 内容 5 | ② 完成見込み 5/18 維持 への合意 |
| 質問・懸念 | あれば併記 |

---

## H. self-check

| # | 項目 | 結果 |
|---|---|---|
| 1 | 可能性 A + B 両方並行の採択理由 4 件明示 | ✅ |
| 2 | D-3/4/5 名称確定（suffix a/b で区別） | ✅ |
| 3 | apply 中の作業優先度 3 区分（即時/並行 OK/待機） | ✅ |
| 4 | apply 完了後 次タスク 7 ステップ明示 | ✅ |
| 5 | spec フォーマット 9 セクション明示 | ✅ |
| 6 | 5/14 以降実装スケジュール 表形式 | ✅ |
| 7 | critical path ② への影響 5 要因評価 | ✅ |
| 8 | ACK 形式 5 内容明示 | ✅ |
| 9 | dispatch v5 ヘッダー（投下先 / 番号 / 緊急度 先頭） | ✅ |
| 10 | コードブロック禁止、表形式中心 | ✅ |
| 11 | ~~~ ラップ | ✅ |
| 12 | 待機モード解除 + 次タスク明示 | ✅ |

---

以上、bud # 47-ack への回答 + Phase D-3/4/5 名称確定 + apply 中作業優先度 + 次タスク指示。

ACK を 19:00 までに bud # 48-ack で返信ください。
質問・懸念があれば併記、なければ「合意、5/12 中に 6 件 spec 起草開始」で OK。

~~~
