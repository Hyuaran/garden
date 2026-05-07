# dispatch main- No. 84 — a-bloom-004 5 件 + 今夜本実装 GO + a-root-002 補足 2 件

> 起草: a-main-013
> 用途: a-bloom-004 へ判断 5 件回答 + 今夜から本実装着手 GO / a-root-002 へ dispatch 参照方法 + DB 適用済情報 補足
> 番号: main- No. 84
> 起草時刻: 2026-05-07(木) 18:17
> 緊急度: 🔴 高（5/13 完成 / 5/14-16 デモのクリティカルパス）

---

## 投下用短文 A（東海林さんが a-bloom-004 にコピペ）

~~~
🔴 main- No. 84
【a-main-013 から a-bloom-004 への dispatch（5 件 判断回答 + 今夜 本実装着手 GO）】
発信日時: 2026-05-07(木) 18:17

bloom-004- No. 42 の判断保留 5 件 + 3 案、東海林さん判断確定です。

詳細は以下ファイル参照:
[docs/dispatch-main-no84-bloom-004-approval-root-002-supplement-20260507.md](docs/dispatch-main-no84-bloom-004-approval-root-002-supplement-20260507.md)

## 5 件 判断結果

| # | 論点 | 結果 |
|---|---|---|
| 1 | 画像置き場所 | ✅ 推奨採用: `public/themes/garden-login/` |
| 2 | 既存 5 機能 | 🟡 **部分廃止** ← 変更点あり |
| 3 | パスワード見た目 | ✅ 推奨採用: `type="password"` 維持 + 目アイコンで切替 |
| 4 | 認証関数 | ✅ 推奨採用: signInBloom 流用継続 |
| 5 | 今夜の前倒し | 🔴 **「ガンガン進めていこう」**（B 案以上、本実装着手 GO） |

## #2 既存 5 機能 部分廃止（重要、変更点）

| 機能 | 判断 | 備考 |
|---|---|---|
| **目アイコン** | ✅ **残す** | パスワード ●●●→text 切替、一般 UX |
| **状態保持** | ✅ **残す** | リフレッシュ後もログイン情報維持 |
| パスワード忘れ | ❌ 廃止 | 5/13 以降復活検討、当面 admin（東海林さん）が再発行 |
| E-/P- prefix | ❌ 廃止 | パートナーログインは post-デモ再設計 |
| microcopy | ❌ 廃止 | claude.ai 起草版の世界観優先 |

## #5 今夜 本実装着手 GO

東海林さん「ガンガン進めていこう、荷造りだけでは済まない」承認。

今夜から以下まで進めて OK（C 案以上、本実装着手）:
- 画像 5 枚コピー（A 案）
- 既存 page.tsx legacy 保持（B 案）
- **新 /login/page.tsx の Next.js 化 本実装**（claude.ai 起草版ベース）
- **新 /page.tsx（garden-home 化）の Next.js 化 本実装**（時間許せば）
- BloomGate redirect 先変更（時間許せば）

5/8 朝までにできるところまで完成、残りは 5/8 で完走。

## 注意点
- 旧コード保持ルール厳守: legacy ファイル併存（route.legacy-bloom-original-login-20260507.tsx 等）
- 目アイコン + 状態保持は claude.ai 起草版に追加実装（世界観壊さない範囲で）
- E-/P- prefix と microcopy は完全廃止 = 入力欄シンプル化
- 5/9 から a-root-002 が認証 backend 着手、密に連携

完了報告は bloom-004- No. NN（次番号）で進捗 / 完了時刻記載お願いします。
~~~

---

## 投下用短文 B（東海林さんが a-root-002 にコピペ）

~~~
🟡 main- No. 84（a-root-002 向け補足）
【a-main-013 から a-root-002 への dispatch（root-002-5 補足 2 件）】
発信日時: 2026-05-07(木) 18:17

root-002-5 受領、5/9 朝着手 → 5/12 完成プラン承知。2 つ補足します。

詳細は以下ファイル参照:
[docs/dispatch-main-no84-bloom-004-approval-root-002-supplement-20260507.md](docs/dispatch-main-no84-bloom-004-approval-root-002-supplement-20260507.md)

## 補足 1: dispatch ファイル本体の参照方法

dispatch-main-no83 ファイルは workspace/a-main-013 ブランチにあります（origin/develop には未存在）。

a-root-002 で読む方法:
```
git fetch --all
git show origin/workspace/a-main-013:docs/dispatch-main-no83-garden-unified-auth-gate-20260507.md
```

dispatch ファイル本体の dev/develop マージは横断課題、post-デモで運用整理。当面は git show で参照。

## 補足 2: Bloom 進捗 Phase 1a DB 適用 + import 完了済（伝達漏れ）

main- No. 53 + 55（Bloom 進捗 Phase 1a + 4 月期間集計）の DB 適用 + import 実行は **5/7 14:05 頃 a-main-013 で完了済**:

| テーブル | 件数 |
|---|---|
| root_module_progress | 12 件（Bloom 65% / Forest 70% / Tree 100% / Bud 55% / Leaf 60% / Root 100% / 他 6 = 12） |
| root_daily_reports | 3 件（4/5 / 4/12 / 4/25） |
| root_daily_report_logs | 31 件（state.txt 4/25 から 29 件 import + 4 月期間集計 2 件） |

Vercel 本番（garden-chi-ochre.vercel.app/api/bloom/progress-html）も `X-Data-Source: supabase` で実データ取得確認済。

a-root-002 が 5/9 朝以降の作業時、DB は既に整備済の前提で進めて OK。

## a-bloom-004 との連携

a-bloom-004 は今夜（5/7 夜）から本実装着手の判断（main- No. 84 投下先 A）。

5/9 朝の a-root-002 着手時、a-bloom-004 が既に /login UI コア実装中の想定:
- /login UI = a-bloom-004 担当
- 認証 backend / role 別振分け = a-root-002 担当
- 5/10-11 統合テスト

判断保留事項あれば即停止 → a-main-013 経由で東海林さんに確認依頼。
~~~

---

## 1. 背景

### 1-1. a-bloom-004 bloom-004- No. 42 受領

a-bloom-004 が 17:57 に main- No. 83 受領 + 計画起草 + 判断保留 5 件 + 3 案を提示。

### 1-2. a-root-002 root-002-5 受領

a-root-002 が 17:55 に main- No. 83 受領 + 5/8 spec 起草 + 5/9 着手プラン提示。2 つの懸念点（dispatch ファイル参照方法 / DB 適用済情報の伝達漏れ）あり。

### 1-3. 東海林さん判断（18:00 頃）

- a-bloom-004 5 件: #1/3/4 推奨、#2 部分廃止（目アイコン + 状態保持残す）、#5 ガンガン進める
- a-root-002 補足: 私が代行で対応

---

## 2. a-bloom-004 への 5 件 判断回答 詳細

### 2-1. #1 画像置き場所: `public/themes/garden-login/`

**根拠**:
- Next.js が配信できる `public/` 配下
- 既存 `themes/` と階層統一、整理整頓
- garden-login 専用ディレクトリで他テーマと分離

**コピー対象**:
| ファイル | コピー元（Drive ）| コピー先 |
|---|---|---|
| bg-login-twilight-with-card.png | `_chat_workspace/garden-ui-concept/images/` | `public/themes/garden-login/` |
| bg-night-garden-with-stars.png | 同上 | 同上 |
| logo-garden-series.png | 同上 | 同上 |
| login-frame-arch.png | 同上 | 同上 |
| login-card-arch.png | 同上 | 同上 |

Drive 元 touch 禁止（コピーのみ）。

### 2-2. #2 既存 5 機能 部分廃止

| 機能 | 残す/廃止 | 実装方針 |
|---|---|---|
| **目アイコン** | ✅ 残す | claude.ai 起草版に追加実装（世界観壊さない範囲で目アイコンを password 入力欄右に追加）|
| **状態保持** | ✅ 残す | sessionStorage の既存ロジック維持、claude.ai 起草版でも同じ key 使用 |
| パスワード忘れ | ❌ 廃止 | 5/13 以降復活検討、当面 admin（東海林さん）が再発行 |
| E-/P- prefix | ❌ 廃止 | パートナー運用は post-デモ再設計、入力欄から E-/P- 区別 UI を削除 |
| microcopy | ❌ 廃止 | claude.ai 起草版に説明文を追加せず、世界観優先 |

**「目アイコン + 状態保持を残す」理由**:
- 目アイコン: パスワード入力ミス時の確認に有用、一般的な UX
- 状態保持: 後道さん含む全ユーザーの利便性、リフレッシュで再ログイン回避

### 2-3. #3 パスワード入力欄: `type="password"` 維持 + 目アイコンで切替

**実装イメージ**:
```jsx
<input type={showPwd ? "text" : "password"} ... />
<button onClick={() => setShowPwd(!showPwd)}>👁</button>
```

claude.ai 起草版の input 要素に目アイコン button を追加実装。

### 2-4. #4 認証関数: signInBloom 流用継続

**理由**:
- a-bloom-004 は UI 実装に集中、認証 backend は a-root-002 担当
- 共通化（signInGarden）は a-root-002 が 5/9-12 に並行検討
- 5/12 以降に signInBloom → signInGarden への切替を統合テストで実施

### 2-5. #5 今夜 本実装着手 GO（C 案以上）

**東海林さん判断**:
> ガンガン進めていく / 荷造りだけ等では済まない

**今夜（5/7 夜）の進行範囲**:
1. ✅ 画像 5 枚コピー（A 案）
2. ✅ 既存 /login/page.tsx legacy 保持（B 案）
3. ✅ **新 /login/page.tsx 本実装**（claude.ai 起草版ベース）
4. ✅ **新 /page.tsx（garden-home 化）本実装**（時間許せば）
5. ✅ BloomGate redirect 先変更（時間許せば）

5/8 朝までにできるところまで完成、残りは 5/8 で完走。

**作業の優先順**:
1. 画像 5 枚コピー（先に素材揃える）
2. /login/page.tsx 本実装（最重要、5/14-16 デモの中核）
3. /page.tsx（garden-home）実装
4. BloomGate redirect 先変更
5. legacy ファイル整理（途中で行う）

---

## 3. a-root-002 への補足 2 件 詳細

### 3-1. 補足 1: dispatch ファイル本体の参照方法

**問題**: a-root-002 が「docs/dispatch-main-no83-...md は origin/develop および全 remote ブランチに未存在」と報告。

**原因**: 私（a-main-013）が push したのは **workspace/a-main-013 ブランチ**。a-root-002 は develop ベースで grep 検索したため未検出。

**当面の解決策**:

```bash
# a-root-002 で実行
git fetch --all
git show origin/workspace/a-main-013:docs/dispatch-main-no83-garden-unified-auth-gate-20260507.md
```

**長期解決策**: dispatch ファイルの共有方式を見直し（develop へ PR マージ or Drive `_chat_workspace/` 配下に複製）。これは横断課題、post-デモで運用整理。

### 3-2. 補足 2: DB 適用 + import 完了済（伝達漏れ）

**問題**: a-root-002 が「main- No. 53 + 55 の DB 適用 + import 実行は東海林さん依頼継続中」と認識。

**実態**: **5/7 14:05 頃 a-main-013 で実施完了**。

**完了内容**:

| migration | 状態 | テーブル |
|---|---|---|
| 20260505000001_root_daily_reports.sql | ✅ 適用済 | root_daily_reports（3 件）|
| 20260505000002_root_daily_report_logs.sql | ✅ 適用済 | root_daily_report_logs（31 件）|
| 20260505000003_root_module_progress.sql | ✅ 適用済 + 12 件初期データ INSERT | root_module_progress（12 件）|
| 20260505000004_root_daily_reports_april_period_insert.sql | ✅ 適用済（順序修正後）| 4 月期間集計 2 件 INSERT |

**import script**:
- `scripts/import-state-to-root.ts` 実行
- state.txt（4/25 GW 期間、29 logs）→ root_daily_report_logs に取り込み
- 結果: root_daily_report_logs 31 件（4/5 Forest 1件 + 4/12 Tree 1件 + 4/25 29 件）

**Vercel 本番確認**:
- `curl -sI https://garden-chi-ochre.vercel.app/api/bloom/progress-html`
- `X-Data-Source: supabase` ✅
- `SUPABASE_SERVICE_ROLE_KEY` も Vercel env 追加済（5/7 15:30 頃）

a-root-002 が 5/9 朝以降の作業時、**DB は既に整備済の前提**で進めて OK。新規 migration 作成も既存テーブルとの整合性を考慮して。

---

## 4. dispatch counter / 後続予定

- a-main-013: main- No. 84 → 次は **85**（counter 更新済）
- 後続 dispatch:
  - main- No. 85+: a-bloom-004 / a-root-002 の進捗報告 受領 + 必要に応じ補足
  - main- No. NN: 各モジュール（a-tree / a-bud / a-leaf）への redirect 統一個別 dispatch（5/13 以降）
  - main- No. NN: 横断統合テスト指揮（5/13）
  - main- No. NN: 後道さんデモ最終調整（5/14-16）

---

## 5. 関連 dispatch / 並行進行

| dispatch | 状態 |
|---|---|
| main- No. 76（a-forest 銀行 CSV）| ✅ 完了 |
| main- No. 77（a-bloom-003 500 修正）| ✅ 完了 |
| main- No. 78（a-bloom-003 PR マージ + Vercel）| ✅ 完了 |
| main- No. 79（a-bloom-003 BloomState dev mock）| ✅ 完了（旧 a-bloom-003）|
| main- No. 80（a-forest-002 判断保留 回答）| ✅ 受領 |
| main- No. 81（a-bloom-004 引き継ぎ）| ✅ 完了（bloom-004- No. 41）|
| main- No. 82（a-forest-002 5/7 中前倒し）| ✅ 受領 + 5/7 中 0.6d 完走 |
| main- No. 83（横断周知 認証統一着手）| ✅ 全モジュール受領（a-leaf 残） |
| **main- No. 84（本書、5 件回答 + 補足）** | 🔴 投下中 |

---

ご確認・着手お願いします。判断保留事項あれば即停止 → a-main-013 経由で東海林さんに確認依頼。
