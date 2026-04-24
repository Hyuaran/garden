# Garden-Bud レビュー提案 - 2026-04-24

- 作成元セッション: **a-auto**（自律実行モード / 集中別作業中・約30分枠）
- 作業ブランチ: `feature/bud-review-20260424-auto`（`feature/bud-phase-0-auth` から派生）
- 対象: `src/app/bud/` および `docs/` 配下の現状把握ベースの提案
- 目的: **改修指示ではなく「観察結果 + 判断材料」の提示**。実装判断は a-bud セッション（東海林さん承認のうえ）で行う。

---

## a. コード品質の気づき（5項目）

### 1. `BudGate` の `isBudUnlocked()` が非リアクティブ
[BudGate.tsx:22-31](C:/garden/a-bud/src/app/bud/_components/BudGate.tsx) の `useEffect` は `[loading, isAuthenticated, router]` のみに依存。`isBudUnlocked()` は命令的関数で useState 連携が無いため、**セッションが 2 時間で失効しても画面を遷移するまで検知されない**。

→ 対策案: `BudStateContext` に `isUnlocked` を State で保持し、`setInterval` でチェック or `visibilitychange` で再検査する。

### 2. `canCreate = true` のハードコード（TODOコメント残）
[transfers/page.tsx:87](C:/garden/a-bud/src/app/bud/transfers/page.tsx) に `const canCreate = true; // bud_has_access() すなわちこの画面に居る時点で OK` の記述。
- 現状 `BudGate` を通過済 = bud_has_access 通過と等価、というロジックに依存。
- 権限区分が「閲覧のみ」「作成可」「承認可」と増えた場合の拡張ポイントが未整備。

### 3. FilterBar の `onBlur` と `Enter` 両方で検索が発火
[FilterBar.tsx:104-110](C:/garden/a-bud/src/app/bud/transfers/_components/FilterBar.tsx) で `onBlur` と `onKeyDown: Enter` 両方が `updateParam` を呼ぶ。
- Enter 押下 → 即 router.push → input が blur → onBlur で再度同値で router.push、という二重発火が起こり得る（React 18+ で結合される可能性は高いが保証されない）。
- `onBlur` のみ or Enter のみのどちらかに絞る方が意図が明確。

### 4. transfers 一覧が固定 limit 200、ソート不可、ページング無し
[transfers/page.tsx:52](C:/garden/a-bud/src/app/bud/transfers/page.tsx) で `f.limit = 200` ハードコード。テーブルには `<th>` でのソート UI も無く、200 件超は見えない。
- 運用初期は問題無いが、月次振込が 200 件を超えた段階で見落としが起きる。UI に「201件以上存在する場合のヒント」も無い。

### 5. 会社マスタ取得のエラー無視
[transfers/page.tsx:64-68](C:/garden/a-bud/src/app/bud/transfers/page.tsx) の `root_companies` 取得は `{ data: companyData }` しか受け取らず、`error` を破棄している。取得失敗時はフィルタの実行会社セレクトが空のまま黙る。
- `fetchTransferList` 側はエラーを例外で捕捉しているので、同じ層で扱いを揃えるのが自然。

### 補足（良い点）
- `_lib/__tests__/` に **4種のユニットテスト**（`duplicate-key` / `transfer-id` / `transfer-status` / `status-display` / `transfer-form-schema`）がそろっており、DB 側と同ロジックの純粋関数に対する回帰網が組まれている。a-tree 側には無い優位点。
- `useEffect` のクリーンアップで `cancelled` フラグ方式を徹底（ストリクトモード時の二重実行・unmount 後の state 更新を防止）。

---

## b. アクセシビリティ / レスポンシブ改善案（3項目）

### 1. テーブルに `<caption>` / `scope="col"` / `aria-sort` を追加
[transfers/page.tsx:137-148](C:/garden/a-bud/src/app/bud/transfers/page.tsx) の `<thead>` は `<th>` に `scope` が無く、支援技術からテーブル構造が読めない。`<caption>` で「振込一覧」等を付与すれば、複数テーブルがあっても文脈が保てる。

### 2. 行クリック（`<tr onClick>`）のキーボード操作対応
[transfers/page.tsx:161-167](C:/garden/a-bud/src/app/bud/transfers/page.tsx) は `<tr className="cursor-pointer" onClick={...}>` でページ遷移。**キーボードやSRでフォーカスできない**ため、振込IDを `<Link>` で包むか、行全体を `<tr role="button" tabIndex={0} onKeyDown>` 化するのが望ましい。

### 3. エラー表示の `role="alert"` 統一
[transfers/page.tsx:128-131](C:/garden/a-bud/src/app/bud/transfers/page.tsx) のエラー UI に `role="alert"` が無い。送金関連の画面で失敗メッセージが読み上げられないのは業務上リスク（「送れたと思った」が起きる）。

---

## c. 未ドキュメント化の機能・仕様（5項目）

docs/ 配下は superpowers/plans・specs・handoff 系が充実（a-tree より手厚い）が、以下 5 点は**実装／コミットメッセージだけで存在し、独立ドキュメント無し**。

1. **Bud 2時間セッション（Bud固有のアンロック概念）**
   `isBudUnlocked()` が示す「Bud モジュール固有の 2 時間ロック」仕様。Garden 共通 Auth とは別レイヤーで、根拠・延長ルール・他モジュールでの踏襲可否が未記録。

2. **振込ステータス 6 段階遷移 + super_admin スキップ**
   `bud_transfers v2 RLS ポリシー（6 段階遷移 + super_admin スキップ）` コミットで触れられた遷移グラフ・可能ロール表・不可逆点が未ドキュメント化。

3. **`FK-` / `CB-` 振込 ID フォーマット**
   `transfer-id.ts` のロジックのみに存在。桁数・プレフィックス・DB 側の生成関数との役割分担（どちらが正か）が未記録。

4. **super_admin 自承認時の `confirmed_by/at` NULL ルール（I-2 B案）**
   レビュー修正コミット（`dcce5ba`）で採用された B 案の意思決定経緯・代替案 A の却下理由が超要約のみ。

5. **重複検出キー（DB 側と同ロジック）**
   `duplicate-key.ts` が「DB 側と同ロジック」であることを担保する仕組み（テストで比較する等）と、両者が乖離したときの検出フローが未記録。

---

## d. 優先度マトリクス

| 種別 | 項目 | 優先度 | 根拠 |
|---|---|---|---|
| コード | 1. BudGate 非リアクティブ | 🔴 | セッション失効後もデータ閲覧可のリスク |
| コード | 5. 会社マスタのエラー握り潰し | 🟡 | 画面が黙るため UX 影響 |
| コード | 3. FilterBar 二重発火 | 🟡 | 体感バグ化しやすい |
| コード | 4. limit 200/ソート無し | 🟡 | 運用規模で顕在化 |
| コード | 2. canCreate ハードコード | 🟢 | 権限追加時に合わせて対応で可 |
| A11y | 3. role=alert | 🔴 | 送金業務のSR読み上げ欠落はリスク大 |
| A11y | 2. 行クリックのキーボード対応 | 🟡 | アクセシビリティ観点で重要 |
| A11y | 1. table caption/scope | 🟡 | 1箇所追加で効果大 |
| ドキュ | 2. 6段階ステータス遷移 | 🔴 | 業務ルールの要。仕様書不在は危険 |
| ドキュ | 1. 2時間セッション | 🟡 | 他モジュール流用判断に必要 |
| ドキュ | 3. FK/CB フォーマット | 🟡 | DB と同期する仕様 |
| ドキュ | 4. 自承認ルール | 🟢 | コミットログで追える |
| ドキュ | 5. 重複検出キー整合 | 🟡 | テストで担保できれば🟢へ降格可 |

---

## e. 次アクション候補（A/B/C 案）

### A案：🔴 最優先 3 点を束ねる（1〜1.5d、推奨）
1. `BudGate` の `isBudUnlocked` リアクティブ化（Context へ state 昇格 + visibilitychange ハンドラ）
2. エラー UI への `role="alert"` 一括付与（transfers 系 3〜5 画面）
3. 振込ステータス 6 段階遷移の仕様ドキュメント新規作成（`docs/specs/2026-04-24-bud-transfer-status-6stage.md`）
→ 本番投入リスクの高いものだけを束ねて片付ける。

### B案：ドキュメント一括整備（0.5d、低リスク・自律実行向き）
未ドキュメント化 5 点の仕様文書化のみ。コード不触。a-auto 自律実行モードでも遂行可能な範疇。
→ 将来のレビューコスト低減が主目的。

### C案：テーブル UI 改善（1d）
一覧テーブルのソート・ページング・キーボード操作・caption/scope を一括対応し、FilterBar の二重発火も合わせて解消する。他モジュール（Forest 等）のテーブルにも波及しうる設計判断が含まれるため、横断相談が必要。

---

## 付録: 参考ファイル
- [BudGate.tsx](C:/garden/a-bud/src/app/bud/_components/BudGate.tsx)
- [transfers/page.tsx](C:/garden/a-bud/src/app/bud/transfers/page.tsx)
- [FilterBar.tsx](C:/garden/a-bud/src/app/bud/transfers/_components/FilterBar.tsx)
- [layout.tsx](C:/garden/a-bud/src/app/bud/layout.tsx)

— end of review —
