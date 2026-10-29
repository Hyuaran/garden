# Codex-487：コーポレートサイトのお問い合わせ通知の TO を Root から決める（Garden 側）（2026-10-29）

## 東海林さんの話（開発ボードの回答）
- 各社のコーポレートサイトのお問い合わせ通知（Chatwork）の宛先（TO）は、今サイトごとに書かれている。**Root から読むようにする**（宛先の変更を Garden の画面だけで済ませる）。
- Chatwork の番号は Root の従業員 `root_employees.chatwork_account_id` が正（2026-10-27 から）。

**触ってよい場所：`src/app/system/sites/`・新しく作る `src/app/api/public/site-notify/`・`src/lib/sites/`（無ければ作る）・migration・テストだけ。** ほかは読むだけ。別の作業（マイページの扶養）が同時に動いているので `src/app/system/mypage/` は読みもしない。

先に読む：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` の §2.5〜§2.7（**表の行は全体を押す・表のマスに選ぶ欄を置かない・押した先は共通 Modal・フォームは form-kit・複数を選ぶのは BoxSelect（Modal の中で FormRow の見出しがあるときは `hideLabel`）**）。今の画面 `src/app/system/sites/`（サイト一覧は `_data/corporate-sites.json`。各サイトに `chatwork_to`＝名前の配列）。公開窓口の見本 `src/app/api/public/company/`。長い説明は不要・ファイルは必要な範囲だけ読む。

## 作るもの
1. **表**（migration `20261029000487_site_notify_recipients.sql`・作成のみ・Claude が本番に当てる）：`system_site_notify_recipients(site_key text, employee_id text references root_employees, primary key(site_key, employee_id), updated_at, updated_by)`。`site_key` は JSON のサイトを一意にする鍵（`public_slug`＋`kind` など、JSON の中で一意になるもの。無ければ JSON に `notify_key` を足す）。**今の `chatwork_to` の名前から社員を探して最初の行を入れる**（名前の空白の違いは無視して照合。見つからない名前は migration の中で `raise notice` して入れない）。RLS は service_role だけ。
2. **公開窓口** `GET /api/public/site-notify/<site_key>`：ヘッダー `x-garden-site-key` を環境変数 `SITE_NOTIFY_SECRET` と照らして一致したときだけ、`{mentions:[{id:"chatwork の番号", name:"氏名さん"}]}` を返す（在籍中で chatwork の番号がある人だけ・並び＝登録順）。鍵が違えば 401、知らない site_key は 404。5 分キャッシュは付けない（変更をすぐ反映）。
3. **画面**（/system/sites）：サイトの表（またはカード）の「TO」に、Garden で決めた人の氏名を出す。行（カード）を押すと共通 Modal「〇〇（サイト名）のお問い合わせ通知の TO」：BoxSelect（複数・在籍中で Chatwork の番号がある人）→［登録する］。全権管理者だけ変更できる（見るのは今と同じ）。Chatwork の番号が無い人は選べない（「Root で Chatwork の番号を登録してください」）。
4. テスト：鍵の確かめ（401／404／200）・在籍中で番号のある人だけ返る・画面で選んで登録できる。

## サイト側（今回は作らない・Claude が後で各リポジトリに入れる）
各サイトの `api/contact.js` は、送る前に上の窓口から mentions を取り、取れなかったら今の書かれた宛先で送る（止めない）。報告に、サイト側で使う `site_key` の一覧（JSON のどのサイトがどの鍵か）を書く。

## 終わったら
- `npx tsc --noEmit` と関係するテストを通す。完了報告（コードブロック）。
- ファイルは UTF-8（BOM なし）。**git は触らない（commit しない）。npm install しない。本番の DB に当てない。Chatwork に送らない。**

## 実装時の取得回数
- 新しい cron は無し。窓口はお問い合わせ 1 件ごとに 1 回（サイトから）。画面は開いたとき 1 回。
