# a-soil dispatch - PR #101 個人情報保護法リスク修正 - 2026-04-27

> 起草: a-main-009
> 用途: a-soil PR #101（Phase B 7 spec）に対する a-review CONDITIONAL 指摘（🔴 5 件）の修正依頼
> 前提: a-review handoff `docs/handoff-review-phase3-202604270500.md`、特に R-1 個人情報保護法リスク

## 投下短文（東海林さんが a-soil にコピペ）

```
【a-main-009 から a-soil へ】PR #101 Phase B 個人情報保護法リスク修正依頼

▼ 経緯
- 4/27 a-review が PR #101 を CONDITIONAL 判定、🔴 5 件指摘
- 特に R-1 が個人情報保護法リスク（Bud と並ぶ最厳格水準）
- 5/3 GW 中盤までに修正完了希望

▼ 主要指摘（修正必須）

▼ R-1 🔴 個人情報保護法リスク（最優先）

| 観点 | 内容 |
|---|---|
| 指摘 | B-04 spec の tsvector 全文検索定義に、暗号化対象の phone_primary が平文混入 |
| リスク | tsvector index 内に平文電話番号が保存される → DB ダンプ / バックアップ漏洩時に個人情報流出 |
| 修正方針 | A 案: tsvector から phone_primary 除外（name / address / メモ等のみ対象）|
|  | B 案: 別 tsvector で phone_primary_hash 等のハッシュ化値を使用 |
|  | → A 案推奨（電話番号で検索する UX 要件は admin のみで頻度低、別途 EXACT match で対応可）|

▼ R-3 MV / 通常テーブル横断不整合（🔴）

| 観点 | 内容 |
|---|---|
| 指摘 | B-05/B-06 で MV（Materialized View）と通常テーブルを横断する設計、整合性保証ロジックが不在 |
| 修正方針 | MV 更新タイミング明記（CRON / Trigger / On-demand）+ 不整合時のフォールバック spec 追記 |

▼ その他 🔴 指摘 3 件

a-review handoff `docs/handoff-review-phase3-202604270500.md` 参照（comment-4324631749 詳細）

▼ 修正手順

1. `git pull origin feature/soil-phase-b-specs-batch19-auto`（PR #101 ブランチ最新化）
2. `docs/handoff-review-phase3-202604270500.md` の R-1〜R-5 詳細確認
3. spec md 修正（tsvector 定義 + MV 整合性 + その他 3 件）
4. commit + push
5. a-main-009 に「PR #101 修正完了、SHA: xxxxxxx」共有

▼ 期待結果

- spec のみ修正（実装はまだ未着手なので、spec 修正で済む）
- 工数 30 分〜1h 見込み
- 5/3 GW 中盤までに APPROVE 期待

▼ 注意点

- Soil は §16 通常厳格度だが、R-1 は個人情報保護法 直接リスクで Bud（🔴 厳格）と同等の慎重対応必要
- spec 修正後 implementation 着手前なので、修正コスト最小
- memory `project_garden_login_office_only.md`（Soil 系の機微情報も社内 PC 限定）と整合
```

## 投下後の進行

| Step | 内容 | 担当 |
|---|---|---|
| 1 | 東海林さんが a-soil に上記短文投下 | 東海林さん |
| 2 | a-soil が a-review handoff 確認 → spec 修正 → push | a-soil |
| 3 | 修正完了 + SHA 報告 | a-soil → a-main-009 |
| 4 | a-main が a-review に再レビュー依頼 | a-main-009 |
| 5 | a-review APPROVE → merge | a-review / 東海林さん |

## 改訂履歴

- 2026-04-27 初版（a-main-009、PR #101 個人情報保護法リスク 5 件の修正 dispatch）
