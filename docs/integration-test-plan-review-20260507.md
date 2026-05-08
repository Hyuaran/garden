# 5/13 統合テスト Plan レビュー（5/14-16 デモ前提で見直し）- 2026-05-07(木) 21:58

> 起草: a-main-014
> 対象: [docs/superpowers/plans/2026-05-13-garden-series-integration-test-plan.md](docs/superpowers/plans/2026-05-13-garden-series-integration-test-plan.md)（273 行、a-main-013 + Plan agent 起草）
> 用途: 5/8 → 5/14-16 デモ延期 + 認証統一実装決定 + 12 モジュール化反映に伴う Plan 整合性確認
> ステータス: レビュー結果、東海林さん判断後に Plan 改訂 or そのまま運用

---

## 1. 総評

| 観点 | 評価 | 備考 |
|---|---|---|
| 構成 | 🟢 健全 | 環境 / 役割 / シナリオ / 失敗手順 / タイムテーブル / チェックリスト揃い |
| 5/14-16 デモ前提 | 🟢 整合 | F4 で 5/14-16 デモ延期判断既記載、整合 OK |
| 認証統一前提 | 🟢 整合 | S1-S6 で /login → role 別振分け → garden-home が中核、整合 OK |
| 9 時間 + 予備 2 時間 | 🟢 妥当 | 08:00-19:00 = 11 時間、予備 2h 確保 |
| Test Accounts | 🟢 妥当 | CEO 0001 / admin 0002 / manager 0010 / staff 0100 / 未登録 9999 |
| 主要更新箇所 | 🟡 4 件 | 下記詳細 |

→ **大筋このまま運用 OK**、4 箇所の更新で 5/14-16 デモ前提に完全整合可能。

---

## 2. 主要更新箇所（4 件、優先度順）

### 更新 #1: 指揮セッション名 a-main-013 → a-main-014（22 箇所）

**現状**: Plan 内で「a-main-013」が指揮セッションとして 22 箇所登場。
**問題**: 既に a-main-013 → a-main-014 引き継ぎ済み（5/7 19:00 頃）。5/13 当日は a-main-014 or 後継（a-main-015 等）が指揮。
**推奨**:
- 「a-main-013」→「a-main-014（または当日の現役 a-main-NNN）」に書き換え
- または「a-main 系統（指揮セッション）」に汎用化

**置換例**:
```
旧: a-main-013 が指揮セッションとして
新: a-main-014（5/13 当日の現役 a-main 系統）が指揮セッションとして
```

→ 5/13 までに更に世代交代する可能性あり（5/8-12 で 1-2 世代）、汎用記述が無難。

### 更新 #2: モジュールセッション名 世代調整（11 箇所）

**現状**: 役割分担表で「a-bloom / a-forest / a-tree / a-bud / a-leaf / a-root / a-soil / a-rill / a-sprout / a-calendar / a-fruit / a-seed」と記載。
**問題**: 実際の現役セッション名は世代付き（a-bloom-004 / a-forest-002 / a-leaf-002 / a-root-002 等）。
**推奨**:
- 「a-bloom-004（または当日の現役 Bloom 系統）」形式に
- または現状のまま「a-bloom」で汎用化（CLAUDE.md §11 のセッション分類に準拠）

| 現 Plan 記載 | 5/7 21:58 時点の現役 |
|---|---|
| a-bloom | a-bloom-004 |
| a-forest | a-forest-002 |
| a-tree | a-tree（無印） |
| a-bud | a-bud（無印） |
| a-leaf | a-leaf-002 |
| a-root | a-root-002 |
| a-soil | a-soil（無印） |
| a-rill | 休眠中（5/8 起動予定） |
| a-sprout | 未起動（仮モジュール） |
| a-calendar | 未起動 |
| a-fruit | 未起動（実体化予定、Phase B） |
| a-seed | 休眠中 |

→ 5/13 までに sprout/calendar/fruit が起動済みかの確認必要。

### 更新 #3: claude.ai 起草版 login.html / garden-home.html を S2-S6 シナリオに反映

**現状**: シナリオ S2-S6 で「/login」「/」（garden-home）を使用、ただし「claude.ai 起草版」が反映済かは未明記。
**問題**: 5/14-16 デモ用 demo-rehearsal-garden では推奨表示順 1-2 に /login + /garden-home（claude.ai 起草版）を配置。5/13 統合テストで世界観確認も必要。
**推奨**:
- S2-S6 の各シナリオに「claude.ai 起草版 login + garden-home の世界観表示確認」を追記
- スクショ取得（demo-rehearsal-garden で再利用可能）

### 更新 #4: 12 モジュール構成の最終確定 + 巡回シナリオ S6 の対象明示

**現状**: 役割分担で 12 モジュールリストアップ、ただし sprout/calendar/fruit の実装状況不明確。
**問題**: 5/13 当日に「sprout 未着手だから対象外」のような対応が必要かも。
**推奨**:
- S6 巡回対象を「実装済モジュール（5/12 EOD 時点）」に限定
- 未着手モジュールは「概念のみ / 後日着手」と明記、巡回スキップ
- 5/13 当日のモジュール実装状況確認 task を Task 0 に追加

---

## 3. 軽微な更新候補（優先度低、なくても運用可）

### 更新 #5: 5/13 タイムテーブル開始時刻

**現状**: 08:00-19:00 = 11 時間
**観察**: 東海林さんの通常 PC 立ち上げ時刻は不明、08:00 開始は早い可能性
**推奨**: 09:00 開始 + 19:00 終了 = 10 時間も選択肢、または現状維持

### 更新 #6: F4 デモ延期判定基準の精度向上

**現状**: 18:00 / 19:00 の 2 回判定
**観察**: 5/14 デモ朝（08:00 想定）まで 13 時間あれば、19:00 → 翌朝 03:00 まで深夜延長対応も可能
**推奨**: 19:00 判定で「即延期」ではなく「深夜延長 or 5/15 へ繰下げ」の選択肢併記

### 更新 #7: Vercel preview の取扱い

**現状**: L2 Vercel preview を Task 3 で使用
**観察**: develop → main マージ済みの前提だと preview は不要、main 直接で L1 → L3
**推奨**: L2 を「main マージ前の最終確認」用にするか、削除するか明確化

---

## 4. 強み（Plan として既に優秀な点）

- ✅ 9 時間 + 予備 2 時間の余裕設計
- ✅ Failure Procedure F1-F4 の段階的対応（単一画面 → 認証 → デプロイ → 延期判断）
- ✅ Dispatch Template の用意（修正依頼が即実行可能）
- ✅ Test Accounts の役割別 5 ID 設計
- ✅ シナリオ S1-S7 の正常系 + 異常系カバー
- ✅ Self-Review チェックリスト 10 項目で品質担保

---

## 5. 推奨アクション（東海林さん判断仰ぎ）

| # | アクション | 推奨度 | タイミング |
|---|---|---|---|
| 1 | 更新 #1（指揮セッション汎用化）即実施 | 🟢 高 | 5/8 朝 |
| 2 | 更新 #2（モジュールセッション名汎用化）即実施 | 🟢 高 | 5/8 朝 |
| 3 | 更新 #3（claude.ai 起草版 login 反映）追加記述 | 🟡 中 | 5/12 までに |
| 4 | 更新 #4（巡回対象モジュール最終確定）5/12 EOD で確定 | 🟡 中 | 5/12 EOD |
| 5 | 更新 #5-7（軽微）後追い OK | 🟡 中 | 不要可 |

→ **推奨: 更新 #1 + #2 を a-main-014 自走で即実施 + #3 + #4 は 5/12 EOD 確定**

東海林さん「Go」ならば即 Plan 改訂、commit、push で完了。

---

## 6. Plan 改訂後の派生作業

Plan 改訂と同時に進めると効率的:

- demo-rehearsal-garden-20260514-16.md（既起草）と Plan の整合性確認
- 5/13 統合テスト準備 dispatch（5/12 EOD 各セッション「Ready」報告依頼）の事前起草
- 各モジュールセッションの認証統一実装進捗 tracker 起草

---

## 7. 関連 docs

- 元 Plan: [docs/superpowers/plans/2026-05-13-garden-series-integration-test-plan.md](docs/superpowers/plans/2026-05-13-garden-series-integration-test-plan.md)
- 5/14-16 デモリハ: [docs/demo-rehearsal-garden-20260514-16.md](docs/demo-rehearsal-garden-20260514-16.md)
- 旧 5/8 デモリハ（保持）: [docs/demo-rehearsal-bloom-20260508.md](docs/demo-rehearsal-bloom-20260508.md)
- handoff: [docs/handoff-a-main-013-to-014-20260507.md](docs/handoff-a-main-013-to-014-20260507.md)
