# Codex-469：マイページ専用の URL `garden-os.net/my` を作り、System のマイページ 4 画面をまとめる（2026-10-29）

## 東海林さんの話
- 求人応募→入社→Garden アカウント発行の流れができた。次は、従業員の打刻を KING OF TIME から Garden に切り替える準備として、**マイページ専用の URL** を作る（フォームの `/m/expense/nhk` のような、開くとそれだけが出る URL）。
- トス・クローザーは基本このマイページしか見ない。**どの権限の人が開いても、この URL ではマイページしか開けない**。CS の人に他の画面を見せるのは、今後も権限（歯車）で決める。
- 今の System の中のマイページ（`/system/mypage`・`/system/attendance`・`/system/shift`・`/system/zenkaku`）は**別に置いておく必要はない → `/my` にまとめる**。
- タブ：自分の情報（入社手続きもここ）・勤怠打刻・シフト・前確依頼・通話・録音（INNOVERA 履歴・録音）・AP日報（中身は次の Codex-470。今回は「準備中」の枠だけ）。

先に読む：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5〜§2.7。画面の文字に略称・開発者用語を書かない。絵文字なし（印は SVG の線）。iPhone で入力欄が拡大しないこと。

今の作り（読んでから作る）：
- `src/app/system/mypage/`（`MyPageClient.tsx`・`_components/MyPageSectionPage.tsx`・`types.ts` の `MY_PAGE_ROUTES`/`MY_PAGE_TITLES`・`tabs/*`）
- `src/app/system/attendance/`・`src/app/system/shift/`・`src/app/system/zenkaku/`・`src/app/system/innovera-calls/`
- スマホの外枠 `src/app/m/layout.tsx`（`MobileHeader`・`MobileBottomNav`・`MobileAuthGate`）
- ログイン後の行き先 `src/app/login/`（クローザーを `/system/mypage` へ送るテストあり）
- 閲覧権限 `src/lib/auth/system-view-scopes.ts`・`withSystemView`

## 1. `/my`（新しい URL）
- `src/app/my/`。**開くとマイページだけ**：上に「Garden」と「〇〇 さん」、中身、下にタブ。サイドバー・他モジュールへのリンク・モジュールの一覧は出さない（`/m` の三本線メニューも出さない。出すのはログアウトと明暗の切り替えだけ）。
- タブは `?tab=profile|attendance|shift|zenkaku|calls|report`（既定 profile）。スマホは下に 6 つ並べる（SVG の線の印＋短い名前：自分の情報／打刻／シフト／前確／通話／日報）。パソコン幅（768px 以上）は上に SystemTabs で並べ、中身は幅に合わせて広げる。
- 画面の絵（スマホ）：
```
[Garden]                          東海林 美琴 さん  [明暗][ログアウト]
──────────────────────────────────────
自分の情報                                  ← 今のタブの名前（h1）
（今のタブの中身）
──────────────────────────────────────
[自分の情報][打刻][シフト][前確][通話][日報]   ← 下に固定
```
- 中身はいまの部品をそのまま使う（作り直さない）：自分の情報＝ProfileTab、勤怠打刻＝AttendanceClient、シフト・前確依頼＝今のタブ、通話＝`/system/innovera-calls` の中身（権限の段階はそのまま。トス・クローザーは自分の分だけ、のいまの決まりのまま）、日報＝「準備中（AP日報をここから送れるようになります）」の枠。
- **入社手続き**：入社手続きが終わっていない人には、「自分の情報」の一番上に「入社手続きを進めてください」のカード（入社手続きの画面へ）を出す。終わった人には出さない（入社手続きが終わったかどうかの判定は `src/app/system/onboarding/` の今の決まりを使う）。
- 誰でも（在籍中の Garden アカウントなら役職を問わず）開ける。ログインしていなければ `/login?returnTo=/my...`。

## 2. System のマイページ 4 画面をまとめる
- `/system/mypage`・`/system/attendance`・`/system/shift`・`/system/zenkaku` は、`/my` の同じタブへ転送する（`?tab=` を付けて。古いブックマークも生きる）。
- System のサイドバー・スマホのメニュー・System のホーム・マニュアルなど、この 4 画面へのリンクはすべて `/my?tab=…` に変える（`MY_PAGE_ROUTES` を `/my?tab=…` にするのが早い）。
- `/system/innovera-calls` は管理者の機能があるので残す。`/my` の通話タブは本人向けの中身として同じ部品を使う。
- ログイン後の行き先：今 `/system/mypage` に送っている人（クローザーなど）は `/my` へ。トスも `/my` へ（今の決まりを読んで、トス・クローザーの行き先を `/my` にそろえる）。
- 閲覧権限（歯車）：`/my` は全員に開く。今の 4 画面の scope（system-mypage など）はそのまま残してよい（転送するだけになる）。

## 3. テスト
- `/my` の 6 タブが出る・`?tab=` で開くタブが変わる・サイドバーや他モジュールへのリンクが無い。
- 4 画面が `/my?tab=…` へ転送される。
- ログイン後、トス・クローザーが `/my` に着く（今のテストを直す）。
- 入社手続きのカード：未完了で出る・完了で出ない。
- 今あるマイページ・勤怠打刻・シフト・前確依頼・通話のテストは全部通す。

## 終わったら
- `npx tsc --noEmit` と関係するテストを通す。完了報告（コードブロック）。
- ファイルは UTF-8（BOM なし）。**git は触らない（commit しない）。npm install しない。本番の DB に当てない。**

## 実装時の取得回数
- 定期的な取り直し・cron の追加は無し（1 日 0 回）。画面を開いたとき・タブを切り替えたときの読み込みは今の各画面と同じ回数。
