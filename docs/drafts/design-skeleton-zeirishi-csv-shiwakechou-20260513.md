# 設計骨子 — 仕訳帳：税理士送付用データ加工（Bud 移植）

> 起草: a-main-026（2026-05-13(水) 16:18 JST、東海林さん指示「15 分以内」厳守）
> 用途: ヒュアラン決算用、今日中に税理士送付可能な弥生形式 CSV を出力する最短実装計画
> 大原則: **動くデータ最優先 / リファクタリング NG / 移植より接続優先**

---

## §0 大原則（東海林さん明示、絶対遵守）

| # | 原則 | 適用 |
|---|---|---|
| 1 | **ヒュアラン決算最優先** | 6 法人中 ヒュアラン 法人 (`hyuaran`) の 4 月分仕訳出力を Day-1 完成 |
| 2 | **動くデータ最優先** | UI 美化 / 命名整理 / アーキ改善は **後回し**、まず CSV download 動作確定 |
| 3 | **リファクタリング NG** | 既存 yayoi-csv-exporter / classifier / parsers 一切触らず、上から呼び出すだけ |
| 4 | **移植より接続** | Bud /shiwakechou への正式移植は **5/17 以降**、本日は Forest 既存 UI に export ボタン追加で完走 |

---

## §1 既存実装マップ（5/13 時点 grep 確定）

### 1.1 弥生 export ライブラリ（既実装、本日使用するキーパーツ）

| ファイル | 行数 | 役割 |
|---|---|---|
| **`src/shared/_lib/bank-csv-parsers/yayoi-csv-exporter.ts`** | — | **弥生形式 CSV 生成本体（Shift-JIS + CRLF 対応）** |
| `src/shared/_lib/bank-csv-parsers/types.ts` | — | export 型定義 |
| `src/shared/_lib/bank-csv-parsers/__tests__/yayoi-csv-exporter.test.ts` | — | テスト済 |
| `src/lib/shiwakechou/parsers/yayoi/yayoi-import.ts` | — | 弥生 import parser（補助、export には不要） |
| `src/lib/shiwakechou/classifier.ts` | 11.1K | 仕訳分類ロジック（上流、export 前段階） |
| `src/lib/shiwakechou/csv-utils.ts` | 3.4K | CSV 共通処理 |

### 1.2 Forest 仕訳帳 UI（本番稼働中、本日使用）

| ファイル | 行数 | 役割 | export ボタン |
|---|---|---|---|
| `src/app/forest/shiwakechou/page.tsx` | 6.3K | 6 法人カード一覧 | なし |
| `src/app/forest/shiwakechou/[corp_id]/page.tsx` | 13.2K | 法人ダッシュボード | **要追加** |
| `src/app/forest/shiwakechou/[corp_id]/review/page.tsx` | 14.4K | 取引確認画面（status 別フィルタ + 整合性検証） | **要追加（最有力配置先）** |
| `src/app/forest/shiwakechou/balance-overview/page.tsx` | — | Q4 全法人横断 | なし |

### 1.3 Bud 仕訳帳 UI（alpha skeleton、本日触らず）

| ファイル | 行数 | 状態 |
|---|---|---|
| `src/app/bud/shiwakechou/page.tsx` | 3.1K | mock 10 件、export ボタン **disabled** |
| `src/app/bud/shiwakechou/_lib/mock-journal-data.ts` | 8.4K | mock data |

→ **本日は触らない**（Forest README.md に「5/17 以降に Bud 移行」明記、東海林さんも「Bud 移植」と言ったが「動くデータ最優先」を踏まえて Forest 側で完成 → 後日移植が現実解）

### 1.4 関連 DB（5/13 大手術後の本番状態）

| テーブル | 行数 | 用途 |
|---|---|---|
| `bud_corporations` | 6 | 6 法人マスタ（hyuaran 含む） |
| `bud_transactions` | 4 月分実 data | 取引明細（status 付与済、確認済 = 弥生 export 対象） |
| `bud_master_rules` | 714 + memo 列 | 仕訳判定マスタ（PR #175 で memo 列正式化済） |
| `bud_yayoi_exports` | 0 | export 履歴（**本日初回 INSERT 予定**） |

---

## §2 Path A — 最短実装（**今日中、Day-1 = ヒュアラン決算 CSV 出力**）

### 2.1 Path A の全体像（90 分目標）

```
Forest review page
    │
    ├─ [既存] status=ok の取引一覧表示
    ├─ [既存] 整合性検証メータ
    └─ [新規] 「📤 弥生 CSV export」ボタン
                    ↓
            handleExport()
                    ↓
            ┌──── 1. Supabase fetch: bud_transactions WHERE corp_id=X AND status='ok' AND month='2026-04'
            ├──── 2. classifier.ts で仕訳化（debit/credit/科目）→ JournalEntry[]
            ├──── 3. yayoi-csv-exporter.ts で Shift-JIS CSV 生成
            ├──── 4. Blob URL → <a download="hyuaran_2026-04_弥生.csv"> click
            └──── 5. bud_yayoi_exports に INSERT（履歴、optional 後回し可）
```

### 2.2 Path A 実装ステップ（4 段階、想定 90 分）

#### Step 1: API endpoint 新規追加（30 分）
- ファイル: `src/app/api/forest/shiwakechou/export/route.ts`（新規）
- input: `corp_id` + `month` (YYYY-MM, default 2026-04)
- 処理:
  1. 認証チェック（既存 review 画面と同じ pattern）
  2. `bud_transactions` から status='ok' の行を fetch
  3. `classifier.ts` で仕訳化
  4. `yayoi-csv-exporter.ts` で CSV string 生成（Shift-JIS）
  5. response: `Content-Type: text/csv; charset=Shift_JIS` + `Content-Disposition: attachment; filename="..."`
- **既存 lib 一切触らず、上から呼ぶだけ**

#### Step 2: Forest review page に export ボタン追加（20 分）
- ファイル: `src/app/forest/shiwakechou/[corp_id]/review/page.tsx`（既存編集）
- 追加箇所: header に `<button onClick={handleExport}>📤 弥生 CSV export</button>`
- handler: `fetch(/api/forest/shiwakechou/export?corp_id=...)` → blob → download
- **既存 14.4K の core ロジック触らず、ボタン + handler 追加のみ**

#### Step 3: ヒュアラン 4 月分で動作確認（30 分）
- Forest UI で hyuaran 法人選択 → review 画面 → export click
- ダウンロードされた CSV を弥生会計で import 試行（東海林さん側）
- 文字化け / 形式エラーがあれば yayoi-csv-exporter.test.ts を確認 + 微調整
- ✅ ヒュアラン 4 月分 CSV が **税理士に送付可能な状態**で出力されたら Day-1 完了

#### Step 4: 残り 5 法人で同操作（10 分）
- centerrise / linksupport / arata / taiyou / ichi で同じ手順
- 全 6 法人 CSV 揃い → 税理士に一括送付可能
- ✅ Day-1 完走

### 2.3 Path A の依存関係 + リスク

| 項目 | 状態 |
|---|---|
| `bud_transactions` 4 月分データ存在 | ✅ 5/13 仕訳帳本番運用ゲート解放後に投入予定（後道さん UI 確認と連動） |
| `bud_master_rules` 714 件 + memo | ✅ 5/13 本番 apply 済（PR #175 完走） |
| classifier.ts 動作 | ✅ TDD 27 ケース緑（5/12 commit aabc530） |
| yayoi-csv-exporter.ts 動作 | ✅ test 通過済（PR #161 merged） |
| 認証 | ✅ Forest 親レイアウト（admin / executive） |
| **Path A 全体の阻害要因** | **無し**（実装すれば動く） |

---

## §3 Path B — Bud 正式移植（**5/17 以降、本日着手禁止**）

### 3.1 Path B の趣旨
- Forest 配下にある仕訳帳 UI を Bud 配下に正式移管（経理スコープの本来配置）
- README.md で「Forest コアパッケージへの依存禁止 — Bud 移行時の機械的移植を保証」と既に設計済 = 移植は機械的に可能

### 3.2 Path B 実装ステップ（後日、想定 1d）
1. `src/app/forest/shiwakechou/*` を `src/app/bud/shiwakechou/*` にコピー
2. import path を `@/app/forest/...` → `@/app/bud/...` に置換
3. 認証を `forest_users.role IN ('admin', 'executive')` → `bud_users.role` に切替（spec 通り）
4. Forest 側を redirect or legacy 保持（memory `feedback_no_delete_keep_legacy.md` 準拠）
5. Bud /shiwakechou/page.tsx の mock 10 件 表示を実 data に切替

### 3.3 Path B 着手判断
- **トリガー**: ヒュアラン決算 + 6 法人税理士送付完了 (Path A 完走)
- **担当**: a-bud-002 / a-forest-002 連携（dispatch 別途、# 351+）
- **本日は触らない**

---

## §4 担当 + 並列化（Path A）

| Step | 担当候補 | 並列可否 |
|---|---|---|
| Step 1 API endpoint | **a-forest-002**（Forest 既実装把握済、最有力） | — |
| Step 2 review page ボタン | a-forest-002（連動） | Step 1 完了後 |
| Step 3 ヒュアラン動作確認 | **東海林さん主導、私補佐**（弥生 import の実物確認は東海林さんしかできない） | Step 2 完了後 |
| Step 4 残り 5 法人 | a-forest-002 + 東海林さん | Step 3 OK 後 |

**a-main-026 の役割**: Step 1-4 の進捗統制 + Path B トリガー判断 + 障害時の即停止 → 東海林さん報告

---

## §5 注意点（地雷予防）

1. **Shift-JIS encoding**: 弥生は Shift-JIS 必須、UTF-8 の BOM 入りで文字化け。yayoi-csv-exporter は対応済 = **既存 lib 触らない**
2. **CRLF 改行**: 弥生は \r\n 必須。同上 = lib 任せ
3. **金額の正負**: 借方 / 貸方の符号付与、classifier.ts に既ロジック有 = 触らない
4. **法人別ファイル分割**: 1 法人 1 CSV（hyuaran_2026-04.csv 等）、税理士送付時の整理性
5. **本番 DB への INSERT 副作用**: bud_yayoi_exports への履歴 INSERT は **optional**。動作確認優先で履歴記録は後回し可
6. **Path A → Path B 移行時の URL**: `/forest/shiwakechou/...` → `/bud/shiwakechou/...` で東海林さんが混乱しないよう、Forest 側は legacy redirect 残す

---

## §6 完了条件 + 次の dispatch

### 完了条件（Path A Day-1）
- ✅ ヒュアラン 4 月分 CSV download 可能
- ✅ ダウンロードされた CSV を弥生会計で import 成功
- ✅ 残り 5 法人も同様に CSV 出力可能
- ✅ 税理士に 6 法人分一括送付完了

### 次の dispatch（Path A 着手用）
- **dispatch # 351** = a-forest-002 へ Path A Step 1-4 実装依頼
- 緊急度: **🔴**（ヒュアラン決算最優先）
- 想定所要: 90 分（4 step 並列なし、sequential）

### dispatch # 351 ラフ骨子（writer 清書用）
- 件名: `feat(forest): 仕訳帳 弥生 CSV export 機能追加（ヒュアラン決算最優先、dispatch # 351）`
- 投下先: a-forest-002
- 緊急度: 🔴
- 内容: 本設計骨子 §2 Path A の Step 1-4 実装
- 制約: 既存 yayoi-csv-exporter / classifier / Forest review page core ロジック 一切触らず（リファクタ NG）
- 完了条件: 本書 §6 完了条件の 4 項目全 ✅

---

## §7 a-main-026 → 東海林さんへの即決依頼（2 択）

| 順 | アクション | 推奨 |
|---|---|---|
| **A ★** | 本骨子採択 + dispatch # 351 ラフ起草 GO（私が即起草、a-writer-001 経由 a-forest-002 投下） | ★ ヒュアラン決算最優先、即着手 |
| B | 骨子に修正・追加要望（Path B 順序変更 / 担当変更 / その他） | — |

**A 採択なら**: 私が dispatch # 351 ラフを 5 分以内に書出 → writer 清書依頼短文を東海林さんに渡す → 東海林さんが a-writer / a-forest-002 に投下 → 90 分後に動くヒュアラン CSV。

---

EOF
