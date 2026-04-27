# a-review への Phase 3 通常 feature PR 一括レビュー依頼 短文 - 2026-04-27 起草

> 起草: a-main 008
> 用途: Phase 3 (35 PR) 完了後 (~17:00 予定) に a-review に統括レビュー依頼するための短文
> 前提: Phase 1 docs 5 PR + Phase 2 重大指摘 5 PR は別途依頼済（`a-review-dispatch-critical-5-prs-20260427.md`）

## 投下短文（東海林さんが Phase 3 完了後にコピペ）

```
【a-main-008 から a-review へ】Phase 3 通常 feature PR 35 件 一括レビュー依頼

▼ 経緯
- 4/27 GitHub push 復旧後、本日中に 50+ PR 一括発行
- Phase 1 docs 5 件 + Phase 2 重大指摘 5 件は先行依頼済（別 dispatch）
- Phase 3 通常 feature 35 件 (今回依頼) を 5 分間隔で発行完了

▼ 対象 PR の分類

| カテゴリ | 件数 | 主な内容 |
|---|---|---|
| a-auto 系（spec / dispatch ログ）| 14 | broadcast / cross-ui 監査・修正 / image prompts / pending prework / tree-d 8-role 化 |
| a-auto-002 系（spec batch）| 2 | Soil Phase B / Sprout-Fruit-Calendar batch |
| a-bloom 系（chore / fix / feature）| 3 | effort-tracking backfill / login バグ修正 / lockfile sync |
| a-bloom-002（大規模 feature）| 1 | **garden-common-ui-and-shoji-status（39 commits、5/5 デモ UI 完成版）★ 最重要** |
| a-bud 系 | 1 | bud-review 反映 |
| a-forest 系 | 1 | Phase B App85 アーカイブ注記 |
| a-leaf 系 | 4 | A-1c npm install / migration / 将来拡張 / handoff |
| a-root 系 | 4 | 権限管理 + ヘルプ spec / Phase B 反映 + spec / pending decisions 反映 |
| a-soil 系 | 1 | Phase B 判断保留 反映 |
| a-tree 系 | 4 | Phase D-01 schema migration / Phase D 確定反映 / Track B 責任者ツール / **Phase D-02 Step 1+2+3** |

▼ 優先順序（推奨）

1. **a-bloom-002 大規模 PR**（39 commits、5/5 デモ UI 完成版）★ 最重要
   - 5/5 後道さんデモの UI 本体、最優先レビュー
   - BackgroundCarousel + 12 透明アイコン + hover 演出 + 6 atmospheres + URL クエリパラメータ + a11y
   - 累計 ~150 tests
   
2. **a-tree Phase D-01 / D-02**（FileMaker 代替の中核）
   - schema migration 677+135 行 + オペレーター UI Step 1+2+3
   - Tree 特例 §17 で慎重展開、レビュー重要
   
3. **a-root Phase B**（権限管理、Garden 全体に影響）
   - 8-role × 機能マトリクス + 監査ログ拡張
   
4. **その他 feature**（a-leaf / a-bud / a-forest / a-soil 等）
   - 各モジュール固有、並行レビュー可

5. **a-auto 系 spec / docs**
   - 多くは spec 改訂・docs only、build 影響少
   - cross-ui 系 / image prompts / broadcast 系
   - **batch10 派生 3 件**（#7 cross-ui-8-role, #9 cross-ui-conflicts, #10 godo-redesign）は **batch10 merge 後** に diff 整合する
   
▼ ⚠️ Known issue（事前周知）

| PR | 状況 |
|---|---|
| feature/bloom-login-and-returnto-fix | Vercel build failure（develop 全体の test-utils vitest 不在問題、commit message + PR body で範囲外明記済）。merge 判断は a-review 任せ |
| feature/cross-history-delete-specs-batch14-auto-v2 (#87) | develop と diverged（3 ahead / 11 behind）、merge 時 conflict 解消必要 |
| 一部 a-auto 系 PR | spec only、Vercel build 失敗無視可（CLAUDE.md §4.3）|

▼ 各 PR の body 詳細

各 PR の body に以下を記載済（コピペ・追加説明不要）:
- Summary 3 行
- 関連 spec / Issue 番号
- Test plan
- レビュー観点（必要な PR には個別 checkbox）

▼ 期限希望

5/5 後道さんデモ前の安心材料として、**5/3（GW 中盤）までに最重要 (#a-bloom-002 大規模) merge 完了** + 他は順次。
無理せず品質優先で、難しければ調整可。

▼ 並行作業可能

35 PR は独立性高く、複数並行レビュー可能。priority 1-3 を東海林さんと a-review で分担し、4-5 は適宜進めれば効率最大。

▼ 完了基準

- 35 PR レビュー完了 → approve / change request / 保留 のいずれか
- approve なら東海林さん or 私が merge 実行（base = develop）
- change request あれば該当モジュールセッションが追加 commit
- known-issue 系は a-review 判断で merge 保留 OK

▼ 報酬

これで本日 4/27 の Phase 1 + 2 + 3 全 50+ PR レビュー依頼完了。
Garden 全モジュールが 5/5 後道さんデモ前に整理された状態に到達。
品質最優先でレビューお願いします。
```

## 投下後の進行

| Step | 内容 | 担当 |
|---|---|---|
| 1 | Phase 3 完了確認（~17:00）+ 全 PR 件数確認 | a-main |
| 2 | 東海林さんが a-review に上記短文をコピペ投下 | 東海林さん |
| 3 | a-review が priority 順に PR レビュー | a-review |
| 4 | approve なら merge 実行 | 東海林さん or a-main |
| 5 | change request なら branch 追加 commit | 該当モジュールセッション |
| 6 | 全件 merge 完了 → effort-tracking 反映 | a-main |

## 改訂履歴

- 2026-04-27 初版（a-main 008、Phase 3 完了前の事前準備、即投下可能な状態で起草）
