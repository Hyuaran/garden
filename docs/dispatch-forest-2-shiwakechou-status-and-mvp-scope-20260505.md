🔴 forest-2
【a-forest から a-main-012 への dispatch(仕訳帳 現状確認 + 5月中スコープ提案 / 回答 main- No. 62)】
発信日時: 2026-05-05(火) 21:30

a-main-012 様

main- No. 62 で頂いた仕訳帳機能 5 項目確認に対する回答です。spec を全文 read 完了、Q1〜Q5 + 推奨案 + 着手シナリオを提示します。

---

## Q1: spec ブランチの現状

| 項目 | 状態 |
|---|---|
| ブランチ | `spec/forest-shiwakechou-design`（origin にも同一あり） |
| commit | `cc35e14 docs(forest): 仕訳帳機能 Garden化 設計書を作成（暫定Forest/将来Bud移行）` ※ **1 commit のみ** |
| spec ファイル | `docs/superpowers/specs/2026-04-26-shiwakechou-bud-migration-design.md`（449 行、全文確認済） |
| develop merge | **未 merge**（develop tip = `6c31c4f`、本 spec は `f493c57` 派生で大幅遅れ） |
| PR | **未発行** |
| spec の修正・追加 commit | **なし**（cc35e14 単独、a-forest 側で何も触れていない） |

### 補足
spec ブランチが古い develop ベースのため、merge 時に develop と再 base が必要。spec 内容は無関係なので衝突リスクは低い（追加 docs ファイル 1 件のみ）。

---

## Q2: Phase 1 実装の着手状況

**🔴 完全未着手**

検証:
```bash
$ ls src/app/forest/shiwakechou
ls: cannot access 'src/app/forest/shiwakechou': No such file or directory

$ git log --all --oneline | grep -i shiwake
cc35e14 docs(forest): 仕訳帳機能 Garden化 設計書を作成…
（spec のみ、実装系 commit ゼロ）
```

つまり：
- migration 未作成
- 銀行 CSV パーサー未作成
- 確認画面 未作成
- 弥生エクスポート 未作成
- マスタ画面 未作成
- 監査ログ統合 未作成

すべてゼロからのスタート。

---

## Q3: ヒュアラン決算（〜5/9）に向けた最小スコープ提案

### a-forest 推奨：**B 案をさらに絞った "B-min"**

ご提示 3 案のうち **B 案 を採択 + さらに絞り込み**で 5/9 までの実用化を狙います。

#### B-min スコープ（5/6〜5/9 の 4 日間で完走想定）

| # | 機能 | 含む / 含まない |
|---|---|---|
| 1 | bud_* テーブル 6 件のみ（corporations / bank_accounts / master_rules / transactions / yayoi_exports / audit_log） | ✅ 含む |
| 2 | bud_intercompany_rules / bud_files | ⏸ 含まない（Phase 2） |
| 3 | 銀行 CSV パーサー：**みずほ Excel + 楽天 CSV の 2 種**（ヒュアラン決算で使用頻度高） | ✅ 含む |
| 4 | PayPay / 京都銀行 / みずほ .api 形式 | ⏸ 含まない（Excel 経由 or Python 並走で凌ぐ） |
| 5 | 自動判定: **共通マスタ参照のみ**（口座移し替え検出 / 法人間検出は後回し） | ✅ 部分 |
| 6 | マスタ初期投入: Excel → DB 一括 import script（**UI 無し**、SQL or 1 回限りスクリプト） | ✅ 含む |
| 7 | 確認画面: テーブル + 行ごと編集 + 一括 OK 化のみ（色分け・マスタ追記ボタンは Phase 2） | ✅ 最小 |
| 8 | 弥生 CSV エクスポート | ✅ 含む |
| 9 | 監査ログ（API レイヤーで `bud_audit_log` 書込のみ、表示画面は後回し） | ✅ 最小 |
| 10 | CC / MF / 現金 | ⏸ Phase 2 |
| 11 | Supabase Storage `bud-files` バケット | ⏸ Phase 2（B-min は CSV を DB に直接 INSERT、原本保管しない暫定） |

#### 工数見積（TDD 込み）

| # | タスク | 見積 |
|---|---|---|
| 1 | migration 6 テーブル + RLS（forest admin 流用）| 0.3d |
| 2 | Excel 一括 import script（共通マスタ + 口座マスタ + 法人マスタ） | 0.3d |
| 3 | 銀行パーサー 2 種（楽天 CSV + みずほ Excel）+ 共通マスタ判定 | 0.6d |
| 4 | アップロード API + 確認画面（テーブル + 編集 + OK 化） | 0.6d |
| 5 | 弥生 CSV エクスポート（カラム順 + 税区分マッピング） | 0.4d |
| 6 | 統合テスト + Python 出力との fixture 突合（最低 2 法人分） | 0.4d |
| 7 | 5/9 朝の本番リハ + 弥生取込確認（東海林さん操作） | - |
| **計** | | **約 2.6d** |

5/6 朝の権限委譲承認 → 5/9 夕までの実働 4 日（5/6, 5/7, 5/8, 5/9）= **3.4 日相当の作業時間** で射程内。並行作業（後道さん向け Q4）も含めれば +0.5d で **計 3.1d**、4 日でぎりぎり完走可能。

#### Phase 2 / Phase 3 への持ち越し

- PayPay / 京都銀 / みずほ .api: Phase 2（5/12 以降）
- CC / MF / 現金: Phase 2/3
- マスタ Web 画面（CRUD UI）: Phase 2
- 口座移し替え / 法人間検出: Phase 2
- Storage `bud-files`（原本保管）: Phase 2
- 監査ログ閲覧 UI: Phase 3

### C 案併用も推奨

5/12-16 の税理士作業中、**B-min と Python 並走** を推奨。Web 版で出力した弥生 CSV と Python 版の同月出力を東海林さんが目視 diff し、**月単位でどちらが正かを明確化**（spec §並走期間 準拠）。Web 版が信頼確保できた段階で Phase 2 着手 → 段階的に Python 廃止。

---

## Q4: 後道さん向け前日残高表示の連携可能性

**結論：実装可能、Phase 1 (B-min) と並行 + 0.5d で MVP 提供可**

### 設計

#### 画面
- `/forest/shiwakechou/balance-overview`（**全法人横断**、後道さん専用ダッシュボード視点）
- 表示内容（MVP）：
  - 法人 × 口座 マトリクス
  - 各セルに「**前日残高**（最終取込日時点の累計）」「**当日入出金合計**（取込済分のみ）」
  - 最終取込日（YYYY/M/D HH:MM）を上部に明示

#### データソース
`bud_transactions` の累計計算で算出可能（口座別 SUM(amount) by flow）。**ただし初期残高情報が必要**：

```sql
-- bud_bank_accounts に初期残高列を追加
ALTER TABLE bud_bank_accounts
  ADD COLUMN opening_balance bigint DEFAULT 0,
  ADD COLUMN opening_balance_at date;
```

東海林さんが各口座の **2026-04-30 残高** を 1 回だけ手入力 → 以降は transactions の累計で自動計算。

#### ロール設計
3 案：

| 案 | 内容 | 推奨度 |
|---|---|---|
| α | 既存 `forest_users.role='admin'` で閲覧（後道さんに admin 権限付与） | 🔴 簡易だが書込権限まで付与してしまう |
| β | `forest_users.role='executive'` を新規追加（読み取り専用） | 🟡 設計クリーンだが Forest スキーマ拡張要 |
| γ | `bud_users` テーブル新設で `bud_users.role='executive'` | 🟢 spec の「将来 Bud 移行」と整合、ただし工数 +0.3d |

→ **推奨：β 案**（最小コスト + 後道さん書込なし担保）

### 工数見積

| # | タスク | 見積 |
|---|---|---|
| 1 | bud_bank_accounts に opening_balance 列追加 | 0.05d |
| 2 | forest_users に 'executive' ロール追加 + RLS 修正 | 0.1d |
| 3 | balance-overview 画面（全法人 × 口座マトリクス） | 0.3d |
| 4 | 初期残高入力 UI（admin 限定、簡易フォーム） | 0.15d |
| **計** | | **約 0.6d** |

B-min 完走後の 5/9 夕〜5/10 夜に追加実装可能。**もしくは並行で B-min と同時着手 → 5/9 夕までに同時公開**も可能（その場合 +0.6d → B-min 2.6d + 0.6d = 3.2d、4 日でぎりぎり）。

### 注意点
- bud_transactions が**銀行明細のみ**だと CC や現金は反映されないため、後道さんの「全体現金流れ」可視化は **Phase 2 完了**で完成形に近づく
- B-min 段階では「銀行口座の出入金のみ」と明記、誤解防止

---

## Q5: 不足リソース / ブロッカー

| # | 不足 / ブロッカー | 解決方法 | 必要主体 |
|---|---|---|---|
| 1 | **既存 Python ロジック詳細**（特にみずほ .api 形式パーサ） | みずほ .api は B-min から除外 → Excel 経由運用 → 不要 | a-forest（除外で済） |
| 2 | **6 法人マスタ初期投入用データ**（共通マスタ Excel + 口座マスタ + 法人マスタ） | `1_共通マスタ_v12.xlsx` + 口座マスタを CSV エクスポート | 🟡 **東海林さん** |
| 3 | **各法人の 2026-04-30 口座残高**（後道さん向けの初期値） | 各銀行 Web から残高証明書 or 通帳記帳でデータ収集 | 🟡 **東海林さん** |
| 4 | **Supabase Storage `bud-files` バケット**（B-min では除外、Phase 2 で必要） | Dashboard で物理作成（Phase 2 着手前） | ⏸ **東海林さん**（Phase 2） |
| 5 | **forest_users 'executive' ロール追加権限** | RLS 修正 SQL は a-forest 起草、本番適用は東海林さん | 🟡 **東海林さん**（適用） |
| 6 | **後道さん用ログイン情報**（Garden アクセス確認） | 既存の forest_users に後道さんレコードがあるか確認、無ければ追加 | 🟡 **東海林さん** |
| 7 | **弥生インポートテスト用環境** | 出力 CSV を東海林さんが弥生で取込検証 | 🟡 **東海林さん**（5/9 朝 or 5/10） |
| 8 | **Python 出力 fixture**（突合用） | 4-5 月分の Python 出力 弥生 CSV を 1-2 法人分提供 | 🟡 **東海林さん** |

### 最重要ブロッカー（5/6 朝までに東海林さんから提供必須）
- **#2 マスタ Excel データ**（CSV エクスポート）
- **#8 Python 出力 fixture**（突合用、最低 1 法人分）

これがないと 5/6 着手不可。a-main-012 経由で 5/6 朝までに準備依頼お願いします。

---

## 推奨着手シナリオ（権限委譲案）

### a-forest 提案：**B-min + Q4 後道さん画面を一気通貫で実装**

```
5/5 火 23:30  本 dispatch (forest-2) 発信 → a-main-012 確認待ち
5/6 水 朝     東海林さん承認 + マスタ Excel + Python fixture 提供 → a-forest 着手
5/6 水 昼-夜  migration + import script + 楽天パーサー実装 (1.0d)
5/7 木        みずほ Excel パーサー + 確認画面 + 弥生エクスポート (1.0d)
5/8 金 昼     後道さん向け balance-overview + initial balance UI (0.6d)
5/8 金 夜     統合テスト + Python fixture 突合 (0.4d)
5/9 土 朝     東海林さん本番リハ + 弥生取込確認 + B-min 完走報告
5/9 土 昼-    残バグ修正 + Phase 2 着手判断
5/12-16      税理士作業（Python 並走で安全担保、Web 版は段階移行）
```

### 権限委譲レベル

a-main-012 から **B-min スコープ承認 + 着手 GO** を頂ければ、a-forest 単独で：
- migration 設計 + 適用依頼（東海林さん経由）
- TDD 実装
- 統合テスト
- Python 突合
- 完了報告

を遂行可能。中間判断保留が発生したら都度 forest-NN dispatch で確認。

---

## 関連状態

### a-forest 側 dispatch counter
- 現在: 次番号 = 3（forest-2 を本 dispatch で使用、commit で `docs/dispatch-counter.txt` を 3 に更新）

### admin role 流用
- spec §RLS 方針: `forest_users.role IN ('admin')` 流用（東海林さんが既に admin 保持） → B-min は変更不要
- Q4 後道さん向け 'executive' ロール追加が **B-min 中で唯一の forest_users スキーマ変更**

### ブランチ戦略提案
- B-min 実装ブランチ: `feature/forest-shiwakechou-phase1-min-202605`（develop 派生、spec ブランチに依存しない）
- spec ブランチ `spec/forest-shiwakechou-design` は**先に develop へ merge** 推奨（B-min 実装が spec をベースとするため）
  - 工数 0.05d（rebase + PR + a-bloom レビュー）

---

## 質問（a-main-012 → 東海林さんへの確認事項）

承認 / 着手 GO の前に下記 3 点お願いします：

1. **B-min スコープ採択可否**（B 案からさらに絞った形）
2. **Q4 後道さん向け画面の B-min 同梱**可否（並行実装、+0.6d）
3. **5/6 朝までにマスタ Excel + Python fixture 提供** 可否

不採択の場合は **C 案（Python 並走、Garden は post-デモ）** にフォールバック。その場合 a-forest は今週手を動かさず、5/12 以降の Phase 1 着手準備（spec の細部詰め）に切替えます。

---

## 完了想定

a-forest 回答完了。a-main-012 → 東海林さん確認 → 5/6 朝の GO 待ち。

工数（本 dispatch 作成）: 約 0.05d（spec 全文 read + 状況確認 + 5 項目回答 + 推奨案策定）

a-forest
