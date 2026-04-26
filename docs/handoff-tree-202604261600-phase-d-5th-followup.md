# Tree Phase D 5 次 follow-up — handoff

- 日時: 2026-04-26 ~16:00 完了
- セッション: a-tree
- ブランチ: `feature/tree-phase-d-decisions-applied`（既存ブランチに追加 commit）
- 反映対象: 33 件判断保留消化のうち Tree 担当 Cat 3 全 10 件

## 完了成果物

### 🔴 #16 D-1 + D-2 セットリリース戦略（最重要、新案 D 採択）

**従来案廃止**: D-1（基本架電）リリース → 1 ヶ月後に D-2（ソフトフォン自動発信）追加リリース
**新案 D**: **D-1 と D-2 をセットで完成、テスト稼働で品質確保 → FM 完全切替**

#### 反映先
- **plan v3 §4 Tree 特例（§17）段階展開**: 「🔴 最重要：D-1 + D-2 セットリリース戦略」セクション新設（採択根拠 + タイムライン + スコープ整理 + 工数影響）
- **spec-tree-softphone-design.md §0**: リリース戦略を最上位で明示、開発・展開タイムライン明記

#### 工数への影響
- プラン全体見積: **6.5d → 8.5d**（+2.0d ソフトフォン実装統合）
- ソフトフォン実装は plan v3 §3 D-02 operator-ui に統合される形

### #17 モニタリング切替基準（B 採択）

- D-03 spec §0 判 0-2 を更新: **「30 秒 polling 既定 + 同時 50 名超で WebSocket / Realtime 自動切替」**
- 切替閾値は `root_settings.tree_monitoring_realtime_threshold` で運用変更可

### #18 録音聴取（A 注記付き）

3 spec に注記追加: ⚠️ **「将来イノベラ API の採用具合（応答性能・カバレッジ・SLA）次第で、Garden 内録音実装方針へ変更可能性あり。β段階以降の運用評価で再判断」**
- D-01 spec §0 判 0-1
- D-03 spec §0 判 0-1
- spec-tree-softphone-design.md §0 末尾

### #19 他商材展開（A 採択）

- D-04 spec §0 判 0-1 を更新: **「D-1 関電 / D-2 光 / D-3 クレカ」**
- 優先度: 関電 > 光 > クレカ
- D-1+D-2 セットリリース戦略との整合明示（D-2 は光商材 + ソフトフォン）

### #20 KPI 目標設定（拡張、3 階層）

- D-05 spec §0 判 0-1 を更新 + **§0.x「KPI 目標 3 階層 DB 設計」セクション新設**
- 3 テーブル（個人 必須 / チーム 任意 NULL 許容 / 会社 必須）の DDL を明記
- 表示時の優先順位（個人画面 / マネージャー画面 / 後道さん画面で異なる）
- 設定権限（個人 = manager+ / チーム = admin+ / 会社 = super_admin）
- チーム制ない時の運用（テーブル空のまま、画面でチーム階層をスキップ）

### #21-#25 既反映確認

| # | 内容 | 反映先 | ステータス |
|---|---|---|---|
| #21 | KPI スマホ対応 = タブレットまで | D-05 §0 判 0-6 | ✅ 既反映 |
| #22 | テンプレ指示メッセージ = D-2 で /tree/feedback 拡張 | D-03 §0 判 0-4 | ✅ 既反映 |
| #23 | アラート閾値編集 = admin のみ | D-03 §0 判 0-3 | ✅ 既反映（root_settings.tree_alert_thresholds 経由） |
| #24 | tree_call_records パーティション = 3,000 万件で発動 | D-01 §0 判 0-6 | ✅ 既反映 |
| #25 | β録音聴取テスト = イノベラ API 確定後に最小機能 | D-06 §0 判 0-5 | ✅ 既反映 |

## 反映済関連 memory

- `project_tree_d2_release_strategy.md`（**最重要 #16 の根拠**）
- `feedback_quality_over_speed_priority.md`（品質最優先方針）
- `feedback_check_existing_impl_before_discussion.md`
- CLAUDE.md §16（リリース前バグ確認 7 種テスト）
- CLAUDE.md §17（Tree 特例の段階展開）

## ローカル commit

（commit 後に追記）

## 干渉回避

- ✅ a-bud / a-auto / a-soil / a-root / a-leaf / a-forest の進行中ブランチ非接触
- ✅ 実装コード変更なし（spec / plan のみ）
- ✅ main / develop 直接 push 禁止
- ✅ 既存 6 spec の §0 確定事項テーブルを更新する形で反映、本体構造は不変

## ステータス

判断保留が出なかったため pause file 作成不要。push は GitHub 復旧後（push plan 参照）。

## 次のアクション

1. **GitHub 復旧後 push**（push plan: `C:\garden\_shared\decisions\push-plan-20260426-github-recovery.md`）
2. PR 発行 / 既存 PR 更新（既存 `feature/tree-phase-d-decisions-applied` ブランチに追加 commit）
3. PR レビュー → develop merge
4. Tree D-1+D-2 セットリリース戦略を踏まえた plan v3 全体の再見積（必要に応じて v3.1 別 PR）
5. KPI 3 階層スキーマの Phase D-2 着手時 migration 起草

---

## 改訂履歴

| 日付 | 版 | 改訂内容 | 担当 |
|---|---|---|---|
| 2026-04-26 | v1.0 | a-main 006 確定 10 件（Cat 3 #16-#25）を関連 spec / plan に反映完了 | a-tree |
