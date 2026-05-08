# dispatch main- No. 95 — 2 セッション一括返答（soil Phase B-01 着手 GO / leaf # 4 OCR 7 論点 全 OK）

> 起草: a-main-013
> 用途: a-soil Phase B-01 着手 GO / a-leaf-002 # 4 OCR 7 論点 全暫定提案 OK
> 番号: main- No. 95
> 起草時刻: 2026-05-07(木) 19:21

---

## 投下用短文 A（東海林さんが a-soil にコピペ）

~~~
🟢 main- No. 95
【a-main-013 から a-soil への dispatch（Batch 16 8/8 完成 評価 + Phase B-01 着手 GO）】
発信日時: 2026-05-07(木) 19:21

soil-40 受領、Batch 16 第 3 弾完走 + 8/8 完成（100%） + 累計 2,237 insertions / 31 tests green / 約 11 倍速 = 圧倒的成果。

詳細は以下ファイル参照:
[docs/dispatch-main-no95-soil-phase-b01-leaf-ocr-7-replies-20260507.md](docs/dispatch-main-no95-soil-phase-b01-leaf-ocr-7-replies-20260507.md)

## Batch 16 100% 完成 評価 🏆

| spec | 状態 |
|---|---|
| #01-#03 + #05-#08 | ✅ 完成（migrations 6 本 + TypeScript 2 ファイル + 31 tests green）|
| #04 インポート戦略 | ⏳ Phase B-01 で実装（仕様確定済）|

設計実装の **8/8 = 100%** 達成。spec 工数換算 ~5.0d → 実績 ~3.5h（11 倍速）。

## ✅ Phase B-01 着手 GO（ガンガンモード継続）

東海林さんスタンス「ガンガン進める常態 / 進めれない事情あるか?」整合 + 余力あり + リスク低 = **継続 GO**。

### 着手範囲
- Phase B-01 リストインポート skeleton + tests（Kintone API 30 万件取込）
- 想定 1.5d → ガンガンモードで圧縮目標
- 苦戦時自走判断で停止 OK（無理しない）

### 自走判断 OK の範囲
- TDD で skeleton + tests
- Kintone API 連携実装
- 行けるところまで進む
- 設計判断 / バグリスク高 → 即 soil-N で a-main-013 経由

## ⚠️ 適用前確認事項 4 件（東海林さん認知）

soil-40 §「適用前確認事項」の 4 件、認知済みです:

1. handle_pd_number_change の leaf_kanden_cases INSERT 列 = 最小 3 列（spec 6 列の保留は妥当判断）→ a-leaf 経由で実 schema 確認後に拡張
2. root_audit_log 書込 = 動的判定 + EXCEPTION 吸収（a-root 確定後に更新）
3. pg_trgm 拡張 = 他モジュールでも利用、drop しない
4. GIN trigram INDEX 作成時間 = 253 万件投入後は CONCURRENTLY 必須

→ apply は東海林さん別途承認後（CLAUDE.md ルール継続）。garden-dev 適用時の注意事項として認識。

## ガンガン自走判断 評価

soil-40 §「ガンガンモード自走判断したもの」3 点全て妥当:
- handle_pd_number_change INSERT 列最小化（schema 差異リスク回避）
- root_audit_log 動的判定 + EXCEPTION 吸収（先送り戦略）
- memo trigram INDEX defer（spec 通り）

→ 継続して自走判断で進めて OK。

完走 / 区切り報告は soil-N（次番号）で。
~~~

---

## 投下用短文 B（東海林さんが a-leaf-002 にコピペ）

~~~
🟢 main- No. 95
【a-main-013 から a-leaf-002 への dispatch（# 3 TimeTree 完成 評価 + # 4 OCR 7 論点 全 OK）】
発信日時: 2026-05-07(木) 19:21

leaf-002-8 受領、# 3 TimeTree spec 30 分完成（4 倍速）+ PR #133 発行 = 順調。# 4 OCR 7 論点 全 OK です。

詳細は以下ファイル参照:
[docs/dispatch-main-no95-soil-phase-b01-leaf-ocr-7-replies-20260507.md](docs/dispatch-main-no95-soil-phase-b01-leaf-ocr-7-replies-20260507.md)

## # 4 OCR 7 論点 全暫定提案 OK

| # | 論点 | 採用 | 根拠 |
|---|---|---|---|
| 1 | エンジン: **Google Vision API** | ✅ | 日本語精度 + Google Workspace 連携、バランス良 |
| 2 | 課金: 月 200 円想定 | ✅ | 月 1000 件 OCR で $1.5、業務効率化価値が圧倒的 |
| 3 | Phase 配置: **C（補完）** | ✅ | A-1c v3.2 + B-2 TimeTree 完成後の自然な次フェーズ |
| 4 | 対象帳票: **3 段階展開**（受領書 → メーター → 手書き）| ✅ | 段階的に低リスクから着手、誤認識許容範囲を見極め |
| 5 | 保存先: ocr_text 列 + 履歴テーブル | ✅ | データ保全 + 監査可能性確保 |
| 6 | タイミング: **B 案 バックグラウンド** | ✅ | API 課金スパイク回避、優先度低画像は後回し可能 |
| 7 | 信頼度しきい値: **80%** | ✅ | 80% 未満は人手確認フラグ + ハイライト表示 |

→ # 4 OCR spec 起草着手 GO（自走、論点さらに発生したら都度 leaf-002-N で）。

## # 3 TimeTree spec §8 残課題（記録）

- TimeTree 公式エクスポート CSV の実列名 / 形式 確認（実機で 1 件試行）
- TimeTree 添付画像の DL 方法
- 移行用一時表「TimeTree ユーザー名 → 社員番号」整備（Root 側 User mapping UI 起票検討）

→ Phase B-2 着手時に確定で OK（spec 起草段階では確認不要）。

## PR 4 件 状態（記録）

| PR # | 内容 | 状態 |
|---|---|---|
| #130 | spec/plan v3.2 改訂 | OPEN |
| #131 | 将来拡張 設計指針 spec | OPEN |
| #132 | Phase A 着手前 準備ガイド | OPEN |
| **#133** | TimeTree 移行 設計書（Phase B-2）| OPEN |

→ 5/8 以降の a-bloom レビュー待ち（Leaf は 5/14-16 デモ対象外、品質優先）。

## # 4 OCR spec 起草継続

工数 2.0h 想定 → ガンガンモードで 30 分-1h 圧縮見込み。完走 / 区切り報告は leaf-002-N（次番号）で。
~~~

---

## 1. 背景

### 1-1. 2 セッション同時受領（20:15, 20:25）

| セッション | 内容 | 評価 |
|---|---|---|
| a-soil | soil-40: Batch 16 第 3 弾完走 / 8/8 = 100% 完成 | 🏆 設計実装完了 |
| a-leaf-002 | leaf-002-8: # 3 TimeTree spec 30 分完成 + # 4 OCR 7 論点 | ⭐ 4 倍速継続 |

### 1-2. 私の判断（推奨採用、ガンガンモード）

| 案件 | 判断 |
|---|---|
| a-soil Phase B-01 着手 | 継続 GO（東海林さんスタンス整合、進めれない事情なし）|
| a-leaf-002 # 4 OCR 7 論点 | 全暫定提案 OK = 自走継続 |

---

## 2. a-soil 詳細

### 2-1. Batch 16 100% 完成 評価

- 第 3 弾完走（Index #05 + handle_pd_number_change）
- 累計 6 migrations + 2 TypeScript + 31 tests green
- 2,237+ insertions、3 commits
- 工数 **約 11 倍速**（spec ~5.0d → 実績 ~3.5h）

### 2-2. handle_pd_number_change の設計評価

| 観点 | 内容 |
|---|---|
| SECURITY DEFINER + search_path 固定 | SQL injection 防御 |
| 入力検証 3 種 | NULL / 空 / 存在確認 |
| Trx 内 4 段階整合更新 | soil_lists / leaf_kanden_cases (latest → replaced) / 新規 latest / root_audit_log |
| jsonb 結果返却 | ok / new_case_id / replaced_count / audit_logged |
| GRANT EXECUTE TO authenticated | anon 不可、適切な権限制御 |

### 2-3. Phase B-01 着手 GO 理由

| 観点 | 内容 |
|---|---|
| Spec | 既存（Batch 16 #04 = Phase B-01）|
| 余力 | 3.5h で 5.0d = 余力大 |
| リスク | 低（TDD で skeleton、apply は別途承認）|
| 東海林さんスタンス | ガンガン継続 |

---

## 3. a-leaf-002 詳細

### 3-1. # 3 TimeTree spec 30 分完成 評価

- 304 行、6 論点全採用、Phase B-2 配置、見積 2.5d
- PR #133 OPEN
- 工数 4 倍速（見積 2h → 実 30 分）

### 3-2. # 4 OCR 7 論点 全 OK 理由

| # | 論点 | OK 理由 |
|---|---|---|
| 1 | Google Vision API | 日本語精度 + Workspace 連携でバランス良 |
| 2 | 月 200 円想定 | 業務効率化価値が圧倒的（200-500 件案件 × 5 添付）|
| 3 | Phase C 配置 | A-1c v3.2 + B-2 完成後の自然な次フェーズ |
| 4 | 3 段階展開（受領書 → メーター → 手書き）| 段階的にリスク低減、定型文から着手 |
| 5 | ocr_text 列 + 履歴テーブル | データ保全 + 監査可能性 |
| 6 | バックグラウンド処理 | API 課金スパイク回避 |
| 7 | 信頼度 80% | 適切な閾値（80% 未満は人手確認フラグ + ハイライト）|

### 3-3. # 3 TimeTree spec 残課題（記録）

Phase B-2 着手時に確定で OK:
- TimeTree CSV 実列名 / 形式（実機 1 件試行）
- 添付画像 DL 方法
- ユーザー名 → 社員番号 mapping（Root 側 UI 起票）

---

## 4. dispatch counter / 後続予定

- a-main-013: main- No. 95 → 次は **96**（counter 更新済）

---

## 5. 関連 dispatch / 並行進行

| dispatch | 状態 |
|---|---|
| main- No. 91-94 | 各種 進行中 / 完了 |
| **main- No. 95（本書、soil + leaf 返答）** | 🟢 投下中 |

並行起動中:
- 5/13 統合テスト計画 spec ✅ 完了（commit 済）

---

ご確認・ガンガン継続お願いします。判断保留即上げ歓迎です。
