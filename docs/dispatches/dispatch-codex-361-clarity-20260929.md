# Codex-361 Garden 全体：Microsoft Clarity（使い方の分析）を組み込む・氏名と住所に「伏せる」の印を付ける

作成日: 2026-09-29
作業ツリー: C:\garden\a-bloom-008
起点: main の最新（`git log -1` で確認・完了報告に書く。作成時点は 8e82417）
**git は触らないこと（commit・branch・stash すべて禁止）。本番のデータ・DB に触らないこと。開発サーバ・ブラウザを起動しないこと。画面に出る文言は日本語のまま。触ってよいのは下の「触るファイル」だけ。見た目（レイアウト・色・文言）は一切変えない。**

## 0. 目的と前提（東海林さん 2026-09-29 決定）
- Garden を社内に展開するにあたり、使い方（どこで迷うか・どの画面が使われるか）を Microsoft Clarity で見る。見るのは東海林さんだけ。従業員には告知する
- Clarity の「伏せる」は**画面の中で伏せてから送る**（伏せた中身は Microsoft に届かない）。マスクモードは標準の「バランス」＝**数字とメールアドレスは自動で伏せる**／**入力欄とプルダウンはどのモードでも伏せる**
- 自動では伏せられない**文字の個人情報（氏名・住所・口座名義・メールの差出人名など）**だけ、Garden 側で要素に `data-clarity-mask="true"` を付けて伏せる（その要素と子はすべて伏せられる）
- プロジェクト ID は環境変数 `NEXT_PUBLIC_CLARITY_PROJECT_ID`（Vercel の **Production にだけ**設定する＝Claude が後で登録）。**値が無い環境（開発・プレビュー・テスト）では何も読み込まない**

## 1. 直し方
### A. 読み込みの部品（新規 `src/app/_components/analytics/ClarityTracker.tsx`・client component）
- `process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID` が空なら `null` を返して何もしない
- 公式の読み込みコード（`https://www.clarity.ms/tag/<ID>` を async で読み、`window.clarity` の待ち行列を作るもの）と同じ動きを、`next/script`（`strategy="afterInteractive"`）で入れる。ID は環境変数から（文字列に埋め込むときは英数字だけ許す＝`/^[a-z0-9]+$/i` に合わなければ読み込まない）
- ログイン中の人：`useAuthUnified()` の `employeeNumber` があれば、`usePathname()` が変わるたびに `window.clarity("identify", employeeNumber, undefined, pathname, employeeNumber)` を呼ぶ（Clarity が custom-id を画面の中でハッシュしてから送る。friendly-name も社員番号＝氏名は送らない）。未ログインなら identify しない
- `window.clarity` の型宣言を足す（`declare global`）
- `src/app/layout.tsx` の `<AuthProvider>` の中（`ThemeProvider` と同じ並び）に `<ClarityTracker />` を 1 つ置く

### B. 文字の個人情報に「伏せる」の印を付ける
- 付け方は `data-clarity-mask="true"` を**表や詳細欄のまとまり（外側の要素）**に 1 つ付ける。セル 1 つずつに付けなくてよい。見た目は変えない
- 共通の値として `src/app/_lib/clarity-mask.ts` に `export const CLARITY_MASK = { "data-clarity-mask": "true" } as const;` を置き、`{...CLARITY_MASK}` で付ける
- 付ける場所（2026-09-29 の洗い出し。行番号は目安・中身を見て、氏名・住所などが出ているまとまりに付ける）：

| モジュール | ファイル（src/app/ から） | 付けるまとまり |
|---|---|---|
| 共通の枠 | `system/_components/ShachoShell/ShachoShell.tsx`（119・139・145 付近）／`root/_components/RootShell.tsx`（142-179）／`root/_components/UserHeader.tsx`（27）／`rill/_components/RillShachoShell.tsx`（266・278・312）／`tree/_components/SidebarNav.tsx`（605・1007）／`bloom/_components/BloomShell.tsx`（87）／`_components/home/GardenHomeClient.tsx`（169）／`m/account/page.tsx`（38-50） | ログイン中の本人の氏名・頭文字を出している要素 |
| マイページ | `system/mypage/tabs/ProfileTab.tsx`（97-111） | 登録内容の確認カード・基本情報の欄（住所・緊急連絡先・口座・生年月日・氏名） |
| リストマスタ | `system/list/_components/ListMasterClient.tsx`（2732-2741 検索結果の表／3159 履歴の見出し／3331-3334 自社アポ禁の一覧） | 一覧の表（tbody）・履歴の「今の値」・自社アポ禁の一覧 |
| System 各画面 | `system/kanri/KanriPortalClient.tsx`（721-728・935-936・1181-1185）／`system/call-metrics/CallMetricsClient.tsx`（100-101）／`system/forms/shukkin/ShukkinClient.tsx`（274-276・331・337-339）／`system/forms/nhk-visit/NhkVisitClient.tsx`（138）／`system/forms/payroll-notice/PayrollNoticeClient.tsx`（170）／`system/attendance/AttendanceClient.tsx`（54）／`system/attendance/sync-status/SyncStatusClient.tsx`（37-46）／`system/onboarding/admin/page.tsx`（29）／`system/onboarding/admin/[employeeId]/page.tsx`（24-25）／`system/docs/_components/CompanyDocument.tsx`（22-25）／`system/docs/_components/OrganizationChart.tsx`（14-17） | 社員・入社予定者の氏名を出している表・行・見出し・組織図 |
| Root | `root/employees/page.tsx`（659-667 表／729・751・785）／`root/bank-accounts/page.tsx`（153）／`root/companies/page.tsx`（214-215）／`root/permissions/PermissionsClient.tsx`（148-149）／`root/contracts/page.tsx`（122）／`root/inbox/page.tsx`（92）／`root/bank-check/page.tsx`（186） | 従業員の表・履歴・口座名義・代表者名・一覧 |
| Bud | `bud/transfers/[transfer_id]/page.tsx`（188-198）／`bud/transfers/_components/TransferDetailContent.tsx`（59-107）／`TransferFormRegular.tsx`（665-675 確認欄）／`TransferApprovalPanel.tsx`（552）／`TransferPaymentCategoryPanel.tsx`（510）／`DuplicateWarning.tsx`（53）／`bud/transfers/csv-export/page.tsx`（231-233）／`bud/statements/_components/ManualAssignModal.tsx`（163）／`bud/expenses/_components/ExpenseReviewPanel.tsx`（1818・1939）／`ExpenseBookingPanel.tsx`（604）／`ExpenseBookingGroupHeader.tsx`（62）／`ExpenseFinalPanel.tsx`（663） | 支払先名・名義カナ・申請者名を出している表・詳細欄 |
| Tree | `tree/call/page.tsx`（348-350・757-767）／`tree/calling/branch/page.tsx`（301-311・745）／`tree/calling/sprout/page.tsx`（560-570）／`tree/search/page.tsx`（93-95）／`tree/toss-wait/page.tsx`（172・225）／`tree/confirm-wait/page.tsx`（207）／`tree/_components/ProspectList.tsx`（241・262）／`tree/monitoring`（126・251）／`tree/alerts`（187）／`tree/aporan`（283・341）／`tree/ranking`（152）／`tree/feedback`（133・157）／`tree/birthday/page.tsx`（144） | お客様の氏名・住所の欄、社員名の一覧 |
| Rill | `rill/mail/_components/RillMailScreen.tsx`（893 受信の一覧／897・900 詳細の差出人と宛先） | 差出人名・宛先の欄（本文の欄も付ける） |
| ポータル | `p/toss/board/Board.tsx`（36 の表）／`p/toss/new/TossForm.tsx`（33 照合結果・35） | 申込者名・契約名義・住所の欄 |
| Bloom | `bloom/workboard/components/WorkboardDashboard.tsx`（250） | メンバーの氏名 |

- `bud/payroll` などの「見本の HTML を `BudFaithfulFrame` で出している画面」は、`BudFaithfulFrame` の外側に 1 つ付ける（中の見本に名前が入っている可能性があるため）
- 表のまとまりに付けると数字・日付も一緒に伏せられるが、それで構わない（どこを押したか・どこで迷ったかは見える）

## 2. 触るファイル
- 新規 `src/app/_components/analytics/ClarityTracker.tsx`・`ClarityTracker.test.tsx`・`src/app/_lib/clarity-mask.ts`
- `src/app/layout.tsx`
- 上の表のファイル（属性を 1 つ足すだけ・それ以外を変えない）
- 既存のテストが属性の追加で壊れた場合だけ、そのテストを直す

## 3. テスト（vitest・**`npx vitest run src/app` の全部**を流して、前から落ちているもの以外は緑に）
- ClarityTracker：ID が空なら何も描かない・`window.clarity` を呼ばない／ID が英数字以外なら読み込まない／ID ありで読み込みのスクリプトが入る／ログイン中は identify が社員番号と pathname で呼ばれ、pathname が変わると再び呼ばれる／未ログインは identify しない
- 代表の画面（リストマスタの一覧・マイページの基本情報・Root の従業員の表）で、氏名の要素の祖先に `data-clarity-mask="true"` があること
- 前から落ちているテスト（例：AppHeader の 5 本）は、落ちたままでよい。完了報告に「前から」と書く
- `npx tsc --noEmit`・触ったファイルの eslint

## 4. 画面の絵（**見た目は変わらない**）
```
（利用者の画面）今までと同じ。何も表示されない。
（東海林さんの Clarity の録画）
 System / リストマスタ                      ▪▪▪ さん        ← 本人の氏名は伏せられる
 該当 ▫▫,▫▫▫ 件（▫.▫ 秒）                                  ← 数字は Clarity が自動で伏せる
 電話番号   氏名  住所        …  区分                        ← 見出しは見える
 •••••••   •••  ••••••••        [••••]                     ← 一覧の中身は伏せられる
 （クリックの位置・スクロール・迷い方・どのボタンを押したかは見える）
```

## 5. 完了報告（コードブロックで・コピーできる形）
- 起点の main のコミット／変えたファイル（伏せる印を付けたファイルの一覧と数）／テスト本数と結果（前から落ちているものは別に）／tsc・eslint
- 表にあったのに付けなかった場所（理由つき）・表に無いが付けた場所
- 気づいた点・やり残し
