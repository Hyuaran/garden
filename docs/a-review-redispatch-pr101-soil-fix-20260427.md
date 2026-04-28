# a-review 再レビュー依頼 - PR #101 (a-soil Phase B 修正完了) - 2026-04-27

> 起草: a-main-009
> 用途: PR #101 (Soil Phase B 7 spec) の R-1〜R-5 修正完了に伴う再レビュー依頼
> 前提: a-review が CONDITIONAL 判定 + 🔴 5 件指摘（個人情報保護法リスク含む）

## 投下短文（東海林さんが a-review にコピペ）

【a-main-009 から a-review へ】PR #101 a-soil Phase B 修正完了 → 再レビュー依頼

▼ 経緯
- 4/27 a-review 初回レビューで 🔴 R-1〜R-5 5 件指摘（CONDITIONAL）
- a-soil 側で全件修正完了、commit db5255a push 済（feature/soil-phase-b-specs-batch19-auto）
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
- spec のみ修正のため、Vercel build 影響なし（docs only）

▼ 重要性

- R-1 は個人情報保護法 直接リスク、Bud（🔴 厳格）と同等の慎重対応
- spec 修正後 implementation 着手前なので、修正コスト最小（実装後発見だと数日工数）

▼ 報告先

再レビュー結果（APPROVE / 追加 REQUEST CHANGES）を a-main-009 に共有してください。
（a-main 側で APPROVE なら merge 進行、CHANGE REQUEST なら a-soil に追加修正 dispatch）

## 投下後の進行

| Step | 内容 | 担当 |
|---|---|---|
| 1 | 東海林さんが a-review に上記短文投下 | 東海林さん |
| 2 | a-review が再レビュー実施 | a-review |
| 3 | レビュー結果を a-main に共有 | a-review → a-main-009 |
| 4 | APPROVE → merge | a-main-009 / 東海林さん |
| 5 | REQUEST CHANGES → a-soil に追加修正 dispatch | a-main-009 |

## 改訂履歴

- 2026-04-27 初版（a-main-009、a-soil 修正完了 db5255a push 済の即時再レビュー依頼）
