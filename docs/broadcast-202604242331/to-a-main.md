# 【a-auto セッションからの周知】Batch 8 完成 — Leaf 関電 Phase C 6 spec

- 発信日時: 2026-04-24 23:31 発動 / 約 02:00 配布
- 対象セッション: **a-main**
- 発動シーン: 就寝前モード（Batch 8 Leaf 関電 Phase C spec 起草）

---

## ■ 完了した作業（6 spec、合計 2,562 行）

Garden-Leaf 001_関西電力業務委託 Phase C の実装指示書 6 件を生成。**FileMaker 11 からの切替プロジェクト**の仕様書コンプリート、M3-M4 で a-leaf が自律実行可能な状態。

| # | ファイル | 行 | 見積 |
|---|---|---|---|
| C-01 | schema-migration | 461 | 0.75d |
| C-02 | backoffice-ui | 407 | 1.0d |
| C-03 | input-ui-enhancement | 371 | 0.75d |
| C-04 | batch-processing | 446 | 0.75d |
| C-05 | chatwork-notification | 391 | 0.5d |
| C-06 | test-strategy | 486 | 0.75d |

**実装見積 4.5d**（テスト実装含む）。

---

## ■ PR 化予定

commit + push までは a-auto で完了。翌朝 a-main で PR 化して develop マージの流れ。

---

## ■ ハイライト

### 1. RLS 4 階層 + 列制限 Trigger（C-01）
営業 / 事務 / 管理者 / 全権管理者の 4 階層で閲覧・編集権限を分離。営業は自分の案件のみ、事務は全件、管理者は全項目、全権は削除可。**列単位の制限は Trigger で実装**（WITH CHECK では不可）。

### 2. 非技術者向け UX 文言（C-02）
対照表 7 項目で NG/OK を明文化：
- 「データが存在しません」→「データが見つかりませんでした」
- 「OK / キャンセル」→「実行する / やめる」
- 「削除しますか？」→「この案件を削除します。取り消せません。続行しますか？」

### 3. 2 段階ウィザード + OCR 連動（C-03）
新規登録を Step 1（基本情報 + 添付）/ Step 2（契約詳細）に分離。Phase A-1c の OCR 結果を Step 2 の初期値にマージ。**信頼度 90%+ でも手動承認必須**（誤取込リスク）。

### 4. Root KoT パターン踏襲のバッチ（C-04）
`soil_kanden_sync_log` を Root `root_kot_sync_log` と同パターンで設計。Cron 4 本で月次レポート / PD 同期 / 手数料再計算 / 滞留リマインダを自動化。

### 5. 案 D: 署名 URL 不流通（C-05）
月次レポート PDF の **Chatwork 本文への URL 貼付禁止**。代わりに Garden ログイン画面の URL を案内、Garden 内で認証した上で閲覧。**URL 漏洩の被害範囲を Garden 内に閉じる**設計。

### 6. Leaf 🟡 通常厳格度（C-06）
spec-cross-test-strategy 準拠で、Tree/Bud/Root の 🔴 より緩く、Soil/Rill の 🟢 より厳しい中間位置。Unit 70% / Integration 50% / E2E 5 本。**エッジケース優先**（空入力・極大入力・特殊文字・日付境界・金額境界・ステータス境界）。

---

## ■ 判断保留（合計 43 件）

最優先合意事項 5 件（a-main 経由で東海林さん判断）:

| # | 論点 | a-auto 推奨 |
|---|---|---|
| 1 | `plan_code` NOT NULL 化時期 | Phase C 後半 |
| 2 | 解約後のデータ保持期間 | **永続**（税務 7 年+）|
| 3 | 監査ログタブのアクセス範囲 | **admin+ のみ** |
| 4 | OCR 結果の自動承認 | **信頼度 90%+ でも手動承認必須** |
| 5 | 月次 PDF の Chatwork 添付 | **案 D: 添付しない**、Garden ログイン誘導 |

他 38 件は各 spec §最終章に集約、優先度中〜低。

---

## ■ 推奨実装順序

### M3（2026-07 頃）: 2.5d
1. C-01 schema migration（4 日）
2. C-02 backoffice UI（5 日）
3. C-03 input UI（4 日）※ C-02 と並行可

### M4 前半: 1.25d
4. C-04 batch processing（4 日）
5. C-05 chatwork（3 日）
6. C-06 test strategy + α版テスト（4 日）

### M4 中盤: α版 1 週間（東海林さん）
### M4 末: β版 2 週間（3-5 人）
### M5 初: リリース版 + FileMaker 停止

---

## ■ 次 Batch 候補

Batch 8 で Leaf 関電 Phase C spec が揃ったため、次は：

### 候補 A: **Tree Phase D 準備（推奨 🔴）**
- Tree D-01 〜 D-06（6 spec、~4.5d）
- M7 Phase D 着手の前倒し準備、**最慎重な展開**
- FileMaker 切替の主力業務（コールセンター）、早期仕様化でリスク分散

### 候補 B: Bud Phase C 準備
- 年末調整 / 退職金 / 業務委託 / 給与改定 UI 等（~3.5d）
- M6（10 月）の年末調整前に合わせる

### 候補 C: Soil / Rill 基盤設計
- Phase C の補完モジュール準備（~3.0d）
- a-soil / a-rill 着手時のスカフォールド

### 候補 D: Leaf 他商材（光回線・クレカ等）
- 関電業務委託の成功パターンを他商材へ横展開
- テーブル設計スケルトン大量生成（~1.0d auto）

---

## ■ a-auto 推奨: **候補 A（Tree Phase D 準備）**

### 理由詳細
1. **最慎重モジュール**: コールセンター中心業務、FileMaker 切替失敗＝業務停止
2. **Phase D は M7-M8 集中展開**: 7 種テスト → α → 1 人 → 2-3 人 → 半数 → 全員の 5 段階を経るため、仕様書の早期固まりが必須
3. **Leaf 関電と並行学習**: Leaf Phase C の成功パターン（案 D Chatwork / 2 段階ウィザード / FM ショートカット）を Tree に移植
4. Bud Phase C（候補 B）は M6 着手でも十分、優先度は Tree が上

### 副次候補
- 候補 B（Bud Phase C）は Tree Phase D 後のスロットで併行実施可
- 候補 D（Leaf 他商材）は a-leaf の関電 Phase C 実装中に並行 auto 投入可（スケルトン生成のみ、判断ほぼ不要）

---

## ■ 制約遵守

- ✅ コード変更ゼロ（`src/` 未改変、docs のみ）
- ✅ main / develop 直接作業なし、**develop 派生**（派生元ルール遵守、Batch 3-8 継続）
- ✅ 6 件完走、正常停止
- ✅ `[a-auto]` タグ付き commit
- ✅ 各 spec 371-486 行（200-500 行目安内）
- ✅ 既存コード未改変、spec のみ
- ✅ 判断保留は各 §最終章に集約（43 件）

---

## ■ Phase A + B + 横断 + Leaf C 累計

| Batch | 対象 | spec 数 | 工数 |
|---|---|---|---|
| Batch 1-6 | Phase A/B 各モジュール | 34 | 14.7d |
| Batch 7 | Garden 横断 | 6 | 4.75d |
| **Batch 8** | **Leaf 関電 Phase C**（本 PR）| **6** | **4.5d** |
| **累計** | — | **46 spec** | **約 23.95d** |

Garden リリース準備の仕様書は **46 spec / 約 23.95 日分**に到達。Phase A-C の骨格がほぼ完成（Tree Phase D のみ残）。

---

## ■ 参考

- **作業ブランチ**: `feature/leaf-kanden-phase-c-specs-batch8-auto`
- **成果物**:
  - `docs/specs/leaf/spec-leaf-kanden-phase-c-0{1-6}.md` × 6 本
  - `docs/broadcast-202604242331/summary.md`
  - 本ファイル
- **関連参照**:
  - Batch 7 Garden 横断 spec（PR #25）
  - `feature/leaf-kanden-supabase-connect` の既存 `src/app/leaf/`
  - Phase A-1c（添付・OCR）/ A-2（1 click）/ A-FMK1（ショートカット）の既存実装
  - Root KoT 連携（PR #15）パターン踏襲
  - project_chatwork_bot_ownership memory
