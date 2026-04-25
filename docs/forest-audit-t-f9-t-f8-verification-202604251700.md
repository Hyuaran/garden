# Forest T-F9 / T-F8 差分監査検証レポート

- 作成日時: 2026-04-25 17:00
- 担当: a-forest（イレギュラー自律実行モード）
- 対象 PR: 本ファイル含む `feature/forest-t-f9-t-f8-audit` ブランチ
- 元 spec:
  - `docs/specs/2026-04-24-forest-t-f9-01-microgrid-diff-audit.md`
  - `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md` §4.8 (T-F8), §4.9 (T-F9)
- 性質: **コード読み取りによる検証のみ**。実装は spec §13 推奨フロー（東海林さん採否合意先行）に従い未着手。

---

## 1. T-F9 (MicroGrid 差分監査) 検証結果

a-auto が `2026-04-24-forest-t-f9-01-microgrid-diff-audit.md` で提示した 10 点差分を、現行 `src/app/forest/_components/MicroGrid.tsx` (develop tip 時点) と照合した結果。

### 検証一覧

| D# | 差分内容 | spec 主張 | 実コード確認結果 | 検証 |
|---|---|---|---|---|
| D1 | scroll-sync 上下バー同期 | TSX に同期実装なし | L85 と L121 にそれぞれ独立した `overflowX: "auto"` 領域、sync なし | ✅ 一致 |
| D2 | sticky col-company 左列固定 | 通常の `<td>`、sticky 指定なし | L152-161 法人名 `<td>` に `position: sticky` なし | ✅ 一致 |
| D3 | group-summary 別 table 化 | div/flex レイアウト | L76-109 `<div style={{ display: "flex" }}>`、`<table>` 不使用 | ✅ 一致 |
| D4 | 進行期 glow animation | static background のみ、animation なし | L213-219 `background: rgba(184,134,11,0.06)`、`border: 1px solid rgba(184,134,11,0.2)`、`animation` プロパティ無し | ✅ 一致 |
| D5 | mini-bars サイズ | TSX width 4px / factor 40 | L258-268 `width: 4` / `Math.sqrt(...) * 40` | ✅ 一致 |
| D6 | ki-badge Drive URL リンク化 | static div、Drive link なし | L222-235 `<div>` 要素、`<a href>` 不使用 | ✅ 一致 |
| D7 | period-range + reflected | 差分なし | L273-282 `${from}~${to}` + 進行期時の `<br>{reflected}` 実装あり | ✅ 一致 |
| D8 | 初期スクロール最右端 | 実装なし | useEffect / ref / scrollLeft 操作なし、初期は最左端 | ✅ 一致 |
| D9 | scroll-hint テキスト | テキストなし | 「← 過去 ... 未来 →」の表示なし | ✅ 一致 |
| D10 | zantei 専用スタイル | zantei 値は保持されるが UI に未反映 | L198 で `zantei: isSK ? sk!.zantei : false` を CellData に格納するも、L201 以降のスタイル分岐で zantei は未使用 | ✅ 一致 |

**結論**: spec の audit 内容は **全 10 点とも実コードと完全一致**。spec 作成（2026-04-24）から本検証時点（2026-04-25）まで MicroGrid.tsx に変更なし（最終編集は Phase A1 から）。

### auto 推奨の優先度確認

| D# | spec 推奨 | a-forest 検証コメント |
|---|---|---|
| D2 sticky col | 🔴 採用 | 妥当。年度数が増えると法人名が見えなくなるリスクは現実的（現在 ~5 年、将来 10 年超で問題化） |
| D4 glow | 🟡 採用 | 妥当。進行期セルの視認性向上、CSS 1 か所追加で済む低コスト |
| D8 initial scroll right | 🔴 採用 | 妥当。最新年度を見たいユーザーが大半、初期左端は冗長 |
| D10 zantei style | 🔴 採用 | 妥当。`zantei` プロパティは既に CellData に存在し UI のみ抜けている状態 |
| D6 ki-badge Drive | 🟡 判断保留 | **東海林さんの実運用観察必須**。v9 ユーザーの操作習慣次第 |
| D1 scroll sync, D5 mini-bar size, D9 scroll-hint | 🟢 判断保留 | UX 微調整、業務的優先度低 |

### 実装時の所要工数再見積（a-forest 視点）

spec §12 の見積（D2+D4+D8+D10 = 0.5d）は概ね妥当だが、**TDD 適用込みで +0.2d**（テスト整備）を見込むべき：

| D# | spec 見積 | TDD 込み再見積 | テスト方針 |
|---|---|---|---|
| D2 sticky | 0.2d | 0.25d | スタイル属性 (position: sticky) の存在検査 + 法人名要素のスナップショット |
| D4 glow | 0.1d | 0.1d | className 適用検査（globals.css は単体テスト対象外） |
| D8 initial scroll right | 0.05d | 0.1d | render 後の `scrollLeft === scrollWidth` を waitFor で確認 |
| D10 zantei style | 0.15d | 0.2d | zantei=true の CellData で metric が灰色化、mini-bar 透明度 0.35 を attribute 検査 |
| **合計** | 0.5d | **0.65d** | |

---

## 2. T-F8 (MacroChart 差分監査) 検証結果

T-F8-01 は comparison §4.8 において「auto 可、差分抽出のみ」分類。本検証では `src/app/forest/_components/MacroChart.tsx` (PR #43 マージ後) を v9 比で点検。

### v9 vs TSX 比較

| 項目 | v9 期待値 | TSX 現状 | 検証 |
|---|---|---|---|
| タイトル | 「グループ全体の合算利益推移 ～ 森の視界 ～」 | 同一文言（PR #43 で T-F3-F8 として修正済） | ✅ 一致 |
| stacked line | yes | `scales.y.stacked: true`, `scales.x.stacked: true` | ✅ 一致 |
| tension | 0.35 | 0.35 | ✅ 一致 |
| fill | true | true | ✅ 一致 |
| pointRadius | 3 | 3 | ✅ 一致 |
| pointHoverRadius | 6 | 6 | ✅ 一致 |
| borderWidth | 1.5 | 1.5 | ✅ 一致 |
| backgroundColor | `${color}cc` (アルファ付き) | `c.color + "cc"` | ✅ 一致 |
| 年度ラベル | `{y}年度` | `years.map((y) => \`${y}年度\`)` | ✅ 一致 |
| Legend position | bottom | `legend.position: "bottom"` | ✅ 一致 |
| Legend pointStyle | circle | `usePointStyle: true, pointStyle: "circle"` | ✅ 一致 |
| Tooltip footer 合計 | グループ合計表示 | `footer: (items) => "グループ合計: " + fmtYen(total)` | ✅ 一致 |
| Y 軸 tick fmt | 短縮表示 | `callback: (v) => fmtYenShort(v)` | ✅ 一致 |
| chart 高さ | 360px | **320px** ⚠️ | 差分あり（spec T-F3-F8 判3 で判断保留扱い） |

### 結論

- 13 項目中 **12 項目一致**
- 残 1 項目（高さ 320 vs 360）は spec T-F3-F8 §12 判3 で**判断保留**として明示的に未変更扱い
- T-F8 自体は **対応不要**（実装は v9 と十分整合）

### 実装時の追加工数

- 高さ変更（東海林さん採用判断時）: **0.05d**（数値 320 → 360 の 1 行修正 + 視認テスト）

---

## 3. 統合所感

### a-forest からの提案

1. **本ブランチで生成する PR (T-F9/T-F8 audit verification)** はドキュメント追加のみ。マージ後、東海林さんが採否合意したら別 PR で MicroGrid 修正を実施。
2. **D2/D4/D8/D10 を採用するシナリオ** であれば、`feature/forest-t-f9-implementation` を新規作成し、TDD で 4 件まとめて実装可能（0.65d）。
3. T-F8 (高さ調整) は単独では PR として小さすぎるため、上記 D2/D4/D8/D10 PR に同梱する形を推奨。

### 残タスク（自律モード対象外）

判断保留項目のため、本セッションでは着手せず：
- D2/D4/D8/D10 の TDD 実装（東海林さん採否合意後）
- D5/D6/D9 の採否決定（東海林さん運用観察後）
- D1 (scroll sync) の優先度判断
- T-F8 高さ 360 への変更（T-F3-F8 判3 解消後）

### 着手禁止項目（自律モード規定で明示）

- T-F5 (Storage 統合戦略)
- T-F6 (ZIP 設計判断含む)
- 既存 fiscal_periods / shinkouki の編集（PR #54 merge 済 → updated_at は dev 適用済）

---

## 4. 検証メソドロジー

1. `git checkout develop && git pull origin develop`（最新 develop 取得、e4619c7）
2. `feature/forest-t-f9-t-f8-audit` ブランチ作成
3. `docs/specs/2026-04-24-forest-t-f9-01-microgrid-diff-audit.md` 全文読込
4. `src/app/forest/_components/MicroGrid.tsx` 全文読込（300 行）
5. spec の 10 点差分を 1 件ずつ実コードの該当行と照合
6. T-F8 は comparison §4.8 を基に MacroChart.tsx の各設定値を検証
7. 結果を表形式でレポート化
8. 工数再見積を TDD 込みで実施

### 利用したツール

- 静的コード読込（Read tool）
- 別途実装・編集なし（純検証）
- テスト実行なし（コード変更なし＝既存 157/157 のまま）

---

## 5. 関連ドキュメント

- `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md` §4.8, §4.9
- `docs/specs/2026-04-24-forest-t-f9-01-microgrid-diff-audit.md`
- `docs/specs/2026-04-24-forest-t-f3-f8-summary-macro-polish.md` (T-F8 高さ判3)
- `src/app/forest/_components/MicroGrid.tsx` (検証対象)
- `src/app/forest/_components/MacroChart.tsx` (検証対象)

— end of T-F9 / T-F8 audit verification —
