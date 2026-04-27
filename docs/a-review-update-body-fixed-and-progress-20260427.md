# a-review への body 不整合修正完了通知 + REQUEST CHANGES 進捗 - 2026-04-27

> 起草: a-main 008
> 用途: a-review に追加情報 1) PR body 修正完了 2) #87/#85 修正中 を共有
> 前提: a-review 重大指摘 5 PR レビュー完了済（2 APPROVE / 1 条件付 / 2 REQUEST CHANGES）

## 投下短文（東海林さんが a-review にコピペ）

```
【a-main-008 から a-review へ】更新通知 (body 修正完了 + REQUEST CHANGES 進捗)

▼ 内容
1. **PR body 不整合 4 件 修正完了**（a-auto-004 self-review で発見）
2. **REQUEST CHANGES 2 件の修正 dispatch 投下完了**（#87 / #85）

▼ 1. PR body 修正完了

a-auto-004 が PR self-review で「title と body が 1 段ずれ」を発見しました：

| PR | Title | Body（修正前）| Body（修正後）|
|---|---|---|---|
| #83 | leaf #65 | cross-history #47 | leaf #65 ✅ |
| #84 | forest #64 | leaf #65 | forest #64 ✅ |
| #85 | bud #55 | forest #64 | bud #55 ✅ |
| #87 | cross-history #47 | bud #55 | cross-history #47 ✅ |

→ a-review が diff ベースで判断していたため判定への影響なしですが、将来読み手のため整合化済。

▼ 2. REQUEST CHANGES 修正 dispatch 投下完了

| PR | 担当 | 内容 | 想定工数 |
|---|---|---|---|
| **#87 cross-history #47** | a-auto | NEW.id::text ハードコード → Trigger 引数化（修正案 A） | 1.5h |
| **#85 bud #55** | a-bud | R1 (bt.id 参照誤り) / R2 (dual schema) / R3 (selfApprove status_history) / R5 (2 段階遷移) | 1.5-2h |

両方とも修正完了次第、a-main 経由で再レビュー依頼します。

▼ 3. 進行中の他タスク（参考）

| 項目 | 状態 |
|---|---|
| #82 (bud 給与 PDF) conflict 解消 | a-main で対応予定（develop diverged 解消後 merge）|
| docs PR 5 件 即 merge 実行 | 4/5 完了（#77/#78/#79/#80）/ #81 conflict 残 |
| Phase 3 (35 PR) 一括発行 | 進行中、~17:00 完了予定 |
| Bloom-002 v4 + v5 (デザイン改善 9 件 + hover scale) | 投下済、進行中 |
| a-tree D-02 Step 4-10 | 投下済、進行中 |

▼ 期待

#87 / #85 修正完了次第、再レビュー依頼します。
本日 / 明日中の再レビュー + merge 完了が目標、5/3 GW 中盤までに重大指摘 5 件 全件 merge 完了希望。

▼ a-review への問い合わせ（任意）

- 再レビュー時は **diff ベースで判断**お願いします（body 修正したが内容変更ではないため）
- #82 (bud 給与) conflict 解消は私が対応、解消後 merge 可状態にしてから通知します

レビュー継続お願いします。
```

## 改訂履歴

- 2026-04-27 初版（a-main 008、body 修正 + REQUEST CHANGES 進捗 通知）
