# Codex-325 マニュアル画面：資料ファイルを画面から差し替える（全権管理者）＋旧版を残す

作成日: 2026-09-13
作業ツリー: C:\garden\a-bloom-008
起点: main d6ef8ac（`git log -1` で一致を確認してから着手）
**git は触らないこと（commit するな）。本番のデータ・Storage に触らないこと。開発サーバ・ブラウザを起動しないこと。**

必ず先に読むもの：
- ④正本：C:\Claude\000_Garden\150_System_システム\00_マニュアル\15_マニュアル画面\Garden_System_マニュアル画面_4_仕様書_Claude読み込み用.md（§2 画面構成・§3 登録表・§5 API・**§6-1 正本は Storage**）
- 画面：C:\garden\a-bloom-008\src\app\system\manuals\（`[module]/[slug]/page.tsx`・`ManualDetailClient.tsx`・`_lib/manuals-registry.ts`（`MANUAL_DOCS`＝5 タブの file 名と minRole）・`manuals.module.css`）
- API：C:\garden\a-bloom-008\src\app\api\system\manuals\[module]\[slug]\[file]\route.ts（権限の確認の仕方・Storage からの download。**新しい API は同じ確認をそのまま使う**）
- 参考（アップロードの見た目）：契約書管理のアップロード画面（ドラッグ＆ドロップの枠・ファイル一覧）、リストマスタのアップロードタブ（`src/app/system/list/_components/ListMasterClient.tsx` の STEP 1〜3）

## 0. 何を作るか（東海林さん 2026-09-13「Garden では Supabase が主体としてデータを持つ。ローカルはバックアップ」）

今：資料 5 点セットは Claude がローカルで直し、スクリプトで Storage に置く（画面からは読むだけ）。
これから：**全権管理者がマニュアル画面から資料ファイルを差し替えられる**ようにし、差し替えたとき**旧版を Storage に残す**（上書きで消えない）。

```
/system/manuals/system/list?tab=engineer（全権管理者で開いたとき）
┌ System ／ マニュアル ／ System ／ リストマスタ ────────────────────────────────┐
│ [操作マニュアル] [要点] [仕組み] [仕様] [Claude 用]                     ［この資料を差し替える］ │
│ ┌ 資料（iframe）───────────────────────────────────────────────────────┐ │
│ │ …                                                                       │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ 版の履歴（この資料）                                                            │
│  2026/09/13 21:30  東海林 美琴  62,087 バイト  いま表示中                              │
│  2026/09/07 22:50  東海林 美琴  22,446 バイト  ［この版に戻す］［開く］                  │
└───────────────────────────────────────────────────────────────────┘

［この資料を差し替える］を押すと（モーダル）：
┌ 資料を差し替える：リストマスタ ／ 仕様（エンジニア向け）────────────┐
│ ┌ ここにファイルをドラッグ＆ドロップ（.html／.md・5MB まで）┐         │
│ │            ［ファイルを選ぶ］                               │         │
│ └────────────────────────────────────────┘         │
│ 選んだファイル：Garden_System_リストマスタ_3_仕様書マニュアル_エンジニア向け.html（62,087 バイト）│
│ 今の版は「版の履歴」に残ります。                     ［キャンセル］［差し替える］ │
└──────────────────────────────────────────────────┘
```

## 1. 権限
- 差し替え・版の履歴・戻す＝**全権管理者（super_admin）だけ**。それ未満にはボタンも履歴も出さない（API も 403）
- 読む側（既存 GET）は変えない

## 2. Storage の置き方（旧版の保持）
- 今の版：`system-manuals/<module>/<slug>/<file>`（既存のまま。GET はここを読む）
- 旧版：差し替えるとき、今の版を `system-manuals/<module>/<slug>/_versions/<file>.<YYYYMMDD-HHMMSS>` にコピーしてから上書きする（Storage の `copy` → `upload({ upsert: true })`）
- 版の履歴の一覧＝`list("<module>/<slug>/_versions")` を `<file>.` で始まるものに絞って新しい順
- 記録表 `system_manual_versions`（migration を書く・SQL は Claude が実行）：id、module、slug、file、storage_path（旧版の置き場）、size、uploaded_by（表示名）、uploaded_at、note（任意）。「いま表示中」の版も 1 行入れる（storage_path＝今の版の場所）。RLS 有効・ポリシーなし・service_role のみ（他の soil/system 表と同じ形）

## 3. API（すべて `src/app/api/system/manuals/…`・runtime nodejs・既存 GET と同じ権限確認＋super_admin）
| API | 中身 |
|---|---|
| POST `[module]/[slug]/[file]/replace` | multipart（file）。登録表にある file だけ（`findManualDoc`）。拡張子は file と同じ（html は html・md は md）・5MB まで・空は 400。今の版を `_versions` へコピー → 上書き → `system_manual_versions` に 1 行 → `{ ok, version }` |
| GET `[module]/[slug]/[file]/versions` | 版の履歴（新しい順・最大 50）。`{ ok, current: {…}, versions: [{ id, uploaded_at, uploaded_by, size, storage_path }] }` |
| POST `[module]/[slug]/[file]/restore` | `{ versionId }`。その旧版を今の版に戻す（戻す前の今の版も `_versions` に残す） |
| GET `[module]/[slug]/[file]/versions/[versionId]` | 旧版の中身（iframe で開く用・同じ Content-Type・no-store） |

- エラー文言は画面にそのまま出るので開発者用語を入れない（「差し替えられませんでした」「この版に戻せませんでした」）

## 4. 画面
- `ManualDetailClient.tsx`：全権管理者のとき、タブ列の右端に［この資料を差し替える］（社長スタイルのボタン・SVG 線画のアップロードアイコン）。押すとモーダル（ドラッグ＆ドロップ＋［ファイルを選ぶ］・選んだファイル名とバイト数・［差し替える］）。差し替え中は全画面のくるくる（`ListProcessingOverlay` と同じ作り＝経費精算の正本をコピー・body 直下・finally で閉じる）。終わったら iframe を読み直し（`src` に `&v=<時刻>` を付ける）、「差し替えました（旧版は履歴に残しました）」
- iframe の下に「版の履歴（この資料）」の表：日時・誰が・バイト数・「いま表示中」／［この版に戻す］［開く］。戻すときは confirm（「2026/09/07 22:50 の版に戻します。いまの版は履歴に残ります。」）
- 権限の判定は page.tsx で読んでいる役職を prop で渡す（画面側で API を叩いて判定しない）

## 5. テスト
- API：super_admin 以外 403／登録表に無い file 404／拡張子違い 400／差し替えで `_versions` へのコピーと upsert と記録の insert が呼ばれる／restore で戻す前の版が残る
- 画面：全権管理者でボタンと履歴が出る・社員では出ない・差し替え後に iframe の src が変わる
- 既存テスト（src/app/system/manuals・src/app/api/system/manuals）は全部通す

## 6. 変えてはいけないもの
- 既存 GET の権限・応答／登録表の形／左メニュー（shacho-shell-config.ts は触らない）

## 7. 受け入れ基準
1. vitest（src/app/system/manuals・src/app/api/system/manuals）が通る　2. tsc に今回の変更由来のエラーが無い　3. eslint（変更ファイル単位）が通る
4. Claude が本番で：全権管理者で［この資料を差し替える］→ .html を上げる → iframe が新しい中身になる → 版の履歴に旧版が出る → ［この版に戻す］で戻る、を実測。社員相当のアカウントではボタンが出ない

## 8. 完了報告（コードブロックで出力）
- 「未コミット」と明記／変更・追加ファイルのフルパス／migration のパス／受け入れ基準 1〜3 の結果／本番データ・Storage・git に触っていないことの明記

## 9. 既知の差分（Codex が追記する）
