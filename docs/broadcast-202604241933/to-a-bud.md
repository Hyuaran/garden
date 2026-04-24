# 【a-auto セッションからの周知】Batch 6 完成 — Bud Phase B 給与処理 6 spec 揃いました

- 発信日時: 2026-04-24 19:33 発動 / 約 21:00 配布
- 対象セッション: **a-bud**
- 発動シーン: 集中別作業中（約 90 分、Batch 6 6 件完走）

---

## 🎉 Bud Phase A-1 + Phase B 給与処理コンプリート

Batch 5（Bud Phase A-1）と合わせて、**Bud モジュールの主要機能すべての仕様書が揃いました**。

| フェーズ | spec 件数 | 工数 |
|---|---|---|
| Phase A-1（振込/明細/CC）| 6 件（Batch 5）| 3.0d |
| **Phase B（給与処理）| 6 件（本 Batch 6）** | **3.0d** |
| 合計 | 12 件 | 6.0d |

---

## ■ Batch 6 完了作業（6 spec、合計 2,487 行）

| # | ファイル | 行数 | 想定 | 性質 |
|---|---|---|---|---|
| B-01 | [salary-calc-engine.md](docs/specs/2026-04-24-bud-b-01-salary-calc-engine.md) | 542 | 0.75d | 計算エンジン中核 |
| B-02 | [social-insurance-tax.md](docs/specs/2026-04-24-bud-b-02-social-insurance-tax.md) | 417 | 0.5d | 社保・源泉・住民税 |
| B-03 | [salary-statement-pdf.md](docs/specs/2026-04-24-bud-b-03-salary-statement-pdf.md) | 431 | 0.5d | 明細 PDF + Tree 配信 |
| B-04 | [salary-payment-flow.md](docs/specs/2026-04-24-bud-b-04-salary-payment-flow.md) | 333 | 0.5d | 振込連携 + トリガ |
| B-05 | [bonus-processing.md](docs/specs/2026-04-24-bud-b-05-bonus-processing.md) | 425 | 0.5d | 賞与処理 |
| B-06 | [salary-kpi-dashboard.md](docs/specs/2026-04-24-bud-b-06-salary-kpi-dashboard.md) | 339 | 0.25d | KPI ダッシュボード |

---

## ■ あなた（a-bud）が実施すること

### 1. 事前合意（実装着手前）

#### 🔴 最優先（M3 Phase B 着手前に必須）
- **B-01 判1**: 月所定日数・月所定労働時間を `root_salary_systems` に追加するか（**推奨：追加**）
- **B-02 判6**: 料率表の年次更新運用（**4 月 / 10 月に admin 手動更新**を推奨、Chatwork アラート）
- **B-02 判1**: 社保加入基準（週 20 時間・月 8.8 万円）の自動判定は Phase C に繰越、v1 は手動
- **B-04 判1**: 給与振込を 6 段階フルスキップで OK か（**auto 推奨: 承認済みスタートでスキップ**）

#### 🟡 M3 中合意
- B-03 判2: 手渡し現金受給者の明細扱い（A-07 論点 3 と整合）
- B-05 判1: 賞与の業績評価数値化（**Phase B v1 は手動入力**）
- B-06 判3: KPI ダッシュボードのアクセス権限（super_admin + admin）

#### 🟢 Phase C 繰越
- 年末調整、給与改定 UI、扶養控除申告書電子化、退職金、外国人租税条約等

### 2. 実装順序

#### Phase B-1（M3 前半、2026-07 頃）: 1.75d
1. **B-01** 給与計算エンジン（0.75d）— Root KoT（PR #15）の上に積む
2. **B-02** 社保・源泉・住民税（0.5d）— 料率表マスタ投入前提
3. **B-03** 明細 PDF（0.5d）— `@react-pdf/renderer` + 日本語フォント

#### Phase B-2（M3 後半、2026-07-08）: 1.0d
4. **B-04** 振込連携（0.5d）— Phase A-1 A-03〜A-05 の上に積む
5. **B-05** 賞与処理（0.5d）— 夏季賞与（7 月）に間に合わせる運用目標

#### Phase B-3（M4 以降）: 0.25d
6. **B-06** KPI ダッシュボード（0.25d）— データ蓄積後、Bloom 連携は Phase C

### 3. MF クラウド給与との並行運用期

**目標**: 2026-07 から 3 ヶ月（7/8/9 月分）は **MF クラウド給与と Garden-Bud で二重計算**、突合で ±10 円以内の一致を目標（B-02 §11 受入基準 10）。10 月以降に MF を停止。

### 4. effort-tracking.md への先行記入
6 タスクを予定時間付きで追記（§12 準拠）。着手順に actual 値も追記。

### 5. 判断保留 64 件の合意
各 spec §12 に集約。Phase B-1 着手前に最低 🔴 マークの 10 件を合意。

---

## ■ 特筆すべき設計判断

### B-01 計算の冪等性
`calc_params_hash`（入力 SHA-256）を保存することで、**同一入力 → 同一出力**を保証。再計算時も結果が変わらなければ再発行不要、変わった場合のみ再計算履歴を記録。

### B-02 給与の超機密性
RLS を厳格化：`bud_salary_records` は**本人 read + admin read/write**のみ。manager や staff からは**列制限**すら見えない。Chatwork 通知は必ず DM（Public チャネル禁止）。

### B-03 給与明細と振込のアトミック性なし
給与明細発行（B-03）と振込起票（B-04）は**独立プロセス**。明細発行済でも振込は未実行の状態が存在可能（確認のためのバッファ）。status 遷移で整合性保持。

### B-04 給与は承認フロー省略
通常振込の 6 段階（下書き→確認→承認待ち→承認済み）は給与ではスキップ、`status='承認済み'` 直接スタート。**計算エンジンの妥当性検証 + 明細発行による事実上の承認**を前提。通常振込との区別は `source_type='salary'` バッジで可視化。

### B-05 健保累計ルール
健康保険は賞与累計 573 万円まで。Phase B v1 では毎回累計判定、4 月にリセット。`cumulative` 関数を独立化して再利用性確保。

### B-06 Bloom 連携の匿名化
個人特定防止のため、3 人以下の法人では総額非表示。Bloom Workboard との連携は Phase C（Bloom 側の実装タイミング次第）。

---

## ■ 依存関係マップ

```
Root KoT (PR #15)  ─→  B-01 計算エンジン
                       │
        B-02 ──────────┤
                       │
        B-03 明細 ←────┤
                       │
        B-04 振込 ←────┴── Phase A-1 A-03〜A-05 (Batch 5)
                              │
        B-05 賞与 ←───────────┤
                              │
        B-06 KPI ←──────────── 集計ビュー
                              │
        Bloom Workboard ←───── Phase C 連携
```

---

## ■ 2026 年日本税制の前提

各 spec は **2026 年時点の日本の法令** を前提とした提案：
- 厚生年金料率: 18.3%（2017 年以降固定）
- 雇用保険料率: 一般 0.6%（従業員負担、2026 年度予算ベース）
- 健保料率: 都道府県別（協会けんぽ）or 組合別
- 介護保険: 40-64 歳、料率は協会けんぽ 1.60% 等
- 賞与上限: 健保 573 万円 / 年、厚年 150 万円 / 回
- 時間外割増: 1.25（25%）、深夜 +0.25、法定休日 1.35、月 60 時間超 1.50（中小も適用）

**料率表の年次更新は admin 運用で必須**。自動化は Phase C（API 連携 or 公式ファイル取込）。

---

## ■ 参考

- **作業ブランチ**: `feature/phase-a-prep-batch6-bud-salary-20260424-auto`
- **Batch 5 成果物**（PR #21 マージ済）: Bud Phase A-1 6 件
- **Root KoT 連携**（PR #15）: `src/app/root/_types/kot.ts` + `_actions/kot-sync.ts`
- **既存 Bud**（`feature/bud-phase-0-auth`）: `transfer-status.ts` / `types.ts` / `duplicate-key.ts`
- **関連 MEMORY**: `project_cc_processing`, `project_bud_cash_payment_issue`, `project_sales_cost_analysis`
- **Phase A + B 累計工数**: **14.7d**（Forest 8.7d + Bud Phase A-1 3.0d + Bud Phase B 3.0d）
