# draft memory: feedback_module_round_robin_check 改訂（C-RP-1 v1 起草、10 セッション化）

> 起草: a-analysis-001（main- No. 299 §D 起草依頼、# 308 §B 採用 # 1 + # 2 + # 3 + # 309 確定）
> 起草日時: 2026-05-11 (月) 19:15
> 用途: 既存 memory feedback_module_round_robin_check の改訂ドラフト（main 採択後に main セッションで memory ファイル上書き）
> 状態: ドラフト、main + 東海林さん最終決裁後に main がファイル上書き（a-analysis 編集権限外）

---

## 自己参照禁止 抵触の自覚明示（最重要、冒頭背景に組み込む）

本改訂は **a-analysis-001 自身の運用変更**（被監視対象化）= 設計書 §7-1 自己参照禁止抵触領域。

| 自覚項目 | 内容 |
|---|---|
| 起草者 = 被監視者 | a-analysis-001 が自セッションの被監視対象化を起草 = 利益相反リスク |
| 第三者目線担保 | 本セクション冒頭明示 + memory 本文 D-2-2 明示 + main フォロー報告で「自己参照領域につき第三者観点で起草」明示 |
| main / 東海林さん監視責任 | 採否判断時に「a-analysis 起草の自己利得」中立性チェック、a-audit / 東海林さん最終決裁で覆す権利保持 |
| 「推奨で全 GO」の範囲（東海林さん 5/11 17:50）| 代替案 C 採用までであり、起草内容は別審査対象 |

---

## memory 全文（コピペ用、~~~ 外で提示、main がそのままファイル上書き可能）

### frontmatter

- name: モジュール巡回チェック v2（30 分おき stagnation 検出 + 別タスク投下 + 10 セッション化 + apply 検証）
- description: ガンガンモード本質の「全モジュール並列稼働」を実現するため、main は 30 分おきに各モジュールセッション最終 commit 時刻を確認、停滞検出したら即時別タスク dispatch。v2 で a-analysis / a-audit を巡回対象化（10 セッション化）+ apply 検証項目追加（A-RP-1 連携）+ 自己参照禁止抵触自覚明示。
- type: feedback
- originSessionId: c325d0f6-aad0-4462-8c97-d372978deb30（consolidated 2026-05-11、a-analysis-001 改訂、main- No. 299 起源、analysis-001- No. 11 C-RP-1、a-main-022 期 a-analysis/audit 報告漏れ 0 件 対処）

### 本文

#### 自己参照禁止抵触の自覚（v2 冒頭明示、最重要）

本 memory v2 改訂は **a-analysis-001 自身の運用変更**（被監視対象化）= 設計書 §7-1 自己参照禁止抵触領域。a-analysis は本巡回でも被監視対象となる。**a-analysis 自身の停滞は a-main / a-audit が検出責任を負う**。起草者 = 被監視対象の構造、main / 東海林さん最終決裁 + a-audit 独立検証で中立性担保。

#### ルール

a-main セッションは作業中、**30 分おき**に以下を実施:

| Step | 内容 |
|---|---|
| 1 | 各モジュールセッション（**10 セッション**）の最終 commit 時刻 + 直近 dispatch 受領状況を確認 |
| 2 | **30 分以上停滞**しているセッションを検出（停滞定義は §3-1 stagnation 判定参照）|
| 3 | 停滞セッションに **別タスク dispatch** を即時起草 → 投下 |
| 4 | 全モジュール並列稼働を維持 |
| 5 | **apply 検証状態 cross-check**（v2 新規）= 各モジュールの「マージ済 / apply 状態」を確認、未検証 PR 検出時は apply 検証 dispatch 即投下（A-RP-1 連携、※ A-RP-1 § 7 と機能近接、両 memory 改訂時は相互整合確認必須）|

#### 1. 10 セッション化（v2 新規）

巡回対象セッション一覧:

| # | セッション | 役割 | 停滞判定基準 |
|---|---|---|---|
| 1 | a-bloom | Bloom UI 実装 | 直近 commit 時刻 |
| 2 | a-bud | Bud 経理実装 | 同上 |
| 3 | a-soil | Soil DB 基盤実装 | 同上 |
| 4 | a-leaf | Leaf 商材実装 | 同上 |
| 5 | a-root | Root 認証 / マスタ実装 | 同上 |
| 6 | a-tree | Tree 架電実装 | 同上 |
| 7 | a-forest | Forest 経営ダッシュボード | 同上 |
| 8 | a-seed | Seed 新事業枠 | 同上 |
| 9 | **a-analysis-001（v2 新規）**| 構造分析 / memory 提案・起草 | 直近 dispatch 受領時刻（on-demand 起動のため）|
| 10 | **a-audit-001（v2 新規）**| critique / 監査 / incident-pattern-log 蓄積 | 同上 |

除外セッション + 再編入条件（D-3 セクション、§308 採用 # 2）:

| セッション | 現状除外理由 | 再編入条件 |
|---|---|---|
| a-rill | Phase 最後着手（Chatwork クローン自社開発）、現時点で稼働セッションなし | a-rill 起動時に自動再編入 |
| a-memory | memory 判断専門の別セッション、PR / apply ループ運用対象外（5/11 時点で未起動）| a-memory 起動時に自動再編入 |

再編入時の周知: main 経由で他全モジュールへ「a-rill / a-memory C-RP-1 編入完了」dispatch（巡回対象拡張周知）。

#### 2. Why（v2 拡張）

- 016 期最大の失敗 = claude.ai 1 経路に集中 + 他 7 モジュール待機
- ガンガンモードの本質「全モジュール並列稼働」が機能しなかった
- 013 期は 7 セッション同時稼働で 25 件完走 / 6 倍速、main は司令塔として巡回していた
- memory feedback_gangan_mode_default で本質定義したが、「30 分巡回」の具体運用ルールが不在
- **v2 起源（2026-05-11）**: a-main-022 期 18 dispatch のうち a-analysis-001 / a-audit-001 への投下 = 0 件、両セッション完全待機（5h 枠全期間）= ガンガン本質「全モジュール並列稼働」崩壊
- v2 で a-analysis / a-audit を巡回対象化することで構造的再発防止
- **v2 起源（apply 検証）**: Tree D-01 事故 + apply 漏れ 80% 推定（5/11 cross-check）= PR merge ≠ apply 完了の構造的誤認、30 分巡回時の apply 検証 cross-check 必須化

#### 3. How to apply

##### 3-1 stagnation 判定基準（10 セッション別、v2 拡張）

| セッション種別 | 停滞判定 | 軽停滞（🟡）| 停滞（🔴）|
|---|---|---|---|
| 実装系 8 セッション（a-bloom 〜 a-seed）| 最終 commit 時刻 | 30 分-1 時間 | 1 時間以上 |
| **分析系 2 セッション（a-analysis / a-audit、v2 新規）**| 最終 dispatch 受領時刻 | **30 分-2 時間**（on-demand 起動のため間隔広め）| **2 時間以上** |

a-analysis / a-audit は on-demand 起動 = 「停滞」定義が他モジュールと異なる、間隔判定基準を緩和（30 分 → 2 時間で 🔴 判定）。

##### 3-2 巡回スクリプト（v2 拡張、10 セッション対応）

```bash
# 30 分おきに以下を実行（v2、10 セッション対応）
for d in a-bloom a-bud a-soil a-leaf a-root a-tree a-forest a-seed a-analysis-001 a-audit-001; do
  cd C:/garden/$d 2>/dev/null
  last_commit=$(git log -1 --format="%cr | %s" 2>/dev/null)
  echo "$d: $last_commit"
done

# 除外: a-rill / a-memory（起動後に再編入、※ D-3 参照）
```

##### 3-3 停滞検出条件（v2 拡張）

| 状況 | 判定 | アクション |
|---|---|---|
| 直近 commit が 30 分以内（実装系）| 🟢 稼働中 | 何もしない |
| 30 分-1 時間（実装系）| 🟡 軽停滞 | dispatch counter / 投下状況確認、未投下あれば即投下 |
| 1 時間以上（実装系）| 🔴 停滞 | **即時別タスク dispatch 起草 → 投下** |
| 直近 dispatch 受領 30 分以内（分析系）| 🟢 稼働中 | 何もしない |
| 30 分-2 時間（分析系）| 🟡 軽停滞 | 候補タスク（memory 棚卸し / critique / 構造分析）準備、必要なら投下 |
| **2 時間以上（分析系、v2 新規）**| 🔴 停滞 | **即時別タスク dispatch 起草 → 投下** |
| 待機中（push freeze 等で意図的）| ⚪ 例外 | 例外条件解除後に巡回再開 |

##### 3-4 巡回タイミング（v1 継承）

| トリガー | 動作 |
|---|---|
| 私が claude.ai 起草応答待ち | 待ち時間に巡回 |
| 大きな単一タスク完了直後 | 全モジュール状況確認 |
| 任意の時刻（明示的タイマー）| 30 分タイマー（CronCreate or ScheduleWakeup）|
| ユーザーから「他モジュールどう？」聞かれた時 | 即巡回 |

##### 3-5 別タスク投下の優先順（v2 拡張）

| 順 | 内容 | 適用 |
|---|---|---|
| 1 | 各モジュールの docs/wip-*.md / docs/handoff-*.md の「次にやるべきこと」| 実装系 |
| 2 | effort-tracking で遅延しているタスク | 実装系 |
| 3 | spec / プロンプト起草系（auto 推奨タスク、feedback_module_session_auto_mode）| 実装系 |
| 4 | **memory 棚卸し / 改訂起草 / 構造分析（v2 新規）**| **a-analysis-001 向け** |
| 5 | **critique / incident-pattern-log 蓄積 / 違反検出（v2 新規）**| **a-audit-001 向け** |
| 6 | 1-5 で具体化できない場合は「スキップ」（無理に投下しない）| 全セッション |

##### 3-6 apply 検証 cross-check（v2 新規、A-RP-1 連携）

30 分巡回時に各実装系モジュールの直近 merge 済 PR の apply 状態を確認:

| ステップ | アクション |
|---|---|
| 1 | gh pr list --state merged --limit 5 で各モジュール直近 merge 済 PR 取得 |
| 2 | PR description / 該当モジュール handoff で「apply 完了」記述 + 3 点併記（検証手段 / 時刻 / 検証者）確認 |
| 3 | 併記なし PR を「マージ済だが apply 未検証」として検出 |
| 4 | 該当モジュールに「apply 検証 dispatch」即投下（A-RP-1 §4 形式準拠）|
| 5 | 検証完了報告受領まで該当 PR を「未完了」扱い、後続作業停止 |

※ A-RP-1 § 7 と機能近接、両 memory 改訂時は相互整合確認必須。

##### 3-7 sentinel # 8 連動（v2 新規）

応答出力前 自己 memory 監査 v2 の sentinel # 8（新設提案: apply 検証ロック解除確認）と連動。30 分巡回 = 外部観測、sentinel # 8 = 内部観測、両軸で apply 漏れ検知。

※ sentinel # 8 は 2026-05-11 時点で提案段階（別 RP として採否判断中）。採用確定後、本注記を削除し正式連動として運用開始。

#### 4. 例外（巡回しない / 停滞容認、v1 継承）

| 例外 | 理由 |
|---|---|
| Vercel push freeze 中 | 意図的稼働制限、解除後再開 |
| モジュール α/β テスト稼働中 | 現場テスト期間、コード変更控える |
| 東海林さんから「待機」明示指示 | 専管事項 |
| a-analysis / a-audit が大規模起草中 | dispatch 連続受領で 30 分以上稼働中の場合、stagnation 判定対象外 |

#### 5. 関連 memory

- feedback_gangan_mode_default（ガンガン本質、本 memory はその具体運用）
- feedback_pr_health_check_proactive（PR 巡回の類似パターン）
- handoff-a-main-013-to-014（7 セッション同時稼働の成功例）
- **feedback_a_memory_session_collaboration**（a-analysis / a-audit セッション設計、v2 連携、a-memory 起動時は本 memory § 1 除外解除条件 参照）
- **feedback_migration_apply_verification（A-RP-1、v2 新規連携）**（PR merge ≠ apply 完了の構造的誤認防止、本 memory § 3-6 と機能近接、※ 両 memory 改訂時は相互整合確認必須）
- **feedback_self_memory_audit_in_session**（sentinel # 8 連動、v2 新規、※ sentinel # 8 は提案段階、別 RP として採否判断中）

#### 6. 改訂履歴

- 2026-05-09 18:30 v1 初版（a-main-017、016 期 1 経路集中失敗対策）
- **2026-05-11 19:15 v2 ドラフト**（a-analysis-001 起草 + 東海林さん決裁 + a-main-023 登録、main- No. 299 起源、analysis-001- No. 11 C-RP-1、a-main-022 期 a-analysis/audit 報告漏れ 0 件 + Tree D-01 apply 漏れ 対処、10 セッション化 + apply 検証 + 自己参照禁止抵触自覚明示）
