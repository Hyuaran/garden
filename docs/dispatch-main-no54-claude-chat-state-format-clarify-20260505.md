# main- No. 54 dispatch - claude.ai 作業日報セッションへ state.txt フォーマット正確化依頼 - 2026-05-05

> 起草: a-main-012
> 用途: a-root が state.txt → Root 取り込みを実装する際、モジュール属性抽出が確実に動くように state.txt フォーマット仕様を正確化
> 番号: main- No. 54
> 起草時刻: 2026-05-05(火) 19:00
> 緊急度: 🟡 5/7 夜までに（a-root の Phase 1a 実装と並行）

---

## 投下用短文（東海林さんが claude.ai 作業日報セッションにコピペ）

~~~
🟡 main- No. 54
【a-main-012 から claude.ai 作業日報セッションへの 依頼（state.txt フォーマット正確化）】
発信日時: 2026-05-05(火) 19:00

Garden Bloom 開発進捗ページの実データ化（Phase 1a〜2）を進めています。a-root が state.txt → Root 取り込みスクリプトを実装する際、**モジュール属性の抽出ルール明確化**が必要なため、claude.ai 作業日報セッションでの記述ルール正確化を依頼します。

【背景】

state.txt の work_logs[] / tomorrow_plans[] 等は、現状以下のような自然文形式:

```
"Garden Tree：架電アプリ確定事項10件を反映..."
"Garden Forest(進行期データ)：画面で編集できる機能完成..."
"Claude作業環境：複数セッション間で情報が引き継がれる仕組みを整備"
```

a-root の取り込みスクリプトは、これらから **module 属性**（'Tree' / 'Forest' / 'Bloom' / ...）を正規表現で抽出して、root_daily_report_logs.module 列に格納します。

【依頼内容: 記述ルール正確化】

# 1: 標準フォーマット（推奨）

work_logs / tomorrow_plans / carryover / planned_for_today に追記する文字列は、以下のいずれかのフォーマットを **厳守**:

| パターン | 例 | 抽出される module |
|---|---|---|
| `Garden <Module>：<内容>` | `Garden Tree：架電アプリ完成` | `Tree` |
| `Garden <Module>(<補足>)：<内容>` | `Garden Forest(進行期データ)：画面完成` | `Forest`（補足は content 側に含む）|
| `<横断系>：<内容>` | `Claude作業環境：連携整備` | `null`（モジュール属性なし、横断扱い）|

→ **`Garden 〇〇：` で始まらないエントリは module 属性なし**として扱う。

# 2: 12 module 名の正規化

state.txt 内で使う module 名は、以下 12 種に **統一**:

| 正式名 | 和名 | 別表記禁止 |
|---|---|---|
| Bloom | 花 | bloom（小文字） NG |
| Forest | 森 | |
| Tree | 木 | |
| Bud | 蕾 | |
| Leaf | 葉 | |
| Root | 根 | |
| Rill | 川 | |
| Soil | 土 | |
| Sprout | 新芽 | |
| Calendar | 暦 | |
| Fruit | 実 | |
| Seed | 種 | |

→ 「Garden tree：...」（小文字） や 「Garden 木：...」（和名） は **不可**。

# 3: 区切り文字（既知のルールを明文化）

memory `project_claude_chat_drive_connector.md` § 7-B の表記ルールを再確認:

| 要素 | 区切り |
|---|---|
| Garden と モジュール名 | **半角スペース**（`Garden Tree`、`Garden Forest`）|
| エントリ内 区切り | **全角コロン「：」** |
| JSON キー部分 | **半角コロン「:」** |

→ 既存ルール踏襲、変更不要。

# 4: 過去エントリの扱い（既存 state.txt は触らない）

現状 state.txt の work_logs[] には既に多数のエントリ（4/16〜累積）。これらは `Garden 〇〇：` 形式に **概ね準拠**しているので、claude.ai 側で過去エントリを書き換える必要なし。

→ a-root の取り込みスクリプトは「マッチしないエントリは module=null で挿入」で対応するため、過去データは触らず、今後の追記分から本ルール厳守で OK。

# 5: 特記事項フィールドの扱い

v29 HTML には「特記事項」セクションあり、現状 state.txt にはフィールドなし。

選択肢:
- A: state.txt に新規フィールド `special_notes: []` を追加（5/8 以降で順次）
- B: work_logs に `特記事項：内容` 形式で混入させる（module=null で抽出される）
- C: 5/8 デモまで特記事項は空欄で見せ、Phase 2 で対応

→ どの方式が claude.ai の運用フローと合いやすいか、claude.ai 側で判断 + 回答ください。

【完了報告フォーマット】

claude.ai 作業日報セッションが対応完了したら report- No. NN で:
- 上記 1〜4 ルールの確認 + 同意 / 別案
- 5 特記事項フィールドの扱い（A/B/C 選択）
- claude.ai 側 system prompt or memory への明文化 結果（任意）
- 完了時刻

【dispatch counter】

a-main-012: 次 main- No. 55
claude.ai 作業日報セッション: report- No. NN

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 19:00 初版（a-main-012、Phase 1a で a-root 取り込みスクリプト実装と並行）
