# dispatch main- No. 298 — a-bloom-006 へ a-root-003 Task 1+4+5 全 3 PR (#162/#163/#164) batch review 依頼（auth 統一 plan v1.0、Task 2/3/6 着手の前提）

> 起草: a-main-023
> 用途: a-bloom-006 への a-root-003 Garden-wide unified auth plan v1.0 Task 1+4+5 batch review 依頼。Task 2/3/6 着手 + 1 週間 critical path ③ ログイン統一 5/13 完成見込みの前提
> 番号: main- No. 298
> 起草時刻: 2026-05-11(月) 17:50

---

## 投下用短文（東海林さんがコピー → a-bloom-006 にペースト）

~~~
🔴 main- No. 298
【a-main-023 から a-bloom-006 への dispatch（a-root-003 Task 1+4+5 全 3 PR batch review 依頼、auth 統一 plan v1.0）】
発信日時: 2026-05-11(月) 17:50

# 件名
🔴 a-root-003 から Garden-wide unified auth plan v1.0 (1,780 行 / 6 Task) の Task 1 (#164) + Task 4 (#163) + Task 5 (#162) 全 3 PR open 状態、batch review 依頼。Task 2/3/6 着手 + 1 週間 critical path ③ ログイン統一 5/13 完成見込みの前提

# A. 3 PR 一覧（review 対象）

| # | PR | タイトル | 行数 | branch | 状態 |
|---|---|---|---|---|---|
| 1 | #164 | feat(root): [Task 1] Login 統一画面 / /login 一本化 + AuthProvider 導入 | 284 行 (auth-unified.tsx) + 改名 5 + stub 4 + BloomGate 1 + ForestGate 1 | feature/root-task1-login-unified-20260511 | open |
| 2 | #163 | feat(root): [Task 4] RLS 統一テンプレート (5 モジュール横断) | TBD（root-003 # 47 報告参照） | feature/root-task4-rls-template-20260511 | open |
| 3 | #162 | feat(root): [Task 5] super_admin 権限固定 / 東海林さん 1 名専任化 | TBD（root-003 # 47 報告参照） | feature/root-task5-super-admin-20260511 | open |

# B. plan v1.0 概要（前提知識）

| 項目 | 内容 |
|---|---|
| plan 規模 | 1,780 行 / 6 Task |
| 統合整合性 | 5 件解決済 (IN-1〜IN-5) |
| Acceptance 項目 | 計 38 項目 |
| 完了 Task | Task 1 (#164) / Task 4 (#163) / Task 5 (#162) |
| 待機中 Task | Task 2 (Series Home /series) / Task 3 (ModuleGate 統一) / Task 6 (権限境界明文化) |
| critical path | ③ ログイン統一 → Series Home → 5/13 完成見込み |

# C. review 観点（Task 1 / Task 4 / Task 5 別）

## C-1. Task 1 (#164) review 観点（最重要）

| # | 観点 | 詳細 |
|---|---|---|
| 1 | auth-unified.tsx 整合性 | 284 行 / 7 関数 + useAuthUnified Hook + AuthProvider の責務分離 / 命名 / 型整合 |
| 2 | /login/page.tsx 置換 | returnTo + Suspense + signInUnified の置換適切性、Next.js 15 App Router 規約遵守 |
| 3 | BloomGate L42 GARDEN_LOGIN 変更 | dev バイパス維持確認（memory `project_bloom_auth_independence` 準拠） |
| 4 | ForestGate legacy 改名 + redirect-only shell 化 | shell 化で既存 Forest 画面に影響しないか |
| 5 | forest/bud/tree/root 4 login page | legacy 改名 + stub の冪等性、deep link 互換 |
| 6 | IN-4 準拠 | ForestGate rename は Task 1 で 1 回のみ、Task 3 は ModuleGate に書換のみ（二重改名禁止） |
| 7 | IN-5 準拠 | 既存 signInBloom 等 5 helper は維持（API 互換）、削除されていないか |
| 8 | TypeScript 型 | 型エラー 0 件確認（root-003 # 48-B Step 6 で報告済、要再検証） |
| 9 | Vercel build | build success 確認推奨（preview URL あり） |

## C-2. Task 4 (#163) review 観点

| # | 観点 | 詳細 |
|---|---|---|
| 1 | RLS テンプレート | 5 モジュール横断（root/bloom/forest/bud/tree）の共通 RLS pattern が正しく抽出されているか |
| 2 | server/client 区分 | memory `project_rls_server_client_audit` 準拠、Route Handler で anon 流用なし |
| 3 | 既存 RLS 破壊性 | Task 4 で既存テーブルの RLS が無効化されていないか |
| 4 | super_admin bypass | super_admin RLS bypass が Task 5 と整合しているか |

## C-3. Task 5 (#162) review 観点

| # | 観点 | 詳細 |
|---|---|---|
| 1 | super_admin = 東海林さん 1 名専任 | memory `project_super_admin_operation` 準拠、固定 user_id ロジック |
| 2 | 設定変更可能性 | memory `project_configurable_permission_policies` 準拠、ハードコード回避（root_settings 経由） |
| 3 | 既存 super_admin 操作影響 | Garden 全モジュールの super_admin 操作経路が壊れていないか |

# D. review 優先順位（並列実施可だが報告順を分ける）

| 順 | Task | 理由 |
|---|---|---|
| 1 | Task 1 (#164) | Login 統一が critical path ③ の起点、Task 2/3 の前提、最重要 |
| 2 | Task 4 (#163) | 基盤（RLS）、Task 2/3 の DB アクセスに影響 |
| 3 | Task 5 (#162) | 基盤（権限）、Task 6 の前提 |

# E. review 結果報告形式

a-bloom-006 → a-main-023 へ bloom-006- No. NN で報告:

| 項目 | 内容 |
|---|---|
| # 1 (最重要) | Task 1 (#164) review 結果: 推奨 merge / 修正要求 / 重大問題 |
| # 2 | Task 4 (#163) review 結果: 同上 |
| # 3 | Task 5 (#162) review 結果: 同上 |
| # 4 | 横断観点: 3 PR 間の整合性、merge 順序推奨 |
| # 5 | 判断保留事項（東海林さんへの確認事項） |

# F. 後続依存（review 完了後の流れ）

| Step | 内容 | 担当 | 期限 |
|---|---|---|---|
| 1 | a-bloom-006 batch review 完了 → bloom-006- No. NN 報告 | a-bloom-006 | 5/11 中（軽量 batch） |
| 2 | review 結果を a-main-023 で集約 → 東海林さん採択 | a-main-023 | review 直後 |
| 3 | 3 PR merge（採択順） | 東海林さん | 5/11 夜 〜 5/12 朝 |
| 4 | a-root-003 Task 2 (Series Home /series) 着手 | a-root-003 | Task 1 merge 後 |
| 5 | Task 3 (ModuleGate 統一) 着手 | a-root-003 | Task 1 merge 後 |
| 6 | Task 6 (権限境界明文化) 着手 | a-root-003 | Task 5 merge 後 |
| 7 | critical path ③ ログイン → Series Home 5/13 完成 | a-root-003 | 5/13 |

# G. ACK 形式（軽量、batch review 完了予定時刻）

a-bloom-006 → a-main-023 への ACK (bloom-006- No. NN):

~~ ACK 形式
✅ main- No. 298 受領、3 PR batch review 開始
- review 完了予定時刻: HH:MM
- 並列 / 直列: 並列（Task 1 優先）
- subagent 使用予定: あり / なし
- 報告先: a-main-023（bloom-006- No. NN で報告）
~~

# H. self-check（a-bloom-006 が review 前に確認）

- [ ] PR #164 / #163 / #162 の branch を fetch 済み
- [ ] memory `project_bloom_auth_independence` 既読
- [ ] memory `project_rls_server_client_audit` 既読
- [ ] memory `project_super_admin_operation` 既読
- [ ] memory `project_configurable_permission_policies` 既読
- [ ] IN-4 / IN-5 の整合性条件を理解
- [ ] review 観点 C-1 / C-2 / C-3 を内部チェックリスト化
- [ ] 報告形式 E に従い bloom-006- No. NN を起草準備
~~~

---

## 詳細（参考、投下対象外）

### 起草背景

- 5/11 17:15 a-root-003 から root-003- No. 48 として Task 1 (Login 統一画面) PR #164 完成報告受領
- Task 1+4+5 全 3 PR open 状態となり、batch review の機が熟した
- root-003 # 48 判断保留 # 1: 「3 PR を a-bloom-006 batch review で依頼」 = 東海林さん「推奨で全 GO」採択
- a-root-003 は本セッション内で subagent-driven 並列実装、約 2.4 倍圧縮達成

### 投下経路

- main- No. 298 → 東海林さんが a-bloom-006 にコピペ
- a-bloom-006 → batch review 実施 → bloom-006- No. NN で a-main-023 へ報告

### a-bloom-006 採用理由

- bloom-006 は multi-review 担当として運用中（過去実績あり）
- auth 系の整合性チェック観点を持つ（Bloom 独立認証経験 + RLS audit 経験）
- 3 PR 軽量 batch は subagent-driven で短時間処理可能

### review 観点の重みづけ

- Task 1 = 最重要（critical path ③ 起点、284 行 + 4 改名 + 4 stub の大規模変更）
- Task 4 = 基盤（RLS テンプレート、5 モジュール横断）
- Task 5 = 基盤（権限固定、東海林さん 1 名専任）

### 想定 review 所要時間

| Task | 行数 | 想定 review 時間 |
|---|---|---|
| Task 1 (#164) | 284 + 改名/stub | 30-40 分 |
| Task 4 (#163) | TBD | 15-20 分 |
| Task 5 (#162) | TBD | 15-20 分 |
| 横断観点 + 報告起草 | - | 10-15 分 |
| **計** | - | **70-95 分（軽量 batch）** |

### 後続 critical path

| 日付 | マイルストーン | 状態 |
|---|---|---|
| 5/11 (本日) | Task 1+4+5 review 完了 + merge | ⏳ 進行中 |
| 5/12 | Task 2 (Series Home) + Task 3 (ModuleGate) 着手 | 待機 |
| 5/13 | critical path ③ ログイン → Series Home 完成見込み | 待機 |
| 5/14 以降 | Task 6 (権限境界明文化) | 待機 |

### memory 準拠確認

- `feedback_dispatch_header_format` v5: ~~~ ラップ + 冒頭 3 行 + コードブロック禁止 ✅
- `feedback_dispatch_image_path_required`: 画像添付なし、該当せず
- `feedback_proposal_count_limit`: 2-3 択遵守、review 観点は内訳のため対象外
- `project_bloom_auth_independence`: review 観点 C-1 # 3 で参照
- `project_rls_server_client_audit`: review 観点 C-2 # 2 で参照
- `project_super_admin_operation`: review 観点 C-3 # 1 で参照
- `project_configurable_permission_policies`: review 観点 C-3 # 2 で参照

### 起草者 self-check

- [x] 番号 main- No. 298 確定
- [x] 投下先 a-bloom-006 明示
- [x] 緊急度 🔴 高（critical path ③ 前提）
- [x] 3 PR 一覧 (#162/#163/#164) 全記載
- [x] review 観点 C-1 / C-2 / C-3 を Task 別に整理
- [x] IN-4 / IN-5 整合性条件を明示
- [x] review 優先順位（Task 1 最重要）を明示
- [x] 報告形式 E (bloom-006- No. NN) を指定
- [x] 後続依存 F (Task 2/3/6 + 5/13 完成) を明示
- [x] ACK 形式 G (軽量) を明示
- [x] self-check H を a-bloom-006 向けに用意
- [x] ~~~ ラップ内にコードブロック (```) を入れていない
- [x] 表形式中心、自然会話形式回避
- [x] 全文 約 280 行（250-350 行の範囲内）

---

（dispatch md 起草終了）
