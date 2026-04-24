# T-F-ui-link: UI 連携統合 実装指示書（F4/F6/F10/F11 接続 5 サブタスク）

- 対象: Garden-Forest Phase A 完全移植の**仕上げ**として、個別実装済コンポーネントを dashboard に接続する 5 作業を統合
- 見積: **0.5d**（約 4 時間、5 サブタスク総計）
- 担当セッション: a-forest
- 作成: 2026-04-24（a-auto / Phase A 先行 batch4 #T-F-ui-link）
- 元資料: T-F4-02 / T-F11-01 / T-F6-04 / T-F10-03 / T-F5-02（Batch 2 / 3 で個別実装済）, P07 v9 vs TSX 対比

---

## 1. スコープ

### 作る（5 サブタスク）

本 spec は 5 つのサブタスクを**1 ファイルにまとめ、a-forest が順次実施**できる形で整理：

| サブ | 内容 | 工数 |
|---|---|---|
| **ST-F4-03** | TaxCalendar の pill クリック → TaxDetailModal 起動接続 | 0.1d |
| **ST-F4-04** | dashboard/page.tsx に `<TaxCalendar>` セクションを追加 | 0.05d |
| **ST-F6-05** | dashboard/page.tsx に `<DownloadSection>` セクションを追加 | 0.05d |
| **ST-F10-04** | `CellData` に reflected 渡す or 既存確認 + DetailModal で表示 | 0.1d |
| **ST-F11-02** | TaxDetailModal を dashboard にマウント + selectedScheduleId state | 0.2d |

### 作らない
- 各コンポーネント本体の実装（Batch 2/3 で完了済）
- 新規テーブル作成 / UI コンポーネント（接続のみ）
- 動作確認用のデータ投入（P09 / P08 migration で実施済前提）

---

## 2. 前提

| 依存 | 内容 |
|---|---|
| **Batch 2 完了** | T-F4-02（TaxCalendar）/ T-F11-01（TaxDetailModal）/ T-F6-03（Download ZIP API）/ T-F7-01（InfoTooltip）/ T-F10-03（DetailModal HANKANHI） |
| **Batch 3 完了** | T-F6-01 / T-F5-01 / T-F6-02 / T-F5-02 / T-F5-03 / T-F6-04 |
| P08/P09 migration 投入済 | `forest_hankanhi` + `forest_nouzei_*` テーブル + サンプルデータ |
| T-F10-02（本 Batch）| `fetchHankanhi()` 関数、DetailModal 側は T-F10-03 で利用 |

---

## 3. ファイル構成

### 変更（メイン）
- `src/app/forest/dashboard/page.tsx` — セクション追加 + state 管理

### 変更（補助）
- `src/app/forest/_constants/companies.ts` — `CellData` 型に `reflected` があるか確認（既にあれば ST-F10-04 は確認のみ）
- `src/app/forest/_components/MicroGrid.tsx` — `reflected` を CellData に詰める処理が既にあるか確認（main の L183 `reflected: isSK ? sk!.reflected : null,` で渡し済）
- `src/app/forest/_components/DetailModal.tsx` — reflected 表示が欠落なら追加（T-F10-03 §Step 4 で指示済）

### 新規
なし

---

## 4. 型定義

既存の型で充足：
```typescript
// 既存 CellData（companies.ts）に reflected: string | null があるか要確認
// main の MicroGrid.tsx L183 で reflected: isSK ? sk!.reflected : null を渡しているため、型にも存在するはず

// dashboard/page.tsx 内で追加する state
const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
```

---

## 5. 実装ステップ（サブタスク別）

### ST-F4-03: TaxCalendar の pill クリック接続

**現状**: TaxCalendar は `onPillClick(scheduleId: string)` prop を受けとる（T-F4-02 §5 Step 5 参照）

**実装**:
```tsx
// dashboard/page.tsx 内
<TaxCalendar
  companies={companies}
  schedules={nouzeiSchedules}
  onPillClick={(scheduleId) => setSelectedScheduleId(scheduleId)}
/>
```

**動作確認**:
1. pill クリックで setSelectedScheduleId が呼ばれる
2. React DevTools で state 変更を確認

---

### ST-F4-04: dashboard に TaxCalendar セクション追加

**配置**: v9 L994-1001 の順序に合わせ、**SummaryCards の直後**に配置（MicroGrid より上）

**実装**:
```tsx
// dashboard/page.tsx 構造（追加後）
<>
  <SummaryCards companies={companies} periods={periods} />
  <TaxCalendar
    companies={companies}
    schedules={nouzeiSchedules}
    onPillClick={(id) => setSelectedScheduleId(id)}
  />
  <TaxFilesList companies={companies} taxFiles={taxFiles} />           {/* Batch 3 */}
  <DownloadSection companies={companies} />                            {/* ST-F6-05 */}
  <MacroChart companies={companies} periods={periods} />
  <MicroGrid
    companies={companies}
    periods={periods}
    shinkouki={shinkouki}
    onEditShinkouki={isAdmin ? setEditingCompanyId : undefined}
  />
  {/* modals */}
</>
```

**ForestStateContext に追加要なデータ**:
- `nouzeiSchedules`（T-F4-02 で T-F11-01 用に追加済前提）
- `taxFiles`（T-F5-01 で追加済前提）

**ForestStateContext refreshData 確認**:
```typescript
// src/app/forest/_state/ForestStateContext.tsx
const [c, p, s, ns, tf] = await Promise.all([
  fetchCompanies(),
  fetchFiscalPeriods(),
  fetchShinkouki(),
  fetchNouzeiCalendar(from, to),    // T-F4-02 で追加
  fetchTaxFiles(),                  // T-F5-01 で追加
]);
```

---

### ST-F6-05: dashboard に DownloadSection 追加

**配置**: v9 L1014-1077 の順序に合わせ、**TaxFilesList の直後**（MacroChart の前）

**実装**:
```tsx
// ST-F4-04 の構造に既に含めた。ST-F6-05 は同じ配置を確認するだけ
<DownloadSection companies={companies} />
```

**動作確認**:
1. ボタン押下 → `/api/forest/download-zip` へ POST
2. Progress 表示 → 完成 ZIP リンク

---

### ST-F10-04: CellData.reflected 表示

**現状確認**:
- main MicroGrid.tsx L183: `reflected: isSK ? sk!.reflected : null` — **既に渡されている**
- main DetailModal.tsx: `data.reflected` の利用を確認（T-F10-03 §Step 4 で指示した実装が未適用の場合、本 spec で実施）

**実装**:
```tsx
// DetailModal.tsx ヘッダー近く、進行期タグの後に追加
{data.isShinkouki && data.reflected && (
  <span style={{ fontSize: 11, color: FOREST_THEME.negative, marginLeft: 8 }}>
    ※{data.reflected}
  </span>
)}
```

**動作確認**:
1. 進行期セル（例: ヒュアラン 第 10 期）クリック → DetailModal 表示
2. `※2026/3まで反映中` が赤字で表示される
3. 未反映の進行期（reflected=null）では何も表示されない

---

### ST-F11-02: TaxDetailModal を dashboard にマウント

**実装**:
```tsx
// dashboard/page.tsx 末尾に追加
{selectedScheduleId && (() => {
  const schedule = nouzeiSchedules.find(s => s.id === selectedScheduleId);
  const company = schedule ? companies.find(c => c.id === schedule.company_id) : null;
  if (!schedule || !company) return null;

  return (
    <TaxDetailModal
      scheduleId={selectedScheduleId}
      company={company}
      onClose={() => setSelectedScheduleId(null)}
    />
  );
})()}
```

**動作確認**:
1. TaxCalendar の pill クリック → TaxDetailModal が開く
2. モーダル内で税目内訳・合計・添付ファイルが表示される
3. 背景クリック / Esc / 閉じるボタンで閉じる
4. 閉じた後、別の pill をクリックすると別の schedule が表示される

---

## 6. データソース

| 種類 | 取得元 | 利用場所 |
|---|---|---|
| `nouzeiSchedules` | `fetchNouzeiCalendar` (T-F4-02) | TaxCalendar + TaxDetailModal |
| `taxFiles` | `fetchTaxFiles` (T-F5-01) | TaxFilesList |
| `companies` / `periods` / `shinkouki` | 既存 | 全コンポーネント |
| 個別 `hankanhi` | `fetchHankanhi` (T-F10-02) | DetailModal 内部 |
| 個別 `scheduleDetail` | `fetchNouzeiDetail` (T-F11-01) | TaxDetailModal 内部 |

---

## 7. UI 仕様

### dashboard/page.tsx 最終構造
```
┌─ ForestShell ─────────────────────────────────┐
│ [SummaryCards] 5 カード                         │
│                                                 │
│ [TaxCalendar] 6法人 × ローリング12ヶ月          │
│                                                 │
│ [TaxFilesList] 法人ごとアコーディオン          │
│                                                 │
│ [DownloadSection] 法人選択 + 期数 + DL ボタン │
│                                                 │
│ [MacroChart] 積み上げ折れ線                     │
│                                                 │
│ [MicroGrid] 6法人 × 年度 セルグリッド          │
│                                                 │
│ [ShinkoukiEditModal] 進行期編集（admin のみ）  │
│ [DetailModal] セル詳細（主要 6 + HANKANHI 8）  │
│ [TaxDetailModal] 納税詳細（items + files）     │
└────────────────────────────────────────────────┘
```

### Modal 制御
| modal | state | トリガ | データ |
|---|---|---|---|
| DetailModal | `selectedCell` | MicroGrid セルクリック | fetchHankanhi で追加取得 |
| ShinkoukiEditModal | `editingCompanyId` | MicroGrid 進行期セル + admin | 既存 |
| TaxDetailModal | `selectedScheduleId` | TaxCalendar pill クリック | fetchNouzeiDetail で取得 |

**同時に 2 つの modal が開くことはない**が、state は独立させておく（将来の stack 対応のため）。

---

## 8. エラーハンドリング

| # | シナリオ | 対応 |
|---|---|---|
| E1 | pill クリックしたが `nouzeiSchedules` に該当 schedule がない | TaxDetailModal は null を返してマウント回避、誤クリック扱い |
| E2 | schedule.company_id が `companies` に存在しない | 同上（ログのみ出力）|
| E3 | DownloadSection API 呼出失敗 | T-F6-04 §8 のエラー対応 |
| E4 | DetailModal の HANKANHI fetch 失敗 | T-F10-03 §8 のエラー対応 |
| E5 | TaxCalendar のデータ 0 件 | T-F4-02 がデフォルトで空カレンダー表示 |

---

## 9. 権限・RLS

各コンポーネントの個別 RLS を継承：
- TaxCalendar / TaxDetailModal: `forest_is_user()` 読み取り
- DownloadSection: API 側で `forest_is_user()` 検証
- TaxFilesList: 読み取り / admin+ アップロード UI
- DetailModal HANKANHI: `forest_is_user()` 読み取り

dashboard/page.tsx 自体は既存の `isAuthenticated / hasPermission / isUnlocked` ゲートで守られる。

---

## 10. テスト観点（§16 7種テスト）

| # | テスト種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | 全 5 サブタスクの動作確認 |
| 2 | エッジケース | schedule 見つからない / company 見つからない / 空配列 |
| 3 | 権限 | forest_user でページロード → 全セクション表示 |
| 4 | データ境界 | nouzeiSchedules 0 件 / 100 件 / 法人 6 社データ揃い |
| 5 | パフォーマンス | dashboard 初期レンダリング 2 秒以内 |
| 6 | Console | 警告なし（特に useEffect cleanup / modal 多重 open）|
| 7 | a11y | modal 開閉時のフォーカス管理 |

---

## 11. 関連参照

### Batch 2 成果物（`feature/phase-a-prep-batch2-20260424-auto`）
- T-F4-02 [tax-calendar.md](2026-04-24-forest-t-f4-02-tax-calendar.md) — TaxCalendar 本体
- T-F11-01 [tax-detail-modal.md](2026-04-24-forest-t-f11-01-tax-detail-modal.md) — TaxDetailModal 本体
- T-F10-03 [hankanhi-detail-modal.md](2026-04-24-forest-t-f10-03-hankanhi-detail-modal.md) — DetailModal HANKANHI
- T-F6-03 [download-zip-edge.md](2026-04-24-forest-t-f6-03-download-zip-edge.md) — DL API

### Batch 3 成果物（`feature/phase-a-prep-batch3-20260424-auto`）
- T-F5-02 [tax-files-list-ui.md](2026-04-24-forest-t-f5-02-tax-files-list-ui.md) — TaxFilesList
- T-F6-04 [download-section-ui.md](2026-04-24-forest-t-f6-04-download-section-ui.md) — DownloadSection

### Batch 4 成果物（本 Batch）
- T-F10-02 [fetch-hankanhi.md](2026-04-24-forest-t-f10-02-fetch-hankanhi.md) — DetailModal 用データ取得

### 既存 TSX（main c005663）
- `src/app/forest/dashboard/page.tsx`
- `src/app/forest/_state/ForestStateContext.tsx`
- `src/app/forest/_components/MicroGrid.tsx`

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | Modal の stack 対応（2 つ同時 open） | **Phase A では単一 modal のみ**、排他的 state で十分 |
| 判2 | `selectedScheduleId` を URL search param に同期 | **Phase A 範囲外**、モーダル状態は URL に残さない |
| 判3 | TaxCalendar と TaxFilesList の上下順序 | **TaxCalendar → TaxFilesList**（v9 L994-1012 順序準拠）|
| 判4 | DownloadSection の位置（TaxFiles の直後 vs MacroChart の前）| **TaxFiles の直後**（v9 L1014-1077 準拠）|
| 判5 | dashboard/page.tsx の肥大化対策 | **Phase A 完了時点でリファクタ検討**、`DashboardLayout` 分離 |
| 判6 | reflected note の色（v9 L982-984 赤 vs テーマ統一） | **赤字（FOREST_THEME.negative）を推奨**（v9 準拠）|

---

## 13. 実装順序の推奨

a-forest が本 spec 単体を着手する際の順序：

1. **ST-F10-04**（0.1d）: DetailModal reflected 表示（最軽量、視覚確認容易）
2. **ST-F4-03 + ST-F11-02**（0.3d）: TaxCalendar ↔ TaxDetailModal 接続（相互依存）
3. **ST-F4-04**（0.05d）: dashboard に TaxCalendar 追加
4. **ST-F6-05**（0.05d）: dashboard に DownloadSection 追加

**合計 0.5d**（本 spec 見積通り）。

### 全 Batch を跨いだ実装順序（推奨）

Forest Phase A 完全実装のため、a-forest が Batch 2/3/4 を跨いで実施する推奨順序：

```
Week 1（インフラ整備）
  1. T-F6-01 Storage buckets（Batch 3）          — 0.25d
  2. T-F5-01 Tax Files インフラ（Batch 3）       — 0.5d
  3. T-F6-02 Drive→Storage 移行（Batch 3）      — 0.5d
  4. T-F10-02 fetchHankanhi（Batch 4）          — 0.25d
  5. T-F2-01 最終更新日（Batch 2）               — 0.25d
  6. T-F7-01 InfoTooltip（Batch 2）              — 0.25d
  Week 1 計: 2.0d

Week 2（主機能実装）
  7. T-F10-03 DetailModal HANKANHI（Batch 2）    — 0.5d
  8. T-F11-01 TaxDetailModal（Batch 2）          — 0.5d
  9. T-F4-02 TaxCalendar（Batch 2）              — 1.0d
  10. T-F5-02 TaxFilesList UI（Batch 3）         — 0.75d
  11. T-F5-03 Tax Files Upload UI（Batch 3）     — 0.5d
  Week 2 計: 3.25d

Week 3（接続 + 仕上げ）
  12. T-F6-03 Download ZIP API（Batch 2）         — 1.5d
  13. T-F6-04 Download Section UI（Batch 3）      — 0.5d
  14. T-F-ui-link（本 spec）                     — 0.5d
  15. T-F3-F8 polish（Batch 4）                  — 0.2d
  16. T-F9-01 MicroGrid 差分補正（Batch 4）       — 0.75d（採否次第で圧縮）
  Week 3 計: 3.45d

合計 約 8.7d（約 1.7 週間の実稼働）
```

**ただし** a-forest が他モジュールの保守・レビュー・営業業務と並行する前提で、**M1（2026-05、約 20 稼働日）の前半 2/3 = 約 14 日**でカバーされる見込み。

— end of T-F-ui-link spec —
