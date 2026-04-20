# Garden Forest Phase A — コードレビュー結果

**実施日**: 2026-04-17
**対象ブランチ**: `feature/forest-phase-a`
**対象差分**: +9589 行追加 / -2 行削除（main比較）
**レビュー方式**: Claude Code セルフレビュー（code-reviewer エージェント）

全体評価: **Tree モジュールのパターン踏襲、「モジュール販売原則」を意識した自己完結構成、3層セキュリティ設計はよく機能している**

---

## 🔴 Blocking（マージ前に必ず直すべき）

### B-1. 監査ログの偽装可能性（改ざん対策）
**ファイル**: `src/app/forest/_lib/audit.ts:26-33`

`forest_audit_log` への INSERT をクライアント側の anon key で実行しているため、認証済みユーザーなら任意の `action` / `target` / `user_id` を詐称できる。

**推奨**:
- 監査ログ INSERT を Supabase Edge Function 経由に切替
- RLS で `user_id = auth.uid() AND action IN (...)` を CHECK 制約化
- IP アドレスも Edge 側で付与

**Phase A としては**: 「次フェーズ必須タスク」と明記を。

---

### B-2. `login_failed` 時に user_id が NULL のまま記録されない ⚠️ バグ
**ファイル**: `src/app/forest/_components/ForestGate.tsx:71, 87` + `audit.ts:23-24`

`writeAuditLog("login_failed", empId)` 呼び出しは `audit.ts:23-24` で `if (!user) return;` されるため、**ログインに失敗した時点では常に認証前で、ログが記録されない**。ブルートフォース検知が機能不全。

**推奨**:
- `audit.ts` に `login_failed` だけは `user_id = null` 許容の分岐を追加
- schema 側でも `login_failed` のみ `user_id IS NULL` を許す CHECK に
- または別テーブル `forest_login_attempts` に分離

---

### B-3. sessionStorage ベースのゲートは XSS で即破られる
**ファイル**: `src/app/forest/_lib/auth.ts:63, 78`

sessionStorage は JS から自由に読み書き可能。将来のサードパーティスクリプト混入・依存ライブラリのサプライチェーン攻撃で `sessionStorage.setItem("forestUnlockedAt", Date.now())` 一行でゲートを突破できる。

**本質**: ゲートは UI ガードに過ぎず、実質的な保護は RLS のみ。`forest_users` への登録が真の権限境界。

**推奨**:
- 短期: `docs/auth/login-implementation-guide.md` に「ゲートは UI ガードのみ」と明記
- 将来: Server Component で `cookies()` から読む httpOnly 方式に

---

## 🟡 Should fix（マージ前に直す推奨）

### S-1. `fetchForestUser` が throw すると無反応になる
**ファイル**: `src/app/forest/_state/ForestStateContext.tsx:96-109, 148-151`

`refreshAuth` の catch で呑み込まれて `loading=false` で止まるだけ。ユーザーにリトライ手段なし。

**推奨**: `error` state を追加、`RetryScreen` を表示。

---

### S-2. 2時間セッションタイマーのイベントリスナーが高頻度発火
**ファイル**: `src/app/forest/_lib/session-timer.ts:14-22`

`mousemove` + `scroll` + `touchstart` を `{ passive: true }` で登録し、毎回 `touchForestSession()` → `sessionStorage.setItem` を呼ぶ。マウス移動中に毎秒数十回のストレージ書き込み。

**推奨**: `handleActivity` を throttle（例: 30秒に1回のみ書き込み）。

---

### S-3. `Math.sqrt(...)` に負値が渡りうる
**ファイル**: `src/app/forest/_components/MicroGrid.tsx:172-174`

DB から負値が来れば `Math.sqrt` → `NaN` → CSS `height: NaN` で警告。過年度修正（返金処理等）で破綻リスク。

**推奨**: `Math.sqrt(Math.max(0, src.uriage!) / maxVal)` に統一。

---

### S-4. Chart.js のグローバル `register` が副作用として実行される
**ファイル**: `src/app/forest/_components/MacroChart.tsx:27`

`MacroChart.tsx` が import されるだけで `ChartJS.register(...)` がモジュール初期化時に走る。「自己完結」原則からは副作用 import は避けたい。

**推奨**: `register` を `useEffect(() => { register(...) }, [])` か、`_lib/chart-setup.ts` にまとめて明示 import。

---

### S-5. 権限なし時のエラーメッセージで情報リーク
**ファイル**: `src/app/forest/_state/ForestStateContext.tsx`（refreshAuth の no permission 分岐）

「認証成功するが forest_users 未登録」= 社員番号・パスワードが正解であることが判明。

**推奨**:
- 「社員番号またはパスワードが正しくありません」に寄せる
- または「管理者にお問い合わせください」に留める

---

### S-6. `view_detail` の二重発火 + `click_drive_link` 未使用
**ファイル**: `src/app/forest/_components/MicroGrid.tsx:60` + `DetailModal.tsx:31`

`DetailModal.tsx:31` の Drive クリックで `view_detail` を呼んでいるが、本来は `click_drive_link` を使うべき。型定義には既に `click_drive_link` が定義済み。

**推奨**: `DetailModal.tsx:31` を `writeAuditLog("click_drive_link", ...)` に修正。

---

## 🔵 Nice to have（後日で可）

### N-1. インラインスタイル肥大化
`ForestGate.tsx` 等でインラインスタイル 200 行超。CSS Modules か `clsx` + Tailwind への段階移行推奨。

### N-2. `MicroGrid.tsx:178-191` の `CellData` 組み立てが非 DRY
`_lib/to-cell-data.ts` に純粋関数化でテストしやすく。

### N-3. `SummaryCards.tsx:36-38` の `sort` が毎レンダ発火
`periods` を `company_id` でグループ化した Map にしておく。Phase A では不要。

### N-4. Next.js 16 の Server Component 活用余地
全コンポーネントが `"use client"`。`dashboard/page.tsx` を Server Component 化して初期データを RSC 取得、hydrate 済みデータを Provider に渡す設計が望ましい。Phase A スコープ外。

---

## ✅ 良かった点

- **Tree パターンの一貫性**: `layout → Provider → Shell → children`
- **認証と権限の分離**: `signInForest` を「認証のみ」に、`refreshAuth` で権限確認（RLS タイミング対策）
- **型安全性**: `CellData` 結合型、`ForestUser.role` のリテラル型
- **Supabase クライアントに anon key のみ**: Service Role Key 不使用
- **SSR 互換**: 各所で `typeof window !== "undefined"` チェック

---

## 🎯 マージ判断

**B-2 は必ず修正**（ロジックバグ）。B-1・B-3 はドキュメント追記＋次フェーズ宿題化でも可。

### 明日の作業優先順位

1. **B-2 修正**（login_failed が記録されないバグ）
2. **S-6 修正**（click_drive_link 使用）
3. **S-3 修正**（Math.sqrt に負値対策）
4. **S-5 修正**（エラーメッセージの情報リーク対策）
5. **B-1, B-3 のドキュメント追記**（Phase B/C 宿題化）
6. S-1, S-2, S-4, N-* は Phase B 以降で対応

---

## 未レビューファイル（次回確認）

サンドボックス制約で未読のファイル:
- `scripts/forest-schema.sql`
- `scripts/seed-forest.ts`
- `_constants/colors.ts`
- `_constants/theme.ts`
- `docs/auth/login-implementation-guide.md`

特に RLS・SECURITY DEFINER 関数 `is_forest_admin()` の実装妥当性（`SET search_path = public` 設定の有無、`SECURITY DEFINER` + `STABLE` 指定）を要確認。
