# a-review への重大指摘 5 PR レビュー依頼 短文 - 2026-04-27

> 起草: a-main 008
> 用途: a-review に「重大指摘 5 件 全件 PR 化完了、優先レビュー依頼」を伝える配布短文
> 前提: 5 PR (#82, #83, #84, #85, #87) 全件発行済、Vercel build 確認済

## 投下短文（東海林さんが a-review にコピペ）

```
【a-main-008 から a-review へ】重大指摘 5 PR 全件発行完了、優先レビュー依頼

▼ 経緯
- a-review が 4/24-26 に指摘した重大事項 5 件、全件修正完了 + PR 発行
- GitHub アカウント suspended から復旧、4/27 にて最終 push + PR 化
- 一部 PR は branch 名変更（-v2 サフィックス）で発行：GitHub backend の幽霊 PR 状態を回避

▼ 対象 5 PR

| 重大指摘 | PR | branch | 影響 |
|---|---|---|---|
| #47 SQL injection | #87 | feature/cross-history-delete-specs-batch14-auto-v2 | cross-history Trigger、全モジュール影響 |
| #55 Bud RLS | #85 | feature/bud-phase-0-auth-v2 | Bud 経理権限分離、admin 例外検証 |
| #64 Forest ENUM typo | #84 | feature/forest-t-f5-tax-files-viewer-v2 | zanntei→zantei、データ整合性破壊的変更 |
| #65 Leaf SECURITY DEFINER | #83 | feature/leaf-a1c-task-d1-pr-v2 | 関電業務委託 RLS、search_path 明示 |
| #74 Bud 給与 PDF + Y 案 | #82 | feature/bud-phase-d-specs-batch17-auto-fixes | 給与明細レイアウト + Y 案配信フロー |

▼ 優先順序（推奨）

セキュリティ最優先 → データ整合性 → 業務インパクト の順:

1. **#87 cross-history #47**（SQL injection、全モジュール影響）
2. **#83 leaf #65**（SECURITY DEFINER、権限昇格リスク）
3. **#85 bud #55**（RLS、経理権限）
4. **#84 forest #64**（ENUM typo、migration 必要）
5. **#82 bud #74**（給与 PDF、業務 UX）

▼ 各 PR の body 詳細

各 PR の body に以下を明記済（コピペ・追加説明不要）:
- a-review 重大指摘番号 + 内容
- 修正前後（要点）
- 影響範囲（モジュール / テーブル / migration / 後方互換性）
- レビュー観点（4 項目 checkbox）
- Test plan

▼ ⚠️ 注意点

- **#87 は merge 時に develop 側で conflict 発生の可能性**（3 ahead / 11 behind diverged）
  → a-review 確認後、東海林さん or 私が conflict 解消、その後 merge
- 他 4 件は auto-merge OK
- Vercel preview build 状態は事前確認済（develop 全体課題による既知の build failure はあるが、本 PR 範囲外）

▼ 完了基準

- 5 PR 全件レビュー完了 → approve or change request
- approve なら東海林さん or 私が merge 実行
- change request あれば即対応（branch に追加 commit）

▼ 期限希望

5/5 後道さん デモ前の安心材料として、**5/3（GW 中盤）までに全件 merge**完了希望。
無理せず品質優先で、難しければ調整可。

▼ 報酬

これで a-review が 4/24-26 に指摘した重大事項 5 件 全件解消。
Garden 全モジュールのセキュリティ + データ整合性が確保された状態で 5/5 後道さんデモに臨める。
品質最優先でレビューお願いします。
```

## 投下後の進行

| Step | 内容 | 担当 |
|---|---|---|
| 1 | 東海林さんが a-review に上記短文をコピペ投下 | 東海林さん |
| 2 | a-review が 5 PR 個別レビュー（順次）| a-review |
| 3 | approve なら merge 実行 | 東海林さん or a-main |
| 4 | change request なら branch 追加 commit | 該当モジュールセッション or a-main |
| 5 | 全件 merge 完了 → effort-tracking 反映 | a-main |

## 改訂履歴

- 2026-04-27 初版（a-main 008、重大指摘 5 PR 全件発行直後）
