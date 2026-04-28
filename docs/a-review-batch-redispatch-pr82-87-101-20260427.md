# a-review 一括レビュー依頼 - PR #82 / #87 / #101 - 2026-04-27

> 起草: a-main-009
> 用途: 修正完了 + conflict 解消済の 3 PR を a-review に並行レビュー依頼
> 前提: 全 PR push 済 + conflict 解消済 + 5/3 GW 中盤までに APPROVE 期待

## 状態サマリ

| PR | branch | 最新 SHA | 種別 | 解消状態 |
|---|---|---|---|---|
| #87 | feature/cross-history-delete-specs-batch14-auto-v2 | `03dbd2d` | 再レビュー（REQUEST CHANGES → 修正完了）| conflict 解消済 |
| #82 | feature/bud-phase-d-specs-batch17-auto-fixes | `19f2151` | 初回レビュー（Phase 3 priority 1）| conflict 解消済 |
| #101 | feature/soil-phase-b-specs-batch19-auto | `db5255a` | 再レビュー（CONDITIONAL → 修正完了）| diverged なし |

## 投下短文 ① PR #87 再レビュー依頼

東海林さんが a-review にコピペ:

```
【a-main-009 から a-review へ】PR #87 a-auto NEW.id::text 修正完了 → 再レビュー依頼

▼ 経緯
- 4/27 a-review 初回レビューで REQUEST CHANGES（指摘 #1: NEW.id::text ハードコード in 02-rls-policy §4.1）
- a-auto が A 案（COALESCE / 汎用化パターン）で修正完了、commit e980871 push 済
- a-main-009 が develop merge で conflict 解消、commit 03dbd2d push 済（feature/cross-history-delete-specs-batch14-auto-v2）

▼ 修正内容サマリ

| 修正対象 | 内容 |
|---|---|
| 01-data-model §4.1 Trigger 関数 | TG_ARGV[1] で PK 列名受領（デフォルト 'id'）、to_jsonb(NEW)->>v_pk_column で動的 PK 値抽出（COALESCE literal 記述は実行時 evaluate 前に列不在エラーになるため to_jsonb 経由）、識別子バリデーション + ERRCODE 22023 早期 REJECT |
| 01-data-model §4.1.2（新設）| PK 列マッピング表（bud_transfers → transfer_id 等の対応） |
| 01-data-model §4.2 | CREATE TRIGGER 例 4 つ（PK 標準 / 非標準のパターン明示） |
| 02-rls-policy §4.1 案 A | 補助関数 get_table_pk_column(text) 新設、can_user_view_record から呼出、動的 SQL を WHERE %I::text = $1 で PK 列名もクオート |
| 02-rls-policy §4.1 案 B | bud_transfers ポリシー: transfer_id::text に修正、soil_kanden_cases: id::text 維持（実 PK が id）+ コメント追記 |
| 06-test-strategy §15.2 | Case 7（非標準 PK 動作）/ Case 8（TG_ARGV[1] 不正識別子）/ Case 9（PK 列不在）追加、§15.6 DoD 反映 |

変更規模: +204 -18 行 / 3 spec ファイル

▼ 検証結果

- spec only 修正のため Vercel build 影響なし（docs PR）
- a-auto 自己 verify 済（commit message に修正方針明記）

▼ 期待アクション

- 再レビュー → APPROVE 判定 期待
- 5/3 GW 中盤までに merge 完了目標
- 全 spec 統合性 + テスト Case 7-9 妥当性が主観点

▼ 報告先

レビュー結果を a-main-009 に共有してください。
```

## 投下短文 ② PR #82 初回レビュー依頼（Phase 3 priority 1）

東海林さんが a-review にコピペ:

```
【a-main-009 から a-review へ】PR #82 a-bud 給与 PDF + Y 案 + Cat 4 反映 priority 1 レビュー依頼

▼ 経緯
- 4/27 Phase 3 一括 PR 発行のうち、a-bud 大物 PR（#82）の初回レビュー依頼
- conflict 解消済（develop merge、commit 19f2151 push 済）

▼ 対象 PR

- branch: feature/bud-phase-d-specs-batch17-auto-fixes
- 最新 SHA: 19f2151
- URL: https://github.com/Hyuaran/garden/pull/82

▼ 内容サマリ

PR #74 の 4 次 follow-up を含む大型 spec 改訂（push 累計）:

| 改訂層 | 内容 |
|---|---|
| 1 次 | D-01 給与期間（1 日〜月末 / 翌月末営業日 / root_settings 化）|
| 2 次 | D-07 §3.3 勘定項目別レポート 8 区分階層化、MFC 取込責任者 = 東海林さん |
| 3 次 | D-10/D-11 給与確定フロー 4 段階 → 6 段階拡張、D-12 スケジュール / リマインダ新規起草 |
| 4 次 | Cat 4 #26/#27/#28 反映 = 後道不在 + 上田目視ダブルチェック + 振込同時出力 + 賞与 admin 限定 |

▼ 4 次主要変更

- 7 段階フロー（visual_double_checked 挿入）+ payroll_visual_checker ロール（上田）追加 = 5 ロール体制
- D-04 §2.7 上田用 UI 要件正本化（シンプル / 大きく見やすい / timeout なし / 閲覧 + OK ボタンのみ / 編集権なし）
- D-12 schedule に visual_double_check stage 追加（7 stage、+1 営業日 offset）
- D-07 §4.4 で 3 経路同時生成（経路 A FB / 経路 B 会計レポート / 経路 C MFC CSV）
- D-03 §7 RLS を admin only INSERT/UPDATE 化、賞与処理 admin 限定セクション追加

▼ priority

**priority 1（最重要）**。理由:
- §16 Bud 厳格度: 🔴 厳格（金額・振込系・経理事故防止）
- 上田氏（payroll_visual_checker）の現場運用直結、5/3 までに確定したい
- 後道不在前提のフロー設計、東海林さんの実運用に密接

▼ 検証観点（推奨）

- 7 段階フローの巻き戻し policy 妥当性（V6 自起票禁止 + 巻き戻し対象拡張）
- payroll_visual_checker ロール追加の RLS 整合性
- D-12 スケジュール 7 stage offset 計算の論理（営業日 offset）
- 3 経路同時生成（D-07 §4.4）の atomic 性
- 賞与 admin 限定（D-03 §7）の Bud 内整合
- spec only PR のため Vercel build 影響なし

▼ 期待アクション

- 5/3 GW 中盤までに APPROVE 期待
- CHANGE REQUEST あれば a-bud に追加修正 dispatch
- 並行レビュー可（#87 / #101 と独立）

▼ 報告先

レビュー結果を a-main-009 に共有してください。
```

## 投下短文 ③ PR #101 再レビュー依頼

東海林さんが a-review にコピペ:

```
【a-main-009 から a-review へ】PR #101 a-soil Phase B 個人情報保護法リスク 5 件修正完了 → 再レビュー依頼

▼ 経緯
- 4/27 a-review 初回レビューで CONDITIONAL（🔴 5 件指摘、特に R-1 個人情報保護法リスク）
- a-soil が全件修正完了、commit db5255a push 済（feature/soil-phase-b-specs-batch19-auto）
- 4 files / +168 / -57

▼ 修正内容サマリ

| 指摘 | 対象 spec / § | 修正概要 |
|---|---|---|
| R-1 🔴 | B-04 §4.1 | tsvector から phone_primary 除外、暗号化対象列の混入禁止原則を明文化、電話番号検索は B-tree EXACT match で代替 |
| R-2 🔴 | B-02 §10 | §10.2 B（並列許容）を主軸に格上げ、A（業務閑散時投入）は緊急 fallback へ降格 |
| R-3 🔴 | B-04 §6.3/§7 + B-06 §5.1 | soil_lists_assignments を MV → 通常テーブル表記に全箇所統一、REFRESH cron 対象から除外 |
| R-4 🔴 | B-05 §5.5.4/§5.5.5 | MD5 統一比較、verifying ステータス先行 INSERT → 検証成功後に R2 削除、3 回連続失敗で severity='high' 通知 |
| R-5 🔴 | B-06 §17.4.1/§17.8 | EXPLAIN ANALYZE 期待プラン明記、フォールバック GIN INDEX 追加、DoD に INDEX 利用確認追加 |

▼ 期待アクション

- 再レビュー → APPROVE 判定 期待
- 5/3 GW 中盤までに merge 完了目標
- spec only 修正のため Vercel build 影響なし

▼ 重要性

- R-1 は個人情報保護法 直接リスク、Bud（🔴 厳格）と同等の慎重対応
- spec 修正後 implementation 着手前なので、修正コスト最小

▼ 報告先

レビュー結果を a-main-009 に共有してください。
```

## 投下後の進行

| Step | 内容 | 担当 |
|---|---|---|
| 1 | 東海林さんが a-review に上記 3 短文を順次コピペ投下 | 東海林さん |
| 2 | a-review が 3 PR を並行レビュー（独立性高い）| a-review |
| 3 | レビュー結果を a-main-009 に共有 | a-review → a-main-009 |
| 4 | APPROVE → 東海林さん GitHub UI で merge（#85 と同様の手順）| 東海林さん |
| 5 | CHANGE REQUEST → 各モジュールセッションに追加修正 dispatch | a-main-009 |

## 改訂履歴

- 2026-04-27 初版（a-main-009、3 PR 一括 a-review レビュー依頼、全 conflict 解消済 + 修正 push 済）
