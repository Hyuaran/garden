# proposal: 違反 10（tab-2/3 構造崩壊事故）再発防止策 5 件 統合改訂案

> 起草: a-analysis-001
> 起草日時: 2026-05-11 (月) 11:50
> 用途: audit-001- No. 11 提案 1-5 統合改訂案（提案 6 は a-audit 担当、本ドラフト対象外）
> 起点: main- No. 234（audit-001- No. 11 critique 全件採用 GO 受領後）
> 状態: ドラフト、main + a-audit-001 critique + 東海林さん最終決裁後に main が memory + governance ファイル反映

---

## 配分判断（a-analysis 最適選択）

main- No. 234 §2 で「既存 memory 改訂 vs sentinel # N 新設」等の選択肢が複数提示された提案について、a-analysis として以下の配分を採択:

| # | 提案 | 配分選択 | 理由 |
|---|---|---|---|
| 1 | visual_check 強化 | **既存 memory feedback_self_visual_check_with_chrome_mcp 改訂** | sentinel # 7 新設は肥大化、既存 memory に「review 受領時の独立検証要件」追加が論理的 |
| 2 | 既存実装把握 v3 | memory feedback_check_existing_impl_before_discussion v2 → v3 | main 提示通り、4 トリガー化 |
| 3 | review 過信 | **memory feedback_my_weak_areas # 10 新規追加** | sentinel は 6 項目までで肥大化、不得意分野リスト追加が概念的に明確 + 既存構造活用 |
| 4 | template first ルール | 新規 memory feedback_template_first_then_claude_ai_request | main 提示通り、新規ファイル化 |
| 5 | governance §2 改訂 | governance-rules-v1-20260509.md §2 a-review 行拡張 | main 提示通り |

提案 6（audit-html-css-consistency.py 実装）は a-audit 担当、本ドラフト対象外（自己参照禁止 §7-1 抵触のため、a-audit 自身に main- No. 後続候補で起動指示）。

---

## 提案 1 改訂案: feedback_self_visual_check_with_chrome_mcp 改訂

### 対象

既存 memory `feedback_self_visual_check_with_chrome_mcp.md`

### 改訂方針

既存「§ 5 NG パターン」「§ 6 OK パターン」セクションの後に **新規 § 6.5「review 受領時の独立検証要件」** を挿入。frontmatter name / description / 改訂履歴も更新。

### 改訂版 frontmatter

- name: 視覚確認は Chrome MCP で Claude 自身が実施 / 東海林さんへの文字判断仰ぎ禁止 + review 受領時 main 独立検証義務（v2、2026-05-11 拡張）
- description: localhost や public URL の視覚一致判定（プロト vs 既存等の客観差分）は Claude が Chrome MCP で自分でスクショ取得 → 比較 → 判定。東海林さんへの視覚確認丸投げ + 文字差分一覧での判断仰ぎ は両方禁止。実物提示 + 最終 OK のみ東海林さん。**v2 追加: review judgment が「構造比較で完結」「self-prep 略」等を含む場合、main 側で実描画確認の追加要求 or main 自身が Chrome MCP で 1 件以上独立検証**。違反 10（tab-2/3 構造崩壊事故）再発防止。

### 新規挿入セクション（既存 § 6 OK パターン の後、§ 7 実装フローの前）

```
## 6.5. review 受領時の独立検証要件（v2、2026-05-11 違反 10 起源、最重要）

a-review からの視覚評価 review（review-NN）を受領した時、以下の場合は main 側で独立検証必須:

| review judgment 文言 | 不通過時の動作 |
|---|---|
| 「構造比較で完結」「実描画確認略」等を含む | main 側で実描画確認の追加要求 dispatch（review に明示依頼）|
| 「self-prep 完了、構造ベース判定」のみ | main 自身が Chrome MCP で 1 件以上独立検証（採用判定前）|
| 実描画スクショ未添付 | main 側で実描画スクショ追加要求。**検出条件具体パターン**: review 内に画像 / スクショ参照（`![...](...png)` / `file://` / `http://` URL）なし、Chrome MCP 起動言及（`mcp__Claude_in_Chrome__*` / preview tool 起動）なし、視覚比較関連の文言なし、のいずれか該当時（v1.1、2026-05-11 audit-001- No. 13 改善 1 起源）|

### Why（v2 追加分）

- 5/11 違反 10: tab-2/3 構造崩壊事故、review-11 採用判定で main が独立検証なし → 共通 CSS 不整合見落とし
- review は信頼関係の前提でも、最終承認は main 独立検証付きで二重チェック
- review self-prep が「構造比較で完結」表記時、実描画は未確認 = main 補完責任

### 独立検証の最小手順

1. Chrome MCP で対象 URL スクショ取得（review 対象画面）
2. 比較対象（既存稼働 HTML / プロト等）も同様にスクショ取得
3. 視覚比較 → 構造崩壊 / 桁削れ / レイアウト不一致 等の検出
4. 差分あり → review に再確認依頼 or main 修正 dispatch 起草
5. 差分なし → 採用判定可、東海林さん最終 OK 依頼
```

### 改訂履歴追加行

- 2026-05-11 11:50 v2（a-analysis-001、audit-001- No. 11 提案 1 起源、main- No. 234 GO）: review 受領時 main 独立検証義務追加（§ 6.5 新設）、違反 10 再発防止

### 自己参照禁止 抵触検証

- 全 session 共通 memory 改訂 = a-analysis 自身の運用変更ではない（抵触なし）
- 当事者性: a-analysis 自身も review 受領時の独立検証義務適用対象（機能本旨内）

---

## 提案 2 改訂案: feedback_check_existing_impl_before_discussion v2 → v3

### 対象

既存 memory `feedback_check_existing_impl_before_discussion.md`

### 改訂方針

トリガー数を v2 の 3 件（議論前 / 修正前 / 外部依頼前）から v3 の **4 件**（HTML/CSS 修正前 追加）に拡張。frontmatter / How to apply / NG パターン / 改訂履歴を更新。

### 改訂版 frontmatter

- name: 議論前 / 修正前 / 外部依頼前 / HTML・CSS 修正前 に既存実装を必ず確認（v3、4 トリガー拡張版）
- description: 既存実装把握ルールを v2「議論前 / 修正前 / 外部依頼前」3 トリガーから v3「+ HTML・CSS 修正前」4 トリガーに拡張。016 期 違反 # 5 + 5/11 違反 10（tab-2/3 構造崩壊事故、共通 CSS 不整合見落とし）再発防止。

### ルール表（改訂版）

| トリガー | 確認手順 | 例 |
|---|---|---|
| 1. 議論前（v1 既往）| `src/app/<module>/` ディレクトリ + spec 確認 | Tree のアラート設計議論前 |
| 2. 修正前（v2 既往）| 対象ファイル grep + Read + git log -10 + 関連 import 追跡 | bgLayer1+2 構造修正前 |
| 3. 外部依頼前（v2 既往）| 該当領域の既存実装把握 + 仕様乖離リスク事前把握 | claude.ai に HTML 起草依頼前 |
| 4. **HTML・CSS 修正前（v3 新規、2026-05-11 違反 10 起源）**| **既存稼働 HTML の class 構造 + 参照 CSS を grep + Read で確認、共通 CSS 整合性検証** | tab-2 / tab-3 HTML 修正前、既存共通 CSS（forest-common.css 等）との class 構造整合確認 |

### How to apply 新規セクション（トリガー 4）

```
### トリガー 4: HTML・CSS 修正前（v3、2026-05-11 違反 10 起源、最重要）

HTML 起草 / 修正 / claude.ai 依頼前に：

1. 既存稼働 HTML の class 構造を全把握（grep + Read）
2. 参照されている CSS（共通 CSS / モジュール固有 CSS）を全把握
3. 新規 HTML の class 構造が既存 CSS と整合するか事前検証
4. 不整合検出時、CSS 側の追加 or HTML 側の class 修正で整合確保

bash（汎用化テンプレ + Forest 例併記、v1.1、2026-05-11 audit-001- No. 13 改善 2 起源）:

汎用化テンプレ（<module> / <module-prefix> を実モジュール名・class prefix に置換）:
- grep -rn 'class=' src/<module>/ui_drafts/<module-name>_v<N>.html
- grep -rn '<module-prefix>' src/<module>/ui_drafts/_assets/<module>-common.css

例: Forest（gf-* prefix）
- grep -rn 'class=' src/garden-forest/ui_drafts/garden-forest_v9.html
- grep -rn 'gf-summary' src/garden-forest/ui_drafts/_assets/garden-forest-common.css

例: Bloom（bloom-* prefix）
- grep -rn 'class=' src/garden-bloom/ui_drafts/garden-bloom_vN.html
- grep -rn 'bloom-' src/garden-bloom/ui_drafts/_assets/garden-bloom-common.css

例: Bud（pl-* / pay-bn-* / inv-rcv-* prefix）
- grep -rn 'class=' src/garden-bud/ui_drafts/garden-bud_vN.html
- grep -rn 'pl-\|pay-bn-\|inv-rcv-' src/garden-bud/ui_drafts/_assets/garden-bud-common.css
```

### NG パターン追加

❌ 新規 tab-2 HTML 起草、既存共通 CSS の class 命名規則未確認 → 構造崩壊
✅ 既存共通 CSS の class 命名規則（gf-summary-* / gf-tax-* 等）を grep 確認 → 新規 HTML で踏襲

### 改訂履歴追加行

- 2026-05-11 11:50 v3（a-analysis-001、audit-001- No. 11 提案 2 起源、main- No. 234 GO）: HTML・CSS 修正前トリガー追加（4 トリガー化）、違反 10 再発防止

### 自己参照禁止 抵触検証

- 全 session 共通 memory 改訂 = 抵触なし
- 当事者性: a-analysis 自身も HTML/CSS 修正前トリガー適用対象（機能本旨内）

---

## 提案 3 改訂案: feedback_my_weak_areas # 10 新規追加（review 過信）

### 対象

既存 memory `feedback_my_weak_areas.md`

### 改訂方針

「不得意分野リスト」表に # 10 「review 過信」を新規追加。description / 改訂履歴を更新。

### 不得意分野リスト 改訂版（# 10 追加）

| # | 不得意分野 | 別経路 |
|---|---|---|
| 1 | 画像 → text 化 | claude.ai 直接添付 |
| 2 | UI 視覚評価の自己判定 | preview tool + a-review 兼任 |
| 3 | ファイルパスの曖昧記述癖 | dispatch テンプレで添付パス必須欄 |
| 4 | デザイン感性判断 | 東海林さん専管 |
| 5 | 長文応答の冗長化 | 表形式 + 短文徹底 |
| 6 | 3 択提示の乱用 | 2 択標準 |
| 7 | 自己評価の甘さ | 厳しい目で再確認 3 ラウンド + 東海林さん追記欄 |
| 8 | 既存実装把握漏れ | 議論前 / 修正前 / 外部依頼前 / HTML・CSS 修正前 の grep + Read 必須（v3）|
| 9 | memory が機能しているか自己検証 | handoff 引越し時の memory 棚卸し |
| 10 | **review 過信（review 評価を独立検証なく採用してしまう癖）**（v2、2026-05-11 違反 10 起源） | **review 評価受領時、main 側で 1 件以上の独立検証実施（feedback_self_visual_check_with_chrome_mcp § 6.5 連動）。review = 信頼関係の前提でも、最終承認は main 独立検証付き** |

### Why 追加（# 10 起源）

- 5/11 違反 10: review-11 採用判定で main が独立検証なし → tab-2/3 構造崩壊事故 + 共通 CSS 不整合見落とし
- review = a-review 兼任セッションが提供する評価、信頼するが盲信は禁物
- 「自己評価の甘さ # 7」とは別軸、「他者評価の過信」として独立カテゴリ化

### 改訂版 frontmatter description

- description: Claude Code が不得意な作業（画像 → text 化 / 視覚評価の自己判定 / パス曖昧記述 / **review 過信** 等）を自覚し、別経路（claude.ai / a-review / 東海林さん / main 独立検証）に自動的に振る原則確立。

### 改訂履歴追加行

- 2026-05-11 11:50 v2（a-analysis-001、audit-001- No. 11 提案 3 起源、main- No. 234 GO）: # 10 review 過信 新規追加、違反 10 再発防止、提案 1 visual_check § 6.5 連動

### 自己参照禁止 抵触検証

- 全 session 共通 memory 改訂 = 抵触なし
- 当事者性: a-analysis 自身も「review 過信」適用対象（機能本旨内）

---

## 提案 4 改訂案: 新規 memory feedback_template_first_then_claude_ai_request

### 対象

新規 memory ファイル `feedback_template_first_then_claude_ai_request.md`

### 命名検討（a-analysis）

| 候補 | 評価 |
|---|---|
| A. feedback_template_first_then_claude_ai_request.md（main 提示）| ✅ 採用: workflow 順序が明示、claude.ai 依頼前提を明示 |
| B. feedback_common_template_first_workflow.md | 短いが claude.ai 依頼前提が抜ける |
| C. feedback_html_template_completion_first.md | HTML 限定で範囲が狭い |

→ A 案採用。

### 改訂版 memory 全文（コピペ用）

#### frontmatter

- name: 共通テンプレート抽出 → claude.ai 依頼の順序ルール（template first then claude.ai request）
- description: 共通構造関連の HTML 起草 / 修正は、共通テンプレート（template）完成 → claude.ai 依頼の順で進める。template と claude.ai 依頼の並行進行は禁止（template 未完成で claude.ai 依頼すると構造崩壊事故、5/11 違反 10 起源）。Forest UI / Bloom UI / Bud UI 等の共通構造関連 HTML 起草に適用。
- type: feedback
- originSessionId: a-analysis-001-2026-05-11（audit-001- No. 11 提案 4 起源、main- No. 234）

#### 本文

##### ルール

共通構造関連の HTML 起草 / 修正は以下順序を厳守:

| 順 | 段階 | 内容 |
|---|---|---|
| 1 | template 完成 | 共通構造（class 命名規則 / 共通 CSS / 共通 component）の template 完成 + main + a-review 検証 |
| 2 | template 確定 | template を docs/template-* or src/components/_template/ に確定配置 |
| 3 | claude.ai 依頼 | 確定 template をベースに claude.ai に HTML 起草依頼 |
| 4 | 各 tab / 画面起草 | claude.ai が template 踏襲で各 tab / 画面起草 |
| 5 | review | a-review + main で確認、template 整合 + 共通 CSS 整合検証 |

**禁止**: template と claude.ai 依頼の並行進行（template 未完成のまま claude.ai に各 tab HTML 起草依頼）。

##### Why

- 5/11 違反 10: tab-2 / tab-3 HTML を template 未完成のまま claude.ai に並行依頼 → 構造崩壊 + 共通 CSS 不整合
- template 未完成 = 共通 class 命名規則・共通 CSS 規約が未確立 = claude.ai が独自設計に走る
- template 完成後の依頼 = 整合性を template が保証 = 構造崩壊リスク最小化

##### 適用範囲

| 対象 | 内容 |
|---|---|
| Forest UI | tab-1〜tab-8 共通構造（.topbar / .sidebar.sidebar-dual / .activity-panel / gf-* class 系列）|
| Bloom UI | 共通構造（bloom-* class 系列）|
| Bud UI | 共通構造（pl-* / pay-bn-* / inv-rcv-* class 系列）|
| Tree UI | 共通構造（tree-* class 系列）|
| 他モジュール UI | 同様に共通構造 template first |

##### How to apply

###### template 完成判定基準

| 項目 | 判定 |
|---|---|
| 共通 class 命名規則確立 | gf-summary-* / gf-tax-* 等の prefix 確定 |
| 共通 CSS ファイル完成 | forest-common.css / bloom-common.css 等の確立 |
| 共通 component 確立 | TopBar / Sidebar / ActivityPanel 等の共通実装 |
| main + a-review 検証完了 | template review-NN 受領 + 採用判定 |

###### template 確定配置先

- HTML template: `docs/template-<module>-common-YYYYMMDD.html`
- CSS template: `src/<module>/ui_drafts/_assets/<module>-common.css`
- component template: `src/components/_template/<module>/`

###### claude.ai 依頼 dispatch 起草時

dispatch 内に以下明示:
- 参照 template ファイルパス（フルパス）
- 流用可項目（template の class 命名規則 / 共通 CSS）
- 厳守事項（template 踏襲、独自設計禁止）
- 添付画像のフルパス（mock 画像、memory feedback_dispatch_image_path_required 準拠）

##### NG パターン

❌ template 未完成のまま claude.ai に tab-2 / tab-3 HTML 並行依頼 → 構造崩壊
✅ template 完成 → claude.ai に tab-2 / tab-3 HTML 順次依頼 → 整合性確保

##### 関連

- memory feedback_check_existing_impl_before_discussion v3（HTML・CSS 修正前トリガー、トリガー 4 連動）
- memory feedback_self_visual_check_with_chrome_mcp v2 § 6.5（review 受領時 main 独立検証義務、本ルール違反時の検出装置）
- memory feedback_chatgpt_mock_to_claude_ai_direct_attach（mock 画像直接添付フロー）
- memory feedback_my_weak_areas # 8 既存実装把握漏れ + # 10 review 過信

##### 改訂履歴

- 2026-05-11 11:50 v1 ドラフト初版（a-analysis-001、audit-001- No. 11 提案 4 起源、main- No. 234 GO、違反 10 再発防止）

### 自己参照禁止 抵触検証

- 全 Garden 共通 workflow memory = a-analysis 自身の運用変更ではない（抵触なし）
- 当事者性: a-analysis は memory 起草担当、HTML 起草担当ではない = 当事者性低

---

## 提案 5 改訂案: governance §2 a-review 役割定義 解像度向上

### 対象

`docs/governance-rules-v1-20260509.md` § 2 セッション役割分担表

### 改訂方針

a-review 行の役割記述を「コード/PR レビュー + UI mock 視覚評価兼任（5/9 確定）」から、判断粒度の限界と main 補完責任を明示する記述に拡張。

### 現行（v1）

```
| **a-review** | コード/PR レビュー + **UI mock 視覚評価兼任**（5/9 確定） |
```

### 改訂版（v1.2、5/11、表セル簡潔化 + 補足脚注化、audit-001- No. 13 改善 3 起源）

§2 セッション役割分担表 a-review 行は **表セル内を簡潔化**、判断粒度の詳細は新規 §2-1 脚注として独立セクション化:

```
| **a-review** | コード/PR レビュー + UI mock 視覚評価兼任（5/9 確定）。**判断粒度詳細は §2-1 参照、違反 10 再発防止（5/11 強化）**|
```

新規 §2-1 a-review 役割記述補足（5/11 違反 10 再発防止、v1.2 拡張）:

```
### §2-1 a-review 役割記述補足（5/11 違反 10 再発防止）

- 判断粒度は「構造比較」止まりが標準
- 「実描画確認」を求める場合は main 側で明示依頼必須
- review self-prep「構造比較で完結」表記時は main 側で実描画確認の追加要求必須
- 該当 memory: feedback_self_visual_check_with_chrome_mcp v2 § 6.5（review 受領時 main 独立検証義務）
```

### 差分サマリ

| 項目 | v1 → v1.1 変更点 |
|---|---|
| 基本役割 | 維持（コード/PR レビュー + UI mock 視覚評価兼任）|
| 追加記述 | 判断粒度の限界（構造比較止まり）+ main 補完責任明示 + self-prep 表記時の追加要求義務 |
| 起源 | 5/11 違反 10、audit-001- No. 11 提案 5 |

### 改訂履歴追加行（governance §改訂履歴）

- 2026-05-11 11:50 v1.1（a-analysis-001 起草、audit-001- No. 11 提案 5 起源、main- No. 234 GO）: § 2 a-review 役割記述拡張、判断粒度限界 + main 補完責任明示、違反 10 再発防止

### 自己参照禁止 抵触検証

- governance 改訂 = a-analysis 自身の運用変更ではない（a-review 役割定義の解像度向上）= 抵触なし
- 当事者性: a-analysis は a-review 評価を受領する立場ではない（a-analysis は memory 起草、a-audit は critique 担当）= 当事者性低

---

## 5 提案 統合 自己参照禁止 抵触検証

| # | 提案 | 抵触判定 | 当事者性 |
|---|---|---|---|
| 1 | visual_check 強化 | 抵触なし | あり（a-analysis 自身も適用）|
| 2 | 既存実装把握 v3 | 抵触なし | あり |
| 3 | review 過信 # 10 | 抵触なし | あり |
| 4 | template first 新規 memory | 抵触なし | 低 |
| 5 | governance §2 改訂 | 抵触なし | 低 |

総合: 5 件全件、a-analysis 自身の運用ルール変更には抵触しない（全 session 共通改訂 or 他セッション役割記述変更）。a-audit 独立検証で当事者バイアス確認推奨（特に提案 1 / 2 / 3 は a-analysis 自身も適用対象）。

---

## main / a-audit / 東海林さん 採否仰ぎ事項

| # | 判断事項 | 推奨 |
|---|---|---|
| 1 | 配分判断（sentinel vs 既存 memory 改訂 vs my_weak_areas 追加）| ✅ a-analysis 提示通り採用推奨（sentinel 肥大化回避 + 既存構造活用）|
| 2 | 提案 1 § 6.5 新設 vs 既存 § 5/§ 6 の拡張統合 | § 6.5 新設推奨（既存セクション独立性維持）|
| 3 | 提案 2 トリガー 4 追加配置（v2 → v3） | OK 推奨 |
| 4 | 提案 3 # 10 新規追加 vs # 2 拡張 | # 10 新規追加推奨（不得意分野独立カテゴリ化）|
| 5 | 提案 4 新規 memory 命名 A 案 | OK 推奨 |
| 6 | 提案 5 governance §2 改訂内容 | OK 推奨 |
| 7 | a-audit critique 依頼可否（標準フロー §4-1）| 推奨、main- No. 後続候補で依頼 |
| 8 | 即時反映タイミング（5/11 中、v5.2 改訂と並行可）| OK 推奨 |

---

## 改訂履歴

- 2026-05-11 11:50 v1 ドラフト初版（a-analysis-001、main- No. 234 起源、audit-001- No. 11 提案 1-5 統合）
- 2026-05-11 12:30 v1.1 軽微改善 3 件反映（a-analysis-001、audit-001- No. 13 改善 1+2+3 起源、main- No. 242 C セクション GO）: 提案 1 § 6.5「実描画スクショ未添付」検出条件具体パターン明示 / 提案 2 トリガー 4 bash コマンド例 汎用化テンプレ + Forest / Bloom / Bud 例併記 / 提案 5 governance §2 表セル簡潔化 + §2-1 補足脚注化
