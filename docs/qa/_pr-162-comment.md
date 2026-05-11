## 📌 Apply 完了履歴（A-RP-1 §4 遡及補完）

main- No. 312 broadcast「feedback_migration_apply_verification (A-RP-1) 7 項目」内化に伴い、本 PR の **apply 完了時の 3 点併記（検証手段 + 検証時刻 + 検証者）** を遡及補完します。

### 3 点併記

| 項目 | 値 |
|---|---|
| 検証手段 | **Method A 推定**（Supabase Dashboard SQL Editor で `scripts/garden-super-admin-lockdown.sql` 直接実行 + 同ファイル末尾の確認クエリ `SELECT tgname FROM pg_trigger WHERE tgname IN ('trg_prevent_super_admin_role_change','trg_prevent_super_admin_insert');` で trigger 2 件作成確認）|
| 検証時刻 | **2026-05-11 18:00 頃 JST**（main- No. 313 §E 報告「SQL apply 完了（5/11 18:00 頃 東海林さん Run）」、精度 ±10 min）|
| 検証者 | **東海林さん**（Supabase Studio 実行者、main- No. 313 経由）|

### 補足

- **記録源泉**: main- No. 313（5/11 18:42、a-main-023 起票）§E「Task 5 (super_admin) ✅ #162 merged + SQL apply 完了（5/11 18:00 頃 東海林さん Run）」
- **記録の精度**: 時刻精度は **18:00 頃 ±10 min**（main- No. 313 表記、具体時刻未記録）
- **動作確認の根拠（本 PR description Test plan 内）**:
  - garden-dev で authenticated session UPDATE で SQLSTATE 42501 確認
  - service_role バイパスが成功すること
  - 既存 super_admin (employee_number=0008、東海林さん本人) が変更されていないこと
- **追加検証 Method C クロス検証（Task 6 で実施予定、main- No. 330 §A # 3 採択済）**: Vitest E2E シナリオ S9-S11 (super_admin lockdown 関連) で authenticated session UPDATE → 42501 確認を含めることで **Method A + Method C のクロス検証** を実施。
- **補完起草経緯**: A-RP-1 (memory `feedback_migration_apply_verification`) 5/11 制定、PR merge (5/11 18:32) と apply (5/11 18:00 頃) のタイミング前後関係から PR description に 3 点併記が未記録だったため遡及補完。今後の Root PR では merge 直後 5 分以内の 3 点併記を厳守。

🤖 起草: a-root-003 (Claude Code) / 承認: a-main-023 (main- No. 330) / 投下: a-root-003 (gh pr comment)
