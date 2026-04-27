# Tree Phase D 確定 42 件反映 + 新規 2 spec 起草 — handoff

- 日時: 2026-04-26 ~10:00 完了
- セッション: a-tree
- ブランチ: `feature/tree-phase-d-decisions-applied`（develop ベース、ローカル commit のみ、push は GitHub 復旧後）

## 完了成果物

### 既存 6 spec の改訂（判断保留 42 件すべて確定として反映）

各 spec の冒頭に「**§0. 2026-04-26 確定事項**」セクションを追加 + 既存「判断保留事項」セクションを「全件確定済 — 履歴保持」へ更新。

| spec | ファイル | 確定 # | 主要変更点 |
|---|---|:--:|---|
| D-01 | spec-tree-phase-d-01-schema-migration.md | 6 | 録音 = イノベラ継続 / result_code = CHECK 制約 / リスト割当 = 開放型・競争式 / 整合性 = 日次 23:00 / 監査永続スタート / partition は 3,000 万件で |
| D-02 | spec-tree-phase-d-02-operator-ui.md | 7 | キャンペーン自動 / オフラインキュー 500 件 / 巻き戻し 5 秒 / F1-F10 override / beep 既定 OFF / **電話番号 D-1 表示のみ → D-2 ソフトフォン自動発信** / メモ 500 文字 |
| D-03 | spec-tree-phase-d-03-manager-ui.md | 7 | 録音 = PBX リンク / 30s polling / **アラート閾値 = 有効率（eff）絶対値ベース**（既存 `/tree/alerts` 整合）/ テンプレ D-2 / マネージャー間介入不可 / 通知 ON/OFF / 合算+詳細 |
| D-04 | spec-tree-phase-d-04-tossup-flow.md | 7 | 関電のみ / 編集不可 / 取消不可 / 同意全商材必須 / `campaign_code → chatwork_room_id` / 18,000件/時 OK / **closer 状況 5 分 poll + toss UI 非表示 + トス完了結果即時反映** |
| D-05 | spec-tree-phase-d-05-kpi-dashboard.md | 8 | 目標設定 D-2 / アラートは D-03 / 同時表示 / **PDF UI 後 後道さん FB** / 100 万行 OK / タブレットまで / 3 ヶ月移動平均 / 非稼働日含める+トグル |
| D-06 | spec-tree-phase-d-06-test-strategy.md | 7 | k6 / カバレッジ未達は block / `headless: false` / FM 突合自動 / α録音除外 / 二重承認 / **`test01`〜`test09`**（実在 0001-0009 と区別） |

### 新規 2 spec の起草

| spec | ファイル | 行数 | 見積 |
|---|---|--:|--:|
| Softphone | `docs/specs/tree/spec-tree-softphone-design.md` | ~430 | **2.0d**（Phase D-2、イノベラ API 仕様待ち） |
| Toast | `docs/specs/tree/spec-tree-toast-notification.md` | ~340 | **0.4d**（D-02 と同時進行可） |

#### Softphone spec 主要内容
- UI: マネーフォワード問合せボタン風（右下フローティング、開閉可）
- 機能: X-Lite 簡素化版 10 機能（発信 / 切断 / 保留 / ミュート / 再発信 / 転送 / モニタリング / クリア / テンキー / メモ）
- そぎ落とし: 1/2 ライン / RECORD / AA / AC / DND / CONF / FLASH / Volume / SPEAKER PHONE
- 権限: 転送 + モニタリングは **manager+ のみ**（staff 以下グレーアウト）、`root_user_permission_overrides` で個別 override 可
- 録音: イノベラ側自動、ソフトフォンから操作なし
- API: イノベラ API（月 7,000 円）+ 手動取込 fallback
- 共通コンポーネント設計（Tree 全画面 + 将来 Bud / Bloom 等から呼出可）

#### Toast spec 主要内容
- 配置: 画面右上
- 表示時間: 成約 10s / 見込み 7s / NG 5s / 失注 5s / 情報 3s / 警告 5s / エラー持続
- 背景色 + アイコン: 🎉 金 / ✨ 緑 / ❌ 赤 / 🚫 グレー / ℹ️ 青 / ⚠️ オレンジ / 🚨 赤濃
- クリック動作: `/tree/toss-wait?call_id=...` 該当行へ遷移
- 集約: 同種 5 秒以内 2 件以上で「成約 3 件」等
- 音: 既定 OFF、個別設定で ON 可（D-02 §0 判 0-5 整合）
- 業務中断しない設計（focus 奪わない、モーダルブロックなし）
- 共通コンポーネント設計（sonner ベース）

### 既存実装との整合（spec 内に明記）

| 既存実装 | 統合先 spec | 方針 |
|---|---|---|
| `/tree/alerts`（有効率ベースアラート + バッジワークフロー）| D-03 §0 | **有効率（eff）絶対値指標を確定** — 要フォロー = 1% 未満、注意 = 5% 未満、通常 = 5% 以上 |
| `/tree/dashboard`（個人 KPI、月間目標 60P 等のデモ値）| D-05 §0 | 動的化（過去 3 ヶ月移動平均 + 経営判断補正） |
| `/tree/ranking`（30 秒自動更新、有効率バー）| D-05 §0 | 既存 30 秒更新を維持、データソースを `tree_call_records` に切替 |
| `/tree/aporan`（月次成績ランキング、MANAGER 限定）| D-05 §0 | KPI 集計 VIEW（`mv_tree_kpi_monthly`）と統合、manager+ 権限維持 |
| `/tree/toss-wait`（1 秒経過タイマー、closer 空き状況）| D-04 §0 | manager+ 権限明記、closer 状況は本画面のみ表示（toss UI には非表示） |
| `/tree/calling/sprout`（架電結果ボタン、トス時メモ必須）| D-02 §0 / D-04 §0 | result_code CHECK 制約と同期、トス押下後 Toast 通知、closer 状況非表示 |
| `/tree/feedback`（マネージャー指示メッセージ）| D-03 §0 | 既存実装をそのまま流用、Phase D-2 でテンプレート化検討 |
| `/tree/monitoring`（モニタリング画面、未確認）| D-03 §0 | 30 秒 polling 適用、manager+ のみ |

### ローカル commit 履歴

```
（commit 後に追記）
```

## 反映済関連 memory

- `feedback_check_existing_impl_before_discussion.md` — 既存実装ベースで議論（D-03 アラート閾値で適用）
- `feedback_data_retention_default_pattern.md` — 永続スタート（D-01 監査ログで適用）
- `project_tree_toss_focus_principle.md` — トス集中（D-02 / D-04 で適用）
- `feedback_ui_first_then_postcheck_with_godo.md` — UI 先行（D-05 PDF 出力で適用）

## 次のアクション

1. **GitHub 復旧後 push**（push plan: `C:\garden\_shared\decisions\push-plan-20260426-github-recovery.md`）
2. PR 発行（develop 向け、レビュー: a-bloom）
3. PR レビュー → develop merge → 実装 Phase 着手判断（東海林さん）
4. Tree Phase D 実装プラン v3（`docs/superpowers/plans/2026-04-25-tree-phase-d-implementation.md`）の更新検討（本改訂を反映するか、別 PR で v3.1 起草するか）

## 備考

- 本 handoff は **spec 改訂のみ**、コード変更なし
- 干渉回避遵守: a-bud / a-auto / a-soil / a-root / a-leaf / a-forest の進行中ブランチに非接触
- main / develop 直接 push なし
- 判断保留が出なかったため pause file 作成不要

---

## 改訂履歴

| 日付 | 版 | 改訂内容 | 担当 |
|---|---|---|---|
| 2026-04-26 | v1.0 | a-main 006 確定 42 件 + 新規 17 件 + 既存実装整合 8 項目を全 6 spec + 新規 2 spec に反映完了 | a-tree |
