# Bud Phase E — Overview（給与処理拡張 + 勤怠取込拡張 + MFC 拡張）

- 対象: Garden-Bud Phase D 完成後の運用拡張機能群
- 起草: 2026-05-08（a-bud-002、main- No. 136 GO 受領）
- 起草担当: a-bud-002 / レビュー担当: a-bloom
- 関連: Phase D 100% 完成（PR #148）、CLAUDE.md §18 Phase B 該当

---

## 1. Phase E の位置づけ

Phase D（D-01〜D-12）は「給与処理コア機能」を網羅した。Phase E は **Phase D 完成後に運用で発生する例外フロー・拡張機能** を整備する。

### 1.1 Phase D との違い

| 観点 | Phase D | Phase E |
|---|---|---|
| 目的 | 給与処理コア（毎月確実に動く基本機能） | 運用拡張（例外・特殊ケース・外部連携） |
| 必須度 | 🔴 給与計算ができない | 🟡 例外運用が手作業に戻る |
| 着手判断 | リリース前必須 | β版以降の補強、運用フィードバック反映 |

### 1.2 Phase E の対象範囲

```
給与処理拡張   → 月次運用 cron / 退職者・中途入社特例 / 産休育休フロー / 役員報酬区分
勤怠取込拡張   → KoT 完全同期 / Excel 取込 / 修正申請ワークフロー
MFC 拡張       → 仕訳科目辞書 / 部署集約 / 弥生 / freee 連携
```

---

## 2. Phase E spec 一覧（v1、bud-002 起草）

| # | spec | 工数見積 | 主な機能 | 優先度 |
|---|---|---|---|---|
| **E-01** | 月次運用 Cron + リマインダ拡張 | 0.75d | D-12 schedule 実運用、停止条件・リトライ | 🟢 高 |
| **E-02** | 退職者・中途入社特例 | 1.0d | D-02/D-05/D-06 拡張、日割り・社保按分・即時精算 | 🟢 高 |
| **E-03** | 産休育休フロー | 0.75d | D-05 拡張、免除解除・月変・育児短時間勤務 | 🟡 中 |
| **E-04** | 役員報酬区分 | 0.5d | D-07/D-11 拡張、損金算入限度・賞与扱い | 🟡 中 |
| **E-05** | KoT 完全同期 + Excel 取込 | 1.0d | D-01/Root A-3-a 拡張、修正申請ワークフロー | 🟢 高 |

合計実装見積: **4.0d**（5 件、本起草工数 0.5-1.0d は spec 起草のみ）

---

## 3. Phase D との依存関係

```
Phase E は Phase D 完成（544 tests green）を前提に拡張:

E-01 ← D-12 schedule + reminder（cron 運用化）
E-02 ← D-02 salary + D-05 insurance + D-06 nenmatsu（特例分岐）
E-03 ← D-05 insurance + D-09 bank accounts（口座変更頻度）
E-04 ← D-07 transfer + D-11 mfc-csv（仕訳区分）
E-05 ← D-01 attendance schema + Root A-3-a kot_sync_log（同期拡張）
```

---

## 4. Phase E v2 候補（参考、本 batch 外）

将来 a-auto Batch で追加検討:

| 候補 | 内容 | 工数 |
|---|---|---|
| E-06 | 弥生 / freee 連携（D-07 transfer-accounting-csv 代替フォーマット） | 1.0d |
| E-07 | MFC 仕訳科目辞書（D-11 mfc-csv-mapper 拡張、自動マッピング） | 0.75d |
| E-08 | 給与改定一括処理（昇給・降給・基準日 mass-update、D-02 拡張） | 1.0d |
| E-09 | 賞与算定資料 PDF（D-03 拡張、計算根拠 export） | 0.5d |

---

## 5. 共通制約（Phase D precedent 踏襲）

- **設計判断・仕様変更なし**（spec の判断保留事項に列挙、東海林さん判断仰ぎ）
- **新規 npm install なし**（既存依存のみ）
- **動作変更なし**（拡張のみ、既存 Phase D 動作影響なし）
- **本番影響なし**（migration 適用は spec レビュー後）
- **既存 helpers 再利用**（bud_has_payroll_role / bud_is_admin_or_super_admin / nextBusinessDay 等）

---

## 6. テスト戦略（Phase D D-08 流儀踏襲）

- 各 E-* spec で 単体テスト計画 + 受入基準（DoD）明記
- 共通 fixture は Phase D D-08 `tests/_fixtures/` 再利用
- E-* 単体テスト目標: 各 spec 20+ tests（境界値 + RLS + 法令）

---

## 7. 実装着手判断（Phase E 全体）

1. **東海林さん判断必要**: 各 spec の「判断保留事項」（料率・除外条件・運用ルール等）
2. **a-bloom レビュー**: 各 spec を起草後、a-bloom が Phase D との整合性 / 法令準拠を確認
3. **実装着手は Phase D PR #148 merge 後**: develop に Phase D が乗ってから E-* 着手

---

## 8. 関連ドキュメント

- Phase D 完成: PR #148（feature/bud-phase-d-implementation-002 → develop）
- Phase D D-08 テスト戦略: `docs/specs/2026-04-25-bud-phase-d-08-test-strategy.md`
- Root A-3-a kot_sync_log: `supabase/migrations/20260425000001_root_kot_sync_log.sql`
- Phase C nenmatsu: `docs/specs/2026-04-25-bud-phase-c-{01..06}-*.md`（Phase C で別途実装予定）
- CLAUDE.md §18: Garden 構築優先順位
- CLAUDE.md §22-8: 自律的 token 使用率チェック

---

## 9. 起草記録

- 2026-05-08 14:50 a-bud-002（bud-22）起草、main- No. 136 GO 受領後
- 起草工数: 0.5-1.0d（main- No. 136 想定通り）
- レビュー指定: a-bloom
- ブランチ: `feature/bud-phase-e-specs-batch-bud-002`（origin/develop 派生）
