## 📌 Apply 完了履歴（A-RP-1 §4 遡及補完）

main- No. 312 broadcast「feedback_migration_apply_verification (A-RP-1) 7 項目」内化に伴い、本 PR の **apply 完了時の 3 点併記（検証手段 + 検証時刻 + 検証者）** を遡及補完します。

### 3 点併記

| 項目 | 値 |
|---|---|
| 検証手段 | **Method C（functional roundtrip）**: Tree D-01 schema 再 Run（`20260427000001_tree_phase_d_01.sql`）成功 = `root_employees.employee_number` への FK 参照が成立 → 本 PR の UNIQUE 制約が確実に apply 済を実証 |
| 検証時刻 | **2026-05-11 17:00 JST**（main- No. 291 報告「Tree D-01 apply ✅ 完了（5/11 17:00）」）|
| 検証者 | **東海林さん**（Tree D-01 再 Run 実施者、main- No. 291 経由）|

### 補足

- **記録源泉**: main- No. 291（5/11 17:10、a-main-023 起票）「Tree D-01 apply 完全成功、真因 = root_employees.employee_number UNIQUE 未適用、解消手段 = migration 20260511000002 即 apply（5 分）」
- **記録の精度**: 時刻精度は **5/11 17:00 ちょうど**（main- No. 291 §A 明示）
- **検証の確実性**: Method C により functional roundtrip 成功（Tree D-01 schema apply が FK 制約「FK 参照先は UNIQUE/PK 必須」を満たして成立）、本 PR の SQL 適用が事実上不可避
- **事前確認 SQL**:
  - D-1（重複 0 件確認）: `SELECT employee_number, COUNT(*) FROM public.root_employees GROUP BY employee_number HAVING COUNT(*) > 1;` → 0 行
  - D-3（Tree D-01 rollback 痕跡 0 件確認）: 同 main- No. 291 で実施済
- **補完起草経緯**: A-RP-1 (memory `feedback_migration_apply_verification`) は **本 PR の apply 漏れ事故が契機で制定された**（Tree D-01 が 14:30 に 42830 invalid_foreign_key で失敗 → 17:00 解消）。本 PR は事故の「真因」であり、今後の apply 検証ルールの源流。

🤖 起草: a-root-003 (Claude Code) / 承認: a-main-023 (main- No. 330) / 投下: a-root-003 (gh pr comment)
