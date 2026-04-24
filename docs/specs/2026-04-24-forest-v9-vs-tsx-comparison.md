# Garden-Forest v9 HTML × TSX 実装 差分マッピング完全版

- 作成: 2026-04-24（a-auto / Phase A 先行 batch1 #P07）
- 作業ブランチ: `feature/phase-a-prep-batch1-20260424-auto`
- 目的: **判1〜判5 が判断済となった前提**での、v9 HTML（2047 行）→ TSX 実装の行対行対応表。実装担当（a-forest）が「何を直せばよいか」を一目で見られる**作業ベース**。
- 前提ドキュメント:
  - `docs/forest-v9-to-tsx-migration-plan.md`（移植計画）
  - `docs/specs/2026-04-24-forest-hankanhi-migration.sql`（P08）
  - `docs/specs/2026-04-24-forest-nouzei-tables-design.md`（P09）

---

## 1. 判断確定の前提

| # | 論点 | 確定案 | 本書での扱い |
|---|---|---|---|
| 判1 | 販管費テーブル正規化 | **A 案：別テーブル `forest_hankanhi`** | §4 で HANKANHI 行を提示 |
| 判2 | 納税スケジュール構造 | **B 案：3 テーブル分割** | §4 で Tax Calendar / Tax Detail Modal 行を提示 |
| 判3 | 決算書 PDF 格納場所 | **B 案：Supabase Storage にミラー** | §4 F5/F6 の実装指針に反映 |
| 判4 | ZIP 生成方式 | **B 案：Edge Function + Storage** | §4 F6 の実装指針に反映 |
| 判5 | Tax Files アップロード主体 | **B 案：社内担当者が代理入力** | §4 F5 の RLS 方針に反映 |

---

## 2. 全体マッピング（Quick Overview）

| v9 機能 | v9 行番号 | 実装状況 | TSX 対応 | 主差分 |
|---|---|---|---|---|
| F1 Login | 945-962, 1113-1197 | ✅ 置換実装 | `login/page.tsx` / `ForestGate.tsx` / `_state/ForestStateContext.tsx` | v9 GAS token → Supabase Auth（Forest で独自拡張） |
| F2 Header | 964-981 | ✅ 実装 | `ForestShell.tsx` | 要実確認：user-bar/ログアウトボタン |
| F3 Summary Cards | 984-992, 1350-1372 | ✅ 実装 | `SummaryCards.tsx` | 一致 |
| F4 Tax Calendar | 994-1001, 1573-1677 | ❌ **未実装** | — | 新規作成必須（§4-F4） |
| F5 Tax Files | 1003-1012, 1682-1757 | ❌ **未実装** | — | Supabase Storage 連携から（§4-F5） |
| F6 Download | 1014-1077, 1786-1944 | ❌ **未実装** | — | Edge Function + Storage（§4-F6） |
| F7 Info Tooltip | 434-478 | ❌ **未実装** | — | 共通 Tooltip 新設（§4-F7） |
| F8 Macro Chart | 1079-1088, 1377-1417 | ✅ 実装 | `MacroChart.tsx` | 一致想定 |
| F9 Micro Grid | 1090-1102, 1422-1568 | ✅ 実装 | `MicroGrid.tsx` | 細部差分未調査（§5） |
| F10 Detail Modal | 2036-2045, 1979-2022 | 🟡 **部分** | `DetailModal.tsx` | **HANKANHI 未実装**、reflected note 未実装 |
| F11 Tax Detail Modal | 2026-2034, 1952-1968 | ❌ **未実装** | — | F4 と同時実装（§4-F11） |

---

## 3. データソース突合表

| v9 定数 | v9 行 | TSX 対応データソース | 移行状況 | 本書での対応 |
|---|---|---|---|---|
| `COMPANIES` | 1202-1268 | `companies` テーブル（Supabase） | ✅ 移行済 | そのまま利用 |
| `SHINKOUKI` | 1273-1280 | `shinkouki` テーブル | ✅ 移行済 | そのまま利用 |
| `NOUZEI` | 1286-1292 | **未移行** | ❌ | → `forest_nouzei_schedules` + items + files（判2 B 案） |
| `HANKANHI` | 1299-1320 | **未移行** | ❌ | → `forest_hankanhi`（判1 A 案） |
| Tax Files 一覧（GAS getTaxFiles） | — | **未移行** | ❌ | → `forest_tax_files` + Supabase Storage `forest-tax/`（判5 B 案） |
| 決算書 `doc` URL | 1207-1260 各行 | `fiscal_periods.doc_url` | ✅ 移行済（Drive URL） | 判3 B 案で Storage へミラー可、当面 Drive URL 継続 |

---

## 4. 機能別 行対行マッピング

### 4.1 F1 Login（v9 L945-962 / JS L1113-1197 → TSX 置換済）

| v9 要素 | v9 行 | TSX 対応 | 差分 |
|---|---|---|---|
| `login-overlay` + `login-card` | 945-962 | `login/page.tsx` 全体 | Supabase Auth + 2段階ゲートに置換 |
| `initAuth()` 関数 | 1113-1145 | `ForestStateContext` `refreshAuth()` | JWT ベースに全面刷新 |
| `doLogin()` | 1147-1183 | `login/page.tsx` の `handleLogin` | `signInWithPassword` |
| `doLogout()` | 1185-1197 | `ForestStateContext` `lockAndLogout('manual')` | 擬似メール不要 |
| `validateSession(token)` | 1135 | Supabase Auth の自動 refresh | — |

**結論**: v9 の GAS 認証はまるごと破棄。TSX 側の実装で充足。**追加作業不要**。

### 4.2 F2 Header（v9 L964-981 → TSX ForestShell）

| v9 要素 | v9 行 | TSX 対応 | 差分 |
|---|---|---|---|
| `gf-header` ブランド | 966-974 | `ForestShell.tsx`（要実確認） | スタイル・色 は Forest 流用想定 |
| `user-greeting` | 977 | `ForestShell.tsx` | Supabase ユーザー名 or `forestUser.name` |
| `logout-btn` | 978 | `ForestShell.tsx` → `lockAndLogout('manual')` | — |
| `update-info` 最終更新日 | 975 | **未実装（推定）** | **要追加**：Supabase 側の `fiscal_periods.updated_at` の最新値を表示 |

**作業項目**:
- T-F2-01: `ForestShell.tsx` で最終更新日時を表示（ソース: `max(fiscal_periods.updated_at)` + `shinkouki.updated_at`）— 0.25d

### 4.3 F3 Summary Cards（v9 L984-992, L1350-1372 → TSX SummaryCards）

| v9 `renderSummary()` | TSX `SummaryCards.tsx` | 差分 |
|---|---|---|
| 5 カード生成（総売上/経常利益/純資産/現預金/法人数） | 同等 | 一致（想定） |
| 「壱を除く 5 社」注記 | — | 要確認：同等の注記が付いているか |

**作業項目**:
- T-F3-01: 実装実読で注記文言を v9 と一致させる（要実確認）— 0.1d

### 4.4 F4 Tax Calendar（v9 L994-1001, L1573-1677 → TSX 未実装）

| v9 要素 | v9 行 | 新規 TSX ファイル | 内容 |
|---|---|---|---|
| `#taxCalendar` コンテナ | 1000 | `_components/TaxCalendar.tsx` | ローリング 12 ヶ月グリッド |
| `tax-grid` / `tax-year-label` / `tax-header` | CSS 231-338 | `_components/TaxCalendar.tsx` + `_constants/theme.ts` | Tailwind or 既存スタイル流用 |
| `tax-pill`（kakutei/yotei/paid） | CSS 290-321 | `_components/TaxPill.tsx` | 3 種 variant |
| `renderTaxCalendar()` 関数 | 1573-1677 | `_lib/tax-calendar.ts` | 12 ヶ月計算ロジック、current-month ハイライト |
| 年ラベル（`tax-year-label`）| 1608-1612 | 同上 | 年境界の視覚的分離 |

**データソース**: `forest_nouzei_schedules`（§P09 設計書準拠）

**作業項目**:
- T-F4-01: `forest_nouzei_schedules` + `forest_nouzei_items` テーブル投入（§P09 SQL 実行）— 0.25d
- T-F4-02: `TaxCalendar.tsx` 新規実装（ローリング 12 ヶ月、年グループ化、pill 描画）— 1.0d
- T-F4-03: pill クリック → F11 Tax Detail Modal 起動 — 0.25d
- T-F4-04: dashboard/page.tsx に `<TaxCalendar>` を追加 — 0.1d

### 4.5 F5 Tax Files（v9 L1003-1012, L1682-1757 → TSX 未実装）

| v9 要素 | v9 行 | 新規 TSX | 実装指針 |
|---|---|---|---|
| `#taxFilesList` コンテナ | 1009 | `_components/TaxFilesList.tsx` | 法人ごと collapsible |
| `loadTaxFiles()` GAS 呼出 | 1682-1702 | `_lib/tax-files-queries.ts` | `forest_tax_files` + Storage signedURL |
| 法人ごとグループ化 | 1706-1755 | `_components/TaxFilesGroup.tsx` | アコーディオン |
| PDF/xlsx/other アイコン | 1728-1729 | `_components/TaxFileIcon.tsx` | 拡張子判定 |
| `tax-file-status`（暫定/確定） | 1731-1735 | Badge コンポーネント | 色分け |
| `TAX_COMPANY_ORDER` | 1704 | `_constants/companies.ts` に定数追加 | 固定順序 |

**データソース**: 新規テーブル `forest_tax_files` + Supabase Storage bucket `forest-tax/`

**判5（B 案：社内代理入力）反映**:
- RLS：`forest_is_user()` で SELECT、`forest_is_admin()` で INSERT/UPDATE/DELETE
- 税理士直接書込は無し

**作業項目**:
- T-F5-01: `forest_tax_files` テーブル定義 + Storage bucket `forest-tax/` 作成（private）+ RLS — 0.5d
- T-F5-02: `TaxFilesList` / `TaxFilesGroup` / `TaxFileIcon` 実装 — 0.75d
- T-F5-03: 管理者向けアップロード UI（管理者のみ）— 0.5d
- T-F5-04: dashboard/page.tsx に `<TaxFilesList>` を追加 — 0.1d

### 4.6 F6 Download Section（v9 L1014-1077, L1786-1944 → TSX 未実装）

| v9 要素 | v9 行 | 新規 TSX | 実装指針 |
|---|---|---|---|
| 法人チェックボックス | 1044-1053 | `_components/DownloadCompanySelector.tsx` | 6 法人 + 全社 |
| 期数ラジオ（1/2/3） | 1055-1061 | `_components/DownloadKiRadio.tsx` | — |
| `downloadDocs()` メイン | 1786-1944 | `/api/forest/download-zip/route.ts`（Edge Function） | 判4 B 案：Storage から ZIP 生成 |
| Progress bar | 403-432, 1887-1894 | `_components/DownloadProgress.tsx` | ポーリング or SSE |
| 単一／複数法人でファイル名分岐 | 1870-1881 | Server 側で生成 | 同ロジック |
| ローカルモードフォールバック | 1929-1943 | **廃止**（Supabase Auth 前提のため） | — |
| Info Tooltip | 1019-1040 | `_components/InfoTooltip.tsx` | F7 と共通化 |

**判3 B 案（PDF を Storage にミラー）反映**:
- `fiscal_periods.doc_url` は当面 Drive URL のまま
- **移行期**：Drive URL → PDF fetch → Storage キャッシュ、2 回目以降は Storage 直読み
- **完了期**：全 PDF を Storage へ移し替え、Drive URL を廃止

**判4 B 案（Edge Function + Storage）反映**:
- `/api/forest/download-zip/route.ts` が Edge Function（Node ランタイム）で実行
- Storage から PDF fetch → JSZip で ZIP 化 → Storage `forest-downloads/` にアップロード → signedURL を返却

**作業項目**:
- T-F6-01: Storage bucket `forest-docs/`（PDF 本体）+ `forest-downloads/`（ZIP 一時格納）作成 — 0.25d
- T-F6-02: 既存 Drive PDF を Storage へミラーするバッチ（1 回実行）— 0.5d
- T-F6-03: `/api/forest/download-zip/route.ts` 実装（JSZip + signedURL 返却）— 1.5d
- T-F6-04: Download Section UI（セレクタ・ラジオ・progress）— 0.5d
- T-F6-05: dashboard/page.tsx に `<DownloadSection>` を追加 — 0.1d

### 4.7 F7 Info Tooltip（v9 CSS L434-478 → TSX 未実装）

| v9 要素 | v9 行 | 新規 TSX | 実装指針 |
|---|---|---|---|
| `.info-wrap` + `.info-icon` | 434-456 | `_components/InfoTooltip.tsx` | ホバーで展開 |
| `.info-tooltip` コンテンツ | 457-477 | Props: `title, items` | Tailwind |

**作業項目**:
- T-F7-01: 共通 `InfoTooltip` 実装（role="tooltip", focus/hover 両対応, a11y）— 0.25d

### 4.8 F8 Macro Chart（v9 L1079-1088, L1377-1417 → TSX MacroChart）

| v9 要素 | TSX | 差分 |
|---|---|---|
| `renderMacroChart()` Chart.js | `MacroChart.tsx` | 一致想定（要実確認） |
| `stacked line` + tooltip footer（合計） | 同上 | 一致想定 |
| `legend: { position: 'bottom', usePointStyle: true }` | 同上 | 一致想定 |

**作業項目**:
- T-F8-01: 実装実読で v9 の細部（tension 0.35、fill true、年度ラベル）と一致確認 — 0.1d（auto 可）

### 4.9 F9 Micro Grid（v9 L1090-1102, L1422-1568 → TSX MicroGrid）

| v9 要素 | v9 行 | TSX | 要確認差分 |
|---|---|---|---|
| sticky col-company | CSS 508-527 | `MicroGrid.tsx` | 位置固定の CSS が揃っているか |
| `scroll-sync-top` + `scrollBottom` の同期 | 1553-1563 | **要実確認** | 双方向スクロール同期があるか |
| `group-summary-table`（別 table） | 1099, 1434-1457 | 要確認 | グループ計行がある程度別レイアウトで存在するか |
| data-cell 進行期 glow | CSS 759-801 | 実装済 | `shinkouki` animation の細部 |
| mini-bars 高さ計算（`sqrt` スケール）| 1503-1505 | 要確認 | 現行実装のスケーリング方式 |
| ki-badge link（Drive URL） | 1507 | 実装済 | クリック伝播停止（`event.stopPropagation()`）の有無 |
| period-range 表示（`from~to + reflected`）| 1525 | 要確認 | 進行期の `reflected` 注記が表示されるか |

**作業項目**:
- T-F9-01: MicroGrid.tsx の実装実読で上記 7 点を検証、差分があれば修正 — 0.75d（auto 可：差分抽出のみ）

### 4.10 F10 Detail Modal（v9 L2036-2045, L1979-2022 → TSX DetailModal 部分実装）

| v9 要素 | v9 行 | TSX | 差分 |
|---|---|---|---|
| 主要 6 項目（売上/外注/経常利益/純資産/現金/預金） | 1984-1994 | 実装済 | 一致 |
| **HANKANHI 販管費内訳 8 項目** | 1996-2012 | **未実装** 🔴 | § P08 SQL + DetailModal 拡張で実装 |
| 進行期タグ | 1982 | 実装済 | 一致 |
| reflected note（`※2026/3まで反映中`） | 1982 | **未実装** 🟡 | 追加必要 |
| `.modal-doc` 決算書リンク | 2014-2020 | 実装済 | 一致（ただし `writeAuditLog` は TSX 側の方が強化済） |

**データソース追加**: `forest_hankanhi`（§ P08）

**作業項目**:
- T-F10-01: `forest_hankanhi` 投入（§ P08 SQL 実行）— 0.1d
- T-F10-02: `_lib/queries.ts` に `fetchHankanhi(companyId, ki)` 追加 — 0.25d
- T-F10-03: DetailModal.tsx に販管費セクション追加（`mg-section-label` + 8 項目）— 0.5d
- T-F10-04: reflected note 表示追加（進行期のみ）— 0.1d

### 4.11 F11 Tax Detail Modal（v9 L2026-2034, L1952-1968 → TSX 未実装）

| v9 要素 | v9 行 | 新規 TSX | 実装指針 |
|---|---|---|---|
| `.modal-overlay#taxDetailModal` | 2027-2034 | `_components/TaxDetailModal.tsx` | 基本ダイアログ |
| `tax-modal-title` / sub / grid | 1955-1966 | 同上 | 法人色ドット + 種別 + 済/未納 |
| 税目内訳表示 + 合計 | 1958-1966 | 同上 | § P09 `forest_nouzei_items` を `(label, amount)` で描画 |

**データソース**: `forest_nouzei_schedules` + `forest_nouzei_items`

**作業項目**:
- T-F11-01: `TaxDetailModal.tsx` 実装 — 0.5d
- T-F11-02: F4 Tax Calendar の pill クリックから起動する接続 — 0.1d

---

## 5. 判断カラム・各機能紐付け

| 機能 | 判1 販管費 | 判2 納税 | 判3 PDF | 判4 ZIP | 判5 Tax Files |
|---|---|---|---|---|---|
| F4 Tax Calendar | — | ✅ 直接依存 | — | — | — |
| F5 Tax Files | — | — | △ 間接（Storage 同居）| — | ✅ 直接依存 |
| F6 Download | — | — | ✅ 直接依存 | ✅ 直接依存 | — |
| F10 Detail Modal | ✅ 直接依存 | — | — | — | — |
| F11 Tax Detail Modal | — | ✅ 直接依存 | — | — | — |

---

## 6. 実装順序（推奨）

| 順 | フェーズ | タスク群 | 累積 | 理由 |
|---|---|---|---|---|
| 1 | P08 実装 | T-F10-01〜04 | 0.95d | 低難度・高インパクト、他に依存なし |
| 2 | F2/F3 補完 | T-F2-01, T-F3-01 | +0.35d | 細かい見栄え改善、他と独立 |
| 3 | P09 実装 | T-F4-01〜04, T-F11-01〜02 | +2.2d | F4/F11 を同時に片付け |
| 4 | F7 | T-F7-01 | +0.25d | F6 の Info Tooltip で使うため先行 |
| 5 | F5（Tax Files 閲覧） | T-F5-01〜04 | +1.85d | Supabase Storage 初の活用 |
| 6 | F5（アップロード UI） | — | +0.5d | 管理者フロー |
| 7 | F6（Download 基本 + ZIP） | T-F6-01〜05 | +2.85d | 最大ボリューム |
| 8 | F9 差分調査 | T-F9-01 | +0.75d | auto 可、並列実施 |
| 9 | F8 差分確認 | T-F8-01 | +0.1d | auto 可 |

**合計見積**: 約 **9.8d**（移植計画の「フル 9.25〜10.25d」と整合）

---

## 7. テスト観点（§16 7 種テスト適用）

各機能の実装完了時に以下を確認：

| 機能 | 機能網羅 | エッジケース | 権限 | データ境界 | パフォーマンス | Console | a11y |
|---|---|---|---|---|---|---|---|
| F10 Detail Modal | ◯ | HANKANHI 全 null | admin/user 別表示 | 負数・0 | 1s 以内 | 警告なし | role="dialog" |
| F4 Tax Calendar | ◯ | 年跨ぎ | forest_user のみ | 12ヶ月境界 | 2s 以内 | 警告なし | table caption |
| F5 Tax Files | ◯ | 0 件時 | admin 書込可 | 巨大ファイル | DL 時間 | 警告なし | link 代替テキスト |
| F6 Download | ◯ | 3 期 × 6 社 | admin のみ DL 可？ | 同名ファイル | 進捗表示 | エラーなし | a11y role |

---

## 8. 付録

### 8.1 v9 HTML 未参照の CSS（将来移植時の参考）

| CSS ブロック | v9 行 | 対応 TSX | 扱い |
|---|---|---|---|
| `.login-overlay.hidden` | 49-52 | `login/page.tsx` で `Suspense` により代替 | 移植不要 |
| `.scroll-hint` | 809-810 | MicroGrid 内で表示される文言「横スクロールで成長の軌跡を追体験」 | 要確認 |
| `@media (max-width: 768px)` | 931-940 | Tailwind の `md:` / `sm:` で置換 | F4 実装時に対応 |

### 8.2 本書でカバーしない範囲
- 管理者機能（`ShinkoukiEditModal` / `PdfUploader` / `NumberUpdateForm` / `PeriodRolloverForm`）は v9 にないため対比対象外
- `scripts/update_shinkouki_v3.py` との整合性（PDF バッチ）は別途管理
- 認証基盤（F1）はすでに v9 を超える実装のため、行対行の逆移植は不要

### 8.3 判断保留
| # | 論点 | スタンス |
|---|---|---|
| 判1 | F9 MicroGrid の細部差分（特に scroll-sync） | T-F9-01 で精査後、必要なら別 spec 起草 |
| 判2 | F5 のアップロード UI を Phase A 内に含めるか | Phase A 末に組み込み可、優先度 🟡 |
| 判3 | F6 の ZIP 生成ランタイム（Node / Edge） | Node 推奨（日本語ファイル名・大容量ZIP のため） |

— end of v9 vs tsx comparison v1 —
