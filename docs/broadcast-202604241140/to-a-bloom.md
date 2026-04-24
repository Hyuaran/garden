# 【a-auto セッションからの周知】

- 発信日時: 2026-04-24 11:40 発動 / 約 12:30 配布
- 対象セッション: **a-bloom**
- 発動シーン: 集中別作業中（約60分）

---

## ■ 完了した作業

- `main` から `feature/bloom-workboard-scaffold-20260424-auto` を派生
- 以下 3 ファイルを新規作成し commit + push
  - `docs/specs/2026-04-24-bloom-workboard-scaffold.md`（設計書本体、全 10 章）
  - `docs/autonomous-report-202604241140-a-auto-bloom-scaffold.md`（自律実行レポート）
  - `docs/broadcast-202604241140/to-a-bloom.md`（本ファイル）
- **src/app/bloom/ 配下は一切触れていません**（実装は a-bloom が行う前提）

---

## ■ あなた（a-bloom）が実施すること

### 1. 設計書の精読
```bash
git fetch origin feature/bloom-workboard-scaffold-20260424-auto
git show origin/feature/bloom-workboard-scaffold-20260424-auto:docs/specs/2026-04-24-bloom-workboard-scaffold.md | less
```
または GitHub 上で直接閲覧。本設計書は**ドロップインスカフォールド**として書かれており、SQL / TypeScript / ディレクトリ構造を**そのままコピペ可能**な形にしてあります。

### 2. 判断保留 5 項目の合意（着手前）
§10.3 に列挙した 5 項目を東海林さんと合意してから T1 に着手してください。

| 判# | 論点 | a-auto 推定スタンス |
|---|---|---|
| 判1 | Chatwork API トークンの暗号化方式 | pgcrypto（DB 内完結） |
| 判2 | PDF 生成のランタイム | Node（日本語フォント埋込のため） |
| 判3 | `bloom_monthly_digests.pages` JSON スキーマ厳格化 | 当面 DigestPage 型で運用 |
| 判4 | manager の「忙しさ指標」実装方式 | まずクライアント絞込、将来 View へ昇格 |
| 判5 | Bloom 独自ログイン画面を持つか | 当面 `/forest/login` リダイレクト |

### 3. Phase A-1 実行順序（§9）
設計書で T1〜T10 に分解済。**依存関係に従って順次実行**：

1. **T1** migration 実行（SQL 2 本）— 0.5d
2. **T2** 型定義生成（auto 可）— 0.25d
3. **T3** 認証スケルトン（Forest コピー＋リネーム）— 0.5d
4. **T4** Workboard 画面 — 0.5d
5. **T5** Roadmap 画面 — 0.5d
6. **T6** 月次ダイジェスト画面 — 0.5d
7. **T7** ViewMode 切替 — 0.25d
8. **T8** Chatwork 連携基盤（`src/lib/chatwork/` 新設）— 0.25d
9. **T9** Cron 3 本（daily / weekly / monthly）— 1.0d
10. **T10** 疎結合化仕上げ — 0.25d

**合計 4.0d**（Bloom CLAUDE.md の工数見積と完全一致）

### 4. 特に注意すべき設計方針
- **`bloom_users` テーブルは作らない**（§8.2）— `root_employees.garden_role` を直接参照
- **`bloom_*` プレフィックス必須**（§7.3）— Seed 移植時の差替容易化の核
- **ViewMode は初期 `'simple'`**（§5.3）— 👥みんな向けをデフォルトに
- **auto モード隠蔽**（ステータス名は「対応可能 / 取り込み中 / 集中業務中 / 外出中」）
- **manager の「忙しさ指標のみ」はクライアント側で SELECT 列を絞る**（§8.4）— 将来 View 化検討

### 5. auto 投入可能なサブタスク（§9 より）
T2（型定義生成）は a-auto 次回発動で実施可能。a-bloom の実装本体が始まる前の夜間バッチに適合。

### 6. 本ブランチの扱い
- **推奨**: `main` への **PR 化してマージ**（設計書は永続化したい）
- 代替: `feature/bloom-foundation-20260424`（Bloom CLAUDE.md §Phase A-1 記載）を作り、そこから本設計書を参照しながら実装
- 非推奨: 本ブランチのまま実装を上書き（設計書 vs 実装が混在して履歴追跡が難しくなる）

---

## ■ 判断保留事項（a-auto 側で止めた項目）

**§10.3 の 5 項目**（再掲）。これらは a-auto では結論を出していません。

---

## ■ 設計書ハイライト

### §1 DB: 7 テーブル + 4 enum + RLS ポリシー完備
すべて `bloom_*` プレフィックス、`bloom_has_access()` 関数でロール判定統一。

### §3 ディレクトリ構成（疎結合）
```
workboard/components/   ← 汎用、Seed 移植可
workboard/_lib/         ← 汎用
_types/                 ← 汎用
_components/            ← Bloom 依存 OK
_state/                 ← Bloom 依存 OK
```

### §4 Chatwork 連携
- ライブラリは `src/lib/chatwork/`（**Bloom 外の共有層**）→ Rill でも再利用可
- 日次 18:00 / 週次 金18:00 / 月次 14日18:00（JST = UTC 09:00）
- Vercel Cron 3 本で自動化

### §5 ViewMode 切替
- `'simple'` / `'detail'` の 2 値
- 用語変換マップ 15 エントリ（Phase / Module / Git 用語）
- localStorage で保存、ブラウザ間同期なし

### §6 月次ダイジェスト
- 大画面投影モード（文字大・1ページ1情報）
- PDF: `@react-pdf/renderer` 推奨（日本語フォント埋込可）
- 画像: `html2canvas` 推奨

### §7 Seed 移植
- `cp -r` → `ALTER TABLE RENAME` → クエリ層一括置換 → State 差替 → ルーティング → Chatwork ルーム ID 発行
- 想定 **1〜2 時間**

### §8 Auth 統合
- Forest 既存 `_lib/auth.ts` / `session-timer.ts` / `supabase.ts` / `ForestGate.tsx` / `ForestStateContext.tsx` を **コピー＋リネーム** で流用
- `forest_users` のような permission-scoped table は作らず、`root_employees` 直接参照

---

## ■ 参考

- 設計書本文: `docs/specs/2026-04-24-bloom-workboard-scaffold.md`
- 作業ブランチ: [`feature/bloom-workboard-scaffold-20260424-auto`](https://github.com/Hyuaran/garden/pull/new/feature/bloom-workboard-scaffold-20260424-auto)
- 参考済ドキュメント:
  - `docs/garden-release-roadmap-20260424.md`（本日 a-auto 生成）
  - `docs/forest-v9-to-tsx-migration-plan.md`（本日 a-auto 生成）
  - `06_Garden-Bloom/CLAUDE.md`（本日更新済）
