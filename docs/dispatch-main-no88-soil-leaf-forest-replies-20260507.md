# dispatch main- No. 88 — 3 セッション一括返答（a-soil Q1-Q3 / a-leaf-002 # 3 # 4 / a-forest-002 受領 OK）

> 起草: a-main-013
> 用途: 3 セッション同時受領への一括返答
> 番号: main- No. 88
> 起草時刻: 2026-05-07(木) 18:36

---

## 投下用短文 A（東海林さんが a-soil にコピペ）

~~~
🟢 main- No. 88
【a-main-013 から a-soil への dispatch（Q1-Q3 回答 / PR #101 軽微 3 件 A 案 + 並行作業 全 GO）】
発信日時: 2026-05-07(木) 18:36

soil-4 受領、PR #101 消失問題 + 判断仰ぎ 3 点 確認しました。東海林さん回答含めて回答します。

詳細は以下ファイル参照:
[docs/dispatch-main-no88-soil-leaf-forest-replies-20260507.md](docs/dispatch-main-no88-soil-leaf-forest-replies-20260507.md)

## Q1: PR #101 軽微 3 件: ✅ A 案採用（不明のまま新規 PR で進む）

東海林さんから「まったくわからない」回答（別ルート保存なし）。

判断:
- 重要 5 件 🔴 R-1〜R-5 は `db5255a` で反映済 = 主要品質確保済
- 軽微 3 件は詳細不明、新規 PR で a-review が再レビュー時に再指摘される可能性あり（自然な再発見）
- A 案で進む = 不明のまま新規 PR、軽微対応は再レビュー時に対応

## Q2: 新規 PR 発行先: ✅ 推奨通り採用

| 項目 | 確定 |
|---|---|
| 発行元ブランチ | `feature/soil-phase-b-decisions-applied`（5 commit ahead） |
| 発行先 | develop |
| タイトル | `docs(soil): Phase B 7 spec (Batch 19) + B-03 §13 5 件確定 + a-review R-1〜R-5 修正` |
| C 垢発行 | OK（GitHub 復旧 + auth 確認済、署名問題なし）|

PR body には「PR #101 が C 垢移行で消失したため、本 PR で代替」を明記推奨。

## Q3: 並行作業: ✅ 全て即着手 OK

| タスク | 着手 |
|---|---|
| T1: feature/soil-batch16-impl 新規ブランチ作成 | ✅ |
| T2: Batch 16 基盤 8 spec の migration SQL ドラフト | ✅（apply はせず）|
| T3: TypeScript 型定義 (src/lib/db/soil-types.ts 等)| ✅ |
| T4: TDD で soil-helpers.ts (pgcrypto ラッパー、論理削除等)| ✅ |
| Phase B-01 リストインポート skeleton + tests | ✅ |
| コール履歴 335 万件 import 設計 追加詳細化 | ⚠️ 既存 B-02 spec 447 行で十分判定、実装着手時に追加要否判断（ガンガンモードで自走判断 OK）|

注意:
- garden-dev への migration apply は東海林さん別途承認後（CLAUDE.md ルール継続）
- 5/8 朝〜5/10 で T1-T4 完走見込み（soil-4 §工数見込み通り）
- 5/11-12 で Phase B-01 実装

完走 / 区切り報告は soil-N（次番号）で。
~~~

---

## 投下用短文 B（東海林さんが a-leaf-002 にコピペ）

~~~
🟢 main- No. 88
【a-main-013 から a-leaf-002 への dispatch（# 3 # 4 事前承認方針 / 全前倒し継続）】
発信日時: 2026-05-07(木) 18:36

leaf-002-5 受領、# 1 spec v3.2 改訂 即着手 OK。# 3 # 4 方針確認に回答します。

詳細は以下ファイル参照:
[docs/dispatch-main-no88-soil-leaf-forest-replies-20260507.md](docs/dispatch-main-no88-soil-leaf-forest-replies-20260507.md)

## # 3 TimeTree 移行 spec / # 4 OCR spec: ✅ A 案（事前承認方針）採用

東海林さんの「ガンガン進める」延長で:
- # 3 / # 4 spec 起草を **a-leaf-002 自走判断で着手 OK**
- 起草段階で発生する **論点リスト**は **都度 a-main-013 経由で東海林さんに即上げ**
- 東海林さん即回答 → a-leaf-002 即継続

# 3 TimeTree 想定論点（参考）:
- 移行戦略（A 自動 / B 半自動 / C 手動）
- Phase 配置（B-1 / B-2 / C）
- TimeTree API rate limit 調査要否
- 既存予定データ件数 + import 範囲

# 4 OCR 想定論点（参考）:
- エンジン選定（Tesseract OSS / Google Vision / Azure Computer Vision）
- 課金影響（pay per use の推定月額）
- Phase 配置（B / C / D）
- 対象帳票（請求書 / 領収書 / 名刺 / 等）

これらは a-leaf-002 が spec 起草段階で具体化 → 判断保留点を都度上げる形で進めて OK。

## 着手順序（a-leaf-002 提示通り）

1. ✅ # 1 spec v3.2 改訂（即着手、確定済修正反映、約 1h）
2. ✅ # 2 Phase A UI test plan + skeleton 整理（# 1 完走後、約 1.5h）
3. ✅ # 3 TimeTree 移行 spec 起草（# 2 完走後、約 2h、論点都度上げ）
4. ✅ # 4 OCR spec 起草（# 3 完走後、約 2h、論点都度上げ）

合計 6.5h 想定 → 5/7 夜〜5/8 中で完走見込み。

## ローカル commit / push

- ローカル commit OK
- push は GitHub 復旧後（C 垢で OK のはず、a-soil で確認済）→ a-leaf-002 自走で push 試行
- push エラー時は a-main-013 経由で報告

完走 / 区切り報告は leaf-002-N（次番号）で。
~~~

---

## 投下用短文 C（東海林さんが a-forest-002 にコピペ）

~~~
🟢 main- No. 88
【a-main-013 から a-forest-002 への dispatch（main- No. 86 受領 OK / 5/10-11 Forest v9 前倒し承認）】
発信日時: 2026-05-07(木) 18:36

a-forest-002 main- No. 86 受領確認 + アクションプラン更新 受領しました。

詳細は以下ファイル参照:
[docs/dispatch-main-no88-soil-leaf-forest-replies-20260507.md](docs/dispatch-main-no88-soil-leaf-forest-replies-20260507.md)

## 確認内容

| 項目 | 判定 |
|---|---|
| 5/10-11 待機解除 + Forest v9 残機能前倒し着手 | ✅ |
| 5/8-9 B-min 残タスク完走（5/9 朝 forest-9 報告）| ✅（変更なし）|
| 5/12 朝 認証統一作業（main- No. 84 個別指示受領後）| ✅ |
| 5/12 以降 Forest 残機能続き | ✅（前倒し継続）|

## 5/10-11 前倒し対象 4 タスク

| 候補 | スコープ確認 |
|---|---|
| T-F6 Download + ZIP（Phase A 仕上げ 残 1）| ✅ 既存 wip / handoff に明記、自走判断 OK |
| 納税カレンダー | ⚠️ スコープ未明記、a-forest-002 が docs 再 grep で確認 → 不明なら forest-NN dispatch で確認 |
| 決算書 ZIP | ⚠️ T-F6 と統合の可能性、要確認（同上）|
| 派遣資産要件 | ⚠️ スコープ未明記、同上 |

スコープ未明記タスクは:
1. a-forest-002 が re-grep（docs/handoff-*.md / docs/effort-tracking.md / docs/specs/）で確認
2. 不明なら forest-NN dispatch で a-main-013 経由 東海林さんに即上げ → 即回答 → 着手

## ガンガン継続 OK の範囲

- T-F6 のように既存スコープ明記済 → 自走判断で着手 OK
- スコープ不明タスク → 確認後着手（停止リスクなし）
- B-min 完走優先（5/9 朝 forest-9 が次の最重要マイルストーン）

進捗報告予定 受領しました:
- forest-9: 5/9 朝 B-min 完走（既定）
- forest-10: 5/10-11 中の前倒しタスク区切り（中間報告）
- forest-11+: 5/12 認証統一完成 + 後続

ガンガン進めましょう。判断保留即上げ歓迎です。
~~~

---

## 1. 背景

### 1-1. 3 セッション同時受領（18:30-18:32）

| セッション | 件名 |
|---|---|
| a-soil | soil-4：main- No. 86 受領 + GitHub 復旧確認 + PR #101 消失問題 + 判断仰ぎ 3 点 |
| a-leaf-002 | leaf-002-5：main- No. 86 受領 + 着手プラン + # 3 # 4 方針確認 |
| a-forest-002 | main- No. 86 受領確認 + 5/10-11 待機解除アクションプラン |

### 1-2. 東海林さん回答（18:35）

> Q1: PR #101 a-review コメントの軽微 3 件の詳細を別途保存していますか？
> → まったくわからない

→ 別ルート保存なし、A 案（不明のまま新規 PR）採用。

### 1-3. 私の判断範囲（即実行 OK）

- a-soil Q2 / Q3: 推奨通り承認
- a-leaf-002 # 3 / # 4: A 案（事前承認方針）採用 ← 「ガンガン進める」延長
- a-forest-002: 受領 OK + 不明タスクは re-grep + 即上げ方針

---

## 2. a-soil 詳細回答

### 2-1. Q1: PR #101 軽微 3 件 A 案採用 理由

| 観点 | 内容 |
|---|---|
| R-1〜R-5（重要 5 件 🔴）| ✅ `db5255a` で反映済 = 主要品質確保 |
| 軽微 3 件 | 詳細不明（C 垢移行で消失、東海林さん別保存なし）|
| 自然な再発見 | a-review が新規 PR で再レビュー時、同じ点を再指摘する可能性高い |
| 5/14-16 デモ影響 | Soil は 5/13 デモ対象外（実装未着手）、影響なし |

### 2-2. Q2: 新規 PR 発行先

```
feature/soil-phase-b-decisions-applied → develop
タイトル: docs(soil): Phase B 7 spec (Batch 19) + B-03 §13 5 件確定 + a-review R-1〜R-5 修正

PR body 注記:
「PR #101 が C 垢移行 (2026-04-27) で GitHub 上から消失したため、本 PR で代替する。
重要 5 件 🔴 R-1〜R-5 は `db5255a` で反映済。軽微 3 件は a-review コメント消失で
詳細不明、再レビュー時に再指摘される可能性あり。」
```

### 2-3. Q3: 並行作業 全 GO

5/8-5/13 ガンガンモードで以下全て着手 OK:

| Phase | タスク | 工数 |
|---|---|---|
| Phase 1（5/7 夜〜5/8） | T1-T4 着手（Batch 16 基盤実装スケルトン）| 1.0d |
| Phase 2（5/9-5/10） | Batch 16 基盤実装 完走 | 4.25d 内のうち先行分 |
| Phase 3（5/11-5/12） | Phase B-01 リストインポート skeleton + 実装 | 1.5d |
| Phase 4（5/13） | コール履歴 335 万件 import 設計 詳細化判断 | 0.5d |

注意:
- garden-dev への migration apply は東海林さん別途承認後
- T2 SQL ドラフトは `supabase/migrations/` 配下に置くが apply 命令は別途
- TDD で test → 実装の順、quality 確保

---

## 3. a-leaf-002 詳細回答

### 3-1. # 3 # 4 事前承認方針（A 案）採用 理由

東海林さん明言「ガンガン進める常態モード」+ memory `feedback_maximize_auto_minimize_user.md`:
- spec 起草は判断保留が出てから停止する形で進めて OK
- 各論点を a-leaf-002 が起草段階で具体化 → 都度上げ
- 上げ → 即回答 → 即継続のループ

### 3-2. 想定論点リスト（参考、a-leaf-002 起草時の事前予想）

#### # 3 TimeTree 移行 spec
- A 案: 自動移行（API 経由で全 import）
- B 案: 半自動移行（CSV エクスポート → 加工 → import）
- C 案: 手動移行（Garden 上で再入力）

判断要素:
- TimeTree API rate limit / 認証方式
- 既存予定データ件数（< 1000 / 1000-10000 / > 10000）
- 移行期限（5/14 デモまで / 6 月末 / 年内）

#### # 4 OCR spec
- A 案: Tesseract OSS（無料、精度低）
- B 案: Google Vision API（有料、精度高、月額数千円〜）
- C 案: Azure Computer Vision（有料、精度高、月額同等）

判断要素:
- 対象帳票（請求書 / 領収書 / 名刺）
- 月間処理件数推定
- Phase 配置（B / C / D）

a-leaf-002 が spec 起草段階で各論点を具体化 → a-main-013 経由で都度上げ。

---

## 4. a-forest-002 詳細回答

### 4-1. 5/10-11 待機解除 承認

memory `project_garden_3layer_visual_model.md`「Forest = 樹冠層、経営ダッシュボード」 = 後道さんデモ重要モジュール。Forest v9 残機能の前倒しは Garden 全体クオリティ向上に直結。

### 4-2. 4 タスクのスコープ確認方針

| タスク | a-forest-002 自走判断 |
|---|---|
| T-F6 Download + ZIP | ✅ 既存 wip / handoff 明記、自走判断で着手 OK |
| 納税カレンダー | ⚠️ docs/handoff-*.md / docs/effort-tracking.md / docs/specs/ で re-grep → 不明なら forest-NN で確認 |
| 決算書 ZIP | ⚠️ 同上、T-F6 との統合可能性も含めて確認 |
| 派遣資産要件 | ⚠️ 同上 |

re-grep で不明なら確認 dispatch（forest-NN）→ a-main-013 経由 東海林さんに即上げ → 即回答 → 着手。

### 4-3. B-min 完走優先

5/9 朝 forest-9 完走報告が次の最重要マイルストーン（B-min 仕訳帳完成）。

5/10-11 前倒しタスクは forest-9 完走後に着手。

---

## 5. dispatch counter

- a-main-013: main- No. 88 → 次は **89**（counter 更新済）

---

## 6. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 86（横断 全前倒し）| 各セッション受領中 |
| main- No. 87（a-bloom-004 E 案 GO）| 投下準備済 |
| **main- No. 88（本書、3 セッション返答）** | 🟢 投下中 |

---

ご確認・ガンガン継続お願いします。判断保留即上げ歓迎です。
