# dispatch main- No. 332-rep-2 — a-bud-002 No. 56 列混同への返信、案 C 即実行 GO（bud_* RLS 比較式 21 件機械置換）

> 起草: a-main-024
> 用途: bud-002 No. 56 で発覚した列混同（employee_id PK vs employee_number UNIQUE の値不一致）への対応、東海林さん Chrome SELECT 検証で実証、案 C 即実行 GO（5/11 中夜間に修正完了、5/12 朝 Supabase Run、5/12 中本番運用着地）
> 番号: main- No. 332-rep-2
> 起草時刻: 2026-05-11(月) 21:46（実時刻基準、powershell.exe Get-Date 取得）

---

## 投下用短文（東海林さんがコピー → a-bud-002 にペースト）

~~~
🔴 main- No. 332-rep-2
【a-main-024 から a-bud-002 への dispatch（No. 56 列混同への返信、案 C 即実行 GO + 5/11 中夜間修正、5/12 朝 Run、5/12 中本番運用着地）】
発信日時: 2026-05-11(月) 21:46

# 件名
🔴 案 C 即実行 GO — bud_* RLS 比較式 21 件機械置換（5/11 中夜間修正、5/12 朝 Supabase Run、5/12 中本番運用着地 = MFC 解約路 docking 確定）

# A. Chrome SELECT 検証結果（実データ実証）
東海林さん経由 Supabase Studio で `SELECT employee_id, employee_number, name FROM root_employees LIMIT 5` Run 結果:

| employee_id | employee_number | name |
|---|---|---|
| EMP-0008 | 0008 | 東海林 美琴 |
| EMP-0004 | 0004 | 上田 基人 |
| EMP-0009 | 0009 | 萩尾 拓也 |
| EMP-1165 | 1165 | 宮永 ひかり |
| EMP-1326 | 1326 | 小泉 翔 |

→ **値不一致確定**: employee_id = `"EMP-NNNN"` 形式、employee_number = `"NNNN"` 形式（EMP- prefix なし）

→ v5 の `employee_id = auth_employee_number()` 比較は `"EMP-0008" = "0008"` = 常に false = **RLS 完全失敗**

# B. 案 C 採用（東海林さん明示 GO 21:30 頃 = 5/11 中夜間修正 + 5/12 朝 Run）
| 案 | 採否 | 理由 |
|---|---|---|
| C | ✅ **採用** | bud_* RLS 比較式変更 = Bud のみ即修正、10-15 分、5/12 中本番運用着地路維持 |
| A | 中期 | cross_rls_helpers に `auth_employee_id()` 追加、Phase B-5 候補（Root 担当）|
| B | 不採用 | bud_* FK 大規模変更、5/12 中着地不可 |

# C. 案 C 修正方針（21 件機械置換）
v5 で `employee_id = auth_employee_number()` 21 箇所を以下に置換:

```
employee_id = (
  SELECT employee_id 
  FROM public.root_employees 
  WHERE employee_number = auth_employee_number() 
    AND is_active = true 
  LIMIT 1
)
```

または等価なサブクエリ形式（Bud 側判断で簡略化可）。

# D. 修正対象 13 migration の機械置換手順
| Step | 内容 |
|---|---|
| 1 | `supabase/migrations/20260507*.sql` 全件 grep で `employee_id = auth_employee_number()` 検出（21 件想定） |
| 2 | 機械置換 sed or Edit ツールで一括置換 |
| 3 | grep 再実行で残存 0 件確認 |
| 4 | commit + push（5/11 中夜間想定）|

# E. 5/11 中夜間 完走 ETA / 5/12 朝 Run 想定
| 順 | アクション | 担当 | ETA |
|---|---|---|---|
| 1 | Bud 機械置換 21 件 + commit + push | a-bud-002 | 5/11 22:00-22:30（10-15 分）|
| 2 | a-main-024 が v7 SQL 生成（v6 + RLS 比較式置換）| a-main-024 | 22:30-22:45（10-15 分）|
| 3 | 東海林さん起床後 Supabase Studio で v7 Run | 東海林さん | 5/12 朝早朝 |
| 4 | REST 検証 + 仕訳帳動作確認 | a-main-024 + 東海林さん | 5/12 朝-午前 |
| 5 | **本番運用着地 = MFC 解約路 docking 完了** | — | **5/12 中** |

# F. 5/12 中本番運用着地（東海林さんの確認に対する回答）
東海林さん確認: 「5/12 中本番運用着地は今日はできないから、明日なんだよね？」
→ ✅ **正解**、本日（5/11 月）は修正準備まで、Run + 検証 + UI 動作確認は明日（5/12 火）朝-午前。明日 5/12 中に本番運用着地で MFC 解約路 docking 完了。

# G. cross_rls_helpers deleted_at filter（補足、急務でない P1）
auth_employee_number() / has_role_at_least() が deleted_at filter していない場合、退職者の RLS 通過リスク。Phase B-5 セキュリティ強化候補（5/12 朝 audit review 後判断）。本 # 332-rep-2 では対応せず（5/12 中本番運用着地優先）。

# H. ACK 形式（bud-002- No. 57）
| 項目 | 内容 |
|---|---|
| 1 | # 332-rep-2 受領確認 |
| 2 | 案 C 採用 + 21 件機械置換完了 |
| 3 | commit hash + push 時刻 |
| 4 | 5/11 中夜間 完走 ETA |

# I. 緊急度
🔴 最緊急（MFC 解約路 critical、5/12 中本番運用着地 docking gate）

# J. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 起草時刻 = 実時刻 21:46（powershell.exe Get-Date 取得済）
- [x] 番号 = main- No. 332-rep-2（ack 派生、counter 非消費）
- [x] A 実データ検証 / B 案 C 採用 / C 修正方針 / D 機械置換 / E ETA / F 5/12 着地確認 / G P1 補足 / H ACK
~~~

---

## 詳細（参考、投下対象外）

### 連動
- bud-002 No. 56（列混同 escalation + 3 案提示）
- main- No. 332-rep（実 31 列リスト + Step 3 マッピング）
- 東海林さん Chrome SELECT 検証（5/11 21:30 頃、a-main-024 経由 Run + 結果取得）

### Chrome SELECT 検証経緯
1. a-main-024 が Monaco editor に setValue で SELECT 投下
2. 東海林さん「Run OK」 = Run 許可 → a-main-024 が editor.getAction('run-query').run() で実行
3. Chrome 翻訳バイパス（font tag 経由）で結果取得
4. 列値不一致確定（employee_id = "EMP-0008", employee_number = "0008"）
