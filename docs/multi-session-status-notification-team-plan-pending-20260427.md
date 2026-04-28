# 4 セッション宛 状況通知 dispatch（a-leaf / a-soil / a-bud / a-tree）- 2026-04-27

> 起草: a-main-009
> 用途: GitHub Team プラン課金 48h block 中の各モジュールセッション向け状況通知 + C 垢切替手順
> 前提: B 垢 (ShojiMikoto-B) suspended、C 垢 (shoji-hyuaran) で運用予定、push 復旧は ~4/29 夕方

## 共通 状況（4 セッション全部に該当）

| 項目 | 状態 |
|---|---|
| GitHub アカウント | A 垢・B 垢 共に suspended、C 垢 (shoji-hyuaran / shoji-dev@hyuaran.com) 新設 |
| Hyuaran org | C 垢 Owner 招待済、Team プラン課金 48h 調査中（解除 ~4/29 夕方）|
| Support Ticket | #4330372 受理 + 追加情報返信投下済 |
| ローカル commit | 全セッション継続可能、push のみ block |
| 5/5 デモ | localhost で実施（push 不要）|

---

## ① a-leaf 向け短文

```
【a-main-009 から a-leaf へ】GitHub crisis + 状況通知

▼ 状況
- B 垢 (ShojiMikoto-B) 4/27 夕方 suspended、C 垢 (shoji-hyuaran) で運用へ移行
- Hyuaran org Team プラン課金 48h 調査中、解除 ~4/29 夕方
- ローカル commit は完全継続可能、push のみ block

▼ あなたへの影響
- ローカル commit は OK（Phase D 進行中なら継続）
- push は ~4/29 夕方まで保留（GitHub 復旧後 a-main-009 が一括 push or 各セッションで push 再開）
- 5/5 デモは localhost で実施、push 不要

▼ Phase D 進捗確認希望
- 関西電力業務委託 Phase D 92.9% 完了状態か（13/14 task 実装済）
- D.14 カバレッジ確認 + Phase A / B / F 残作業
- 何か block / 詰まりあれば即報告

▼ 復旧後の作業
1. C 垢稼働後（東海林さんから通知あり）gh auth login + setup-git で C 垢に切替
2. ローカル commit を一括 push
3. PR レビュー依頼継続

詳細手順: docs/c-account-gh-cli-setup-and-config-switch-20260427.md 参照

▼ 5 分間隔遵守（再 ban 回避）
push 再開後は最低 5 分間隔、1 日 PR 5-10 件 / push 10-20 件目安。
```

---

## ② a-soil 向け短文

```
【a-main-009 から a-soil へ】GitHub crisis + #101 後続作業確認

▼ 状況
- B 垢 (ShojiMikoto-B) 4/27 夕方 suspended、C 垢 (shoji-hyuaran) で運用へ移行
- Hyuaran org Team プラン課金 48h 調査中、解除 ~4/29 夕方

▼ #101 状況
- a-review 再レビュー APPROVE 受領済（4/27、軽微 3 件のみ）
- conflict 解消不要、APPROVE 後 merge 待ち
- merge は GitHub Team プラン解除後、東海林さん操作

▼ あなたへの影響
- Phase B 7 spec 起草完了、実装着手は東海林さん指示後
- ローカル commit は OK
- push は ~4/29 夕方まで保留

▼ 復旧後の作業
1. C 垢稼働後 gh auth login + setup-git
2. ローカル commit を一括 push（あれば）
3. Phase B 実装着手判断（東海林さん指示後）

▼ 後追い対応
- a-review 軽微指摘 3 件は実装着手時に対応で OK
- 詳細: a-review が PR #101 に投稿したコメント確認
```

---

## ③ a-bud 向け短文

```
【a-main-009 から a-bud へ】GitHub crisis + PR 状況通知

▼ 状況
- B 垢 (ShojiMikoto-B) 4/27 夕方 suspended、C 垢 (shoji-hyuaran) で運用へ移行
- Hyuaran org Team プラン課金 48h 調査中、解除 ~4/29 夕方

▼ PR 状況

| PR | 状態 |
|---|---|
| #85 (Phase 0 認証 + RLS R1/R2/R3/R5 修正) | ✅ APPROVE + merge 完了（4/27 17:16、6c31c4f）|
| #82 (給与 PDF + Y 案 + Cat 4 #26/#27/#28) | ✅ APPROVE 条件付（軽微 2 件、Phase D 実装時対応で OK）|

▼ あなたへの影響
- Phase A-1 完結（919 tests 全緑）
- Phase B (給与処理) spec 8 件起草済、実装は Phase B 着手指示後
- Phase D (給与確定 7 段階フロー + MFC CSV + 上田目視ダブルチェック) spec 完成
- ローカル commit は OK
- push は ~4/29 夕方まで保留

▼ #82 軽微指摘 2 件
- payroll_visual_checker の SELECT スコープ未明示 → Phase D 実装時に pr_select policy で「依頼済のみ」絞り込み
- 3 経路同時生成の Storage オーファン → DB rollback 時の cleanup 戦略明記

→ Phase D 実装着手時に対応で OK、現時点修正不要。

▼ 復旧後の作業
1. C 垢稼働後 gh auth login + setup-git
2. PR #82 merge（東海林さん操作、Team プラン解除後）
3. Phase B / D 実装着手判断（東海林さん指示後）
```

---

## ④ a-tree 向け短文

```
【a-main-009 から a-tree へ】GitHub crisis + D-01/D-02 PR + α 版判断

▼ 状況
- B 垢 (ShojiMikoto-B) 4/27 夕方 suspended、C 垢 (shoji-hyuaran) で運用へ移行
- Hyuaran org Team プラン課金 48h 調査中、解除 ~4/29 夕方

▼ PR 状況

| PR | 状態 |
|---|---|
| #109 (D-01 schema migration) | a-review priority 1 レビュー依頼投下済、結果待ち |
| #110 (D-02 オペレーター UI 全 10 Step) | 同上 |

▼ セット merge 戦略
- D-01 → D-02 の順 merge 必須（D-02 単体 merge は schema 不在で起動失敗）
- 詳細: docs/pr-tree-d01-d02-set-merge-plan-20260427.md

▼ α 版開始判断
- 5/5 後道さんデモ後（採用判定後）に判断
- 5/5 までは α 版開始しない、現状の D-01/D-02 完成形保持

▼ α 版開始前 解消必須事項（4 件）
1. Breeze 画面 役割齟齬（既存実装 vs spec §3.4）→ D-04 着手前 東海林さん確認
2. ng_timeout CHECK 制約拡張（spec §3.6）→ D-2 で決定
3. D-01 migration 投入確認（garden-dev）→ 東海林さん本人
4. 既存 ESLint 11 errors（タイマー系）→ D-06 品質向上

▼ あなたへの影響
- ローカル commit は OK（D-03/D-04/D-05/D-06 着手可）
- push は ~4/29 夕方まで保留
- 5/5 デモは localhost で実施、Tree D-01/D-02 必須ではない

▼ §17 Tree 特例 5 段階展開（post-5/5）
α (1 週間、東海林さん 1 人) → β1 (1 週間、CC スタッフ 1 名) → β2-3 → half → full + FileMaker 30 日並行参照
6 月末〜 7 月初旬で FileMaker 完全切替目標

▼ 復旧後の作業
1. C 垢稼働後 gh auth login + setup-git
2. PR #109/#110 merge（東海林さん操作、Team プラン解除後）
3. α 版開始準備（東海林さん指示後）
```

---

## 投下タイミング（東海林さん判断）

| # | タイミング | 推奨 |
|---|---|---|
| **A** | 今すぐ全 4 セッションに投下（状況共有、各セッション能動継続）| 🟢 推奨 |
| B | Team プラン解除後（4/29 夕方）にまとめて投下 | 🟡 |
| C | a-tree のみ即（Tree D-01/D-02 が priority 1）、他は Team 解除後 | 🟡 |

→ 推奨 A（情報共有は早めが良い、各セッションが状況を把握して動ける）

## 改訂履歴

- 2026-04-27 初版（a-main-009、4 セッション宛 GitHub crisis 状況通知 + C 垢切替手順 + 各セッション固有事項）
