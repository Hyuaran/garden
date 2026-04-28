# a-bloom-002 dispatch - 候補 8 push + PR #91 修正 - 2026-04-27

> 起草: a-main-009
> 用途: a-bloom-002 候補 8 完走（5 commits ローカル）の push 指示 + a-review #91 REQUEST CHANGES の修正依頼
> 前提: a-review が PR #91 で🔴 status enum "offline" 不在 / focused/away 未テスト / outsource 欠落 を指摘

## 投下短文（東海林さんが a-bloom-002 にコピペ）

> ⚠️ **Markdown ネスト問題で旧版は Section 2 が切れていた**。下記は純テキスト整形版（コードブロック内蔵せず）。

【a-main-009 から a-bloom-002 へ】候補 8 push + PR #91 修正依頼

▼ Section 1: 候補 8 完走分の push（即実行）

- 候補 8（home design 7 items + /login 権限別 redirect + tests 34 ケース、5 commits 累計）
- branch: feature/garden-common-ui-and-shoji-status
- 状態: ローカル commit 済、push 待ち（GitHub 復旧済なので即可）
- コマンド: git push origin feature/garden-common-ui-and-shoji-status

push 後、既存 PR #106 が自動更新される（candidate 7+F 〜 候補 8 までの累計 commit が反映）。

▼ Section 2: PR #91 (ShojiStatus regression test) の REQUEST CHANGES 修正

a-review からの🔴指摘 3 件、すべて修正必要。

▼ 指摘 #1: status enum "offline" が spec / migration #90 に不在

| 観点 | 内容 |
|---|---|
| 指摘 | テストで使われている status="offline" は spec / migration（PR #90）に存在しない（spec は available / busy / focused / away の 4 値）|
| 影響 | テスト pass しても、実 DB INSERT 時に CHECK 制約違反でエラー |
| 修正方針 | テストから "offline" を削除 OR spec / migration #90 に "offline" を追加 |

**判断保留事項（東海林さんに確認）**: "offline" を 5 値目として正式に追加するか、テストから削除するか
- A 案: spec / migration #90 に "offline" 追加（5 値: available / busy / focused / away / offline）→ サーバー停止時 / 退社後を表現可能、UX 上意義あり
- B 案: テストから "offline" 削除 → spec 4 値遵守、シンプル

→ a-bloom-002 側で **A 案推奨で先行実装**（5 値化、5/5 後道さんデモで「離席中 / 休憩中」と並ぶ「退社後」表現に有用）。東海林さんが B 案希望なら revert 容易。

▼ 指摘 #2: focused / away テストカバレッジ 0

| 観点 | 内容 |
|---|---|
| 指摘 | spec で 4 値定義しながら focused / away のテストが 1 件もない |
| 修正 | ShojiStatus.test に focused / away の rendering / transition test 各 1-2 ケース追加 |

▼ 指摘 #3: outsource ロール欠落（known-pitfalls #6 違反）

| 観点 | 内容 |
|---|---|
| 指摘 | テスト fixture の roles に outsource が含まれていない（8 役割: super_admin/admin/manager/staff/cs/closer/toss/outsource）|
| 影響 | known-pitfalls #6（権限ロール網羅）に違反、Garden 全モジュール 8-role 化方針と矛盾 |
| 修正 | fixture に outsource role 追加、可視範囲テスト 1-2 ケース追加 |

▼ 期待結果

| 項目 | 結果 |
|---|---|
| status enum | 5 値化（A 案）or 4 値固定（B 案） |
| focused/away テスト | 各 1-2 ケース追加 |
| outsource role テスト | 1-2 ケース追加 |
| 全テスト | PASS |
| TypeScript / ESLint | 0 errors |

▼ 工数見込み

- 1h 程度（status enum 拡張 + 5 ケース追加 + 既存 fixture 更新）

▼ 完了後の連絡

修正完了 + push 後、a-main-009 に「PR #91 修正完了、commit SHA: xxxxxxx」を共有してください。
（a-main 側で a-review に再レビュー依頼短文を起草）

▼ 補足

- known-pitfalls.md の参照: docs/known-pitfalls.md #6（権限ロール網羅）
- memory `project_garden_dual_axis_navigation.md` の outsource → /leaf/{partner_code} routing と整合
```

## 投下後の進行

| Step | 内容 | 担当 |
|---|---|---|
| 1 | 東海林さんが a-bloom-002 に上記短文投下 | 東海林さん |
| 2 | a-bloom-002 が Section 1 push → Section 2 修正 | a-bloom-002 |
| 3 | 修正完了 + push → a-main に SHA 報告 | a-bloom-002 → a-main-009 |
| 4 | a-main が a-review に再レビュー依頼 | a-main-009 |
| 5 | a-review が再レビュー → APPROVE → merge | a-review / 東海林さん |

## 改訂履歴

- 2026-04-27 初版（a-main-009、候補 8 push + PR #91 REQUEST CHANGES 修正の合体 dispatch）
