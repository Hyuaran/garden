# a-tree への Phase D-02 Step 4-10 続行 dispatch - 2026-04-27

> 起草: a-main 008
> 用途: a-tree が D-02 Step 1+2+3 完走後の続行 dispatch
> 前提: handoff `handoff-tree-202604272000-phase-d-02-step-1-3.md` 既存、commit bc3bcfa / 60fbc7d / be6ef68

## 投下短文（東海林さんが a-tree にコピペ）

```
【a-main-008 から a-tree へ】Phase D-02 Step 4-10 続行 dispatch

▼ 前提（既存ハンドオフから引継ぎ）
- ブランチ: feature/tree-phase-d-02-implementation-20260427（push 済、PR #未発行、Phase 3 待機）
- Step 1+2+3 完走（commit bc3bcfa / 60fbc7d / be6ef68、vitest 31/31 PASS）
- 既存 /tree/call (InCallScreen) 完全保護、新 path /tree/select-campaign 新設
- handoff: docs/handoff-tree-202604272000-phase-d-02-step-1-3.md

▼ 実装範囲（Step 4-10、合計 0.7d 想定）

Step 4: Branch 画面の Supabase 連携（0.5h）
- /tree/calling/branch（Branch クローザー架電）
- Sprout 画面（Step 3）と同パターン
- 結果ボタン 11 種（受注 / 担不 / コイン / 見込 A-C / 不通 / NG x 4）
- 既存 _constants/callButtons.ts の Branch 11 種を維持

Step 5: FM 互換ショートカット F1-F10 + Ctrl+Z/Esc/Enter 実装（1.0h）
- spec §4 のキー割当通り：
  - F1: トス (Sprout) / 受注 (Branch)
  - F2: 担不
  - F3: 見込 A
  - F4: 見込 B
  - F5: 見込 C
  - F6: 不通
  - F7: NG お断り
  - F8: NG クレーム
  - F9: NG 契約済
  - F10: NG その他
  - Ctrl+Z: 巻き戻し（5s 以内）
  - Ctrl+→: 次リスト
  - Ctrl+←: 前リスト（結果未入力時のみ）
  - Esc: メモ入力キャンセル
  - Enter: メモ確定
- 実装ポイント:
  - useEffect + window.addEventListener('keydown')、cleanup 必須
  - focus が input/textarea の場合はショートカット無効
  - ユーザー設定 ON/OFF トグル（localStorage）

Step 6: 巻き戻し UI（5 秒固定）（0.5h）
- 結果ボタン押下後 5s 以内に「巻き戻し」ボタン or Ctrl+Z で取消
- 巻き戻し時: tree_call_records UPDATE で result_code を prev_result_code に保存
- 監査ログ Trigger 'tree.call.rollback' 発火（D-01 §5）
- 5s 経過後はボタン消去
- 判断保留 #3 確定（5s 固定）

Step 7: オフライン耐性 localStorage キュー + flush ロジック（1.5h）
- spec §5 通り
- localStorage key: `tree_offline_queue_v1`、value: [{id, payload, ts}]
- 上限 500 件（判断保留 #2 確定）
- ネットワーク状態バッジ（緑 🟢 / 黄 🟡 キューあり / 赤 🔴 オフライン）
- キュー件数 > 0 の間 tree_calling_sessions close 拒否
- 競合解決: 同 session_id + list_id の重複は DB 側 unique（last-write-wins）
- UUID v4 クライアント生成（オフライン中の session_id）

Step 8: 画面遷移ガード（0.5h）
- spec §6 通り
- _components/CallGuard.tsx
- beforeunload: 通話中はブラウザ戻る・タブ閉じ警告
- SPA 内遷移: カスタム <Link> で isCalling 時 preventDefault + モーダル確認
- SidebarNav も同様にガード

Step 9: Breeze / Aporan / Confirm-wait 画面の Supabase 連携（1.5h）
- /tree/breeze（呼吸連続架電 + タイマー、duration_sec 自動取得）
- /tree/aporan（アポ予定の Leaf 連携、トスアップ準備）
- /tree/confirm-wait（同意確認待ち、期限 30 分、超過時 result_code='ng_timeout' + Chatwork Alert）
- D-04 トスアップフローへの遷移点（Leaf 案件化）

Step 10: 結合テスト・バグ修正（1.5h）
- spec §13 観点で網羅テスト
- ショートカット 10 種 × Sprout/Branch の結果 INSERT 全件
- 巻き戻し 5s 以内 / 5s 超過の境界
- オフライン→オンライン復帰時のキュー flush
- RLS: オペレーターが他人の session_id に INSERT できない
- エラー 4 種（成功 / ネット失敗 / RLS 拒否 / 巻き戻し成功）の UI 表示
- 連続 200 コールの累積遅延
- パフォーマンス（spec §9）目標達成確認

▼ 制約
- Mode 1（Subagent-Driven）継続
- 既存 /tree/call、insertCall、callButtons.ts、TreeStateContext は不変
- 既存 select-campaign + Sprout 画面（Step 1-3）と完全互換
- Tree 特例 §17 厳守（α → 1人 → 2-3人 → 半数 → 全員、慎重展開）

▼ 詰まり時
即停止 → a-main 経由で東海林さんに相談
特に Step 5 のキーボードイベント実装、Step 7 のオフライン耐性は複雑度高い、判断保留があれば即停止

▼ 完了報告
全 10 ステップ完走 → handoff + a-review 依頼。
α 版（東海林さん 1 人テスト）開始判断材料として、bug-free + パフォーマンス目標達成が条件。

▼ 報酬
これで Tree Phase D-02 オペレーター UI が完成、FileMaker 代替の中核機能が α 版稼働可能。
品質最優先で進めてください。
```

## 完了後の進行

| Step | 内容 | 担当 |
|---|---|---|
| 1 | 東海林さんが a-tree に上記短文をコピペ投下 | 東海林さん |
| 2 | a-tree が Step 4-10 を 0.7d で完走（並行作業 OK）| a-tree |
| 3 | 完走報告 + handoff + Vercel build 確認 | a-tree → a-main |
| 4 | a-review 依頼（新 PR 発行）| a-main → a-review |
| 5 | α 版 開始判断（Tree 特例 §17 1 人テスト）| 東海林さん |

## 改訂履歴

- 2026-04-27 初版（a-main 008、Phase D-02 Step 1+2+3 完走後の続行 dispatch）
