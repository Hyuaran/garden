# Garden シリーズ 6ヶ月リリースロードマップ - 2026-04-24

- 作成元セッション: **a-auto**（自律実行モード / 集中別作業中・90分枠）
- 作業ブランチ: `feature/garden-roadmap-20260424-auto`（`main` から派生、コード変更ゼロ）
- 目的: 9モジュールの実装状況を棚卸しし、§18「Garden 構築優先順位」（Phase A→D）に沿った6ヶ月（MAX 8ヶ月）実行計画を提示
- 前提:
  - 各モジュールの子 CLAUDE.md（`G:/.../015_Gardenシリーズ/XX_Garden-XXX/CLAUDE.md`）
  - `C:/garden/a-<module>/src/app/<module>/` 配下の実装
  - 親 CLAUDE.md §15（並列自律提案）/ §16（7種バグ確認テスト）/ §17（Tree 特例 1→2-3→半数→全員）/ §18（構築優先順位）
  - `docs/effort-tracking.md`（Forest Phase A1/A2/A3 完了実績）
  - `docs/forest-v9-to-tsx-migration-plan.md`（本日 a-auto が生成）

---

## セクション 1: 各モジュール現状評価

### 1.1 Garden-Soil（土）— DB本体・大量データ基盤

| 項目 | 状態 |
|---|---|
| ステータス | **未構築**（`src/app/soil/` は 0 ファイル） |
| 実装済機能 | なし |
| 未実装機能 | リスト253万件 / コール履歴335万件 / 関電リストの `soil_*` テーブル群、tsvector/GIN検索、RLS統一管理 |
| 残工数見積 | **6.0〜8.0d**（大規模データ分割 + インデックス設計 + RLS設計 + 初期投入バッチ） |
| 技術負債 | なし（未着手） |
| 依存関係 | Root（法人・従業員・取引先マスタ参照）、Leaf（`soil_kanden_cases` 既存）がクエリ元 |

### 1.2 Garden-Root（根）— マスタデータ

| 項目 | 状態 |
|---|---|
| ステータス | **Phase A 認証 構築中** |
| 実装済機能 | login, layout, RootGate, RootShell, SessionWarningModal, UserHeader, 画面7本（companies / employees / vendors / bank-accounts / insurance / salary-systems / attendance）、`_lib/{auth,audit,queries,session-timer}`、`_state/RootStateContext` |
| 未実装機能 | **KoT API 連携画面**、**MF電子契約連携画面**、**garden_role 管理画面**（super_admin）、新入社員追加UI（Tree 側と共同）、`root_audit_log` の本番運用整備、誕生日の本人入力フロー完了確認 |
| 残工数見積 | **5.0〜7.0d**（KoT連携 2.0d / MF連携 1.5d / role管理 1.0d / 監査ログ整備 0.5d / Bud統合テスト 1.0d） |
| 技術負債 | 未調査（a-root のレビューは未実施。A相 Phase A1 要整備） |
| 依存関係 | **全モジュールの参照元**。Bud 給与・Tree 認証・Forest 法人統合の基盤 |

### 1.3 Garden-Tree（木）— 架電アプリ

| 項目 | 状態 |
|---|---|
| ステータス | **Phase B-β 完了**（初回ログイン時の誕生日入力 + Auth パスワード MMDD 自動同期） |
| 実装済機能 | login, birthday, dashboard, layout, TreeAuthGate, TreeShell, ProspectList, SidebarNav, 画面20本超（aporan, break-schedule, breeze, call, calling/{branch,sprout}, chatwork, confirm-wait, feedback, feedback/list, follow-call, monitoring, mypage, qa, ranking, scripts, search, toss-wait, videos, wrap-up）、`_lib/{auth,queries,format,supabase}`、KPIヘッダー・半円ゲージ・達成演出 |
| 未実装機能 | **バイナリーポイント**、**アポラン6ヶ月保管**、**提供エリア自動判定**、**日付4形式入力**、**メニューバー2階層化**、**新入社員追加UI**（staff+ が Root へ INSERT）、KoT API リアルタイム同期、通知センター本実装、スクリプト管理本実装 |
| 残工数見積 | **10.0〜14.0d**（社長・槙フィードバック 5件 約 5〜7d、新アカウント追加UI 1.5d、KoT 同期 2.0d、通知/スクリプト 2.0d、7種テスト＋3段階展開 2.5d） |
| 技術負債 | 今日のレビュー（`feature/tree-review-20260424-auto` / `1a1c806`）で 🔴2 / 🟡7 / 🟢3 指摘（インラインstyle 多用、誕生日同期の部分成功復帰欠如、誕生日PW同期仕様の未文書化、`breeze/page (1).tsx` 残留、useEffect 依存の曖昧化） |
| 依存関係 | Root（認証・garden_role）、Soil（コール履歴 335 万件）、Bud（給与明細閲覧）、Rill（通知） |

### 1.4 Garden-Leaf（葉）— 商材×商流個別アプリ

| 項目 | 状態 |
|---|---|
| ステータス | **001_関西電力業務委託 Phase C 進行中**（事務UI v7 / 入力UI v10 HTML プロトタイプあり） |
| 実装済機能 | login, layout, page, backoffice/page.tsx（StatusBadge/StatusFlow/StatusAdvanceBar/SupplyInline/NewCaseModal）、`_lib/{auth,calendar,queries,supabase,types,session-timer}` |
| 未実装機能 | **8 ステータスフロー本実装**（受注→完了）、**諸元待ち後付け添付**、**供給開始予定日カレンダー管理**、**至急SW（S5等）検出**（OCR検討中）、**撮影画像 3 階層保管**（3ヶ月/12ヶ月/24ヶ月、1500px/JPEG85）、**5種添付書類管理**（電灯/動力/ガス/諸元/受領書）、事務入力画面 FileMaker風検索、画面5分固定自動ロック、Prodelight リスト連携（アラート+月次Excel）、**他商材（光回線・クレカ等 約30テーブル）は未着手** |
| 残工数見積 | 001_関電のみ **8.0〜12.0d** / 他 30 商材合計 **15.0〜25.0d** |
| 技術負債 | 未調査。HTML/JSX プロトタイプから TSX への移植差分分析が未着手 |
| 依存関係 | Root（従業員・取引先）、Soil（`soil_kanden_cases`）、Bud（支払実行連動） |

### 1.5 Garden-Bud（蕾）— 経理・収支

| 項目 | 状態 |
|---|---|
| ステータス | **Phase 1b.2 Task 5/13 完了** |
| 実装済機能 | login, dashboard, layout, BudGate, BudShell, transfers（一覧 + FilterBar + StatusBadge + MonthlySummary + transfer-form-schema）、`_lib/{auth,queries,supabase,duplicate-key,transfer-id,transfer-queries,transfer-mutations,transfer-status}`、**4種のユニットテスト整備**（v2 RLS ポリシー 6段階遷移対応） |
| 未実装機能 | **振込新規作成画面**（new-regular / new-cashback のリンクはある、実体は未確認）、**振込詳細・編集・承認画面**、**明細管理**（入出金記録・銀行データ取込・振込照合）、**給与処理**（勤怠取込・計算・承認・振込連携・明細配信）、**手渡し現金支給**（未決事項）、CC明細処理、給与内外注費リクラス |
| 残工数見積 | 振込残 **3.0〜5.0d** / 明細管理 **4.0〜6.0d** / 給与処理 **8.0〜12.0d** |
| 技術負債 | 今日のレビュー（`feature/bud-review-20260424-auto` / `b371ed5`）で 🔴3 / 🟡8 / 🟢2 指摘（BudGate 非リアクティブ、送金エラー role=alert 欠落、6段階遷移仕様書不在、FilterBar 二重発火、limit 200 ハードコード、会社マスタエラー握り潰し） |
| 依存関係 | **Root**（7マスタすべて）、Forest（決算連携）、Tree（明細閲覧） |

### 1.6 Garden-Bloom（花）— 日報・KPI・案件一覧

| 項目 | 状態 |
|---|---|
| ステータス | **未構築**（`src/app/bloom/` は 0 ファイル） |
| 実装済機能 | なし |
| 未実装機能 | 案件一覧（横断VIEW）、日報作成・提出、KPI集計、営業損益（社内用）、ダッシュボード |
| 残工数見積 | **8.0〜12.0d**（Forest の設計思想を踏襲できるため雛形 4.0d、KPI集計ロジック 2.0d、日報画面 2.0d、案件一覧VIEW 2.0d、損益 2.0d） |
| 技術負債 | なし |
| 依存関係 | Root / Tree / Leaf / Bud すべて参照 |

### 1.7 Garden-Forest（森）— 決算ダッシュボード

| 項目 | 状態 |
|---|---|
| ステータス | **本番稼働中**（Phase A1/A2/A3 完了、v9 機能移植 Phase 1-4 残） |
| 実装済機能 | login, dashboard, layout, ForestGate, ForestShell, SummaryCards, MacroChart, MicroGrid, DetailModal（基本6項目）、ShinkoukiEditModal, PdfUploader, NumberUpdateForm, PeriodRolloverForm, AccessDenied, `_lib/{auth,audit,format,mutations,permissions,queries,session-timer,supabase,types}` |
| 未実装機能（v9 差分） | **Tax Calendar**（納税カレンダー）、**Tax Files**（税理士連携、Supabase Storage 要）、**Download Section**（決算書 ZIP 生成）、**Tax Detail Modal**、**HANKANHI 販管費内訳**（Detail Modal 拡張）、**Info Tooltip**。詳細: [`docs/forest-v9-to-tsx-migration-plan.md`](forest-v9-to-tsx-migration-plan.md) |
| 残工数見積 | 最小構成 **4.75d**（v9 相当）、フル **9.25〜10.25d**（Storage+ZIP まで含む） |
| 技術負債 | v9 と TSX の細部差分（ForestShell / MicroGrid / SummaryCards / MacroChart の挙動整合性）は未調査 |
| 依存関係 | Root（6法人マスタ統合、`root_companies`）、Bud（会計連携） |

### 1.8 Garden-Rill（川）— Chatwork メッセージアプリ

| 項目 | 状態 |
|---|---|
| ステータス | **未構築**（`src/app/rill/` は 0 ファイル） |
| 実装済機能 | なし |
| 未実装機能 | Chatwork API 連携（送受信）、各モジュール通知ルーティング、検索、テンプレート、レート制限対応 |
| 残工数見積 | **5.0〜8.0d**（API仕様調査 0.5d、認証/接続 1.0d、送信 1.5d、受信/同期 2.0d、ルーティング 1.5d、検索 1.5d） |
| 技術負債 | なし |
| 依存関係 | Root（送信先特定）、各モジュール（通知イベント発生源） |

### 1.9 Garden-Seed（種）— 新商材・新事業枠

| 項目 | 状態 |
|---|---|
| ステータス | **未構築 / 予約的枠** |
| 実装済機能 | なし |
| 未実装機能 | 用途未確定。着手時に CLAUDE.md 書き直しの方針 |
| 残工数見積 | **1.0〜2.0d**（初期スキャフォールド + PoC テンプレート化） |
| 技術負債 | なし |
| 依存関係 | 着手時点で定義 |

### 1.10 全モジュール サマリ

| モジュール | ステータス | 残工数（下限〜上限） |
|---|---|---|
| Soil | 未構築 | 6.0 〜 8.0 d |
| Root | Phase A 認証構築中 | 5.0 〜 7.0 d |
| Tree | Phase B-β 完了 | 10.0 〜 14.0 d |
| Leaf（関電のみ） | Phase C 進行中 | 8.0 〜 12.0 d |
| Leaf（他商材） | 未着手 | 15.0 〜 25.0 d |
| Bud | Phase 1b.2 進行中 | 15.0 〜 23.0 d（振込+明細+給与） |
| Bloom | 未構築 | 8.0 〜 12.0 d |
| Forest | 本番稼働 + v9 移植残 | 4.75 〜 10.25 d |
| Rill | 未構築 | 5.0 〜 8.0 d |
| Seed | 予約枠 | 1.0 〜 2.0 d |
| **合計** | — | **77.75 〜 121.25 d**（= 約 **4ヶ月〜6ヶ月** 相当。1ヶ月=20稼働日換算） |

---

## セクション 2: 6ヶ月ロードマップ（Phase A→D）

### 2.1 全体タイムライン

| 月 | ラベル | Phase | 主要目標 |
|---|---|---|---|
| M1 | 2026-05 | A-1 | Bud 振込完走・Forest v9 Phase 1 / 2 / 4 / 5 着手・Root 7マスタ統合 |
| M2 | 2026-06 | A-2 | Bud α版開始・Forest v9 フル（P3/P4.5）・Root KoT/MF 連携 |
| M3 | 2026-07 | B-1 | Leaf 001_関電 Phase C 完走 α版・Bud 給与 Phase 0 |
| M4 | 2026-08 | B-2 | Leaf 関電 β（3-5名）・Bud 給与 α版 |
| M5 | 2026-09 | C-1 | Soil 構築開始・Bloom 雛形・Rill API 連携 |
| M6 | 2026-10 | C-2 | Soil コール履歴移行・Bloom 画面着地・Leaf 他商材スケルトン |
| M7 | 2026-11 | D-1 | Tree §16 7種テスト完走・α版確定 |
| M8 | 2026-12 | D-2 | Tree 1人 → 2-3人 → 半数 → 全員展開・FileMaker 切替 |

※ 東海林さんの通常業務が月 20 稼働日あたり 8〜10 日 Garden 作業に回せる想定。残りは経理実務。a-auto 並列投入で体感稼働時間を 1.3〜1.5 倍化する。

### 2.2 Phase A（M1-M2）: 経理総務の自動化

**目的**: 東海林さんの通常業務を削って以降の加速に回す燃料を作る。

| 月 | Bud | Forest | Root |
|---|---|---|---|
| M1 | 振込新規作成 / 詳細 / 承認画面、6段階遷移仕様書、role=alert 一括付与 | v9 P0 設計判断、P1 HANKANHI、P4 Download 基本、Tax Calendar テーブル設計 | KoT API 連携画面、garden_role 管理画面、root_audit_log 整備 |
| M2 | 明細管理（入出金記録・銀行データ取込・照合）、α版配布（東海林 + 経理担当 1 名） | P2 Tax Calendar 実装、P5 Info Tooltip、α版の運用フィードバック反映 | MF 電子契約連携画面、新入社員追加UI（Tree 側と共同）、7マスタ統合テスト |

#### Phase A タスク一覧
- 🔴 A-01 Bud: BudGate 非リアクティブ修正（Context 昇格 + visibilitychange）— 0.5d
- 🔴 A-02 Bud: 送金エラー UI に `role="alert"` 一括付与 — 0.25d
- 🔴 A-03 Bud: 振込ステータス 6 段階遷移仕様書（`docs/specs/`）— 0.5d（auto可）
- 🟡 A-04 Bud: 振込新規作成（regular / cashback）フォーム完成 — 1.5d
- 🟡 A-05 Bud: 振込詳細・承認・差戻し画面 — 2.0d
- 🟡 A-06 Bud: 明細管理（`bud_statements`）UI + DB 設計 — 4.0d
- 🟡 A-07 Bud: 銀行 CSV 取込 + 振込照合 — 2.0d
- 🔴 A-08 Forest: P0 設計判断 5 項目（東海林合意）— 0.5d
- 🔴 A-09 Forest: P1 HANKANHI 実装 — 1.0d
- 🟡 A-10 Forest: P2 Tax Calendar 実装 — 2.0d
- 🟢 A-11 Forest: P4 Download 基本 — 0.5d
- 🟢 A-12 Forest: P5 Info Tooltip — 0.25d
- 🟡 A-13 Forest: P3 Tax Files 閲覧（Storage 設計後）— 1.5d
- 🔴 A-14 Root: KoT API 連携画面 — 2.0d
- 🟡 A-15 Root: MF 電子契約連携画面 — 1.5d
- 🟡 A-16 Root: garden_role 管理画面（super_admin）— 1.0d

**Phase A 小計**: 約 **20.5 d**（2人月相当）→ 並列 auto 投入で圧縮可

**月別目標**:
- M1 末: Bud 振込 α運用開始、Forest v9 相当カバレッジ達成、Root 7マスタ UI 一通り
- M2 末: Bud 明細 α版、Forest フル機能、Root 外部連携（KoT/MF）一巡

**並列化できるタスク（auto 投入候補）**:
- A-03（6段階遷移仕様書）/ A-08（設計判断たたき台）/ Forest P1 データ投入 SQL 案 / Root マスタ定義書 v3

**リスクと対策**:
- 🔴 経理業務の月末締めで M1 末実装が遅延する可能性 → M1 後半の予備日 2d 確保
- 🟡 Forest P0 の判断が遅れると P3/P4.5 が連鎖遅延 → A-08 を M1 第1週に固定

### 2.3 Phase B（M3-M4）: 事務業務の効率化

**目的**: 関電業務委託を現場投入し、給与処理を軌道に乗せる。

| 月 | Leaf 001_関電 | Bud 給与 |
|---|---|---|
| M3 | v10 HTML → TSX 移植、8 ステータスフロー実装、供給開始日カレンダー管理 | 勤怠取込（Root の `root_attendance`）、給与計算ロジック（正社員/アルバイト別） |
| M4 | 撮影画像 3 階層保管、諸元待ち後付け、α版配布 → β版（3-5 名） | 給与明細配信（Tree 連携）、振込連動（Bud 振込へ注入）、α版配布 |

#### Phase B タスク一覧
- 🔴 B-01 Leaf: v10 HTML / v7 backoffice HTML → TSX 差分分析（auto可）— 0.5d
- 🔴 B-02 Leaf: 8 ステータスフロー本実装（受注→完了）— 2.0d
- 🟡 B-03 Leaf: 諸元待ち後付け添付機能 — 1.0d
- 🟡 B-04 Leaf: 供給開始日カレンダー管理（管理者年1更新）— 1.0d
- 🟡 B-05 Leaf: 5種添付書類管理（電灯/動力/ガス/諸元/受領書）— 2.0d
- 🟡 B-06 Leaf: 撮影画像 3 階層保管（3/12/24ヶ月、1500px/JPEG85）— 2.0d
- 🟢 B-07 Leaf: 至急SW（S5等）検出（OCR 検討は P 後送り）— 1.0d
- 🔴 B-08 Bud: 勤怠取込 + 給与計算（雇用形態別）— 3.0d
- 🟡 B-09 Bud: 給与明細配信（Tree マイページ側と連動）— 2.0d
- 🟡 B-10 Bud: 手渡し現金支給（未決事項確定）— 1.0d
- 🟡 B-11 Bud: MFクラウド給与 → Bud 移行手順書（auto可）— 0.5d

**Phase B 小計**: 約 **16.0 d**

**月別目標**:
- M3 末: Leaf 関電 α版内部運用、Bud 給与 Phase 0 計算ロジック完成
- M4 末: Leaf 関電 β版（3-5 名）稼働、Bud 給与 α版配布

**並列化できるタスク（auto 投入候補）**: B-01（HTML→TSX 差分）/ B-10 未決事項整理（auto可）/ B-11 移行手順書

**リスクと対策**:
- 🔴 関電案件は FileMaker 11 から移行。**並行運用期間は 2 週間以上**必須 → β版を短縮しない
- 🟡 給与計算は労基リスクあり → 必ず **MFクラウド給与との突合テスト**を M3 末に実施

### 2.4 Phase C（M5-M6）: 補完モジュール

**目的**: 残存モジュールの基礎を立て、Tree 投入前にエコシステムを揃える。

| 月 | Soil | Bloom | Rill | Seed | Leaf 他商材 |
|---|---|---|---|---|---|
| M5 | リスト 253 万件 + コール履歴 335 万件のテーブル設計、インデックス戦略、RLS 統一 | 画面雛形、日報提出、案件一覧 VIEW | Chatwork API 認証、送信、通知ルーティング | PoC テンプレート化 | 光回線・クレカ・他のテーブル設計スケルトン（auto 大量生成） |
| M6 | 大量データ初期投入バッチ、tsvector 検索、既存 `soil_kanden_cases` 連携 | KPI 集計、営業損益（社内用）、ダッシュボード完成 | 受信・検索・メッセージ保管、通知受信 | — | 2〜3 商材を α版まで |

#### Phase C タスク一覧
- 🔴 C-01 Soil: コール履歴 335 万件の分割戦略設計（auto可）— 0.5d
- 🟡 C-02 Soil: リスト 253 万件のインデックス戦略（tsvector/GIN、auto可）— 0.5d
- 🟡 C-03 Soil: RLS 統一ドキュメント（auto可）— 0.5d
- 🟡 C-04 Soil: 初期投入バッチ実装 — 3.0d
- 🟡 C-05 Soil: 既存 `soil_kanden_cases` / Leaf との繋ぎ直し — 1.0d
- 🔴 C-06 Bloom: 画面雛形（Forest 踏襲、グリーン系グラデーション）— 1.5d
- 🟡 C-07 Bloom: 日報作成・提出 — 2.0d
- 🟡 C-08 Bloom: 案件一覧 VIEW（横断ビュー）— 2.0d
- 🟡 C-09 Bloom: KPI 集計 + 営業損益 — 2.0d
- 🟢 C-10 Bloom: ダッシュボード完成 — 1.0d
- 🔴 C-11 Rill: Chatwork API 仕様調査レポート（auto可）— 0.25d
- 🟡 C-12 Rill: 認証 / 送信 / 通知ルーティング — 3.5d
- 🟡 C-13 Rill: 受信 / 検索 — 3.0d
- 🟢 C-14 Seed: PoC テンプレート化（auto可）— 0.5d
- 🟡 C-15 Leaf 他商材: 光回線・クレカのテーブル設計スケルトン生成（auto 大量化）— 1.0d（auto）
- 🟡 C-16 Leaf 他商材: 2〜3 商材を α版まで実装（テンプレ化すれば短縮可）— 4.0d

**Phase C 小計**: 約 **25.75 d**

**月別目標**:
- M5 末: Soil + Bloom + Rill の基礎テーブル + 画面雛形揃う
- M6 末: Bloom / Rill / Leaf 2〜3 商材が α版に到達

**並列化できるタスク（auto 投入候補）**: C-01 / C-02 / C-03 / C-11 / C-14 / C-15（特に C-15 は Leaf スケルトン大量生成のために auto が効く）

**リスクと対策**:
- 🔴 Soil の 335 万件コール履歴は **パフォーマンス計測必須** → M5 中旬に負荷試験
- 🟡 Rill は外部 API 依存 → Chatwork 側のレート制限と障害耐性を仕様化

### 2.5 Phase D（M7-M8）: Tree 最終段階 🔴 最慎重

**目的**: FileMaker 稼働中の主力業務を Tree へ切り替える。**失敗は許されない**。

| 月 | 週 | フェーズ | 内容 |
|---|---|---|---|
| M7 | W1-W2 | §16 7種テスト | 機能網羅 / エッジケース / 権限（7段階）/ データ境界 / パフォーマンス / Console エラー / a11y |
| M7 | W3-W4 | α版（東海林さん1人） | 徹底確認、即時修正 |
| M8 | W1 | 1人現場テスト | コールセンタースタッフ 1 名、**新旧並行**、1週間 |
| M8 | W2 | 2-3人テスト | 1週間 |
| M8 | W3 | 半数テスト | 1-2週間 |
| M8 | W4 | 全員投入 | FileMaker 切替 |

#### Phase D タスク一覧
- 🔴 D-01 Tree: §16 7種テスト計画書（auto可）— 0.25d
- 🔴 D-02 Tree: 機能網羅テスト（Playwright）— 1.5d
- 🔴 D-03 Tree: エッジケーステスト — 1.0d
- 🔴 D-04 Tree: 権限テスト（7 段階ロール × 画面数十本）— 1.0d
- 🔴 D-05 Tree: データ境界テスト — 0.5d
- 🔴 D-06 Tree: パフォーマンス計測 — 0.5d
- 🔴 D-07 Tree: Console エラー監視 + a11y 確認 — 0.5d
- 🟡 D-08 Tree: 誕生日 PW 同期の部分成功復帰フロー（今日のレビュー 🔴）— 0.5d
- 🟡 D-09 Tree: バイナリーポイント構想 仕様書（auto可）— 0.5d
- 🟡 D-10 Tree: アポラン 6 ヶ月保管 実装 — 1.0d
- 🟡 D-11 Tree: 提供エリア自動判定 — 1.5d
- 🟡 D-12 Tree: 日付 4 形式入力 — 0.5d
- 🟡 D-13 Tree: メニューバー 2 階層化 — 1.0d
- 🟡 D-14 Tree: 新入社員追加UI（Root 連携）— 1.5d
- 🟡 D-15 Tree: KoT API リアルタイム同期 — 2.0d
- 🔴 D-16 Tree: 1 人現場テスト期間のモニタリング計画書 — 0.25d
- 🔴 D-17 Tree: 2-3 人テスト期間 — 0.5d（主に運用監視）
- 🔴 D-18 Tree: 半数テスト期間 — 0.5d（運用）
- 🔴 D-19 Tree: FileMaker 切替手順書・ロールバック計画 — 0.5d

**Phase D 小計**: 約 **15.0 d**

**月別目標**:
- M7 末: 7種テスト完走、α版完了
- M8 末: FileMaker 完全切替、プロジェクト完了

**並列化できるタスク（auto 投入候補）**: D-01 / D-09 / D-16（計画・仕様書系は auto 大活躍）

**リスクと対策**:
- 🔴🔴🔴 **Tree 失敗＝業務停止**。新旧並行期間を**絶対に短縮しない**
- 🔴 FileMaker 側の運用ルール変更がある場合、切替日を再設定
- 🟡 現場スタッフの Chatwork での声の拾い漏れ → `docs/field-feedback-YYYYMMDD-tree.md` で必ず全件記録

---

## セクション 3: 並列化タスクリスト（auto 投入候補）

> **§15 並列自律提案ルール**と組み合わせて運用する、a-auto 次回以降の発動候補カタログ。**40 件**。

| # | モジュール | タスク | auto 発動タイミング | 見込み工数 | 優先度 |
|---|---|---|---|---|---|
| P01 | Bud | 振込ステータス 6 段階遷移仕様書（v2 RLS ポリシー説明含む） | M1 第 1 週 | 0.5d | 🔴 |
| P02 | Bud | 明細管理の要件定義書起草（入出金記録、銀行データ取込、照合） | M1 第 3 週 | 0.5d | 🟡 |
| P03 | Bud | 給与処理の要件定義書起草（勤怠取込→計算→承認→振込→配信） | M2 第 2 週 | 0.75d | 🟡 |
| P04 | Bud | 手渡し現金支給の未決事項整理（論点・選択肢・推定スタンス） | M2 第 1 週 | 0.25d | 🟡 |
| P05 | Bud | MFクラウド給与 → Bud 移行手順書起草 | M2 第 3 週 | 0.5d | 🟡 |
| P06 | Bud | CC 明細処理ルール仕様書（5000円区切り・インボイス扱い） | M2 | 0.5d | 🟢 |
| P07 | Forest | P0 設計判断 5 項目の比較資料（ZIP 方式 A/B/C 等） | M1 第 1 週 | 0.5d | 🔴 |
| P08 | Forest | P1 HANKANHI データ投入 SQL 案と移行手順 | M1 第 1 週 | 0.25d | 🔴 |
| P09 | Forest | P2 Tax Calendar `forest_tax_schedule` テーブル設計 + SQL | M1 第 2 週 | 0.5d | 🔴 |
| P10 | Forest | P3 Tax Files Supabase Storage 設計（bucket / RLS / メタデータ） | M1 第 3 週 | 0.5d | 🟡 |
| P11 | Forest | ForestShell / MicroGrid / SummaryCards / MacroChart の v9 細部差分調査 | M1 第 4 週 | 0.75d | 🟡 |
| P12 | Root | KoT API 連携画面の要件定義書起草 | M1 | 0.5d | 🔴 |
| P13 | Root | MF 電子契約連携画面の要件定義書起草 | M2 | 0.5d | 🟡 |
| P14 | Root | garden_role 管理画面 要件定義 | M1 | 0.25d | 🟡 |
| P15 | Root | `root_audit_log` スキーマ設計案 | M1 | 0.25d | 🟡 |
| P16 | Root | マスタ定義書 v3（7 マスタ統合、Bud 用 v2 からアップデート） | M2 | 0.5d | 🟡 |
| P17 | Leaf | v10 入力 HTML / v7 事務 HTML → TSX 移植差分分析ドキュメント | M3 第 1 週 | 0.5d | 🔴 |
| P18 | Leaf | 撮影画像 3 階層保管ポリシーの実装設計書 | M3 第 3 週 | 0.25d | 🟡 |
| P19 | Leaf | 諸元待ちアラート閾値の運用ルール文書化 | M3 | 0.25d | 🟢 |
| P20 | Leaf | 至急 SW 案件の OCR 検出設計案（PoC） | M3 | 0.5d | 🟢 |
| P21 | Leaf | 光回線・クレカ・他商材テーブル設計スケルトン大量生成 | M5 第 1 週 | 1.0d | 🟡 |
| P22 | Soil | コール履歴 335 万件の分割戦略設計（パーティション/シャーディング比較） | M5 第 1 週 | 0.5d | 🔴 |
| P23 | Soil | リスト 253 万件のインデックス戦略（tsvector/GIN/trigram） | M5 第 1 週 | 0.5d | 🟡 |
| P24 | Soil | RLS ポリシー統一ドキュメント（全 `soil_*` テーブル横断） | M5 第 2 週 | 0.5d | 🟡 |
| P25 | Bloom | 日報テンプレート要件定義書 | M5 第 2 週 | 0.25d | 🟢 |
| P26 | Bloom | KPI ダッシュボード画面ワイヤーフレーム起草 | M5 第 3 週 | 0.5d | 🟡 |
| P27 | Bloom | 案件一覧 VIEW の SQL 設計（横断ビュー） | M5 | 0.5d | 🟡 |
| P28 | Rill | Chatwork API 仕様調査レポート（認証・レート制限・Webhook） | M5 第 1 週 | 0.5d | 🔴 |
| P29 | Rill | 通知ルーティングルール設計案 | M5 第 2 週 | 0.5d | 🟡 |
| P30 | Seed | 新事業 PoC テンプレート作成（雛形） | M5 | 0.5d | 🟢 |
| P31 | Tree | §16 7 種テスト計画書（全チェックリスト） | M7 第 1 週 | 0.5d | 🔴 |
| P32 | Tree | バイナリーポイント構想 仕様書 | M7 | 0.5d | 🟡 |
| P33 | Tree | アポラン 6 ヶ月保管 実装設計 | M7 | 0.25d | 🟡 |
| P34 | Tree | 提供エリア自動判定 仕様調査（郵便番号 → エリアマスタ） | M7 | 0.5d | 🟡 |
| P35 | Tree | 日付 4 形式入力 実装方針 | M7 | 0.25d | 🟢 |
| P36 | Tree | メニューバー 2 階層化 画面設計 | M7 | 0.25d | 🟡 |
| P37 | Tree | α/1人/2-3人/半数テスト用チェックリスト作成 | M7 第 3 週 | 0.5d | 🔴 |
| P38 | 横断 | `docs/known-pitfalls.md` 初版作成（§17 準拠、全モジュール横断） | M1 | 0.5d | 🔴 |
| P39 | 横断 | `docs/field-feedback-*.md` テンプレ化（分類・集約・反映フロー） | M1 | 0.25d | 🟡 |
| P40 | 横断 | `docs/pre-release-test-*.md` テンプレ化（§16 の7種網羅版） | M1 | 0.25d | 🟡 |

**総計（auto 投入想定タスクの工数）**: 約 **17.5 d**（全部 auto 化できれば対話時間をまるごと圧縮可）

---

## セクション 4: リスクマトリクス

| # | リスク | 発生可能性 | 影響度 | 対策 |
|---|---|---|---|---|
| R-01 | **Leaf 約30テーブル問題**（商材ごとに個別設計が 30 本必要） | 高 | 大 | P21 で auto スケルトン大量生成 / テンプレ化、2〜3 商材で様式確立してからコピー展開 |
| R-02 | **Tree 現場投入で業務停止**（FileMaker 切替失敗） | 中 | **致命** | §17 の 1→2-3→半数→全員 を厳守、新旧並行を短縮禁止、ロールバック計画（D-19）を事前整備 |
| R-03 | **通常業務との競合**（東海林さんが経理業務で Garden 作業に戻れない） | 高 | 大 | Phase A で経理処理の自動化を最優先にし、M2 末で 1〜2 日/週の業務時間を捻出 |
| R-04 | **Forest 設計判断（P0）遅延が P3/P4.5 を連鎖遅延** | 中 | 中 | P0 を M1 第 1 週固定、auto で比較資料（P07）を先出し |
| R-05 | **Soil パフォーマンス問題**（335 万件コール履歴） | 中 | 大 | M5 中旬の負荷試験を前倒し、分割戦略（P22）を auto で先行 |
| R-06 | **Root マスタ変更による各モジュール影響波及** | 中 | 中 | マスタ定義書 v3（P16）を M2 にロックイン、破壊的変更は Phase 切替時のみ |
| R-07 | **給与計算ロジック誤り**（労基リスク） | 低 | **致命** | MFクラウド給与との突合テスト必須（M3 末）、二重計算期間を 1ヶ月設定 |
| R-08 | **Chatwork API のレート制限・仕様変更** | 中 | 中 | Rill はフェイルクローズ設計、通知欠損時のリトライキュー、API 仕様は P28 で先行調査 |
| R-09 | **a-auto 並列投入でブランチ競合** | 中 | 小 | §13 v2 準拠（1 モジュール = 1 ブランチ）、auto 専用の `feature/*-auto` 命名で分離 |
| R-10 | **MF クラウド電子契約の連携仕様確定遅延** | 中 | 中 | MF API 連携は見送り（社長決済困難）→ 締結済PDF 手動運用で先行（Root CLAUDE.md 準拠） |
| R-11 | **KoT API 連携仕様**（契約継続だが API 未検証） | 中 | 中 | P12 で仕様調査、初期は CSV 手動インポートで動作開始（段階実装） |
| R-12 | **Bud 振込の金額誤り** | 低 | **致命** | 今日のレビュー 🔴 3点（A-01/A-02/P01）を Phase A 先頭で潰す、7種テスト（§16）を必ず適用 |

### 4.1 リスク対応の原則

1. **致命リスクは「発生可能性を下げる」より「発生した時の被害を最小化する」設計を優先**（R-02 / R-07 / R-12）
2. **高頻度リスクは早期検出**（R-01 / R-03）
3. **外部依存リスクはフェイルクローズ**（R-08 / R-10 / R-11）

---

## セクション 5: 月次レビュー項目

### 5.1 月末チェックリスト

月末に `a-main` で「Garden 月次レビュー」を発動し、以下を確認する。

| # | 指標 | 確認方法 | 閾値 |
|---|---|---|---|
| M-01 | Phase 目標達成率 | 当月のタスク完了数 / 予定数 | 80% 以上 |
| M-02 | 見積 vs 実績 乖離（`docs/effort-tracking.md`） | `sum(diff)` をモジュール別・Phase 別で集計 | 月合計 ±2.0d 以内 |
| M-03 | 未決事項の滞留 | `docs/handoff-*.md` / 各モジュールの未決一覧 | 0 件を目標、3 件以上なら翌月初で解消会議 |
| M-04 | auto 投入実績 | `docs/autonomous-report-*-a-auto-*.md` の件数・効果 | 月 4 件以上を目標 |
| M-05 | 現場フィードバック集計（β版以降） | `docs/field-feedback-YYYYMMDD-*.md` の 🐛 / 💡 / ✨ / ⚠️ 分類別件数 | ⚠️ 重大は即時対応、🐛 は当月内対応 |
| M-06 | パフォーマンス計測（Soil/Forest/Tree） | ページロード時間 / API 応答時間 | 3 秒以内（P95） |
| M-07 | 技術負債（今日のレビュー 🔴 項目の残件数） | `docs/*-review-suggestions-*.md` 参照 | 月 1 件以上解消 |

### 5.2 effort-tracking.md との連携

月次レビュー時に以下を追記：

```markdown
| {Module} | {Phase 名} | {見積} | {実績} | {差分} | {セッション} | {開始} | {完了} | {所感} |
```

- Phase 着手時に見積行を追加（空の actual_days）
- Phase 完了時に `actual_days` と `diff` を記入
- 月末レビューで `notes` に所感を追記
- 見積は後から書き換えない（§12）

### 5.3 月次レビューの段取り

```
月末最終週
 ├─ 金曜 PM: a-auto で各モジュールの effort-tracking 差分抽出（auto 可）
 ├─ 月末土曜: 東海林さんが a-main で集約レビュー、翌月計画策定
 └─ 月初月曜: 各モジュールセッションへ §11 テンプレートで配布
```

### 5.4 6ヶ月後の終着判定

- M6（10 月）末: **Phase A + B + C が計画どおり完走しているか**
- M8（12 月）末: **Tree 全員投入完了、FileMaker 切替完了**

上記が達成できない場合の対応:
1. スコープ再定義（Leaf 他商材や Seed を保留）
2. 外部リソース投入（ヒュアラン側でエンジニア採用 or 業務委託）
3. §17 の段階テスト期間を延長（Tree は延長可、短縮不可）

---

## 付録

### A.1 参考ドキュメント
- [親 CLAUDE.md §15-§18](file:///G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/CLAUDE.md)
- [Forest v9 移植計画](forest-v9-to-tsx-migration-plan.md)
- [effort-tracking.md](effort-tracking.md)
- `feature/tree-review-20260424-auto` / `1a1c806`（Tree レビュー）
- `feature/bud-review-20260424-auto` / `b371ed5`（Bud レビュー）

### A.2 本計画の限界
- 各モジュール CLAUDE.md は本日読了の範囲（全読は未実施）。子 CLAUDE.md の深部仕様（例：Tree 作業メモ 20260420 / Leaf 残課題一覧 / Bud 設計書 v1）は **a-forest / a-bud / a-tree 各セッションでの精読**を推奨
- 工数見積は a-auto の経験則ベース。東海林さんの実体感で ±30% 調整される前提
- Phase の月次境界は固定ではない。週次で前倒し・後ろ倒しの判断をすること
- **Seed モジュール**は着手時点で仕様再定義の想定のため、本計画では最小限のバッファのみ確保

### A.3 本計画で扱っていない事項
- ヒュアラン側の **人事・採用**（外部リソース投入の前提条件）
- **セキュリティ監査 / 脆弱性診断**（リリース後の継続運用として別計画）
- **SaaS 契約更新**（KoT / MF / Chatwork / Supabase / Vercel の契約期間）
- **災害・障害対応**の BCP

— end of roadmap —
