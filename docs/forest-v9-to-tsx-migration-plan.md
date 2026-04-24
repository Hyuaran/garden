# Garden Forest: v9 HTML → TSX 実装 移植計画

- 作成: 2026-04-24 10:34 発動 / a-auto 自律実行モード（集中別作業中・45分枠）
- 作業ブランチ: `feature/forest-v9-migration-plan-auto`（`main` から派生、コード変更ゼロ）
- 対象ソース:
  - v9 HTML: `G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/08_Garden-Forest/garden-forest_v9.html`（2047行）
  - TSX 実装: `C:/garden/a-auto/src/app/forest/`
- 目的: v9 HTML の全機能と現行 TSX 実装を突き合わせ、未移植機能を Phase 分割＋工数見積り＋優先度付きで可視化する **判断用ドキュメント**。実装判断は a-forest セッションで行う。

---

## 1. v9 HTML 機能リスト（全セクション）

v9 の HTML はシングルページで 11 機能ブロックから成る。行番号は `garden-forest_v9.html` 準拠。

| # | セクション | v9 行番号 | 概要 |
|---|---|---|---|
| F1 | Login Overlay | L945-962 / L1113-1197 | `gf_token` localStorage / GAS `authenticate` / `validateSession` / ローカルモードフォールバック |
| F2 | Header (brand / subtitle / update-info / user-bar) | L964-981 | ブランディング、ログインユーザー挨拶、ログアウトボタン |
| F3 | Summary Cards（グループサマリー） | L984-992 / L1350-1372 | 総売上高・経常利益・純資産・現預金・法人数の5カード（最新確定期合算） |
| F4 | Tax Calendar（納税カレンダー） | L994-1001 / L1573-1677 | ローリング12ヶ月（前5+当月+後6） × 6法人、確定/予定/extra pill、クリックで tax-detail modal |
| F5 | Tax Files（税理士連携データ） | L1003-1012 / L1682-1757 | GAS `getTaxFiles` 経由、法人ごと collapsible、暫定/確定バッジ、PDF/xlsx/other アイコン、Drive preview URL |
| F6 | Download Section（決算書ダウンロード） | L1014-1077 / L1786-1944 | 法人チェック×期数ラジオ→ GAS `createZipDownload` で ZIP生成 or Drive フォルダ、進捗バー + 経過秒カウント、ローカルモード時はリンク一覧フォールバック、info tooltip |
| F7 | Info Tooltip（i アイコン） | L434-478 + 各所 | 使い方説明のホバー展開。主に F6 内 |
| F8 | Macro Chart（合算利益推移） | L1079-1088 / L1377-1417 | Chart.js 積層折れ線（2016-2024×6法人の利益、合計 tooltip） |
| F9 | Micro Grid（6法人決算ワンビュー） | L1090-1102 / L1422-1568 | sticky company 列 + scroll-sync top/bottom + group-summary-table + 年度列 × 法人行、data-cell（売上/外注/利益 + mini-bars + ki-badge doc link + 進行期 glow + zantei スタイル） |
| F10 | Detail Modal（セル詳細） | L2036-2045 / L1979-2022 | 主要財務 6 項目 + **販管費内訳 8 項目（HANKANHI）** + 進行期タグ + reflected note + 決算書リンク |
| F11 | Tax Detail Modal（納税詳細） | L2026-2034 / L1952-1968 | 確定/予定/extra の内訳（法人税等・消費税等）＋合計 |
| (F12) | Footer | L1105 | 静的テキストのみ |

### v9 が持つ内蔵データ（TSX 移植時は Supabase / Storage へ移す必要）

| データ名 | 内容 | v9 行番号 | TSX 移植状況 |
|---|---|---|---|
| `COMPANIES` | 6法人 × 各期の uriage/gaichuhi/rieki/junshisan/genkin/yokin/doc URL | L1202-1268 | `companies` + `fiscal_periods` テーブルに移行済 |
| `SHINKOUKI` | 進行期（速報値、zantei/reflected） | L1273-1280 | `shinkouki` テーブルに移行済 |
| `NOUZEI` | 法人×納税スケジュール（kakutei/yotei/extra、税目内訳） | L1286-1292 | **未移行** |
| `HANKANHI` | 法人×期×販管費8項目 | L1299-1320 | **未移行** |
| 税理士ファイル一覧 | GAS `getTaxFiles` 経由の動的取得 | — | **未移行**（要 Supabase Storage） |

---

## 2. TSX 実装の現状機能リスト

`src/app/forest/` 配下の全コンポーネント・関数を棚卸しし、機能ブロックに対応付け。

### 2.1 認証・状態管理（基盤）
| ファイル | 役割 |
|---|---|
| `layout.tsx` / `login/page.tsx` | ログイン画面・レイアウト |
| `_components/ForestGate.tsx` | パスワードゲート（Forest 固有の再入力ロック、2h 有効） |
| `_components/ForestShell.tsx` | ヘッダー・メインラッパ |
| `_components/AccessDenied.tsx` | `hasPermission=false` 時の拒否画面 |
| `_state/ForestStateContext.tsx` | Garden Auth + forest_users + isUnlocked + 2h timer + データキャッシュ |
| `_lib/auth.ts` / `supabase.ts` / `session-timer.ts` | 認証ユーティリティ |
| `_lib/permissions.ts` | `isForestAdmin(forestUser)` 判定 |
| `_lib/audit.ts` | 監査ログ（view_dashboard, click_drive_link, logout_manual/timeout） |

### 2.2 ダッシュボード機能
| v9 機能 | 対応 TSX | 実装状態 | 差分 |
|---|---|---|---|
| F1 Login Overlay | `login/page.tsx` + `ForestGate` | ✅ 実装済 | Supabase Auth + 2段階ゲートへ置換（v9 より堅牢） |
| F2 Header | `ForestShell` | ✅ 実装済 | 設計は踏襲している想定（要実確認） |
| F3 Summary Cards | `SummaryCards.tsx` | ✅ 実装済 | v9 と同等（5カード） |
| F4 Tax Calendar | — | ❌ **未実装** | コンポーネント存在せず |
| F5 Tax Files | — | ❌ **未実装** | Supabase Storage 連携が前提 |
| F6 Download Section | — | ❌ **未実装** | GAS 依存機能。代替実装の設計必要 |
| F7 Info Tooltip | — | ❌ **未実装** | F6 に付随、軽微 |
| F8 Macro Chart | `MacroChart.tsx` | ✅ 実装済 | Chart.js 利用、v9 と同等 |
| F9 Micro Grid | `MicroGrid.tsx` | ✅ 実装済 | sticky + data-cell + 進行期 glow（v9 準拠） |
| F10 Detail Modal | `DetailModal.tsx` | 🟡 **部分実装** | 主要6項目のみ、**HANKANHI 販管費内訳が未実装** |
| F11 Tax Detail Modal | — | ❌ **未実装** | F4 が実装されないと登場しない |

### 2.3 管理者機能（v9 に無い TSX 拡張）
v9 には無く、TSX では管理者向けに新設されている機能群：
| ファイル | 役割 |
|---|---|
| `ShinkoukiEditModal.tsx` | 進行期の編集モーダル（admin のみ） |
| `PdfUploader.tsx` | PDF ドロップゾーン → `/api/forest/parse-pdf` へ multipart POST |
| `NumberUpdateForm.tsx` | 進行期の数値直接編集 |
| `PeriodRolloverForm.tsx` | 期更新（確定→新進行期） |
| `_lib/mutations.ts` | 更新系クエリ |
| `_lib/types.ts` | `ParsePdfResult` / `ShinkoukiUpdateInput` / `PeriodRolloverInput` |

これらは **v9 からの後方互換 ではなく、TSX で初めて追加された経営管理機能**。v9 移植論議とは別軸で、現行機能として維持・拡張される。

---

## 3. 未移植機能の詳細

### 3.1 Tax Calendar（F4）
**機能要件**
- ローリング 12 ヶ月表示（前 5 ヶ月 + 当月 + 後 6 ヶ月）
- 6 法人 × 12 ヶ月のグリッド、月ヘッダー、年ラベル、当月ハイライト
- 各セルに確定納税 pill / 予定納税 pill / 追加納税 pill（extra）を重ね表示
- pill クリックで Tax Detail Modal（F11）を開く
- 過去月は自動的に `paid` スタイル（薄緑）

**データモデル要否**
- **新規テーブル必要**。案: `forest_tax_schedule`
  ```
  id, company_id, year, month,
  type ('kakutei'|'yotei'|'extra'),
  label (e.g. '確定', '予定'),
  amount (nullable),
  status ('未納'|'納付済'),
  details jsonb  -- [{label:'法人税等', amount:N}, ...]
  ```
- 代替: `forest_tax_kakutei` / `forest_tax_yotei` / `forest_tax_extra` の3テーブル分割（v9 の JSON 構造に忠実）

**Supabase Storage 連携要否**: なし（数値データのみ）

**実装難度**: 🟡 中（UI はスクラッチだが既知パターン。データ投入フローの業務定義が必要）

### 3.2 Tax Files（F5）
**機能要件**
- 法人ごとに collapsible セクション（データ無しは `（データなし）`）
- 各ファイルに PDF/xlsx/other アイコン・暫定/確定バッジ・連携日・備考
- クリックで preview URL に遷移（v9 では Drive preview、TSX では Supabase Storage public URL 想定）

**データモデル要否**
- **新規テーブル必要**。案: `forest_tax_files`
  ```
  id, company_id, doc_name, file_name (original), status ('暫定'|'確定'),
  uploaded_at, note, storage_path, created_by
  ```
- ファイル本体は **Supabase Storage bucket `forest-tax-files/` に格納**

**Supabase Storage 連携要否**: ✅ **必須**
- bucket 作成 + RLS（forest_users のみ read 可）
- アップロード UI は管理者側機能として別途設計

**実装難度**: 🟡〜🔴 中〜高（Storage バケット設計 + RLS + アップロード UI まで含めると高）

### 3.3 Download Section（F6）
**機能要件**
- 法人複数選択 + 直近 1/2/3 期選択
- ボタン押下で ZIP 生成 →進捗バー + 経過秒表示 → 完了リンク
- 多法人時: `ヒュアラングループ_直近3期決算書_YYYYMMDD時点.zip`
- 単一法人時: `ヒュアラン_直近3期決算書_第7期-第9期_YYYYMMDD時点.zip`
- ZIP 内フォルダ構造: `01_ヒュアラン_第7期-第9期/xxx.pdf` 形式で連番ソート
- ローカルモード時はリンク一覧フォールバック（ZIP生成なし）
- info tooltip で使い方説明

**データモデル要否**
- `fiscal_periods.doc_url` は既存。追加データは不要だが、**`doc_url` が Drive URL から Supabase Storage パスに変わるか否かの設計判断が必要**
- 補助テーブルは不要

**Supabase Storage 連携要否**: 設計判断次第
- 案 A: 現状の Drive URL のまま → Edge Function から Drive API で取得して ZIP 化（API 認証必要）
- 案 B: PDF 本体を Supabase Storage にミラーリング → Edge Function で Storage 直読み ZIP 化
- 案 C: クライアント側で JSZip、各 Drive URL を `fetch` → ZIP（CORS 要注意）

**実装難度**: 🔴 高（サーバサイド ZIP 生成 + 進捗通知 + 複数ファイルの認証付き DL）

### 3.4 Tax Detail Modal（F11）
**機能要件**
- Tax pill クリックで起動
- ヘッダー: 法人名 + 納税種別（確定/予定/extra）+ 済/未納バッジ
- サブ: `YYYY年M月末 期限`
- 内訳テーブル（例: 法人税等 ¥X / 消費税等 ¥Y）+ 合計

**データモデル要否**: F4 の `details jsonb` をそのまま描画すれば充足。専用テーブル不要。

**Supabase Storage 連携要否**: なし

**実装難度**: 🟢 低（F4 のデータ構造決定後は定型モーダル）

### 3.5 販管費内訳（HANKANHI）— Detail Modal 拡張（F10 差分）
**機能要件**
- Detail Modal 内で基本6項目の下に**販管費内訳セクション**を追加
- 項目: 役員報酬 / 給与手当 / 接待交際費 / 会議費 / 旅費交通費 / 販売促進費 / 地代家賃 / 支払報酬料
- いずれかが非 null の期のみセクション表示

**データモデル要否**
- **新規テーブル必要**。案: `forest_hankanhi`
  ```
  company_id + ki (PK),
  yakuin, kyuyo, settai, kaigi, ryohi, hanbai, chidai, shiharai (すべて nullable)
  ```
- または `fiscal_periods` に 8 カラムを追加する設計（正規化の判断）

**Supabase Storage 連携要否**: なし

**実装難度**: 🟢 低（DetailModal に 1 セクション追加、データ注入経路のみ新規）

### 3.6 Info Tooltip（F7）
**機能要件**
- 「i」アイコンにホバーで使い方パネル展開
- 主に F6 内で使用

**実装難度**: 🟢 低（共通 Tooltip コンポーネント化で他画面にも流用可）

### 3.7 Header / Footer（F2 / F12）
現状 `ForestShell.tsx` に実装されている想定。要実確認。**本計画では調査項目に留める**。

---

## 4. Phase 別工数見積（0.5d 刻み）

作業単位は **a-forest セッションが集中して 1 日（約 8h）で進められる想定** で、0.5d=半日＝約 4h。

| Phase | スコープ | タスク | 見積 | 依存 |
|---|---|---|---|---|
| **P0** | 設計判断 | F6 Download の Drive 方式（案A/B/C）を確定。Supabase Storage 設計方針・bucket 命名・RLS ポリシー素案 | 0.5d | — |
| **P1** | F10+HANKANHI | `forest_hankanhi` テーブル設計＋投入 SQL＋DetailModal に販管費セクション追加＋テスト | 1.0d | — |
| **P2** | F4+F11 Tax Calendar/Detail | `forest_tax_schedule` テーブル設計＋SQL 初期投入＋TaxCalendar コンポーネント＋TaxDetailModal | 2.0d | — |
| **P3** | F5 Tax Files (read only) | Supabase Storage bucket 作成＋RLS＋`forest_tax_files` テーブル＋TaxFilesSection コンポーネント（閲覧・ダウンロードのみ） | 1.5d | P0 |
| **P3.5** | F5 Tax Files（アップロード UI） | 管理者向けアップロードフォーム＋メタデータ登録＋暫定/確定切替 | 1.0d | P3 |
| **P4** | F6 Download (基本) | 法人選択 UI + 期数選択 + Drive URL 直リンク版（ZIP 未実装）。ローカルモード相当 | 0.5d | — |
| **P4.5** | F6 Download (ZIP) | Edge Function で ZIP 生成 + 進捗バー + エラー処理。選定案（A/B/C）に依存 | 2.0〜3.0d | P0, P4 |
| **P5** | F7 Info Tooltip | 共通 Tooltip コンポーネント化 | 0.25d | — |
| **P6** | F2/F12 確認 | 現状 ForestShell が v9 と同等かレビュー、差分があれば修正 | 0.5d | — |

**総合計見積**:
- 最小構成（P0+P1+P2+P4+P5+P6）: **4.75d**
- フル構成（P0〜P6 全部）: **9.25〜10.25d**

---

## 5. 優先度マトリクス（業務影響度 × 実装難度）

| Phase | 業務影響度 | 実装難度 | 優先度 | 根拠 |
|---|---|---|---|---|
| P1 販管費内訳 | 高 | 低 🟢 | 🔴 **最優先** | 経営会議で販管費の期比較は頻出。低難度で高インパクト |
| P2 Tax Calendar | 高 | 中 🟡 | 🔴 **最優先** | 納税スケジュールは月次経営判断の主要インプット。v9 で常用されている |
| P0 設計判断 | — | 低 | 🔴 **必須前置** | P3/P4.5 を動かすには判断が必要 |
| P6 Header/Footer 確認 | 低 | 低 | 🟡 | 既に ForestShell で実装済の可能性。差分確認のみ |
| P5 Info Tooltip | 低 | 低 | 🟡 | 軽微、他Phaseと同梱可 |
| P4 Download（基本） | 中 | 低 | 🟡 | ZIP 未対応でもリンク一覧で業務は回る |
| P3 Tax Files（閲覧） | 中 | 中〜高 | 🟡 | 税理士連携の可視化が価値。Storage 設計が初物で学習コスト |
| P3.5 Tax Files（アップロード） | 中 | 中 | 🟢 | 既存の税理士 Drive 連携を併用するなら優先度下がる |
| P4.5 Download（ZIP） | 中 | 高 🔴 | 🟢 | 業務上は Drive 直リンクで代替可。ZIP 化はUX向上だが難度高 |

---

## 6. 依存関係（Phase 実行順序）

```
P0（設計判断）
 ├─ P3（Tax Files 閲覧） → P3.5（Tax Files アップロード）
 └─ P4.5（Download ZIP）

独立：
P1（販管費内訳）    ← P0 不要、最速で着手可能
P2（Tax Calendar）  ← P0 不要、独立実装可能
P4（Download 基本） ← P0 不要、Drive 直リンクなら即着手可
P5（Info Tooltip） ← 独立
P6（Header/Footer確認） ← 独立

P11（Tax Detail Modal）は P2 と同じPhaseで実装するため Phase 依存図では P2 に内包
```

### 推奨投下順序（最大インパクト優先）
1. **P0**（0.5d）: 半日で設計判断を詰める
2. **P1**（1.0d）: 販管費内訳追加。最速で経営会議価値を出す
3. **P2**（2.0d）: 納税カレンダー。最大の未移植機能を片付ける
4. **P4**（0.5d）: DL 基本版で v9 相当の業務フロー完成
5. **P5 + P6**（0.75d）: 仕上げの軽微改善
6. ここまでで **4.75d** → v9 相当の機能カバレッジ達成
7. **P3 → P3.5**（2.5d）: Storage 導入
8. **P4.5**（2.0〜3.0d）: ZIP 生成、UX 向上最終段

---

## 7. 設計判断事項（ユーザー承認が必要な論点）

| # | 判断事項 | 選択肢 | a-auto 推定スタンス |
|---|---|---|---|
| 判1 | 販管費テーブルの正規化 | A: `forest_hankanhi` 別テーブル / B: `fiscal_periods` に 8 列追加 | A（将来項目追加を想定） |
| 判2 | 納税スケジュールの構造 | A: `forest_tax_schedule` 単テーブル + `details jsonb` / B: 3テーブル（kakutei/yotei/extra）分割 | A（v9 と同じ柔軟性を維持） |
| 判3 | 決算書 PDF の格納場所 | A: Drive のまま / B: Supabase Storage にミラー / C: 完全移行 | B（Storage ミラーで移行の選択肢を残す） |
| 判4 | F6 ZIP 生成の実装方式 | A: Edge Function + Drive API / B: Edge Function + Storage / C: クライアント JSZip | B（判3 と整合） |
| 判5 | Tax Files のアップロード主体 | A: 税理士から直接（招待リンク） / B: 社内担当者が代理入力 | B（セキュリティ確保、RLS 単純化） |

これらは **a-forest セッションで東海林さんと合意後、正式に docs/superpowers/specs/ 配下で仕様化** することを推奨。

---

## 8. 付録

### 8.1 参考ファイル
- [v9 HTML](file:///G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/08_Garden-Forest/garden-forest_v9.html)
- [dashboard/page.tsx](C:/garden/a-auto/src/app/forest/dashboard/page.tsx)
- [DetailModal.tsx](C:/garden/a-auto/src/app/forest/_components/DetailModal.tsx)
- [ForestStateContext.tsx](C:/garden/a-auto/src/app/forest/_state/ForestStateContext.tsx)
- [queries.ts](C:/garden/a-auto/src/app/forest/_lib/queries.ts)
- [types.ts](C:/garden/a-auto/src/app/forest/_lib/types.ts)

### 8.2 本計画の限界・未調査項目
- `ForestShell.tsx` / `MicroGrid.tsx` / `SummaryCards.tsx` / `MacroChart.tsx` / `NumberUpdateForm.tsx` / `PeriodRolloverForm.tsx` は未読。**スタイル/動作の細部差分（例: scroll-sync の同期方向、mini-bar 高さ計算の sqrt スケーリング等）は今回スコープ外**
- 管理者機能（PdfUploader / ShinkoukiEditModal）の業務フローは v9 にないため対応付け対象外
- v9 の `update_shinkouki_v3.py` との整合性（別途のデータ投入バッチ）は本計画では取り扱わない
- **Shinkouki Phase A1-A3 は別途 `docs/superpowers/plans/` 配下で管理中**（本計画とは別軸）

— end of migration plan —
