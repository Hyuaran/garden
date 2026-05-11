# draft memory: feedback_migration_apply_verification（A-RP-1 v1 起草）

> 起草: a-analysis-001（main- No. 299 §C 起草依頼、# 308 §B-1 採用 # 1 + § 309 確定）
> 起草日時: 2026-05-11 (月) 19:05
> 用途: 新規 memory feedback_migration_apply_verification の起草ドラフト（main 採択後に main セッションで memory ファイル登録）
> 状態: ドラフト、main + 東海林さん最終決裁後に main がファイル登録（a-analysis 編集権限外）

---

## 自己参照禁止 抵触検証

- 全 session 共通 memory（migration 適用検証ルール）= a-analysis 自身の運用変更ではない
- 当事者性: a-analysis は migration 担当ではない、抵触なし

---

## memory 全文（コピペ用、~~~ 外で提示、main がそのままファイル登録可能）

### frontmatter

- name: PR merge ≠ Supabase apply 完了 / migration 適用前後の物理検証義務
- description: PR merge は「コードが main に入った」ことを示すのみ、supabase migration apply / vercel deploy / 環境変数反映 等は別工程。merge 後の verbal「apply 完了」報告は検証手段の併記なき限り信用しない。Tree D-01 事故（5/11）+ apply 漏れ 80% 推定（5/11 cross-check）への恒久対処。
- type: feedback
- originSessionId: a-analysis-001-2026-05-11（main- No. 299 起源、analysis-001- No. 11 A-RP-1、Tree D-01 事故対処）

### 本文

#### ルール

##### 1. PR merge ≠ apply 完了の明文化

| 工程 | 役割 | 完了条件 |
|---|---|---|
| GitHub PR merge | コードベース履歴反映（main branch へ反映）| gh pr view で merge 状態確認のみ |
| Supabase migration apply | 実 DB への migration 適用 | supabase db push 実行 + 物理検証（下記 §2）|
| Vercel deploy | フロントエンド本番反映 | vercel deployment status 確認 + 実アクセス検証 |
| 環境変数反映 | .env / Vercel env 反映 | 該当環境で env 値確認 |

PR merge は「コードが main に入った」ことを示すのみ。supabase migration apply / vercel deploy / 環境変数反映などは別工程。**merge 後の verbal「apply 完了」報告は検証手段の併記なき限り信用しない**。

##### 2. 検証手段（最低 3 種から 1 種以上、apply 完了報告には併記必須）

| 種別 | 手段 | 適用範囲 |
|---|---|---|
| A. supabase studio 直接確認 | supabase studio 上で schema（テーブル / カラム / RLS）を目視確認 | 全 migration |
| B. supabase CLI 差分検証 | supabase CLI `db diff` で remote vs migration ファイル一致確認 | 全 migration |
| C. 実装側ラウンドトリップ | 実装側コードから SELECT/INSERT 動作確認（実 row 作成 → 取得 → 削除）| 機能テスト系 migration |

最低 1 種実施、全件で A or B（schema 物理確認）+ 機能 migration では C（動作確認）併用推奨。

##### 3. 検証タイミング

| タイミング | 内容 |
|---|---|
| PR merge 直後 | 同一セッション内、最低 5 分以内に §2 検証手段で物理確認 |
| 翌セッション起動時 | §0 必読 docs ロック内で「直近 merge 済 PR の apply 検証状態」再確認（feedback_session_handoff_checklist §B 連動）|
| 30 分巡回 | feedback_module_round_robin_check で「マージ済だが apply 未検証」状態の検出（C-RP-1 連携、※ C-RP-1 D-2-3 と機能近接、両 memory 改訂時は相互整合確認必須）|

##### 4. 「apply 完了」記述要件（3 点併記必須）

PR description / handoff / commit message で「apply 完了」と書く場合、以下 3 点併記必須:

| 項目 | 例 |
|---|---|
| 検証手段 | supabase studio 確認 / db diff 一致 / ラウンドトリップ成功 等 |
| 検証時刻 | 17:35（YYYY-MM-DD HH:MM 形式）|
| 検証者 | a-tree-002 / a-soil-002 等 |

完成例: `apply 完了 (supabase studio 確認, 2026-05-11 17:35, a-tree-002)`

**併記なしの「apply 完了」は false statement として禁止**。verbal 報告で併記なき場合、main は検証手段を返答要求（即タスク投下）。

##### 5. silent NO-OP 罠（最重要）

supabase migration は SQL 構文エラーがない限り「成功」扱いになる。しかし以下のケースで実質何もしない silent NO-OP が発生:

| 罠 | 例 |
|---|---|
| RLS policy 重複 | `CREATE POLICY` が既存名と重複、エラーでもなく skip でもなく silently 既存維持 |
| conditional skip | `DROP IF EXISTS` + `CREATE` パターンで既存削除 + 再作成、structure 同一なら NO-OP 同等 |
| migration ファイル順序 | 後発 migration が先発で作成された table を参照、apply 順序により skip |
| transaction rollback | 一部失敗でも transaction 全体 rollback、応答上は「失敗」だが部分実態残存 |

対処:

| 対処 | コマンド例 |
|---|---|
| RLS policy 実存確認 | `SELECT * FROM pg_policies WHERE tablename = '...'` |
| schema 物理確認 | `SELECT * FROM information_schema.table_constraints WHERE table_name = '...'` |
| 制約物理確認 | `SELECT * FROM information_schema.key_column_usage WHERE table_name = '...'` |

migration 適用後は必ず物理検証コマンド実行、「supabase db push 成功」だけで完了判定禁止。

##### 6. 用語統一（混用禁止）

| 用語 | 意味 |
|---|---|
| マージ済 | PR merge 済（main branch 反映）、apply 状態は別 |
| apply 済 | migration / deploy 実施済 + §2 検証済 |
| 稼働中 | 本番環境で実際にユーザー操作可能（α/β/リリース版判定）|

3 段階を別語で表現、混用禁止。「マージ + apply」「apply + 稼働」等の組合せで状態明示:
- 「マージ済 / apply 未検証」
- 「マージ済 / apply 済（検証手段併記）」
- 「マージ済 / apply 済 / 稼働中」

##### 7. 違反検知時の即動作

30 分巡回 / cross-check で「マージ済だが apply 未検証」を検知 → **即タスク投下**:

| ステップ | アクション |
|---|---|
| 1 | main が該当モジュールセッションに「apply 検証 dispatch」発行 |
| 2 | 該当 PR を「未完了」扱いに戻す（PR description / handoff に明示）|
| 3 | 検証完了報告（§4 形式、3 点併記）受領まで該当 PR の後続作業停止 |
| 4 | 検証完了確認後、PR を「apply 済」状態に正式昇格 |

※ C-RP-1 D-2-3 と機能近接、両 memory 改訂時は相互整合確認必須。

#### Why

- 5/11 14:30 Tree D-01 apply で 42830 invalid_foreign_key 発生
- a-main-022 が仮説 1（root_employees.employee_number UNIQUE 制約なし）→ PR #157 起票 + GitHub merge → 「apply 完了」と判定
- 再 apply 試行 → 同 42830 再発（UNIQUE 制約が実 DB に未適用、PR merge ≠ apply 完了の典型誤認）
- 5/11 16:40 REST 直接検証で root_employees.employee_number UNIQUE 未適用立証（重複 INSERT 成功）
- 5/11 cross-check で apply 漏れ 80% 推定（複数 migration で同種誤認再発リスク高）
- 構造的真因: PR merge / supabase apply / 実 DB 物理状態 の 3 工程分離が運用上未明文化、verbal「apply 完了」のみで実検証なし

#### How to apply

##### dispatch 起草時の self-check

apply 関連 dispatch 起草時、以下 sentinel 通過:

| # | チェック | 不通過時 |
|---|---|---|
| 1 | 「apply 完了」記述に検証手段 + 時刻 + 検証者 3 点併記？ | YES → 併記、NO → 検証実施後併記 |
| 2 | 物理検証コマンド実行済？（pg_policies / information_schema 等）| YES → OK、NO → 即実行 |
| 3 | silent NO-OP 罠該当？（RLS 重複 / DROP IF EXISTS + CREATE / 順序依存）| YES → 物理検証強化、NO → 標準検証 |
| 4 | 用語統一（マージ済 / apply 済 / 稼働中）？ | YES → OK、NO → 訂正 |

##### 既存 PR の遡及検証

apply 漏れ 80% 推定（5/11 cross-check）対処として、過去 PR 群の遡及検証推奨:

| ステップ | アクション |
|---|---|
| 1 | 直近 1 ヶ月の merge 済 PR 一覧取得（gh pr list --state merged --limit 50）|
| 2 | 各 PR の migration / deploy 内容把握 |
| 3 | §2 検証手段で実 DB / 実本番状態確認 |
| 4 | 未検証 PR を「未完了」扱いに戻す + 該当モジュールに検証 dispatch 投下 |

#### 関連 memory

- feedback_session_handoff_checklist（§B 起動時必読 docs ロックでの apply 確認項目組込、本 memory § 3 連動）
- feedback_check_existing_impl_before_discussion v2（議論前 / 修正前の既存実装確認の一環として apply 状態確認を含める、本 memory § 1 連動）
- feedback_strict_recheck_iteration（3 ラウンド再確認時の検証強化、本 memory § 5 silent NO-OP 罠検出に活用）
- **feedback_module_round_robin_check v2**（30 分巡回で「マージ済だが apply 未検証」検出、本 memory § 7 と機能近接、C-RP-1 連携、※ 両 memory 改訂時は相互整合確認必須）
- feedback_verify_before_self_critique（apply 完了を主観で断定せず客観検証必須、本 memory § 4 強化）

#### 改訂履歴

- 2026-05-11 19:05 v1 ドラフト初版（a-analysis-001、main- No. 299 起源、analysis-001- No. 11 A-RP-1、Tree D-01 事故 + apply 漏れ 80% 推定 対処）
