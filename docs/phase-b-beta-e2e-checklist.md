# Garden-Tree Phase B-β ブラウザE2E 動作確認チェックリスト

- 作成日: 2026-04-24
- 作成セッション: a-tree
- 対象: Phase B-β（初回ログイン誕生日入力 + Auth パスワード MMDD 同期）
- 対象コミット: `9be77d5` + `a2e925c`
- 想定作業者: **東海林さん本人**（Supabase Dashboard 操作と `npm run dev` の手元起動を含むため）
- 所要時間: 約 15〜20 分

---

## ■ このチェックリストでやること

Phase B-β で実装した「**初回ログイン時に誕生日を登録 → そのまま次回以降のログインパスワードが誕生日4桁（MMDD）に切り替わる**」仕組みを、実際のテストアカウントで通して動くか確認します。

**テストアカウント**：
- 社員番号: `1324`
- 氏名: 三好 理央
- `garden_role`: `staff`

このアカウントは「誕生日を一度入れた後に null に戻して、初回ログイン状態を再現」する形でテストします。

---

## ■ 事前準備（Supabase Dashboard 操作）

### STEP 1. Supabase にログイン

1. ブラウザで https://hhazivjdfsybupwlepja.supabase.co を開く
2. プロジェクト `garden` にログイン（全権管理者のアカウントで）

### STEP 2. 三好理央（1324）の誕生日を null に戻す

1. 左メニューから **SQL Editor** を開く
2. 以下の SQL を貼り付けて **Run** ボタンをクリック

```sql
UPDATE root_employees
SET birthday = NULL
WHERE employee_number = '1324';
```

3. 結果欄に `Success. 1 row affected` と表示されれば OK

### STEP 3. 三好理央の現在パスワードを一時的に既知値へ戻す

誕生日 null ＝ 初回ログイン状態なので、現行パスワードが何か不明なまま進められません。Supabase Dashboard で既知値にリセットします。

1. 左メニュー **Authentication** → **Users** を開く
2. 検索欄に `emp1324@garden.internal` と入力
3. 対象ユーザーの行右端の **…** メニュー → **Send password recovery** ではなく、**Update password** を選択
   - （もし **Update password** が見当たらない場合は、ユーザー行をクリックして詳細画面を開き、**Reset Password** 相当のボタンを押す）
4. 新しいパスワードとして **`temp1234`** を設定（テスト用の仮値）
5. **Save** をクリック

### STEP 4. `.env.local` の確認

**本番（Vercel）ではなくローカル確認なので、`C:\garden\a-tree\.env.local` に以下 3 つが揃っていることを確認**：

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...    ← NEXT_PUBLIC_ が付いていないこと！
```

1. エクスプローラーで `C:\garden\a-tree\.env.local` を右クリック → **プログラムから開く** → メモ帳
2. 上記 3 行がすべてあることを目視確認
3. `SUPABASE_SERVICE_ROLE_KEY` に `NEXT_PUBLIC_` 接頭辞が付いていたら、**接頭辞を削除**して保存（付いていると service_role キーがブラウザに漏れるため）

---

## ■ ローカル起動

### STEP 5. `npm run dev` 起動

1. PowerShell を開く
2. 以下をコピペして Enter

```powershell
cd C:\garden\a-tree
npm run dev
```

3. `▲ Next.js 16.2.3` → `- Local:        http://localhost:3000` と表示されるまで待つ（30秒前後）
4. PowerShell はそのまま**開きっぱなし**にしておく（閉じるとサーバーが止まる）

---

## ■ ブラウザでの検証

### STEP 6. ログイン画面を開く

1. 別のブラウザウィンドウで http://localhost:3000/tree/login を開く
2. **期待状態**：
   - ログインフォーム（社員番号 + パスワード）が表示される
   - サイドバーと KPI ヘッダーは**表示されない**（= bare screen 動作 OK）
   - 未ログイン状態

### STEP 7. 初期パスワードでログイン

1. 社員番号欄に **`1324`** を入力
2. パスワード欄に **`temp1234`** を入力（STEP 3 で設定した仮値）
3. 「ログイン」ボタンをクリック
4. **期待状態**：
   - 一瞬ロードが入った後、URL が **`/tree/birthday`** に切り替わる
   - 「はじめてのログイン」「三好 理央 さん、ようこそ。」のメッセージが出る
   - 誕生日入力欄（date picker）と「登録する」ボタンが見える
   - サイドバー・KPI ヘッダーは**表示されない**（bare screen）

**失敗パターンと対処**：
- **社員番号またはパスワードが正しくありません** → STEP 3 で設定したパスが違う可能性、STEP 3 をやり直す
- **ダッシュボードに直接飛んでしまう** → STEP 2 の `birthday = NULL` UPDATE が効いていない可能性、SQL Editor で再確認
- **ログイン画面のまま動かない** → ブラウザの開発者ツール（F12）→ Console タブでエラー文を確認

### STEP 8. 誕生日を入力して保存

1. 誕生日欄に **`1990-05-07`** を入力（テスト用の任意日付。以降「**0507**」がパスワードになる）
2. 「登録する」ボタンをクリック
3. **期待状態**：
   - ボタンが一瞬「保存中...」表示になる
   - 成功すると URL が **`/tree/dashboard`** に遷移する
   - ダッシュボード画面（サイドバー + KPI ヘッダー + 本文）が表示される

**失敗パターンと対処**：
- **「誕生日は保存されましたが、パスワードの更新に失敗しました」**
  - → `.env.local` の `SUPABASE_SERVICE_ROLE_KEY` が設定されていない／`NEXT_PUBLIC_` 接頭辞付きになっている
  - → PowerShell を Ctrl+C で止め、`.env.local` を修正後に `npm run dev` で再起動
- **何も起きず、ローディングが終わらない**
  - → 開発者ツール（F12）→ Network タブで `/api/tree/update-password` のレスポンスを確認

### STEP 9. Supabase 側の反映を確認

1. Supabase Dashboard → **Authentication** → **Users**
2. `emp1324@garden.internal` の行の **Last sign in** / **Updated at** が **今の時刻**に更新されていることを確認
3. Supabase Dashboard → **Table Editor** → `root_employees` テーブル
4. `employee_number = '1324'` の行の `birthday` が **`1990-05-07`** になっていることを確認

### STEP 10. ログアウト

1. ダッシュボードのサイドバー下部（または該当の UI 位置）にある **ログアウトボタン**をクリック
2. **期待状態**：URL が `/tree/login` に戻る

### STEP 11. 新しい MMDD パスワードで再ログイン

1. 社員番号欄に **`1324`** を入力
2. パスワード欄に **`0507`** を入力（STEP 8 で入れた 1990-05-07 の月日）
3. 「ログイン」ボタンをクリック
4. **期待状態**：
   - URL が `/tree/dashboard` に遷移する（`/tree/birthday` には**戻らない**、誕生日は既に登録済のため）
   - ダッシュボードが普通に開く

**失敗パターンと対処**：
- **社員番号またはパスワードが正しくありません**
  - → `/api/tree/update-password` が成功していない可能性
  - → Supabase Dashboard → Authentication → Users → `emp1324@garden.internal` の「Updated at」が STEP 8 時点に更新されているか再確認
  - → `temp1234`（旧パス）でログインできるかも試す。できたら API 経由の Auth パス更新が効いていない
- **`/tree/birthday` に戻ってしまう**
  - → STEP 9 で `root_employees.birthday` が更新されているか再確認

---

## ■ チェックリスト（東海林さん向け）

| # | 確認項目 | 結果 |
|---|---|:---:|
| 1 | STEP 6: `/tree/login` が bare screen で表示された | ☐ |
| 2 | STEP 7: `1324 + temp1234` でログイン成功、`/tree/birthday` へ自動遷移 | ☐ |
| 3 | STEP 7: `/tree/birthday` も bare screen（サイドバー非表示）で表示 | ☐ |
| 4 | STEP 7: 「三好 理央 さん」の氏名がウェルカム文に出た | ☐ |
| 5 | STEP 8: 誕生日を入れて「登録する」→ `/tree/dashboard` へ遷移 | ☐ |
| 6 | STEP 8: 「パスワードの更新に失敗しました」エラーが**出なかった** | ☐ |
| 7 | STEP 9: Supabase Auth の Updated at が更新された | ☐ |
| 8 | STEP 9: `root_employees.birthday` が `1990-05-07` になった | ☐ |
| 9 | STEP 10: ログアウトで `/tree/login` に戻った | ☐ |
| 10 | STEP 11: `1324 + 0507` で再ログイン成功、`/tree/dashboard` に入れた | ☐ |
| 11 | STEP 11: 旧パス `temp1234` では入れない（念のため確認するなら別途試行） | ☐ |

**11 項目すべて ☑ なら Phase B-β は実環境で正常動作** → Phase B 全体を develop へ PR 作成可能。

---

## ■ 想定外の挙動を見つけたら

1. ブラウザの開発者ツール（F12）→ **Console** タブ と **Network** タブのスクリーンショットを撮る
2. PowerShell のターミナル出力（エラーログ）をコピー
3. a-tree セッションに貼り付けて相談

---

## ■ B 経路（マイページ誕生日変更）の同期確認

> **2026-04-25 時点で `/tree/mypage` に誕生日変更 UI が実装済**（`ChangeBirthdayModal`）。STEP 11 完了後に続けて以下を確認する。
>
> **確定方針（2026-04-24）**: マイページから誕生日を変更したとき、Auth パスワードも新しい MMDD へ**同期更新**する（仕様書 §2.1 B 経路）。一体トランザクション（案 C）採用済。

### STEP 12. マイページを開く

1. STEP 11 の状態（`1324` + `0507` でログイン済、ダッシュボード表示中）から開始
2. サイドバーの「マイページ」をクリック → `/tree/mypage` が表示される
3. **期待状態**：
   - 登録情報セクションに誕生日 `1990-05-07` が表示されている
   - 「誕生日を変更する」ボタンが表示されている（実装後）
   - `garden_role` が `staff` のため、将来的にも「パス再発行」UI は**表示されない**
     （再発行は `password_reset_min_role = 'manager'` 以上のロールで見える）

### STEP 13. 誕生日を変更する

1. 「誕生日を変更する」ボタンをクリック
2. モーダル表示：
   - 「新しい誕生日」date picker
   - 「現在のパスワード」入力欄（本人確認用）
3. 新しい誕生日に **`1985-12-03`** を入力
4. 現在のパスワード欄に **`0507`**（STEP 11 で使った MMDD）を入力
5. 「変更する」ボタンをクリック
6. **期待状態**：
   - 「変更しました。次回ログインからは新しい誕生日のパスワードでログインしてください」メッセージが表示される
   - モーダルが閉じる
   - 現セッションは**ログアウトされず**、マイページ画面のまま継続利用可能
   - 登録情報の誕生日表示が `1985-12-03` に更新されている

**失敗パターンと対処**：
- **「現在のパスワードが違います」** → 現パスを確認（直近ログインに使ったもの）
- **「誕生日は変更されましたが、パスワードの更新に失敗しました」** → STEP 8 と同じ原因（`SUPABASE_SERVICE_ROLE_KEY` 未設定 等）、§2.5.2 の通り B 経路ではログイン不能に陥るリスク大、**案 C（一体トランザクション）実装まで要注意**

### STEP 14. ログアウト → 新 MMDD で再ログイン

1. マイページ or サイドバーからログアウト
2. `/tree/login` で社員番号 `1324` + パスワード **`1203`**（新誕生日 1985-12-03 の MMDD）でログイン
3. **期待状態**：`/tree/dashboard` に遷移、旧パス `0507` では入れない

### STEP 15. Supabase 側の反映確認

1. Supabase Dashboard → `root_employees` の `employee_number = '1324'` の `birthday` が **`1985-12-03`** になっている
2. Supabase Dashboard → Authentication → Users → `emp1324@garden.internal` の Updated at が STEP 13 実行時刻に更新されている

### B 経路チェックリスト

| # | 確認項目 | 結果 |
|---|---|:---:|
| 12 | STEP 13: 現パス再確認が機能した（誤入力ではじかれる） | ☐ |
| 13 | STEP 13: 誕生日変更成功、セッション維持、メッセージ表示 | ☐ |
| 14 | STEP 14: 新 MMDD `1203` で再ログイン成功 | ☐ |
| 15 | STEP 14: 旧 MMDD `0507` では入れない | ☐ |
| 16 | STEP 15: Supabase `root_employees.birthday` が `1985-12-03` | ☐ |
| 17 | STEP 15: Supabase Auth Updated at が STEP 13 時刻 | ☐ |

---

## ■ テスト後の後片付け

STEP 8 で三好理央の本来の誕生日とは違う値（`1990-05-07`）が入っているため、**本番運用開始前に正しい誕生日に戻す**こと：

```sql
UPDATE root_employees
SET birthday = '三好さんの本来の誕生日'
WHERE employee_number = '1324';
```

その後、三好さん本人に「次回ログインは新しい誕生日 MMDD で入る」ことを伝える（または管理者が Dashboard で Auth パスワードを正しい MMDD に再設定）。

— end of checklist —
