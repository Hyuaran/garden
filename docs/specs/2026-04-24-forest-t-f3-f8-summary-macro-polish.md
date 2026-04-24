# T-F3-F8: Summary Cards + Macro Chart 差分補正（統合 spec）

- 対象: Garden-Forest F3 SummaryCards + F8 MacroChart の細部整合
- 見積: **0.2d**（約 1.5 時間、実装 + 確認）
- 担当セッション: a-forest
- 作成: 2026-04-24（a-auto / Phase A 先行 batch4 #T-F3-F8）
- 元資料: `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md` §4.3, §4.8, v9 HTML L984-992/1350-1372, L1079-1088/1377-1417
- **本 spec の性質**: 既存 TSX vs v9 HTML の**細部文言・スタイル差分の軽微修正**。2 件を 1 spec にまとめ、a-forest が一度に対応可

---

## 1. スコープ

### 作る（F3 Summary Cards 補正）
- `SummaryCards.tsx` の sub 文言調整（差分判断後）
- 特に「壱を除く 5 社」表示の業務意図確認

### 作る（F8 Macro Chart 補正）
- `MacroChart.tsx` のタイトル文言（v9 互換 or 現行維持の判断）
- chart height 320 → 360 の調整（v9 準拠）

### 作らない
- Summary Cards の新規メトリクス追加
- Macro Chart のグラフ種別変更（stacked line 維持）
- 動的なデータソース切替

---

## 2. 前提

| 依存 | 内容 |
|---|---|
| main ブランチ | `src/app/forest/_components/SummaryCards.tsx`, `MacroChart.tsx`（c005663 時点）|
| v9 HTML | L1350-1372（renderSummary）, L1377-1417（renderMacroChart）|
| 既存データ | `companies` / `periods`（Supabase 経由、Phase A1 完了済）|

---

## 3. ファイル構成

### 変更
- `src/app/forest/_components/SummaryCards.tsx`
- `src/app/forest/_components/MacroChart.tsx`

### 新規
なし

---

## 4. 型定義

本 spec では既存型をそのまま利用、追加なし。

---

## 5. 実装ステップ

### Part A: SummaryCards 差分

#### 現状観察（TSX c005663）
```typescript
// L52-58
return [
  { label: "総売上高", value: fmtYen(totalU), sub: `${countWithData}社合算` },
  { label: "経常利益", value: fmtYen(totalR), sub: "営業外損益を含む" },
  { label: "純資産", value: fmtYen(totalJ), sub: "総資産 − 総負債" },
  { label: "現預金", value: fmtYen(totalGY), sub: "手許現金 + 銀行預金" },
  {
    label: "法人数",
    value: `${companies.length}社`,
    sub: `${countWithData}社データあり`,
  },
];
```

#### v9 文言（L1359-1365）
```javascript
{ label: '総売上高', value: fmtYen(totalU), sub: '壱を除く5社' },
{ label: '経常利益', value: fmtYen(totalR), sub: '営業外損益を含む' },
{ label: '純資産', value: fmtYen(totalJ), sub: '総資産 − 総負債' },
{ label: '現預金', value: fmtYen(totalGY), sub: '手許現金 + 銀行預金' },
{ label: '法人数', value: '6社', sub: '5社データあり / 壱 未登録' },
```

#### 差分
- **総売上高 sub**: v9 は `'壱を除く5社'`（固定文言、"壱" 名指し）、TSX は `${countWithData}社合算`（動的）
- **法人数 value**: v9 は `'6社'`（固定）、TSX は `${companies.length}社`（動的）
- **法人数 sub**: v9 は `'5社データあり / 壱 未登録'`（"壱" 名指し）、TSX は `${countWithData}社データあり`（動的、名指しなし）

#### auto の推奨: **現行 TSX のほうが正しい**（改善版として維持）
**理由**:
1. 動的計算のほうが将来の法人追加・削除に自然対応（"壱" 以外が未登録になっても追従）
2. "壱" 名指しは運用上の特定の時点の情報（DB の `companies` に壱が含まれ、データが空の状態）
3. 将来 "壱" にデータが入ったら v9 は手動更新が必要

#### ただし「壱」未登録を明示するなら（判断次第）
```typescript
// オプション実装: データなし法人を名指し
const emptyCompanies = companies.filter(c =>
  !periods.some(p => p.company_id === c.id)
).map(c => c.short);

const subForTotal = emptyCompanies.length > 0
  ? `${emptyCompanies.join('・')}を除く${countWithData}社`
  : `${countWithData}社合算`;

const subForCount = emptyCompanies.length > 0
  ? `${countWithData}社データあり / ${emptyCompanies.join('・')} 未登録`
  : `${countWithData}社データあり`;
```

**auto スタンス**: **現状維持**を第 1 推奨、**「壱」名指し復活**を第 2 推奨（上記オプション実装）。

### Part B: MacroChart 差分

#### 現状観察（TSX c005663）
- Title: `経常利益推移（グループ全体）`
- Chart height: 320px
- tension: 0.35, fill: true, stacked: true, legend bottom, tooltip footer — **v9 と完全一致**

#### v9 文言（L1083）
```html
<h2 class="section-title">
  <svg .../>
  グループ全体の合算利益推移 ～ 森の視界 ～
</h2>
```
- タイトル: `グループ全体の合算利益推移 ～ 森の視界 ～`（Garden の "森の視界" ブランド表現）
- chart-wrap height: **360px**（CSS L480）

#### 差分
- **タイトル**: v9 の「～ 森の視界 ～」がない（ブランディング差）
- **高さ**: TSX 320px、v9 360px（40px の差）

#### auto の推奨: **タイトルは v9 に合わせる、高さは判断**

**タイトル変更**:
```tsx
// MacroChart.tsx L66-74
<h3
  style={{
    fontSize: 15,
    fontWeight: 700,
    color: FOREST_THEME.textPrimary,
    marginBottom: 16,
  }}
>
  グループ全体の合算利益推移 ～ 森の視界 ～
</h3>
```

**高さ調整**（判断保留）:
```tsx
<div style={{ height: 360 }}>  {/* 320 → 360 */}
  <Line ... />
</div>
```
高さ変更は画面スクロール量が増えるため、モバイル対応確認後に採用判断。

---

## 6. データソース

本 spec は既存データソースを継続利用：
- `companies` テーブル（Supabase）
- `fiscal_periods` テーブル（Supabase）

追加データソースなし。

---

## 7. UI 仕様

### SummaryCards（現状維持推奨）
- 5 カード横並び、`minmax(180px, 1fr)` グリッド
- sub 文言は動的生成で法人増減に追従

### MacroChart（推奨変更 2 点）
- タイトル: `グループ全体の合算利益推移 ～ 森の視界 ～` に変更（v9 互換）
- 高さ: 320 → 360（判断保留）

### Tailwind 方針
既存 inline style を維持（他 Forest コンポーネントと統一）。

---

## 8. エラーハンドリング

| # | 想定 | 対応 |
|---|---|---|
| E1 | companies 空配列 | 「0社」で表示（現状維持）|
| E2 | periods 空配列 | value が 0 円で表示、sub は "0社合算" |
| E3 | emptyCompanies 検出ロジック（Part A オプション）の計算コスト | 6 法人しかないため O(n*m) でも十分高速 |
| E4 | MacroChart: 全データ 0 の法人 | Chart.js が自動で 0 値として描画（既存挙動）|

---

## 9. 権限・RLS

本 spec は UI のみで DB 変更なし。既存 RLS（`forest_is_user()`）をそのまま利用。

---

## 10. テスト観点（§16 7種テスト）

| # | テスト種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | SummaryCards 5 枚の値・sub 文言 / MacroChart タイトル表示 |
| 2 | エッジケース | 6 法人すべてデータあり時、すべてなし時、特定 1 社だけなし時 |
| 4 | データ境界 | 売上 0 円、巨大売上（1 兆）での表示崩れ |
| 5 | パフォーマンス | SummaryCards render 50ms 以内、MacroChart 初期レンダリング 500ms 以内 |
| 6 | Console | 警告なし（特に Chart.js の scale 設定）|
| 7 | a11y | MacroChart の `aria-label` 検討（現状なし、判断保留 判3）|

---

## 11. 関連参照

- **P07 §4.3**: F3 Summary Cards 差分（c005663 より前の記述、本 spec で最新化）
- **P07 §4.8**: F8 Macro Chart 差分
- **現行 TSX**:
  - `src/app/forest/_components/SummaryCards.tsx`（main c005663）
  - `src/app/forest/_components/MacroChart.tsx`（main c005663）
- **v9 HTML**:
  - L984-992（セクション）, L1350-1372（renderSummary）
  - L1079-1088（セクション）, L1377-1417（renderMacroChart）

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | SummaryCards の sub 文言方針 | **現状維持（動的）推奨**。「壱」復活は東海林さんが希望すれば Part A オプション実装 |
| 判2 | MacroChart タイトル変更 | **v9 タイトル「〜 森の視界 〜」に変更を推奨**（Garden ブランディングの一貫性）|
| 判3 | MacroChart 高さ 360px | **判断保留**（v9 整合 vs モバイル表示面積のトレードオフ）|
| 判4 | Chart.js の a11y 対応 | Phase A 範囲外、`aria-label` 付与は Phase B |
| 判5 | 他セクションの「〜 森の視界 〜」的ブランド表現 | 他セクション（MicroGrid 等）の見出しにも適用するか要検討 |

---

## 13. 実装工数の内訳

本 spec 見積 0.2d の内訳:
- SummaryCards 判断合意 + 実装（オプション採用時）: 0.05d
- MacroChart タイトル変更: 0.02d
- MacroChart 高さ調整（採用時）: 0.02d
- 動作確認（desktop + mobile）: 0.08d
- 文言レビュー・レビュー対応: 0.03d

**最小パターン**（タイトル変更のみ）: 0.1d

— end of T-F3-F8 spec —
