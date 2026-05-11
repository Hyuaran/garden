# dispatch main- No. 121 — a-tree（下準備 3 件完走評価 + 判断仰ぎ 3 件全回答）

> 起草: a-main-014
> 用途: a-tree tree-15 受領 + 下準備 3 件完走評価 + ESLint defer / Breeze 齟齬 / ng_timeout 不整合 判断回答
> 番号: main- No. 121
> 起草時刻: 2026-05-08(金) 12:40

---

## 投下用短文（東海林さんが a-tree にコピペ）

~~~
🟢 main- No. 121
【a-main-014 から a-tree への dispatch（下準備 3 件完走評価 + 判断仰ぎ 3 件全回答）】
発信日時: 2026-05-08(金) 12:40

tree-15 受領、下準備 3 件完走 + ESLint defer + 追加発見 1 件（ng_timeout 不整合）+ Breeze 齟齬資料化 = 非常に丁寧な分析です。

詳細は以下ファイル参照:
[docs/dispatch-main-no121-tree-prepwork-3-decisions-answer-20260508.md](docs/dispatch-main-no121-tree-prepwork-3-decisions-answer-20260508.md)

## 下準備 完走評価

| # | タスク | 結果 |
|---|---|---|
| ✅ #1 | PR #128 / #129 review トラック | OPEN / MERGEABLE / Vercel preview Ready |
| ✅ #2 | D-03 manager UI spec 精読 + 8 Step task 分解（合計 0.8d）| 完走、判断保留 7 件併記 |
| ✅ #3 | Breeze 役割齟齬 説明資料化 | 既存 page.tsx vs spec §3.4 完全別物確定、案 A/B/C 提示 |
| 🟡 #4 | ESLint 11 errors 詳細リスト化 | defer（npm install permission 拒否）|

## 判断仰ぎ 3 件 全回答

### 質問 1: ESLint defer 解消方針 → **案 2 採用**

| 案 | 内容 | 採否 |
|---|---|---|
| 案 1 | 東海林さん別 PowerShell で npm install | ❌ 不要 |
| **案 2** | **D-06 テスト戦略実装フェーズで合わせて対処** | ✅ **採用**（緊急性低、推奨理由整合） |

理由:
- ESLint 11 errors はタイマー系の既知問題（D-06 で本格対処）
- α 版完走後の D-06 着手時に詳細化 + 修正で時系列整合
- 東海林さん別 PowerShell 代行は a-bloom-004（vitest 環境）で先行使用中、Tree も同時投入は負荷分散の観点で後回し OK

### 質問 2: Breeze 役割齟齬 → **案 B 簡易版採用**（修正版）

| 案 | 内容 | 採否 |
|---|---|---|
| A | spec の Breeze 削除/リネーム + 既存チャット維持 | ❌ Phase D 構成に穴空き |
| **B 簡易版** | **既存チャット実装は維持、spec §3.4 Breeze は別途新規作成、Rill リネーム後に統合判断** | ✅ **採用** |
| C | 既存 page.tsx を 2 機能併設（タブ切替）| ❌ UX 複雑化 |

理由:
- spec-tree-rill-rename.md（Breeze→Rill リネーム）が develop 未取込 = a-root-002 集約役 5/10 で吸収候補
- Rill モジュールは Phase 最後着手（CLAUDE.md §18）、Phase D 期間は既存チャット維持が現実的
- spec §3.4 Breeze（連続架電モード）は **D-04 トスアップフロー着手時に新規作成**（α 版完走後、Sprout / Branch と並列）
- 5/14-16 デモ後の Phase D 残実装で対応

### 質問 3: ng_timeout 不整合 → **案 A 採用**

| 案 | 内容 | 採否 |
|---|---|---|
| **A** | **spec D-02 §3.6 を「'ng_other' に降格 + memo「タイムアウト」記録」に修正、メモ運用で対処** | ✅ **採用** |
| B | D-01 schema CHECK 制約に 'ng_timeout' 追加（13 種化） | ❌ schema 変更コスト + ハンドオフ書スタンスに反する |
| C | 期限超過時の自動降格廃止、手動 NG 入力に統一 | ❌ UX 後退 |

理由:
- ハンドオフ書「'ng_other' 集約採択済」のスタンス踏襲
- schema 変更ゼロ、spec 修正のみで完了
- メモ運用で「タイムアウト」記録 = 後追い分析可能

### 追加確認事項: 5/5 D-02 完走 commit 7dfee13 の confirm-wait 期限超過処理

a-tree 自走判断で **commit 7dfee13 の `/tree/confirm-wait` 期限超過実装を確認**してください:
- 既に 'ng_other' 降格 + memo 「タイムアウト」で実装済 → ✅ 案 A 整合、追加対応不要
- 未実装 or 別実装 → 案 A の修正対応必要、tree-N で報告

確認結果次第で 5/8-12 の対応判断（α 版完走前 or 後）。

## spec § 0 確定事項 develop 未取込問題

ハンドオフ書記載「§0 確定 7 件、有効率 eff 絶対値ベース」の develop 未取込問題:
- spec-tree-phase-d-decisions-applied ブランチで反映済の可能性
- a-root-002 集約役 5/10（root_module_design_status migration）で吸収候補
- Tree は本日着手不要、a-root-002 集約役で確認

## 5/8 残下準備（option）

下準備 3 件完走、4 件目 ESLint defer 後の選択肢:

| # | 作業 | 工数 |
|---|---|---|
| 5 | spec D-02 §3.6 修正（案 A 採用、spec 文言のみ）| 0.1d |
| 6 | spec-tree-phase-d-decisions-applied ブランチの develop 取込確認 | 0.1d |
| 7 | D-04 トスアップフロー spec 精読（α 版完走後の準備）| 0.3d |
| 8 | confirm-wait 期限超過実装確認（commit 7dfee13）| 0.05d |

→ ガンガン継続なら #5 + #6 + #8 即実施 OK（合計 0.25d）。

## 自走判断 GO 範囲

- 案 2 / 案 B 簡易版 / 案 A の 3 件採用、自走実施 OK
- spec D-02 §3.6 修正は spec 文言のみ、実装変更なし
- confirm-wait 期限超過実装確認は read-only
- 苦戦 / 設計判断必要 → 即 tree-N で a-main-014 経由

## 制約遵守（再掲）

- 動作変更なし（既存コードは触らない）
- 新規 npm install 禁止（ESLint defer 維持）
- Supabase / FileMaker 操作禁止
- 設計判断・仕様変更なし
- main / develop 直 push なし

完走 / 区切り報告は tree-N（次番号 16）で。判断保留即上げ歓迎です。
~~~

---

## 1. 背景

### 1-1. tree-15 受領（12:38）

a-tree 中間報告:
- ✅ 完走 #1, #2, #3
- 🟡 defer #4（npm install permission denied）
- ⚠️ 追加発見: ng_timeout 不整合（spec D-02 §3.6 vs D-01 schema）
- ⚠️ spec § 0 確定事項 develop 未取込確認必要
- 判断仰ぎ 3 件

### 1-2. 私の判断（3 件即回答）

- 質問 1: 案 2（D-06 着手時、緊急性低）
- 質問 2: 案 B 簡易版（既存チャット維持、spec §3.4 Breeze は別途新規作成、Rill 後に統合）
- 質問 3: 案 A（spec 修正のみ、'ng_other' 降格 + memo）
- 5/5 commit 7dfee13 確認は a-tree 自走で

---

## 2. dispatch counter

- a-main-014: main- No. 121 → 次は **122**
- a-tree: tree-15 受領 → 次 tree-16

---

## 3. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 114（下準備 4 件 GO）| ✅ → 3 件完走 + 1 件 defer |
| **main- No. 121（本書、判断 3 件全回答）** | 🟢 投下中 |
