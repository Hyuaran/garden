# Handoff a-bloom-005 → a-bloom-006（2026-05-09 01:42、§22-1 60-65% 帯 引っ越し実行）

> **発動経緯:** dispatch main- No. 160（5/9 01:42）UU 案採用。bloom-005- No. 5 §22-8 自律 token check で 60-65% 帯到達 + 5/9 朝の a-root-002 連携 + Forest UI 統一作業（重タスク）前に余裕確保のため、UU 案（早期引っ越し）を a-main-015 が採択。

---

## 今やっていること（5/9 01:42 時点）

a-bloom-005 は 5/8 18:21 起動 → 5/9 01:42 で計 約 7h20m 経過。dispatch No. 1 〜 5 で以下を完走:

| # | dispatch | 内容 | commit |
|---|---|---|---|
| 1 | bloom-005- No. 1 | 起動完了 + KK 案 spec 起草（240 行）+ NN 副次 module-icons 配置 | `baa98e4` |
| 2 | bloom-005- No. 2 | main- No. 155 受領 + 案 Y 着手宣言 | `7ee2aea` |
| 3 | bloom-005- No. 3 | PR #148（23,881 行）+ #149（1,640 行）両方レビュー完走（採用推奨）| `8d4ae97` |
| 4 | bloom-005- No. 4 | main- No. 157 採用 = WebP 6 件 + GARDEN_CORPORATIONS + spec 改訂 + Forest 連携 spec 起票 | `2405743` |
| 5 | bloom-005- No. 5 | main- No. 158 採用 = hyuaran-group-hd WebP + GARDEN_GROUP_HD_META + spec §1-2-b 新設 | `(直近)` |

直近の状況:
- token 推定 60-65% 帯到達（§22-1 モジュール引っ越し検討〜実行ライン）
- ローカル commit ahead **8 件**（5/9 09:00 JST 過ぎ broadcast 後 一括 push）
- main- No. 159（a-forest-002 起票 + Forest UI 統一作業）が a-bloom-006 で受領予定

---

## 次にやるべきこと（a-bloom-006 起動後の優先順）

### 🔴 0. 起動チェック（最初の 5 分）

```bash
cd C:\garden\a-bloom-006
pwd
git status
git branch --show-current   # → feature/bloom-6screens-vercel-2026-05-006
git log --oneline -8        # 最新は本 handoff の commit
```

### 🔴 1. push 解除待ち（5/9 09:00 JST 過ぎ broadcast 後）

```bash
git push origin feature/bloom-6screens-vercel-2026-05-006
```

→ 累積 9 commit（a-bloom-005 8 件 + 本 handoff commit）を一括 push。

### 🔴 2. a-root-002 連携 #1 + #3 着手（5/9 朝、push 解除後）

[docs/plan-bloom-root-002-integration-prep-20260508.md](docs/plan-bloom-root-002-integration-prep-20260508.md)（commit `e0273e9`、183 行）に詳細手順記載。

工数 0.5-0.7d、8 step（Task 7-9 完成度確認 / signInBloom 切替 / supabase-client 統合 / GardenRole 8 段階同期 / Vitest 全 PASS / Chrome MCP 視覚確認 / commit + push / 完成報告）。

依存: a-root-002 5/9 朝着手通知（dispatch 受領後即連動）。

### 🔴 3. Forest UI 統一作業（main- No. 159 受領後）

main- No. 160 §「引っ越し後の優先タスク #3」で言及:
- 参照: `docs/forest-ui-unification-research-20260509.md`（a-bloom-005 起票時点で **未配置**、main- No. 159 系統で受領予定）
- a-bloom-006 起動時に main- No. 159 を受領 → forest-ui-unification-research を読込 → 統一作業着手

**注意:** Forest UI 統一作業は a-bloom-005 ではスコープ外（dispatch 受領前）。a-bloom-006 が main- No. 159 受領後に詳細把握 + 着手判断。

### 🟡 4. /bloom/progress 表示拡張準備（5/10、a-root-002 集約役 migration 反映後）

[docs/plan-bloom-progress-display-prep-20260508.md](docs/plan-bloom-progress-display-prep-20260508.md)（commit `6a2bdd7`、142 行）に詳細記載。

5/10 a-root-002 migration 反映後、Bloom 側で:
1. MODULE_META 更新（progress-html/route.ts 79-91 行目、12 モジュール最新化）
2. （マイルストーン追加なら）type 定義 + fetchData + render 追加
3. v29 テンプレート placeholder 追加（必要に応じ）
4. dev で `/bloom/progress` 視覚確認 + Chrome MCP 客観差分

工数 0.3-0.5d（migration 範囲依存）。

### 🟢 5. 5/13 統合テスト リハーサル準備（5/11-12）

[docs/plan-bloom-5-13-integration-test-bloom-side-20260508.md](docs/plan-bloom-5-13-integration-test-bloom-side-20260508.md)（commit `d0ff4a0`、200 行）に詳細記載。

加えて、bloom-005- No. 4 で起票した [docs/specs/2026-05-09-forest-corporations-mock-migration.md](docs/specs/2026-05-09-forest-corporations-mock-migration.md) の §8 で 5/13 統合テスト Bloom plan へのチェック項目追加 3 件 を提案済（plan 本体への追記は未実施、a-bloom-006 で対応推奨）。

### 🟢 6. Daily Report Post-MVP（5/14 以降、デモ後）

[docs/plan-bloom-daily-report-post-mvp-20260508.md](docs/plan-bloom-daily-report-post-mvp-20260508.md)（commit `47fcaf1`、147 行）に詳細記載。

Phase B-1 Chatwork 通知（5/14 即着手）→ B-2 メール（5/15-16）→ B-3 編集（5/17）→ C-1-3 全社展開（5/19-27）。

---

## 注意点・落とし穴

### 🔴 Vercel push 停止中（〜5/9 09:00 JST 過ぎ）

main- No. 148 で全 Garden モジュール push 停止指示:
- ✅ ローカル commit OK
- ❌ git push origin、PR 起票・更新、docs-only push もすべて NG
- 解除: 5/9 09:00 JST 過ぎ a-main-015 broadcast 後

→ a-bloom-006 起動時、ローカル累積 commit が **9 件** ahead 状態。push 解除 broadcast 後にまとめて push。

### 🔴 削除禁止ルール厳守

memory `feedback_no_delete_keep_legacy.md` 通り、`*.legacy-YYYYMMDD.tsx` 併存パターン厳守。`rm` / `Remove-Item` / `del` は system deny で禁止。

### 🔴 §22-8 自律 token チェック必須

a-bloom-006 起動後、各タスク完了時 + dispatch 受領時 + 長時間処理前に token 残量確認。50/60/70% 閾値で自発アラート、bud-20 教訓に基づき 60% 超過なら次タスク着手前に引っ越し優先。

### 🔴 §23 メモリー main 判断ルール

memory（user / project / feedback）の更新権限は **a-main のみ**。a-bloom-006 はメモリー参照のみ、学び・改善提案は dispatch で a-main-015 経由。

### 🔴 dispatch 形式厳守（初回応答含む）

memory `feedback_reply_as_main_dispatch.md`（2026-05-08 改訂版）厳守:
- 新規セッション起動時 / handoff 受領確認応答も dispatch 形式（~~~ ラップ + 🟢 + 番号 + 発信日時 + 件名）
- a-soil-002 が起動直後 通常会話形式で返した結果、東海林さん「毎回ストレス」指摘あり

→ a-bloom-006 起動時の初回応答は **必ず bloom-006- No. 1 形式** で返答。

### 🟡 npm install / dev server 状態

a-bloom-005 は **node_modules 不在**（5/8 中の bloom-005- No. 1 §3 で QQ/RR/SS 案 判断仰ぎ → SS 案推奨で 5/9 朝まとめて）。a-bloom-006 でも同状態の可能性高い:

```bash
ls node_modules 2>&1 | head -1
```

不在なら `npm install`（東海林さん代行 PowerShell or auto-allow 検討）。512 packages 想定（main- No. 118 AA 案実績）。

### 🟡 Forest UI 統一作業 スコープ未把握

main- No. 159 で詳細指示予定、a-bloom-005 では **未受領**。a-bloom-006 起動後に main- No. 159 を読込 + `docs/forest-ui-unification-research-20260509.md`（受領予定）を読込してから着手判断。

---

## 関連情報

### ブランチ + commit

- ブランチ: `feature/bloom-6screens-vercel-2026-05-006`（feature/bloom-6screens-vercel-2026-05-005 派生）
- 累積 ローカル commit ahead: **8 件 + 本 handoff commit = 9 件**:
  - 5474564 / 7ca85d6 / 896c44f（a-bloom-004 終末分）
  - baa98e4 No.1 / 7ee2aea No.2 / 8d4ae97 No.3 / 2405743 No.4 / `本 No. 5 commit` / 本 handoff commit
- 最新 push 済 commit: `5474564` docs(bloom): bloom-004- No. 58
- main HEAD: `30aa992`（PR #126 hotfix release）

### dispatch counter 引継ぎ

- a-bloom-005 最終 counter: `5`（次番号 6 = 本 handoff 完成報告で使用）
- a-bloom-006 起動時の counter: **`1`** から再スタート（新セッション）
- 配置: `C:\garden\a-bloom-006\docs\dispatch-counter.txt = 1`

### 完走 dispatch 一覧（a-bloom-005、5/8 18:21 〜 5/9 01:42 = 5 件）

| 日時 | dispatch | 主な成果 | commit |
|---|---|---|---|
| 5/8 18:21 | bloom-005- No. 1 | 起動 + KK 案 spec（240 行）+ NN 副次 module-icons 12 件配置 | `baa98e4` |
| 5/8 18:24 | bloom-005- No. 2 | main- No. 155 受領 + 案 Y 着手宣言 | `7ee2aea` |
| 5/8 18:27 | bloom-005- No. 3 | PR #148 + #149 両方レビュー完走（採用推奨）| `8d4ae97` |
| 5/9 01:25 | bloom-005- No. 4 | main- No. 157 採用 = WebP 6 件 + GARDEN_CORPORATIONS + spec 改訂 + Forest 連携 spec | `2405743` |
| 5/9 01:37 | bloom-005- No. 5 | main- No. 158 採用 = hyuaran-group-hd 統合アイコン + GARDEN_GROUP_HD_META + spec §1-2-b | (直近) |

### 主要成果物（a-bloom-006 で参照）

#### 新規作成

| ファイル | 内容 |
|---|---|
| `src/lib/garden-corporations.ts` | GARDEN_CORPORATIONS 6 法人 + GARDEN_GROUP_HD_META + helper（getCorporationById / findCorporationByName / LEGACY_FOREST_MOCK_ID_MAP）|
| `public/themes/corporate-icons/*.webp` | 6 法人 + HD 統合 = 7 webp（hyuaran / centerrise / linksupport / arata / taiyou / ichi / hyuaran-group-hd）|
| `docs/specs/2026-05-08-bloom-corporate-icons-chatgpt-prompt.md` | KK 案 spec（改訂版、約 280 行）= ChatGPT 投下プロンプト + 東海林さん操作指示 + §改訂履歴 |
| `docs/specs/2026-05-09-forest-corporations-mock-migration.md` | Forest 連携 spec（約 200 行、a-forest-002 担当指示済）|

#### 配置済み（_chat_workspace 配下）

| 場所 | 内容 |
|---|---|
| `_chat_workspace/_reference/garden-bloom/module-icons/` | 12 webp + README（KK 案添付素材）|
| `_chat_workspace/_reference/garden-bloom/bloom-corporate-icons/` | 6 PNG + HD PNG + 一覧 + ChatGPT 元画像（東海林さん管理）|

### 主要 dispatch 参照（a-main-013 / 014 / 015）

- main- No. 145（5/8 15:18）HH 案 = a-bloom-004→005 引っ越し承認
- main- No. 148（5/8 15:46）Vercel push 停止
- main- No. 150（5/8 15:46）KK + NN 案採用
- main- No. 155（5/8 18:19）dispatch 形式厳守 リマインド + 案 X / Y 推奨
- **main- No. 157**（5/9 01:17）東海林さん新マッピング採用 + 6 法人組込指示 ✅ 完走
- **main- No. 158**（5/9 01:31）hyuaran-group-hd 追加組込 + 判断 3 件採用 ✅ 完走
- **main- No. 159**（5/9 朝予定）a-forest-002 起票 + Forest UI 統一作業（a-bloom-006 受領予定）
- **main- No. 160**（5/9 01:42）UU 案採用 = 本 handoff 起票指示

### 判断保留事項（a-bloom-006 で対応）

| # | 内容 | 推奨 |
|---|---|---|
| 1 | NN 主スクショ（v9 ホーム）| QQ/RR/**SS 案推奨**（5/9 朝 npm install + dev 起動 + スクショ）|
| 2 | KK 案 spec の §補足観点 5 件 | a-bud-002 / a-main-015 で集約（a-bloom 待機）|
| 3 | 5/13 統合テスト Bloom plan に 6 法人チェック追加 | Forest 連携 spec §8 で言及済、plan 本体追記が残（a-bloom-006 で対応推奨）|

### 環境

- worktree: `C:\garden\a-bloom-005` → `C:\garden\a-bloom-006`（新設、a-main-015 作成済 ✅）
- node_modules: ❌ a-bloom-005 不在、a-bloom-006 も同状態想定（5/9 朝 npm install 推奨）
- dev server: 停止状態
- Vercel: feature ブランチ自動デプロイ実行中、main 反映は post-デモ
- Supabase: garden-dev（dev mock 経由で実 fetch、env 設定は Vercel 本番のみ）
- .env.local: ✅ コピー済（main- No. 160 で確認）

### 5/14-16 後道さんデモ前 重要素材状態

| 素材 | 状態 |
|---|---|
| 12 モジュールアイコン群 | ✅ 既配置（5/8 module-icons/）|
| 6 法人アイコン（個別 + HD 統合）| ✅ 配置完了（PNG → WebP、main- No. 157/158 採用）|
| 6 法人カラーマスタ（HEX）| ✅ TypeScript 定義 完了（GARDEN_CORPORATIONS）|
| KK 案 spec（ChatGPT 再生成用）| ✅ 改訂完了（A 案アネモネ統一）|
| Forest 連携 spec | ✅ 起票完了（a-forest-002 担当）|
| Forest UI 統一作業 | 🟡 main- No. 159 受領 + 統一作業（a-bloom-006）|
| /bloom/progress 表示拡張 | 🟡 5/10 a-root-002 migration 後 |
| Bloom v9 ホームページ スクショ | 🟡 SS 案 5/9 朝 |
| 5/13 統合テスト リハ | 🟢 5/11-12 |
| Daily Report Post-MVP | 🟢 5/14-27 |

---

## 完成報告フォーマット (bloom-005- No. 6)

local commit 後 + コピペテキスト即時送信:

```
🟢 bloom-005- No. 6
【a-bloom-005 から a-main-015 への完走報告】
発信日時: 2026-05-09(土) HH:MM
件名: handoff 整備完了、a-bloom-006 起動準備 OK
ファイル: docs/handoff-a-bloom-005-to-bloom-006-20260509.md
次 counter: bloom-006-1
push: 5/9 09:00 JST 過ぎ broadcast 後
```
