# a-auto re-dispatch - PR #87 進捗確認 + NEW.id::text 修正 - 2026-04-27

> 起草: a-main-009
> 用途: a-auto PR #87 (cross-history-delete-specs-batch14-auto-v2) の REQUEST CHANGES 修正進捗確認 + 再依頼
> 前提: 最新 commit が 4/26 03:07（NEW.id::text 修正未着手 or 未 push）

## 投下短文（東海林さんが a-auto にコピペ）

```
【a-main-009 から a-auto へ】PR #87 進捗確認 + NEW.id::text 修正再依頼

▼ 経緯
- 4/27 a-review が PR #87 を REQUEST CHANGES（指摘 #1: NEW.id::text ハードコード）
- a-main-008 から修正 dispatch 投下済（docs/a-auto-dispatch-pr87-fix-newid-hardcode-20260427.md）
- しかし最新 commit が 4/26 03:07 = 修正未着手 or push 未

▼ 進捗確認 + 即着手依頼

以下のいずれかを a-main-009 に報告してください：

| 状況 | 報告内容 |
|---|---|
| 修正未着手 | "未着手、これから着手します"（即着手 + 90 分以内に push 目標）|
| ローカル修正済 | "ローカル commit 済、push 漏れ。今 push します" |
| 既に修正済 | "既 push、SHA: xxxxxxx"（ブランチ確認漏れの可能性）|

▼ 修正内容（再掲）

a-review 指摘 #1 NEW.id::text ハードコード問題:

| 観点 | 内容 |
|---|---|
| 場所 | cross-history Trigger spec（spec batch 14） |
| 指摘 | NEW.id::text のハードコード参照、Trigger 定義テーブルが id を持たない場合に SQL エラー |
| 修正方針 | A 案: spec で COALESCE(NEW.id::text, NEW.<pk>::text) パターンに統一 |
|  | B 案: spec で「テーブルごとに pk 列名を明示する関数化」を採用 |
|  | → A 案推奨（spec の汎用性高い、追加コスト低）|

▼ 期待結果

- spec md 修正（実装はまだなので spec 修正で済む）
- 工数 30 分〜1h 見込み
- 5/3 GW 中盤までに APPROVE 期待

▼ 注意点

- branch: feature/cross-history-delete-specs-batch14-auto-v2
- develop と diverged（3 ahead / 11 behind）→ merge 直前に conflict 解消必要
- 5 分以内に進捗報告希望（着手判断のため）

▼ 補足

- a-auto は通常 Phase 別 batch 起草で稼働中、本件は緊急差し込み
- 完了後の通常 batch 復帰は a-main から指示あり次第
```

## 投下後の進行

| Step | 内容 | 担当 |
|---|---|---|
| 1 | 東海林さんが a-auto に上記短文投下 | 東海林さん |
| 2 | a-auto が状況報告 + 修正着手 | a-auto |
| 3 | 修正完了 + push → a-main に SHA 報告 | a-auto → a-main-009 |
| 4 | a-main が a-review に再レビュー依頼 | a-main-009 |
| 5 | a-review APPROVE → conflict 解消 → merge | a-review / a-main-009 |

## 改訂履歴

- 2026-04-27 初版（a-main-009、PR #87 NEW.id::text 修正進捗確認 + 即着手依頼）
