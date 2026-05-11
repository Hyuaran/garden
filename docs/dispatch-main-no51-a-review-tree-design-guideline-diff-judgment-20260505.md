# main- No. 51 dispatch - a-review に Tree 用ガイドライン差分の妥当性判断依頼 - 2026-05-05

> 起草: a-main-012
> 用途: claude.ai 作業日報セッションから受領した report- No. 7（Tree 用ガイドライン草案の差分妥当性判断依頼）を a-review に委譲し、客観的判断を仰ぐ
> 番号: main- No. 51
> 起草時刻: 2026-05-05(火) 18:53
> 緊急度: 🟢 通常（Tree UI 統一は 5/8 後対応、Review は急がず claude.ai 試作起草前までに完了希望）

---

## 投下用短文（東海林さんが a-review にコピペ）

~~~
🟢 main- No. 51
【a-main-012 から a-review への dispatch（Tree 用ガイドライン草案 vs Bloom 世界観仕様書 差分の妥当性判断）】
発信日時: 2026-05-05(火) 18:53

claude.ai 作業日報セッション（claude-chat-016）から report- No. 7 として、Tree UI 統一用ガイドライン草案を起草いただきました。Bloom 世界観仕様書との差分が妥当か、a-review に客観判断を委譲します。

【判断対象】

# 草案ファイル

Drive 上 path:
- `_chat_workspace\garden-tree\design_prep\chat-spec-tree-design-guideline-draft-20260505.md`
- ファイル ID: 1r7rvLHbEBUjUzEuoiSdYH3E7My0Sl3kZ
- サイズ: 約 13.7KB
- 構成: 10 章

# 比較対象（既存）

- `_chat_workspace\chat-spec-garden-bloom-design-system-20260505.md`（Bloom 世界観仕様書、5/5 18:04 発行）
- C:\garden\a-main-012\docs\dispatch-main-no47-a-tree-ui-redesign-prep-repost-20260505.md（main- No. 47 の Tree UI 統一指示）

【差分 8 件 + 判断観点】

| # | 項目 | Bloom 仕様 | Tree 草案 | 差分根拠 | 判断要 |
|---|---|---|---|---|---|
| 1 | 背景画像 | 華やか森背景 OK | 🔴 NG or 控えめ | main- No. 47 明示制約 | ✅ 確定済 |
| 2 | 円リング進捗バー | 採用 | 不採用 | Tree に進捗概念なし | 🟡 |
| 3 | 勤務形態バッジ | 採用 | 不採用 | Tree オペは出社固定 | 🟡 |
| 4 | Today's Activity 右サイドバー | デフォルト展開 | 最小表示 or 完全省略 | 集中阻害可能性 | 🔴 |
| 5 | フォントサイズ | Bloom 標準 | 大きめ推奨 | 長時間視認性 | 🟡 |
| 6 | カード装飾 padding | 22px 40px | 16px 24px 程度 | 画面領域効率 | 🟡 |
| 7 | コントラスト比 | 規定なし | WCAG AA 準拠 | 業務利用 | 🟡 |
| 8 | アニメーション | 規定なし | 過度な動き禁止 | 集中阻害防止 | 🟡 |

【特に判断仰ぎたい 3 件】

# Q1: Today's Activity 右サイドバーの扱い（🔴 最重要）

| 案 | 内容 | 評価軸 |
|---|---|---|
| A | 完全省略 | 業務集中優先、Bloom 統一感は犠牲 |
| B | 最小表示（オペ個人状態 + 通知のみ）| バランス、通知のみ表示で集中崩しにくい |
| C | Bloom 同様デフォルト展開（折畳可で逃げ）| 統一感優先、業務集中は個人で折畳判断 |

a-review 観点: Tree オペレーターの「業務集中」と「Garden ファミリー統一感」のトレードオフをどう評価するか。

# Q2: 円リング進捗バー / 勤務形態バッジの扱い

claude.ai 暫定判断: Tree に「進捗 %」概念なし、勤務形態は出社固定 → 不採用
a-review 観点: 本当に不採用で良いか。Tree 内に「集計値の見える化」or「役割表示」用途で転用可能か。

# Q3: 細部（フォント / padding / コントラスト / アニメーション）

a-review 観点: a-tree 資料化後の試作で視覚判断するか、先に方針確定するか。

【判断時に参考になる関連 memory / file】

- `project_tree_toss_focus_principle.md`（Tree トス役割は集中原則）
- `project_tree_d2_release_strategy.md`（D-1+D-2 セットリリース戦略）
- main- No. 47 の Tree UI 統一指示
- Bloom 仕様書 §2-2 カラーパレット / §2-3 フォント / §3 UI コンポーネント仕様

【判断不要な確定事項】

- 差分 #1 背景画像 NG（main- No. 47 で東海林さん明示）

【完了報告フォーマット】

review-NN で:
- 差分 8 件それぞれの判断（妥当 / 修正推奨 / 保留）
- Q1 推奨案 A/B/C
- Q2 採否
- Q3 a-tree 資料化後判断 / 先決方針
- 判断根拠（短文）
- 完了時刻

【期限】

- Tree UI 統一は 5/8 後対応のため急がず
- ただし、claude.ai 試作起草フェーズ（a-tree 資料化完了後）に間に合うように
- 目安: 5/9〜5/12 までに判断完了希望

【dispatch counter】

a-main-012: 次 main- No. 52
a-review: review-NN で完了報告予定

工数見込み: 60〜90 分（草案 + 仕様書比較精読 + 8 件判断 + 草案へのフィードバック）

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 18:53 初版（a-main-012、claude.ai report- No. 7 受領後、a-review に判断委譲）
