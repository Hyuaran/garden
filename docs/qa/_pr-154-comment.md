## 📌 Apply 完了履歴（A-RP-1 §4 遡及補完）

main- No. 312 broadcast「feedback_migration_apply_verification (A-RP-1) 7 項目」内化に伴い、本 PR の **apply 完了時の 3 点併記（検証手段 + 検証時刻 + 検証者）** を遡及補完します。

### 3 点併記

| 項目 | 値 |
|---|---|
| 検証手段 | **Method A 推定**（Supabase Dashboard SQL Editor 直接実行 + `SELECT auth_employee_number();` / `SELECT has_role_at_least('staff');` の動作確認）|
| 検証時刻 | **2026-05-11 13:00 頃 JST**（main- No. 259 起票 5/11 13:02 以前、具体時刻未記録）|
| 検証者 | **東海林さん**（Supabase Studio 実行者）|

### 補足

- **記録源泉**: a-root-002 期 dispatch chain（main- No. 259 = 「PR #154 apply 完了通知受領」）+ a-root-002 → a-root-003 handoff §3「PR #154 merge 後 Supabase apply 完了通知受領（main 経由）」
- **記録の精度**: 時刻精度は **±30 min 程度の推定**（main- No. 259 起票時刻 13:02 から逆算）、具体的な実行時刻は記録不在
- **動作確認の根拠**: PR description Test plan 内「SELECT auth_employee_number(); で employee_number 取得 / SELECT has_role_at_least('staff'); で role 比較」（東海林さんが起票後に実行）
- **追跡性**: 本コメント以降、`auth_employee_number()` / `has_role_at_least()` は Tree D-01 RLS (PR #156 reissue + PR #128) / Garden RLS template (PR #163) 等で活用されており、apply 不在では成立しない既存実装が存在
- **補完起草経緯**: A-RP-1 (memory `feedback_migration_apply_verification`) 5/11 制定、PR merge 時 (5/11 13:02) には未制定だったため遡及補完。今後の Root PR では merge 直後 5 分以内の 3 点併記を厳守。

🤖 起草: a-root-003 (Claude Code) / 承認: a-main-023 (main- No. 330) / 投下: a-root-003 (gh pr comment)
