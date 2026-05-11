# dispatch main- No. 119 — a-bud（D-04 完走評価 + D-10 統合中核 推奨 GO）

> 起草: a-main-014
> 用途: a-bud bud-16 受領 + D-04 67% 圧縮完走評価 + Phase D 中核 D-10 推奨
> 番号: main- No. 119
> 起草時刻: 2026-05-08(金) 12:36

---

## 投下用短文（東海林さんが a-bud にコピペ）

~~~
🟢 main- No. 119
【a-main-014 から a-bud への dispatch（D-04 完走評価 + D-10 統合中核 推奨 GO）】
発信日時: 2026-05-08(金) 12:36

bud-16 受領、Friday 朝 D-04 30 分完走（67% 圧縮）+ Cat 4 #26 上田 UI 正本化完成 + 累計 10 件 / 393 tests / 63% 圧縮 = 圧倒的成果。

詳細は以下ファイル参照:
[docs/dispatch-main-no119-bud-d04-complete-d10-go-20260508.md](docs/dispatch-main-no119-bud-d04-complete-d10-go-20260508.md)

## D-04 評価（67% 圧縮、spec 19 KB の重実装を 30 分で完走）

- 30 分完走（見積 1.8d、約 86 倍速、5/8 朝の最大圧縮率）
- migration 2 tables（bud_payroll_notifications + bud_salary_statements、5 段階 status + Y 案フォールバック）
- Cat 4 #26 **上田 UI 要件正本化**（spec § 2.7、UEDA_VISUAL_CHECK_UI_REQUIREMENTS const）
  - autoTimeoutSeconds: null（自動 timeout なし）
  - editableFields: []（編集権限なし）
  - canExecuteTransfer: false（振込実行は東海林専任）
  - rowLayout: 6 項目、allowedActions: 4 種、notificationChannel: garden_internal_only
  - D-10 §6.3 / D-07 §4.1 から本定数を import で参照する設計
- 純関数 8 種（decideDeliveryMethod / generateOneTimeToken / generateStrongPassword 等、暗号学的安全）
- Vitest 64 tests green（権限自動検証 + 境界 + 形式検証）
- 判断保留なし、設計判断・仕様変更なし
- 新規 npm install なし（crypto Node.js 内蔵）

## Cat 4 #26 上田 UI 要件正本化の意義

D-04 で UI 要件を正本化した結果:
- D-10 が D-04 const を import で参照可能
- D-07 振込実行 UI も D-04 const を import で参照可能
- **複数 spec の UI 要件分散を防ぎ、上田 UI の一貫性確保**
- 「急かす UI 禁止」「編集権限なし」「振込実行は東海林専任」の原則が単一定数で表現

## 次タスク 推奨 GO

| 候補 | 内容 | 工数 | 性質 | Friday 朝適性 |
|---|---|---|---|---|
| **D-10 推奨** | payroll integration（4 次 follow-up 7 段階 + 5 ロール、統合中核）| 2.9d | 統合中核 | ◎（fresh 集中力で投資）|
| D-08 | payroll test（中規模、TDD test）| 1.0d | 中規模 | ◎ |
| D-12 | schedule（7 stage Cron + 上田向けリマインダ）| 1.05d | 中規模 | ◎ |
| D-06 | nenmatsu integration（Phase C 連動）| 1.5d | 中規模 | ○ |

東海林さんスタンス（ガンガン常態）+ Friday 朝 fresh 集中力 = **D-10 強推奨**:

- **D-10 強推奨**（Phase D 統合中核、4 次 follow-up 7 段階 + 5 ロール、Cat 4 #26 / #27 / #28 全反映済の集大成）
- D-04 で正本化した上田 UI 要件 const を D-10 §6.3 で import 参照可能
- D-07 / D-11 の 3 経路同時出力基盤も D-10 で統合
- D-10 完成 → Phase D 9/12 = 75% 達成、Phase D 完走見据え可
- 苦戦 / 集中切れ → 自走判断で停止 OK

## 自走判断 GO 範囲

- D-10 着手 → 4 次 follow-up 7 段階 status + 5 ロール × 7 段階権限マトリクス
- 既存 D-01〜D-09 / D-11 helpers + Cat 4 #26 const import OK
- 既存 spec 完全準拠
- 苦戦 / 設計判断必要 → 即 bud-N で a-main-014 経由
- npm install は禁止（既存依存のみ）

## 5/7-5/8 累計成果（評価）

| 指標 | 値 |
|---|---|
| 完走タスク | **10 件**（D-01 + D-09 + D-05 + UI v2 + D-02 + bud.md + D-03 + D-07 + D-11 + D-04）|
| 累計工数 | **3.7d / 10.05d = 63% 圧縮** |
| Vitest | **393 tests all green** |
| Cat 4 反映 | **4 件完了**（#26 上田 UI 正本化 + #27 同時出力 3 経路 + #28 admin only RLS、+ Cat 4 #26 補強）|
| Phase D 進捗 | **8/12 件完成（67%）** |

## 5/8 残作業（Friday 中の最大投資）

D-10 統合中核 完走（5/8 12:36-17:00、4-5 時間想定で 67% 圧縮なら完走可能）+ /bloom/progress 表示反映ロジック準備（a-bloom-004 連携、optional）。

## 制約遵守（再掲）

- 動作変更なし
- 新規 npm install 禁止（crypto Node.js 内蔵 + bcrypt 必要時のみ判断）
- 設計判断・仕様変更なし
- 本番影響なし
- main / develop 直 push なし
- 既存 helpers 再利用 + spec § 2.7 UI 要件 const import

完走 / 区切り報告は bud-N（次番号 17）で。判断保留即上げ歓迎です。
~~~

---

## 1. 背景

### 1-1. bud-16 受領（12:35）

a-bud Day 7 D-04 完走報告:
- 30 分で完走、67% 圧縮（spec 19 KB の重実装を fresh 集中力で）
- migration 2 tables + 純関数 8 種 + Vitest 64 tests green
- Cat 4 #26 上田 UI 要件正本化（UEDA_VISUAL_CHECK_UI_REQUIREMENTS const）
- 累計 10 件、3.7d / 10.05d、393 tests all green
- 判断保留なし
- Friday 朝 fresh 集中力継続中

### 1-2. 私の判断（D-10 統合中核 推奨）

- D-10 = Phase D 統合中核、Friday 朝 fresh 集中力の最大投資先
- D-04 で正本化した UI 要件 const を D-10 で import 参照可能
- D-07 / D-11 の 3 経路同時出力基盤も D-10 で統合
- D-10 完成 → Phase D 9/12 = 75% 達成

---

## 2. dispatch counter

- a-main-014: main- No. 119 → 次は **120**
- a-bud: bud-16 受領 → 次 bud-17

---

## 3. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 102（5/8 朝 起動 + D-04 着手 GO）| ✅ → D-04 完走 |
| **main- No. 119（本書、D-04 評価 + D-10 統合中核 推奨）** | 🟢 投下中 |
