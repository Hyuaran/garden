# T-F9-01: MicroGrid 差分調査（v9 HTML × 現行 TSX）実装指示書

- 対象: Garden-Forest F9 Micro Grid の v9 互換性精査
- 見積: **0.75d**（約 6 時間、調査 + 必要修正の実装を含む）
- 担当セッション: a-forest（本 spec は a-auto が調査結果を提示、修正判断は a-forest + 東海林さん）
- 作成: 2026-04-24（a-auto / Phase A 先行 batch4 #T-F9-01）
- 元資料: `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md` §4.9, v9 HTML L1090-1102, L1422-1568, CSS L508-810
- **本 spec の性質**: 新規実装ではなく**既存 TSX vs v9 HTML の差分レポート**。a-auto が調査済の 10 点差分を提示、a-forest が採否判断

---

## 1. スコープ

### 作る（本 spec の成果物）
- v9 HTML と現行 `MicroGrid.tsx`（main ブランチ、c005663 時点）の**10 点差分チェックリスト**
- 各差分に「auto のスタンス（対応すべき/不要/判断保留）」を付与
- 採用判断された差分についての実装ステップ（a-forest が順次適用可）

### 作らない
- 全差分への自動適用（東海林さんの優先度判断を経る）
- 動作テスト（実装判断後に a-forest が実施）
- デザイン改善（差分補正に留める）

---

## 2. 前提

| 依存 | 内容 |
|---|---|
| main ブランチ | `src/app/forest/_components/MicroGrid.tsx`（c005663 時点）|
| v9 HTML | `G:/.../08_Garden-Forest/garden-forest_v9.html`（L1090-1568）|
| 既存型 | `CellData / Company / FiscalPeriod / Shinkouki`（`_constants/companies.ts`）|
| 既存テーマ | `FOREST_THEME`（`_constants/theme.ts`）|

---

## 3. ファイル構成

### 修正候補（差分採否次第で変更）
- `src/app/forest/_components/MicroGrid.tsx` — 主たる修正対象
- `src/app/forest/globals.css`（or Tailwind 拡張）— `@keyframes shinkou-glow` 追加（差分 D4 採用時）

### 新規
なし

### 変更なし
- 本 spec の調査自体は docs 作成のみ。a-forest の実装判断次第で TSX を修正

---

## 4. 型定義

既存 `CellData` を維持。追加判断が必要なのは以下のみ：
```typescript
// CellData に reflected / zantei は既に存在（MicroGrid.tsx L184-185 で利用）
// 本 spec では新規型定義は不要
```

---

## 5. 差分チェックリスト（10 点）

### D1. scroll-sync（上下バー同期）🔴 差分あり

**v9 挙動**（L1553-1563）:
- 上下 2 つの scrollbar を同期
- `scrollTop` / `scrollBottom` 両方の `scroll` イベントで相互同期

**TSX 現状**:
```tsx
// L73-85, L91 付近
<div style={{ overflowX: "auto" }}>
  ...単一スクロール領域のみ
</div>
```

**auto スタンス**: 🟡 **対応推奨だが優先度低**。v9 の上部 scrollbar は UX 補助（下までスクロールせずにバー操作）だが、現行でも下部 scrollbar で操作可能。

**採用時の実装ステップ**:
```tsx
// src/app/forest/_components/MicroGrid.tsx に追加
const topScrollRef = useRef<HTMLDivElement>(null);
const bottomScrollRef = useRef<HTMLDivElement>(null);
const syncingRef = useRef(false);

const syncScroll = (source: 'top' | 'bottom') => {
  if (syncingRef.current) return;
  syncingRef.current = true;
  const src = source === 'top' ? topScrollRef.current : bottomScrollRef.current;
  const dst = source === 'top' ? bottomScrollRef.current : topScrollRef.current;
  if (src && dst) dst.scrollLeft = src.scrollLeft;
  syncingRef.current = false;
};

// JSX
<div ref={topScrollRef} onScroll={() => syncScroll('top')} style={{ overflowX: 'auto' }}>
  <div style={{ width: /* 総幅 */, height: 1 }} />
</div>
<div ref={bottomScrollRef} onScroll={() => syncScroll('bottom')} style={{ overflowX: 'auto' }}>
  {/* 既存のテーブル */}
</div>
```

### D2. sticky col-company（左列固定）🔴 差分あり

**v9 挙動**（CSS L508-527）:
- 法人名列が `position: sticky; left: 0` で横スクロール時も表示継続
- z-index: 3-4（header は 4、body は 3）

**TSX 現状**: 通常の `<td>`、sticky 指定なし

**auto スタンス**: 🔴 **対応必須**。年度が増えると（将来 10 年超）法人名が見えなくなる。v9 で常用されている UX の核心。

**採用時の実装ステップ**:
```tsx
<td
  style={{
    position: 'sticky',
    left: 0,
    zIndex: 3,
    background: '#f8f5ee',  // FOREST_THEME.stickyBg（追加）
    minWidth: 160,
    padding: '10px 12px',
    borderRight: '2px solid #d8f3dc',
  }}
>
  {/* 法人情報 */}
</td>

// thead の対応 th は z-index: 4
```

**追加定数（theme.ts）**:
```typescript
export const FOREST_THEME = {
  // ...
  stickyBg: '#f8f5ee',  // v9 の col-company 背景
};
```

### D3. group-summary 別 table 化 🟡 差分あり（仕様差）

**v9 挙動**（L1099, L1434-1457）:
- 別 `<table class="group-summary-table">` で配置（メイン table の上）
- `background: #e8f5e9`（ミントグリーン）、上下ボーダー付き

**TSX 現状**: 上部に配置するが div/flex レイアウト、別 table ではない

**auto スタンス**: 🟢 **対応不要**。見た目の差分は軽微、機能的には同等。flex レイアウトの方が CSS 保守性高い。

**判断**: このまま維持。もし v9 完全再現が必要なら a-forest 判断で切替可。

### D4. 進行期 glow アニメーション 🔴 差分あり

**v9 挙動**（CSS L759-801）:
```css
@keyframes shinkou-glow {
  0%, 100% { border-color: rgba(218, 165, 32, 0.35); box-shadow: 0 0 6px rgba(218, 165, 32, 0.15); }
  50%     { border-color: rgba(218, 165, 32, 0.85); box-shadow: 0 0 14px rgba(218, 165, 32, 0.3); }
}
.data-cell.shinkouki {
  border: 2px solid rgba(218, 165, 32, 0.5);
  animation: shinkou-glow 2.5s ease-in-out infinite;
  background: rgba(255, 248, 230, 0.4);
}
```

**TSX 現状**（L181-187）:
```tsx
background: isSK ? "rgba(184,134,11,0.06)" : "rgba(27,67,50,0.03)",
border: isSK ? "1px solid rgba(184,134,11,0.2)" : "1px solid transparent",
```
静的な背景と境界線のみ、animation なし

**auto スタンス**: 🟡 **対応推奨**。進行期セルを視覚的に目立たせる（v9 の核デザイン）。実装コスト低。

**採用時の実装ステップ**:
```css
/* src/app/globals.css に追加 */
@keyframes shinkou-glow {
  0%, 100% {
    border-color: rgba(218, 165, 32, 0.35);
    box-shadow: 0 0 6px rgba(218, 165, 32, 0.15);
  }
  50% {
    border-color: rgba(218, 165, 32, 0.85);
    box-shadow: 0 0 14px rgba(218, 165, 32, 0.3);
  }
}
.shinkou-animate {
  animation: shinkou-glow 2.5s ease-in-out infinite;
}
```
```tsx
// MicroGrid.tsx のセル div に className 追加
<div
  className={isSK ? 'shinkou-animate' : ''}
  style={{
    border: isSK ? '2px solid rgba(218,165,32,0.5)' : '1px solid transparent',
    background: isSK ? 'rgba(255,248,230,0.4)' : 'rgba(27,67,50,0.03)',
    // ...
  }}
>
```

### D5. mini-bars サイズ差 🟡 差分あり

**v9 挙動**（CSS L740-745）:
- `.mini-bar`: width 15px, border-radius 3px 3px 0 0
- 高さ係数: `Math.sqrt(value / maxVal) * 50`（L1503-1505）

**TSX 現状**（L199-212）:
- width 4px, border-radius 2px
- 高さ係数: `Math.sqrt(value / maxVal) * 40`

**auto スタンス**: 🟢 **対応不要 or 微調整**。TSX は狭い mini-bar でコンパクト、v9 は太め。UX 判断。現状維持でも情報伝達に問題なし。

**判断保留**: 東海林さんの「v9 の見た目をどこまで再現するか」次第。

### D6. ki-badge の Drive URL リンク化 🔴 差分あり

**v9 挙動**（L1507）:
```javascript
var docLink = src.doc
  ? '<a href="' + src.doc + '" target="_blank" rel="noopener" class="ki-badge-link" onclick="event.stopPropagation()" ...>第N期</a>'
  : '<div class="ki-badge" ...>第N期</div>';
```
ki-badge そのものが Drive 直リンクを兼ねる（セルクリックで DetailModal、badge クリックで Drive）

**TSX 現状**（L188-199）:
```tsx
<div style={{ ... }}>{`第${cellData.ki}期`}</div>
```
静的 div、Drive リンクなし（DetailModal 経由でアクセス）

**auto スタンス**: 🟡 **判断保留**。v9 ユーザーが ki-badge 直リンクに慣れているなら追加、DetailModal 経由でも構わないなら現状維持。**東海林さんのユーザー操作観察が必要**。

**採用時の実装ステップ**:
```tsx
{cellData.doc_url ? (
  <a
    href={cellData.doc_url}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => {
      e.stopPropagation();  // セルクリック伝播停止
      writeAuditLog('click_ki_badge', `${c.id}_ki${cellData.ki}`);
    }}
    style={{
      display: 'inline-block',
      padding: '1px 8px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 700,
      color: '#fff',
      background: isSK ? FOREST_THEME.shinkouBadge : c.color,
      textDecoration: 'none',
      cursor: 'pointer',
      marginBottom: 6,
    }}
  >
    第{cellData.ki}期
  </a>
) : (
  <div style={{ /* 既存 */ }}>第{cellData.ki}期</div>
)}
```

### D7. period-range + reflected 表示 ✅ 差分なし

**v9 挙動**（L1525）: `${from}~${to}` + 進行期時 `<br>${reflected}`

**TSX 現状**（L219-224）: 同等の実装あり

**auto スタンス**: ✅ **そのまま**。差分なし、確認済。

### D8. 初期スクロール最右端 🟡 差分あり

**v9 挙動**（L1565-1567）:
```javascript
setTimeout(function() {
  scrollBottom.scrollLeft = scrollBottom.scrollWidth;
}, 300);
```
マウント後 300ms で最右端にスクロール（最新年度が初期表示）

**TSX 現状**: 実装なし。初期位置は最左端

**auto スタンス**: 🔴 **対応必須**。ユーザーは「最新年度を見たい」のが主目的。左端スタートは必ずスクロールが必要。

**採用時の実装ステップ**:
```tsx
const scrollContainerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const el = scrollContainerRef.current;
  if (!el) return;
  // 次フレームで最右端にスクロール
  requestAnimationFrame(() => {
    el.scrollLeft = el.scrollWidth;
  });
}, [years]);

// JSX
<div ref={scrollContainerRef} style={{ overflowX: 'auto' }}>
  {/* table */}
</div>
```

### D9. scroll-hint テキスト 🟢 差分あり（軽微）

**v9 挙動**（L1546）:
```javascript
document.getElementById('scrollHint').textContent = '← 過去　　横スクロールで成長の軌跡を追体験　　未来 →';
```

**TSX 現状**: テキストなし

**auto スタンス**: 🟢 **判断保留**。v9 のコピーはブランディング的な表現、業務上は任意。**追加するなら小さい文字で `overflowX: auto` の直上に配置**。

**採用時の実装ステップ**:
```tsx
<div style={{
  fontSize: 11,
  color: FOREST_THEME.textMuted,
  textAlign: 'center',
  padding: '4px 0 8px',
}}>
  ← 過去　　横スクロールで成長の軌跡を追体験　　未来 →
</div>
```

### D10. zantei 専用スタイル（進行期かつ暫定）🟡 差分あり

**v9 挙動**（CSS L775-783）:
```css
.data-cell.shinkouki.zantei .metric-val { color: #999 !important; }
.data-cell.shinkouki.zantei .metric-label { color: #aaa; }
.data-cell.shinkouki.zantei .mini-bar { opacity: 0.35; }
```
数値・ラベルを灰色化、mini-bar 透明度 35% で「暫定」を視覚的に表現

**TSX 現状**:
```tsx
// L184-187 で zantei プロパティは保存しているが UI に反映されていない
zantei: isSK ? sk!.zantei : false,
```

**auto スタンス**: 🔴 **対応推奨**。進行期の中でも「確定前」と「暫定」を区別する業務的重要性あり。

**採用時の実装ステップ**:
```tsx
const isZantei = isSK && sk!.zantei;

// メトリクス数値
<span style={{ fontWeight: 600, color: isZantei ? '#999' : (isNeg ? FOREST_THEME.negative : FOREST_THEME.positive) }}>
  {hasR ? fmtYen(src.rieki!) : '―'}
</span>

// mini-bar
<div style={{
  width: 4,
  height: Math.max(barU, 2),
  background: C.midGreen,
  borderRadius: 2,
  opacity: isZantei ? 0.35 : 1,
}} />
```

---

## 6. データソース

本 spec 自体は設計調査のため新規データソースなし。既存:
- `CellData.zantei`（D10 で活用）
- `CellData.doc_url`（D6 で活用）

---

## 7. UI 仕様

採用差分ごとの UI 変更:
- D1, D8: スクロール挙動（JS レイヤ）
- D2: sticky 列レイアウト（CSS）
- D4, D10: セル状態スタイル（CSS + style prop）
- D6: badge の `<a>` 化（JSX 構造）
- D9: scroll-hint テキスト追加

Tailwind 既存プロジェクトだが Forest は inline style / CSS in JS 中心のため、**keyframe のみ globals.css に追加**、他は inline style を維持（既存パターン踏襲）。

---

## 8. エラーハンドリング

各差分の実装に関連するエラー:
- D1/D8 scroll sync: ref が null のケース（SSR）→ Optional chaining + useEffect 内で実施
- D6 ki-badge link: doc_url null のケース → 三項演算子で div にフォールバック
- D10 zantei: shinkouki データがない場合 → isSK && sk!.zantei で guard

---

## 9. 権限・RLS

本 spec は UI のみで DB 変更なし。既存の RLS（`forest_is_user()` 等）をそのまま利用。

---

## 10. テスト観点（§16 7種テスト）

| # | テスト種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | 採用した差分すべて（例: 4 件採用なら 4 ケース）|
| 2 | エッジケース | 法人 0 件 / 年度 0 件 / shinkouki なしで進行期表示 / zantei=true かつ uriage=null |
| 4 | データ境界 | 年度 20 年分（sticky col の効果確認）、極小/極大 uriage で mini-bar の見た目 |
| 5 | パフォーマンス | 6 法人 × 20 年 = 120 セル、初期スクロール遅延 300ms 以下 |
| 6 | Console | 警告なし（特に `<a>` へのネスト警告、key 重複）|
| 7 | a11y | `<table>` に caption 追加推奨、sticky 列でも `<th scope>` 維持 |

---

## 11. 関連参照

- **P07 v9 vs TSX §4.9**: 本 spec の出発点
- **v9 HTML**:
  - L1090-1102: セクション HTML
  - L1422-1568: `renderMicroGrid()` 関数
  - CSS L508-801: Micro Grid 専用スタイル
- **現行 TSX**: `src/app/forest/_components/MicroGrid.tsx`（main `c005663`）
- **関連 spec**:
  - T-F10-03（DetailModal HANKANHI）— `CellData.reflected` の渡し方確認
  - T-F4-02（TaxCalendar）— sticky 列パターン参考
  - T-F-ui-link（UI 連携統合）— `reflected` note 反映の連動

---

## 12. 判断保留（採否一覧）

| D# | 差分 | 推奨 | 優先度 | 工数 |
|---|---|---|---|---|
| D1 | scroll-sync 上下バー同期 | 判断保留 | 🟢 | 0.15d |
| D2 | sticky col-company 左列固定 | **採用** | 🔴 | 0.2d |
| D3 | group-summary 別 table 化 | 不要 | 🟢 | 0.1d |
| D4 | 進行期 glow animation | 採用 | 🟡 | 0.1d |
| D5 | mini-bars サイズ調整 | 判断保留 | 🟢 | 0.05d |
| D6 | ki-badge Drive URL 化 | 判断保留 | 🟡 | 0.15d |
| D7 | period-range + reflected | 差分なし | — | — |
| D8 | 初期スクロール最右端 | **採用** | 🔴 | 0.05d |
| D9 | scroll-hint テキスト | 判断保留 | 🟢 | 0.05d |
| D10 | zantei 専用スタイル | 採用 | 🔴 | 0.15d |

**auto の推奨**: D2 + D4 + D8 + D10 の 4 件を**必須対応**（総計 0.5d）、他は東海林さんの判断で追加。

**全採用時の総工数**: 0.95d（本 spec 見積 0.75d を少し超える）。現実的な落とし所は**必須 4 件 + D6（0.65d）**程度。

---

## 13. 実装着手時の推奨フロー

1. **東海林さんと差分採否を合意**（D1-D10 のレビュー）
2. **採用差分を 1 PR にまとめる**（個別 PR にすると review 負荷大）
3. **§10 のテスト観点を全件実施**
4. **effort-tracking.md** に D1-D10 の合意結果と工数実績を記入

— end of T-F9-01 spec —
