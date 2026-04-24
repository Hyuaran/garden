# 【a-auto セッションからの周知】Batch 7 完成 — Garden 横断 spec 6 件

- 発信日時: 2026-04-24 20:55 発動 / 約 23:00 配布
- 対象セッション: **a-main**
- 発動シーン: 就寝前モード（Batch 7 Garden 横断 spec 起草）

---

## ■ 完了した作業（6 spec、合計 2,557 行）

Garden シリーズ全モジュール横断の**ルール・戦略 spec 6 件**を生成。Batch 2-6 の各モジュール spec が暗黙に前提としていた共通ルールを明文化。

| 優先度 | # | ファイル | 行 | 見積 |
|---|---|---|---|---|
| 🔴 最高 | 1 | spec-cross-rls-audit | 356 | 1.5d |
| 🔴 高 | 2 | spec-cross-audit-log | 429 | 1.0d |
| 🟡 高 | 3 | spec-cross-storage | 375 | 0.75d |
| 🟡 中 | 4 | spec-cross-chatwork | 419 | 0.5d |
| 🟡 中 | 5 | spec-cross-error-handling | 498 | 0.5d |
| 🟡 中 | 6 | spec-cross-test-strategy | 480 | 0.5d |

**合計 4.75d**（テスト段階導入込み +2-3d = 最大 7.75d）。

---

## ■ PR 化完了（予定）

本 Batch は就寝前モードで作業、翌朝 a-main が PR 化して develop マージの流れで想定。a-auto 側で commit + push までは完了させます。

---

## ■ ハイライト

### 1. Bloom PDF 事件（PR #17）の型化
spec-cross-rls-audit で **3 パターン規格化**：
- **A: ブラウザ用**（Client Component）
- **B: JWT 転送型**（Route Handler / Server Component）← **Bloom A2 を標準化**
- **C: Service Role 型**（Cron / 管理者操作）

Route Handler で `@/lib/supabase/client` を使うと `auth.uid()=NULL` で RLS block という事件型を全モジュール監査リストに反映。

### 2. 監査ログを `root_audit_log` に一本化
- UPDATE / DELETE 禁止（RLS で全拒否）= 改ざん絶対不可
- Forest / Root の個別 `_lib/audit.ts` は re-export に縮小
- `write_audit_log()` SECURITY DEFINER RPC で書込統一
- Trigger と Server Action の二重記録ポリシー

### 3. Storage bucket のマスター管理
既存 9 bucket + 将来 5 bucket を本 spec §8 がマスター一覧化：
- bloom-digests / forest-docs / forest-downloads / forest-tax
- bud-attachments / bud-salary-statements / bud-cc-invoices / bud-statement-imports / bud-cc-imports
- 将来: leaf-kanden-photos / leaf-documents / root-employee-docs / tree-recordings / rill-attachments

TTL ルール: ZIP 5 分 / 明細 10 分 / 決算書 1 時間 / Chatwork URL 3 日。

### 4. Chatwork 誤共有防止
- ルーム ID は**全て環境変数化**（ハードコード禁止）
- **DM ルーム検証**（`assertDmRoom()`）で給与 Public 誤投稿防止
- dry-run モード + staging 段階リリース

### 5. エラーハンドリング統一
- Server Action は**throw 禁止、Result 型返却**で統一
- ユーザー表示: inline / toast（sonner 推奨）/ modal / page error
- Sentry 導入は Phase C（PII マスキング設計済）

### 6. テスト戦略 3 レイヤ
- Unit（Vitest）/ Integration（RTL+MSW）/ E2E（Playwright）
- モジュール別厳格度: Tree/Bud/Root 🔴 / Leaf/Forest/Bloom 🟡 / Soil/Rill/Seed 🟢
- §16 7 種テストとの接続マトリクス完備

---

## ■ 判断保留（合計 42 件）

最優先合意事項（a-main 経由で東海林さん判断）:

| # | 論点 | a-auto 推奨 |
|---|---|---|
| 1 | `server-only` パッケージ導入時期 | **Phase B-1 = M3** |
| 2 | Chatwork 通知 URL TTL 3 日 | **1 日に短縮検討** |
| 3 | Chatwork Bot アカウント作成 | **Bot 推奨**、個人 Token から移行 |
| 4 | Toast ライブラリ | **sonner 統一** |
| 5 | Test runner | **Vitest 統一**（Bud 既存尊重） |

他 37 件は各 spec §最終章に集約、優先度は中〜低。

---

## ■ 推奨実装順序

```
M2 第 1-2 週: Bloom 型化 全モジュール監査 → server.ts 共通化（0.5d）
M2 末       : 監査ログ統一（1.0d）
M3 前半      : エラーハンドリング + Storage 掃除 Cron + Chatwork 環境変数化（0.8d）
M3 後半      : Vitest 横展開（0.3d）+ RTL+MSW 導入（0.15d）
M4         : Playwright E2E 開始（Bud Phase B 並行）
M5-M6      : Sentry 導入（Phase C）
```

---

## ■ 次 Batch 候補

Batch 7 で横断仕様が出揃ったため、次は：

### 候補 A: **Leaf 関電 Phase C 着手（推奨 🔴）**
- Leaf C-01 〜 C-06（6 spec、~4.0d）
- Phase B M3 の着手準備、a-leaf セッションへバトン

### 候補 B: Tree Phase D 準備
- Tree D-01 〜 D-06（6 spec、~4.5d）
- M7 着手の前倒し準備、最慎重な展開

### 候補 C: Bud Phase C 準備
- 年末調整 / 退職金 / 業務委託 / 給与改定 UI / 扶養控除電子化 / 源泉徴収票
- ~3.5d、M6（10 月）の年末調整前に合わせる

### 候補 D: Soil / Rill 基盤設計
- Phase C の補完モジュール、a-soil / a-rill が着手できる準備

### a-auto 推奨: **候補 A（Leaf 関電）**

理由:
1. §18 Phase B（事務業務効率化）のコアモジュール
2. Phase A の Forest/Bud 完走で a-forest/a-bud が並行実装中 → **並列化の最適時期**
3. 既存 HTML/JSX プロトタイプ（`garden-leaf-kanden-input-v10` 等）が資産として存在
4. 関電業務委託は FileMaker 11 からの移行プロジェクト、早期仕様化で移行期短縮

---

## ■ 制約遵守

- ✅ コード変更ゼロ（`src/` 未改変、docs のみ）
- ✅ main / develop 直接作業なし、**develop 派生**（派生元ルール遵守、Batch 3-7 継続）
- ✅ 6 件完走（就寝前モードで時間厳守なし、正常停止）
- ✅ `[a-auto]` タグ付き commit
- ✅ 各 spec 200-500 行目安、実装見込み明記
- ✅ 既存コード未改変、spec のみ
- ✅ 判断保留は各 spec に集約（42 件）

---

## ■ Phase A + B + 横断 累計

| Batch | 対象 | spec 数 | 実装工数 |
|---|---|---|---|
| Batch 1 | 設計・基盤 | 6 | — |
| Batch 2-4 | Forest Phase A | 16 | 8.7d |
| Batch 5 | Bud Phase A-1 | 6 | 3.0d |
| Batch 6 | Bud Phase B 給与 | 6 | 3.0d |
| **Batch 7** | **Garden 横断**（本 PR）| **6** | **4.75d** |
| **累計** | — | **40 spec** | **約 19.45d** |

Garden リリース準備の仕様書は **40 spec / 約 19.45 日分**に到達。Phase A-B の骨格がほぼ完成。

---

## ■ 参考

- **作業ブランチ**: `feature/cross-cutting-specs-batch7-auto`（develop 派生、`8331585` 基点）
- **成果物**:
  - `docs/specs/cross-cutting/spec-cross-*.md` × 6 本
  - `docs/broadcast-202604242055/summary.md`
  - 本ファイル `docs/broadcast-202604242055/to-a-main.md`
- **関連参照**:
  - Bloom PR #17（fix/bloom-pdf-rls-20260424）
  - `docs/known-pitfalls.md` §1.1 / §4.2 / §6.1 / §7
  - `docs/garden-release-roadmap-20260424.md` §3 並列化タスクリスト
