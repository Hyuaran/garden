# Garden シリーズ 工数実績ログ

各 Phase / タスクの**見積 vs 実績**を全モジュール横断で記録する。見積精度向上・ベロシティ把握・計画立案精度改善が目的。

## 記録対象

- 各 spec / plan の Phase・タスクで `estimated_days` を定義したもの **すべて**
- Garden 9 モジュール全般（Soil / Root / Tree / Leaf / Bud / Bloom / Seed / Forest / Rill）
- 東海林アカウント A / B どちらのセッションでも蓄積する

## 記録タイミング

- **Phase 着手時**: 見積を確定したタイミングで行を追加（実績欄は空で pending）
- **Phase 完了時**: 実績・差分・所感を追記
- **途中経過**: 大幅に見積超過しそうなら `notes` にアラート追記

## 単位

- **1 日 = 8 時間相当**（動作確認・レビュー対応含む実稼働ベース）
- 0.25d 刻みで記録
- 東海林さん手動作業（SQL 適用・ブラウザ動作確認・PR レビュー等）は**実績に含める**

## ログ表

| 着手日 | 完了日 | モジュール | Phase/タスク | 見積(d) | 実績(d) | 差分 | セッション | 記録者 | Notes |
|---|---|---|---|---:|---:|---:|---|---|---|
| 2026-04-22 | 2026-04-23 | Root | Phase 1 認証・権限管理 | — | 1.0 | — | b-main (B) | Claude | retroactive 記録（着手時点で見積未設定）。設計書+プラン+実装14コミット+レビュー修正3件+ハンドオフ。PR #9 マージ済。実稼働は Claude 実行時間+東海林手動確認（RLS 適用・動作確認・レビュー）の総計を推定 8h 相当。Phase 1 の残作業として「東海林さんの最終 UX 確認（残6シナリオ）」あり。 |
| 2026-04-23 | (pending) | Root | Phase 2 他アプリからの参照ルール整備 | 0.5 | — | — | a-root (A) | Claude | 見積は暫定（spec 未完成）。着手時点では「Bud/Leaf が Root マスタを参照するためのクエリ整備」として計画されていたが、Bud/Leaf モジュールが未実装のため、a-root では「Root 側で提供する API 契約書・共有クエリヘルパー・RLS 前提条件ドキュメント」に絞って進める方針で東海林さんと確認中。spec 確定後に見積を再調整。**2026-04-24 a-main 判断：Phase 2 は保留。Bud/Leaf 連携開始時に精緻化する。** |
| (予定 2026-04-25) | (pending) | Root | Phase A-1 T1: 法人マスタ CRUD UI | 0.5 | — | — | a-root (A) | Claude | Phase A 7マスタ UI の 1/7。`root_companies` テーブルは Phase 1 で構築済。今回は一覧・新規・編集・無効化の UI + バリデーション。Forest admin UI パターン流用。brand: feature/root-master-ui-20260424。 |
| (予定 2026-04-25〜5-3) | (pending) | Root | Phase A-1 T2: 銀行口座マスタ CRUD UI | 0.5 | — | — | a-root (A) | Claude | 7マスタ UI の 2/7。`root_bank_accounts`（company_id FK）。T1 完了後に着手。 |
| (予定 2026-04-25〜5-3) | (pending) | Root | Phase A-1 T3: 取引先マスタ CRUD UI | 0.5 | — | — | a-root (A) | Claude | 7マスタ UI の 3/7。`root_vendors`。口座名義カナ（銀行CSV形式）重要。 |
| (予定 2026-04-25〜5-3) | (pending) | Root | Phase A-1 T4: 従業員マスタ CRUD UI | 0.5 | — | — | a-root (A) | Claude | 7マスタ UI の 4/7。`root_employees`（Phase 1 で認証用に構築済、今回 CRUD UI 拡張）。KoT ID / MFクラウド ID 入力欄あり。 |
| (予定 2026-05-04〜10) | (pending) | Root | Phase A-1 T5: 給与体系マスタ CRUD UI | 0.5 | — | — | a-root (A) | Claude | 7マスタ UI の 5/7。`root_salary_systems`。JSON フィールド（手当・控除）UI 設計要検討。 |
| (予定 2026-05-04〜10) | (pending) | Root | Phase A-1 T6: 社会保険マスタ CRUD UI | 0.5 | — | — | a-root (A) | Claude | 7マスタ UI の 6/7。`root_insurance`。年度別料率・等級テーブル（JSON）。 |
| (予定 2026-05-04〜10) | (pending) | Root | Phase A-1 T7: 勤怠データ取込 UI | 0.5 | — | — | a-root (A) | Claude | 7マスタ UI の 7/7。`root_attendance`。手動取込画面（CSV インポート）。API 自動化は T8 で別扱い。 |
| (予定 2026-05-11〜17) | (pending) | Root | Phase A-2: KoT API 連携（取込自動化） | 1.0 | — | — | a-root (A) | Claude | キングオブタイム API で月次自動取込。T7 の手動取込画面を補完。M1 総仕上げ。 |

## 集計ビュー（完了分のみ反映）

### モジュール別累計

| モジュール | 累計見積(d) | 累計実績(d) | 誤差率(%) | 完了 Phase 数 |
|---|---:|---:|---:|---:|
| Soil | 0 | 0 | — | 0 |
| **Root** | 4.5（予定）+ — | 1.0 | — | 1 |
| Tree | 0 | 0 | — | 0 |
| Leaf | 0 | 0 | — | 0 |
| Bud | 0 | 0 | — | 0 |
| Bloom | 0 | 0 | — | 0 |
| Seed | 0 | 0 | — | 0 |
| Forest | 0 | 0 | — | 0 |
| Rill | 0 | 0 | — | 0 |
| **全体** | **4.5（予定）+ —** | **1.0** | **—** | **1** |

> ※ Root Phase A-1（7マスタ UI）予定 3.5d + Phase A-2（KoT 連携）予定 1.0d = 合計 4.5d。a-main 指示 2026-04-24 に基づく Phase A 範囲。

> ※ 他モジュール（Bud / Forest / Leaf 等）も別 feature ブランチで独自に記録している。develop に統合されたタイミングで本表を再集計する。

### 所感・学び（Phase 完了のタイミングで追記）

| 日付 | Phase | 所感（見積精度・ボトルネック・改善点） |
|---|---|---|
| 2026-04-23 | Root Phase 1 | 見積未設定で着手したため精度評価は不可。次 Phase からは必ず plan に `estimated_days` を入れる。Phase 1 は Tree Phase A の認証パターンを流用できたため実装スピードが速かった（14 コミットを約 42 分で連続投入）。教訓：(1) 既存モジュール（Tree）の認証パターン流用で実装時間短縮、(2) RLS ポリシー名の実態確認が後工程で必要になった（`*_dev` 命名の前提違い）、(3) `root_audit_log` に INSERT/SELECT ポリシーが欠けていて途中でエラー発覚→即修正。RLS 関連は適用前に `pg_policies` で現状確認する習慣を次回以降徹底。 |

## 運用ルール

1. **spec/plan 作成時**: 工数見積セクションに `estimated_days` を記入し、このファイルにも追加（行追加のみ）
2. **完了時**: git log から着手日を確認し、完了日を記入。実績を `1 日 = 8 時間` 換算で算出
3. **合算セクション**: 月次で更新（完了 Phase がない月はスキップ OK）
4. **A/B 両セッションで更新**: 複数セッション並行でも同じファイルを更新。`git merge` 時に競合起きたら両方保持
5. **精度が大きくズレた Phase**: `所感` 欄に原因と次回改善点を記録
