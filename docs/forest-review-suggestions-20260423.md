# Garden-Forest レビュー提案 — 2026-04-23

**担当セッション**: a-forest（東海林A）
**発動モード**: 自律実行モード（就寝前）
**対象**: Garden-Forest 現行 Next.js 実装（`src/app/forest/**`、`src/app/api/forest/**`）
**対象ブランチ**: `fix/forest-modal-height-consistent`（HEAD: `bfbf24c`）

> **注記（タスク解釈）**: 本タスクは当初「`garden-forest_v9.html` を読む」指示だったが、
> 本リポジトリ（`C:\garden\a-forest`）およびガーデン系ディレクトリ
> （`C:\garden\*`）を全検索しても v9 HTML 単体ファイルは存在しない。
> 既に Next.js (TypeScript) に移植済みで、原本は `_archive` 配下にも見当たらない。
> よって CLAUDE.md §13「既存実装に最も近い選択を採用」に従い、
> **対象を現行 TSX 実装に読み替え** てレビューを実施した。
> v9 時代の指摘事項は `_archive/past-downloads/GardenForest_厳格レビュー_ClaudeCode用.md`
> と突き合わせ、移植後に解消済/残存を明示する。
>
> コード変更は一切行っていない（docs 追記のみ）。

---

## サマリ

- **総合所感**: v9 HTML 時代の「データハードコード」「Python 手動実行」はほぼ解消。
  Next.js + Supabase + RLS の多層防御に再設計され、UI は React + Chart.js に再実装済み。
  残課題は **a) インラインスタイル多用ゆえの再利用性の低さ**、
  **b) アクセシビリティ/キーボード操作の網羅性**、
  **c) エラーハンドリング/リトライ/楽観ロック**、
  **d) 未ドキュメントの運用仕様**、の 4 カテゴリ。
- **v9 時代 5 課題の現状**:
  1. データハードコード → ✅ Supabase `companies` / `fiscal_periods` / `shinkouki` に移行完了
  2. 進行期更新が Python 手動 → ✅ Phase A2/A3 で Web UI から PDF アップロード可能（`/api/forest/parse-pdf`）
  3. テストコードなし → ❌ 未着手（ユニット/E2E とも存在せず）
  4. エラーハンドリング最小 → 🟡 ユーザー向け表示は改善。ログ集約・リトライは未対応
  5. セキュリティ懸念 → 🟡 Supabase Auth + RLS で大幅改善。ただし `sessionStorage` ベースのゲートと監査ログの IP アドレス欠落は残

---

## A. コード品質の気づき（冗長・リファクタ候補）

### A-1 🟡 インラインスタイルの大量重複（推定 40%+ の LoC が style 定義）
- **対象**: `ForestShell.tsx` / `SummaryCards.tsx` / `MacroChart.tsx` / `MicroGrid.tsx` /
  `DetailModal.tsx` / `ShinkoukiEditModal.tsx` / `NumberUpdateForm.tsx` /
  `PeriodRolloverForm.tsx` / `ForestGate.tsx` / `AccessDenied.tsx`
- **観察**:
  - パネル共通スタイル（`panelBg` / `panelBorder` / `panelRadius` / `panelShadow` + `padding`）
    が `SummaryCards` / `MacroChart` / `MicroGrid` / `AccessDenied` の 4 箇所でほぼ同一
  - ボタンスタイル（`padding:"10px 20px"` + `borderRadius:8` + `border:1px solid ${C.textMuted}`）
    が `NumberUpdateForm` / `PeriodRolloverForm` / `ShinkoukiEditModal` のキャンセルボタンで重複
  - `inputStyle` / `labelStyle` が `NumberUpdateForm` と `PeriodRolloverForm` で完全重複
    （26–35 行目、22–39 行目）
- **リファクタ候補（優先度：中）**:
  - A案: `_components/ui/` に `<Panel>` / `<PrimaryButton>` / `<SecondaryButton>` /
    `<FormInput>` を抽出（インラインスタイルを props 化）
  - B案: CSS Modules もしくは Tailwind に寄せる（プロジェクト全体で Tailwind 採用済の前提）
  - C案: `styled-jsx` に切り替え（Next.js 標準で依存追加不要）
- **影響範囲**: Forest 内完結。他モジュール影響なし。

### A-2 🟡 `MacroChart.tsx` の ChartJS.register が副作用（v9 レビュー S-4 相当）
- **対象**: `src/app/forest/_components/MacroChart.tsx:27`
- **観察**: モジュールトップレベルで `ChartJS.register(...)` を実行しているため、
  `MacroChart` を import しただけで全ページで Chart.js の全要素が登録される。
  - `hot reload` で重複登録警告が出るリスク
  - tree-shaking 上 Forest 以外のページで chart.js が評価される可能性
- **改善案**: `useEffect` 内で遅延登録 or `export function registerChart()` を呼び出し側で実行
- **優先度**: 低（現状バグなし、パフォーマンス最適化目的）

### A-3 🟡 `MicroGrid.tsx` が長大（~300 行、セル描画ロジックが肥大化）
- **対象**: `src/app/forest/_components/MicroGrid.tsx`
- **観察**:
  - `years` の build / `groupTotals` の build / セル描画が 1 コンポーネント内に集約
  - セル 1 個の描画（162–285 行）が JSX 120 行以上
  - `CellData` 組み立て（183–199 行）が if/else で分岐しており、`p ? ... : (isSK ? sk : null)` のキャスト
    （`src as FiscalPeriod` / `sk!`）が複数回登場
- **リファクタ候補**:
  - `<MicroGridCell>` を別コンポーネントに抽出
  - `buildCellData(company, year, periods, shinkouki): CellData | null` ヘルパを `_lib/cell.ts` に切り出す
- **優先度**: 中（将来の編集モーダル拡張でバグ温床になりうる）

### A-4 🟡 `rolloverPeriod` が疑似トランザクション（INSERT → UPDATE 逐次）
- **対象**: `src/app/forest/_lib/mutations.ts:67-130`
- **観察**:
  - `fiscal_periods` INSERT 成功後、`shinkouki` UPDATE が失敗した場合 DB が整合性を欠いた状態で残る
    （進行期が次期に進む前にロールオーバー途中で終わる）
  - コード内 5–8 行のコメントで「トランザクションは RPC で実装するのが理想」と自己言及済
- **改善案**: Supabase RPC (PL/pgSQL 関数) を追加し、単一トランザクションで INSERT + UPDATE
  （v9 レビューでも言及された B-1 系の設計課題）
- **優先度**: 中〜高（年 1 回の運用だが、失敗時のリカバリ手順が未整備）

### A-5 🟡 `fetchShinkouki` / `fetchFiscalPeriods` が全件 SELECT
- **対象**: `src/app/forest/_lib/queries.ts:43-71`
- **観察**: 全社・全期を常に取得。データが増えても問題ないスケール感ではあるが、
  RLS + Forest ユーザー権限の前提で十分とはいえ将来的には年度フィルタが望ましい
- **改善案**: 年度レンジパラメータを受けるバリアント `fetchFiscalPeriods({ fromYr, toYr })` を追加
- **優先度**: 低（現状 6 法人 × 10 期 = 60 行程度）

### A-6 🟡 `ForestStateContext` の `useMemo` 依存配列が肥大（13 要素）
- **対象**: `src/app/forest/_state/ForestStateContext.tsx:184-205`
- **観察**: context value の `useMemo` 依存が 13 個。`loading` / `isAuthenticated` / `hasPermission` /
  `isUnlocked` / `userEmail` / `forestUser` / `companies` / `periods` / `shinkoukiData` + 4 callback
- **リファクタ候補**: 「認証状態」「データ」「操作」で分離した 3 つの context に分割し、
  購読側が必要な粒度だけ購読する（現状は 1 つの値が変わるだけで全消費者が再レンダリング）
- **優先度**: 低（現在の規模では体感できないが、将来の拡張で地雷化）

### A-7 🟢 `format.ts:fmtYen` と `fmtYenShort` がほぼ重複
- **対象**: `src/app/forest/_lib/format.ts`
- **観察**: 違いは最後の分岐（円単位テキストの有無）のみ
- **改善案**: `fmtYen(v, { unit?: "yen" | "none" })` に統一
- **優先度**: 低（読みやすさの好み）

### A-8 🟡 `parseRange` の月末計算が手動
- **対象**: `src/app/forest/_lib/mutations.ts:43-61`
- **観察**: `new Date(nextYear, nextMonth - 1, 1) - 24h` で月末を算出しているが、
  うるう年・タイムゾーンずれの余地がある（`new Date(year, month, 0)` の方が安全）
- **改善案**: `new Date(toY, toM, 0).getDate()` で 1 行化
- **優先度**: 低（年度末・月末が 31/30/28 日以外になることは今後ないが堅牢化）

### A-9 🟡 `PdfUploader` が `uploadFile` 内で JWT を毎回 `getSession()` する
- **対象**: `src/app/forest/_components/PdfUploader.tsx:38-43`
- **観察**: Context の `refreshAuth` で既にセッション取得済だが、再度 getSession している
- **改善案**: `useForestState` 経由で `accessToken` を取得 or Context に追加
- **優先度**: 低（安全側の動作ではある）

### A-10 🟡 `input` の `onChange` での `replace(/[^\d-]/g, "")` が 3 箇所重複
- **対象**: `NumberUpdateForm.tsx:95,107,119` / `PeriodRolloverForm.tsx:91,102,113`
- **改善案**: `<NumericInput>` 共通コンポーネントに抽出
- **優先度**: 低

### A-11 🟡 `ShinkoukiEditModal` の `minHeight: 560` がマジックナンバー
- **対象**: `src/app/forest/_components/ShinkoukiEditModal.tsx:176`
- **観察**: コメントで根拠は明示されているが、数値は PdfUploader の表示状態変化で
  可変になりうる
- **改善案**: CSS `contain: size` + `height: max-content` もしくは両タブの外枠 DOM を測定
  して `useState` で動的 min に差し替え
- **優先度**: 低（当面は視覚的な許容範囲内）

---

## B. アクセシビリティ / レスポンシブの改善案

### B-1 🔴 モーダルのキーボードフォーカストラップが未実装
- **対象**: `ShinkoukiEditModal.tsx` / `DetailModal.tsx`
- **観察**:
  - `role="dialog"` / `aria-modal="true"` は付与されているが、Tab キーが背景要素にも移動する
  - 開閉時に `focus()` が初期要素に移動しない
- **改善案**: `focus-trap-react` 導入もしくは自前実装
  - 開いたとき最初のフォーカス可能要素にフォーカス
  - Tab が最終要素から先頭に循環
  - 閉じたとき元の trigger 要素にフォーカス復帰
- **優先度**: 中（アクセシビリティ基本要件）

### B-2 🔴 `MicroGrid` のセルがクリック可能なのに `<button>` ではなく `<td onClick>`
- **対象**: `src/app/forest/_components/MicroGrid.tsx:202-286`
- **観察**:
  - `<td onClick={handleCellClick}>` でキーボード操作不可（Enter / Space で開かない）
  - `role="button"` / `tabIndex={0}` / `onKeyDown` がない
- **改善案**: `<button>` をセル内側にラップ、もしくは `role="button" tabIndex={0} onKeyDown`
- **優先度**: 中

### B-3 🟡 `DetailModal` に `aria-label` / `aria-modal` がない
- **対象**: `src/app/forest/_components/DetailModal.tsx:34-45`
- **改善案**: `role="dialog" aria-modal="true" aria-labelledby={titleId}`
- **優先度**: 中

### B-4 🟡 テキストコントラスト比の未検証
- **観察**:
  - `FOREST_THEME.textMuted` が薄めのグレーで、サブ文字サイズ（10–12px）と合わせて
    WCAG AA (4.5:1) を満たさない可能性
  - セル内「期間表示」（9px × textMuted）は AA 未達の公算大
- **改善案**: Lighthouse / axe-core で実測。`textMuted` を少し濃くするか、補助テキストを 12px 以上に
- **優先度**: 中

### B-5 🟡 `ForestGate` / `AccessDenied` に `<h1>` がない（`<h2>` から始まる）
- **対象**: `ForestGate.tsx:122-130` / `AccessDenied.tsx:36-44`
- **観察**: ランディング/モーダル系画面で heading level が h2 から。スクリーンリーダーの
  ランドマーク的にも h1 が欲しい
- **優先度**: 低

### B-6 🟡 Chart.js のキャンバスが `aria-label` なしでスクリーンリーダーに何のチャートか伝わらない
- **対象**: `MacroChart.tsx:95-138`
- **改善案**: `<canvas aria-label="経常利益推移グラフ">` もしくはテキスト代替の表を併記
- **優先度**: 低

### B-7 🟡 フォーカスリング（`:focus-visible`）が無い要素がある
- **観察**: `<button>` の `outline: none` は設定していないが、背景色が薄い場所で
  フォーカスリングが視認しづらい
- **改善案**: グローバルに `button:focus-visible { outline: 2px solid ... }`
- **優先度**: 低

### B-8 🔴 `MicroGrid` の横スクロールがモバイルで分かりにくい
- **対象**: `src/app/forest/_components/MicroGrid.tsx:86-122`
- **観察**:
  - `overflowX: "auto"` で横スクロール可能だが、スクロールバーが薄いため気付きにくい
  - 一覧に 10 年以上が入る場合、スマホ/タブレットで横幅が足りない
- **改善案**:
  - スクロール可能である旨の視覚ヒント（右端のフェード / スクロールアイコン）
  - モバイルでの縦展開レイアウト（法人ごとの縦リスト）
- **優先度**: 中（経営ダッシュボードは PC 前提だが、外出先確認シーンを考慮）

### B-9 🟡 SummaryCards の `auto-fit, minmax(180px, 1fr)` で 5 枚だと微妙な折り返し
- **対象**: `src/app/forest/_components/SummaryCards.tsx:63-70`
- **観察**: 画面幅によっては 4/5 でブレイクし、最後の 1 枚が横長に
- **改善案**: ブレイクポイントで `repeat(5,1fr)` / `repeat(3,1fr)` / `repeat(2,1fr)` / `1fr` に切替
- **優先度**: 低

### B-10 🟡 `PdfUploader` がキーボード操作困難
- **対象**: `src/app/forest/_components/PdfUploader.tsx:82-114`
- **観察**:
  - `<div onClick>` で `<input type="file">` をトリガする仕組み
  - `tabIndex` 指定なしで TAB キーで到達できない（`onKeyDown` も未定義）
- **改善案**: `<label htmlFor="pdf-file">` + ビジュアル隠し input、もしくは `role="button" tabIndex={0} onKeyDown`
- **優先度**: 中

---

## C. 未ドキュメント化の機能・仕様（要ドキュメント化）

既存 docs は `handoff-*.md` と `superpowers/specs|plans|reviews/` に散在しており、
「Forest の機能そのものを説明するユーザー向け README」が存在しない。
以下は **コードを読まないと分からない** 仕様の一覧。

### C-1 🔴 Forest の README / 機能ドキュメントがゼロ
- **現状**: `README.md` は Next.js デフォルトテンプレート（`create-next-app`）のまま
- **不足ドキュメント**:
  - Forest モジュールの目的（6 法人 × 各期決算データの統合ダッシュボード）
  - 主要画面（ログイン → ダッシュボード → 進行期編集モーダル → 詳細モーダル）
  - 権限（viewer / admin）による UI の差分
  - セッション 2 時間ルール
- **提案**: `docs/forest/README.md` を新規作成

### C-2 🔴 認証フローの全体図が断片的
- **現状**: `docs/auth/login-implementation-guide.md` は存在するが、未確認。
  コード側（`_lib/auth.ts` / `_state/ForestStateContext.tsx` / `_components/ForestGate.tsx`）の
  コメント断片で説明されている
- **不足情報**:
  - 社員番号 → 擬似メール (`emp{4桁}@garden.internal`) 変換の全体像
  - `refreshAuth` と `signInForest` を分離した理由（JWT タイミング問題）
  - `sessionStorage(forestUnlockedAt)` と Supabase Auth セッションの二層構造
  - `view_dashboard` / `login_failed` / `period_rollover` など監査ログ記録タイミング一覧
- **提案**: `docs/forest/auth-flow.md`（シーケンス図含む）

### C-3 🔴 `zantei` / `reflected` フラグの運用ルールが未記載
- **現状**:
  - `scripts/README-shinkouki.md` に断片あり（`zantei: true` はスクリプト反映時）
  - UI 上は `NumberUpdateForm` で暫定/確定ラジオがあるが、どちらを選ぶべきかの運用ルール不明
- **不足情報**:
  - 「暫定」と「確定」の運用上の違い（税理士の月次試算表 vs 決算確定）
  - `reflected` テキストの形式（`YYYY/Mまで反映中`）と他の表現の許容範囲
- **提案**: `docs/forest/shinkouki-workflow.md`

### C-4 🔴 期切り替え（rollover）の運用タイミングと事前確認項目
- **現状**: `PeriodRolloverForm.tsx` に「年 1 回の運用」とコメントあるが詳細不明
- **不足情報**:
  - いつ実行すべきか（決算確定後？税理士からの確定データ受領後？）
  - 実行前に必要な入力（純資産/現金/預金/決算書 URL）の取得先
  - 取り消し不可である点の注意（`rolloverPeriod` は INSERT + UPDATE で逆行不能）
  - 間違えた場合のリカバリ手順（Supabase Table Editor で手動戻し）
- **提案**: `docs/forest/period-rollover-guide.md`

### C-5 🟡 RLS ポリシーの全体像が未集約
- **現状**: `supabase-migrations/` 配下（未確認）と `docs/superpowers/plans/2026-04-21-*.md`
  等に散在
- **不足情報**:
  - `companies` / `fiscal_periods` / `shinkouki` / `forest_users` / `forest_audit_log` の
    SELECT / INSERT / UPDATE / DELETE ポリシー一覧
  - `forest_audit_anon_login_failed` の例外（anon が INSERT できる条件）
- **提案**: `docs/forest/rls-policies.md`（SQL コピペ可能な形）

### C-6 🟡 `/api/forest/parse-pdf` API 仕様が未公開
- **現状**: コード内 JSDoc のみ
- **不足情報**:
  - リクエスト/レスポンスの JSON スキーマ
  - admin 限定である制約
  - サポートする PDF 種類（残高試算表 / 損益計算書 / 貸借対照表）
  - `ParsePdfResult.company_id` が null の場合（会社特定失敗）の UI 挙動
  - maxDuration=30 / runtime=nodejs 制約
- **提案**: `docs/forest/api/parse-pdf.md`（サンプル cURL 含む）

### C-7 🟡 監査ログ（forest_audit_log）の項目と保存期間
- **現状**: `_lib/audit.ts` の AuditAction 型と挿入ロジックのみ
- **不足情報**:
  - 全 action の意味と発生箇所
  - user_agent / ip_address / target の記録方針
  - ログの保持期間・参照方法（Supabase Dashboard？専用 UI？）
- **提案**: `docs/forest/audit-log.md`

### C-8 🟡 セッションタイマー仕様（2時間/操作リセット）
- **現状**: コード内コメント散在
- **不足情報**:
  - どのイベント（mousemove/keydown/scroll/click/touchstart）でリセットか
  - タブ非アクティブ時の挙動
  - バックグラウンドタブでのチェック間隔（1 分ごと）
- **提案**: `docs/forest/session-timer.md`

### C-9 🟡 ログアウト/ロック時のデータクリア仕様
- **現状**: `lockAndLogoutFn` で state を全クリアするが、明示ドキュメントなし
- **不足情報**: manual / timeout の違い（監査ログの `logout_manual` vs `logout_timeout`）
- **提案**: C-2 に統合

### C-10 🟡 `Forest 権限（admin / viewer）` 別の UI 差分
- **現状**: `isForestAdmin` / `onEditShinkouki` の分岐あり
- **不足情報**:
  - viewer で何ができるか（ダッシュボード閲覧のみ？DetailModal は開ける？）
  - admin で追加される機能（進行期編集モーダルのみ？他も？）
  - API 側（`/api/forest/parse-pdf`）も admin 限定である点
- **提案**: `docs/forest/permissions.md`（表形式）

### C-11 🟡 法人カラー/ソート順/決算月の登録方法
- **現状**: Supabase `companies` テーブルに格納されているが、追加時の手順なし
- **不足情報**:
  - `color` / `light` のカラーコード選定方針
  - `sort_order` の衝突時の挙動
  - `kessan` 文字列（例: "3月"）のフォーマット
- **提案**: `docs/forest/companies-master.md`

### C-12 🟡 Vercel デプロイ環境の前提
- **現状**: ハンドオフ `docs/handoff-20260423.md` に URL のみ
- **不足情報**:
  - 必須環境変数（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
    `SUPABASE_SERVICE_ROLE_KEY`）
  - プレビュー環境と本番環境の差分
  - `maxDuration=30` 設定の Vercel プラン前提
- **提案**: `docs/forest/deployment.md`

---

## D. ドキュメント不足（`docs/` 配下の洗い出し）

### 現在 `docs/` に存在するもの
| ファイル | 内容 | 整備度 |
|---|---|---|
| `docs/auth/login-implementation-guide.md` | 認証実装ガイド | 未読・要確認 |
| `docs/handoff-20260422.md` / `-20260423.md` | セッション間ハンドオフ | 最新 |
| `docs/effort-tracking.md` | 工数トラッキング | 最新 |
| `docs/superpowers/plans/2026-04-21-shinkouki-auto-update-phase-a1.md` | Phase A1 実装プラン | 完了分 |
| `docs/superpowers/plans/2026-04-22-forest-phase-a2-a3-edit-modal.md` | Phase A2/A3 実装プラン | 完了分 |
| `docs/superpowers/specs/2026-04-21-shinkouki-auto-update-design.md` | 設計書 | — |
| `docs/superpowers/reviews/2026-04-17-forest-phase-a-review.md` | レビュー結果 | — |

### 欠落しているドキュメント（まとめ）
（C-1 〜 C-12 と重複する箇所もあるが、`docs/` 配下の棚卸し視点で再整理）

- ❌ **Forest モジュール README**（`docs/forest/README.md` または `src/app/forest/README.md`）
- ❌ **運用ドキュメント（非エンジニア向け）**:
  - 「初めて Forest を使う人向けガイド」（ログイン → ダッシュボード見方 → 編集モーダル）
  - 「月次運用手順」（PDF アップロード → 数値確認 → 確定）
  - 「年次運用手順」（期切り替え）
- ❌ **データモデル仕様**:
  - ER 図 / テーブル定義（`companies` / `fiscal_periods` / `shinkouki` / `forest_users` / `forest_audit_log`）
  - RLS ポリシー一覧（C-5）
  - マイグレーション履歴の索引
- ❌ **API リファレンス**:
  - `/api/forest/parse-pdf`（C-6）
- ❌ **ローカル開発セットアップ**:
  - ルート `README.md` が Next.js デフォルト。Forest 開発手順の追記必要
  - `.env.local` 必須キーの説明
  - `npm run dev` / `npm run build` の実行例
  - Supabase garden-dev との接続確認手順
- ❌ **トラブルシューティング統合**:
  - `scripts/README-shinkouki.md` 内のトラブルシュートと、ブラウザ UI 側のトラブルシュート
    を分離管理しているが、統合索引がほしい
- ❌ **変更履歴（CHANGELOG）**: Phase A1 / A2 / A3 / fix/modal-height の時系列と
  main への反映タイミングを追える場所（`effort-tracking.md` は工数用）

### 既存ドキュメントの更新要否
- 🟡 `scripts/README-shinkouki.md` の Phase ロードマップ表が「A2/A3 未着手」のまま
  → 実際は完了済（PR #7, #8 で main マージ済）。更新すべき
- 🟡 `docs/handoff-20260423.md` に「`.claude/settings.json` untracked」とあるが、
  `bfbf24c` コミットで管理下に入った。最新状態は既に反映済だが念のため確認

---

## E. 優先度マトリクス（提案全体）

| 優先度 | 項目 |
|---|---|
| 🔴 高 | B-1 モーダルフォーカストラップ / B-2 セルキーボード操作 / B-8 モバイル横スクロール視覚ヒント / C-1 Forest README / C-2 認証フロー図 / C-3 zantei運用ルール / C-4 期切り替えガイド |
| 🟡 中 | A-1 インラインスタイル抽出 / A-3 MicroGrid分割 / A-4 rollover RPC化 / B-3 DetailModal aria / B-4 コントラスト / B-10 PdfUploader キーボード / C-5〜C-12 各種ドキュメント |
| 🟢 低 | A-2 Chart.js register / A-5 年度フィルタ / A-6 Context分割 / A-7〜A-11 小リファクタ / B-5〜B-7 / B-9 SummaryCards ブレイクポイント |

---

## F. 次アクション候補（東海林さん向け A案/B案/C案）

本レビューから派生する次作業の選択肢：

- **A案**: **アクセシビリティ強化パッケージ** — B-1/B-2/B-3/B-10 をまとめて 1 PR。
  見積: 0.3d〜0.5d。依存なし。Forest の「社外プレゼン可能な品質」を 1 段上げる
- **B案**: **Forest README + 認証フロー図セット** — C-1/C-2 を docs に整備。
  見積: 0.3d。コード変更なしで完結。後続の継承セッション（b-main 等）の立ち上がりが速くなる
- **C案**: **rolloverPeriod を RPC 化** — A-4。Supabase 側に PL/pgSQL 関数作成 + マイグレーション +
  mutations.ts 書き換え。見積: 0.3d〜0.5d。期切り替えの整合性担保
- **D案**: **インラインスタイル抽出（共通 UI コンポーネント）** — A-1。見積: 0.5d〜1d。
  全体の LoC 削減効果大だが、既存実装の見た目を崩さない配慮が必要
- **E案**: **Forest テスト整備（初期セット）** — `docs/forest-test-ideas-20260423.md` 参照。
  見積: 1d〜2d。v9 レビュー課題 3 の解消

優先度付き推奨は **B案 → A案 → C案** の順（低リスク＆短期で効果大の順）。

---

## G. 観測メモ（今後の参照用）

- Forest の UI は「インラインスタイル + Chart.js + Supabase RLS」という
  シンプルな 3 層構成。Tailwind は導入済だが Forest 内ではほぼ未使用
- 監査ログ（forest_audit_log）は anon の login_failed 挿入のみ許可する RLS が設計済。
  本番のブルートフォース検知に使える可能性あり（ダッシュボード未整備）
- `fix/forest-modal-height-consistent` ブランチの `minHeight: 560` はモーダル仕様のマジックナンバー。
  本レビューでは A-11 として記録したが PR #11 のスコープは維持（触らない）
- v9 時代の「ZIP 一括ダウンロード」「Resumable Upload」「納税カレンダー」機能は
  Next.js 版では未移植の模様（想定内 / 意図的な削減かは要確認）

---

**レポート作成**: Claude（a-forest セッション、自律実行モード）
**レビュー対象コミット**: `bfbf24c` 時点の `fix/forest-modal-height-consistent`
**変更有無**: コード変更なし（docs のみ追加）
