# dispatch main- No. 147 — a-leaf-002 クレカ skeleton 起草 GO（D2 推奨案 A 採用）

> 起草: a-main-015
> 用途: a-leaf-002 の待機解除 + クレカ skeleton 起草指示
> 番号: main- No. 147
> 起草時刻: 2026-05-08(金) 15:18

---

## 投下用短文（東海林さんが a-leaf-002 にコピペ）

~~~
🟢 main- No. 147
【a-main-015 から a-leaf-002 への dispatch（leaf-002-18 受領 + クレカ skeleton 起草 GO）】
発信日時: 2026-05-08(金) 15:18

# 件名
leaf-002-18 受領。次タスク = クレカ skeleton 起草 GO（光回線 #147 の precedent 流用）

# leaf-002-18 受領内容（要約）
- A+B+C 並列タスク完走（31 分実績 / 75 分予定、59% 短縮）
- ✅ A: §22-8 token 自発チェック完走、引っ越し不要判断
- ✅ B: leaf.md v2.1 更新（45% → 47%、PR #147 反映）
- ✅ C: PR #147 self-review 10 観点（merge 可能品質、緊急修正必要事項なし）
- 改善提案 7 件タイミング別整理（Phase B-1 / B-2）
- 累計 5/7+5/8: 15 PR + 副次 1 / 約 24h → 約 5.5h（77% 短縮）
- 候補 4 件提示（クレカ skeleton / 関電 README / 横断レビュー FU / a-bloom レビュー対応）

# 横断調整セッションの判断
**A 案 GO = クレカ skeleton 起草**（D2 推奨案 A、5/8 15:18 東海林さん承認）

理由:
- 光回線 PR #147 の precedent（business_id = 'hikari'）が直近完成、流用すれば 30 分見込
- スケルトン精度向上が Phase B 着手前の重要な基盤整備
- 関電業務委託 README は 5/14-16 デモ向けだが、デモ前に時間が確保できれば後回しでも対応可
- 横断レビュー FU / a-bloom レビュー対応は他セッション稼働中で並行進行（leaf-002 が手戻りリスク）

# あなた（a-leaf-002）がやること

## クレカ skeleton 起草（光回線 PR #147 を precedent に）

### 対象商材

主要クレカ商材を skeleton レベルで網羅:

| business_code | 名称 | 想定ボリューム |
|---|---|---|
| credit_card_basic | 一般クレカ取次（流通系・銀行系統合）| 主力 |
| credit_card_premium | プレミアム / プラチナクレカ | 中 |
| credit_card_corporate | 法人クレカ / 出張カード | 中 |

東海林さん判断仰ぎ事項として、より詳細な商材分割が必要かを完走報告で提示してください。

### skeleton 内容

光回線 #147 の構成踏襲:
- spec ファイル（業務概要 / テーブル設計 / VIEW / RLS / Phase 配置 / 残課題）
- migration SQL skeleton（テーブル定義のみ、本実装は Phase B-1）
- business_id 連携（leaf_business_settings への登録パターン）
- 改訂履歴

### 工数見込
- 30 分（光回線 precedent 流用）

### PR 発行
- ブランチ: feature/leaf-credit-card-skeleton-20260508
- base: develop
- title: docs(leaf): 003_クレジットカード取次 最小 skeleton 起票（Phase B 次商材、business_id = 'credit_card_*'）
- body: 光回線 PR #147 と同形式
- a-bloom レビュー指定（main- No. 141 / #147 と同様）

# 注意点

- **既存実装に影響を与えない（spec のみ追加）**
- 光回線 #147 で PR #147 self-review にて挙げた 改善提案 1-3 / 6 / 7 は Phase B-1 対応 = 本クレカ skeleton では適用不要（同じ skeleton レベルで OK）
- 命名: case_id 連番 sequence（光回線 self-review §4.4 提案 3）は **Phase B-1 で全商材横断設計**するため、クレカ skeleton では UUID 暫定でもよい（ただし方針併記）
- A-1c との整合（self-review 提案 6）は本 skeleton では深追い不要、Phase B-1 で対応

# Vercel 状況（共有）

直近 PR (#147 含む) で Vercel エラーメール届いていますが、**個人 Free scope (hyuaran-5e506769) で発生、Org Pro (hyuaran) は健全**。
東海林さんが個人 scope を disconnect 操作中。disconnect 後、新しいクレカ skeleton PR は Org Pro でのみ走り、エラーなく CI 完走見込み。

# 完走報告フォーマット
🟢 leaf-002-19
【a-leaf-002 から a-main-015 への 完走報告】
発信日時: 2026-05-08(金) HH:MM
件名: クレカ skeleton 起草 + PR 発行完了
PR URL: https://github.com/Hyuaran/garden/pull/NNN
判断保留: 商材分割の粒度（東海林さん判断仰ぎ）

# 緊急度
🟢 通常（待機解除、30 分タスク）
~~~

---

## 詳細（参考）

発信日時: 2026-05-08(金) 15:18
発信元: a-main-015
宛先: a-leaf-002
緊急度: 🟢 通常
