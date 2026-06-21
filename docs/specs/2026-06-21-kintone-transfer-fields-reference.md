# 振込依頼 (app 51 / /k/51/)

| type | ラベル | フィールドコード |
|---|---|---|
| RECORD_NUMBER | レコード番号 | レコード番号 |
| SINGLE_LINE_TEXT | 重複キー | 重複キー |
| STATUS | ステータス | ステータス |
| GROUP | キャッシュバック依頼一覧 | グループ |
| CATEGORY | カテゴリー | カテゴリー |
| DATE | 依頼日 | 日付 |
| SUBTABLE | 振込履歴 | テーブル |
| └ DATETIME | └ 入力日時 | 日時 |
| └ MULTI_LINE_TEXT | └ 詳細 | 文字列__複数行_ |
| └ USER_SELECT | └ 入力者 | ユーザー選択 |
| STATUS_ASSIGNEE | 作業者 | 作業者 |
| NUMBER | パートナーコード | 数値_0 |
| CHECK_BOX | ▼みずほ銀行 | チェックボックス_0 |
| NUMBER | 振込手数料 | 数値_1 |
| SINGLE_LINE_TEXT | 支払期日(YYYYMMDD) | 文字列__1行__36 |
| SINGLE_LINE_TEXT | empty_2 | 文字列__1行__35 |
| DROP_DOWN | 商材名（×） | ドロップダウン_1 |
| DROP_DOWN | 商流名（×） | ドロップダウン_0 |
| SINGLE_LINE_TEXT | empty_5 | 文字列__1行__32 |
| SINGLE_LINE_TEXT | empty_6 | 文字列__1行__31 |
| CHECK_BOX | お支払い内容（条件分岐） | チェックボックス |
| SINGLE_LINE_TEXT | empty_3 | 文字列__1行__34 |
| SINGLE_LINE_TEXT | empty_4 | 文字列__1行__33 |
| USER_SELECT | 二重チェック者 | ユーザー選択_1 |
| NUMBER | 振込金額 | 数値 |
| DROP_DOWN | 受取人預金種目 | ドロップダウン_7 |
| DROP_DOWN | ステータス | ドロップダウン_6 |
| LINK | 請求書・支払明細 | リンク |
| DROP_DOWN | 実行登録 | ドロップダウン_8 |
| DROP_DOWN | 実行会社名 | ドロップダウン_3 |
| DROP_DOWN | 依頼会社名 | ドロップダウン_2 |
| CREATED_TIME | 作成日時 | 作成日時 |
| DROP_DOWN | 口座種別 | ドロップダウン_5 |
| DROP_DOWN | 実行銀行名 | ドロップダウン_4 |
| USER_SELECT | 振込実行者 | ユーザー選択_0 |
| GROUP | 空欄 | グループ_0 |
| MODIFIER | 更新者 | 更新者 |
| SINGLE_LINE_TEXT | 振込ID | 文字列__1行_ |
| SINGLE_LINE_TEXT | empty_7 | 文字列__1行__30 |
| SINGLE_LINE_TEXT | 楽天サービス区分 | 文字列__1行__25 |
| MULTI_LINE_TEXT | 備考 | 文字列__複数行__0 |
| SINGLE_LINE_TEXT | empty_1 | 文字列__1行__24 |
| SINGLE_LINE_TEXT | empty_10 | 文字列__1行__27 |
| SINGLE_LINE_TEXT | 重複キー識別子 | 文字列__1行__26 |
| SINGLE_LINE_TEXT | 顧客番号xx | 文字列__1行__21 |
| SINGLE_LINE_TEXT | 顧客番号x | 文字列__1行__20 |
| SINGLE_LINE_TEXT | 支払期日(MMDD) | 文字列__1行__23 |
| SINGLE_LINE_TEXT | 振込名 | 文字列__1行__22 |
| SINGLE_LINE_TEXT | empty_8 | 文字列__1行__29 |
| SINGLE_LINE_TEXT | empty_9 | 文字列__1行__28 |
| REFERENCE_TABLE | 明細一覧 | 関連レコード一覧_0 |
| REFERENCE_TABLE | 関連レコード　パートナー名簿 | 関連レコード一覧_1 |
| CREATOR | 作成者 | 作成者 |
| REFERENCE_TABLE | キャッシュバック依頼一覧 | 関連レコード一覧_2 |
| DROP_DOWN | 依頼者 | ドロップダウン |
| SINGLE_LINE_TEXT | お支払い先 | 文字列__1行__0 |
| SINGLE_LINE_TEXT | 商材名 | 文字列__1行__1 |
| UPDATED_TIME | 更新日時 | 更新日時 |
| SINGLE_LINE_TEXT | 支店名 | 文字列__1行__4 |
| SINGLE_LINE_TEXT | 顧客番号 | 文字列__1行__14 |
| DATE | 振込希望日 | 日付_5 |
| SINGLE_LINE_TEXT | 支店コード | 文字列__1行__5 |
| SINGLE_LINE_TEXT | 申込者電話番号 | 文字列__1行__13 |
| DATE | 開通日 | 日付_4 |
| SINGLE_LINE_TEXT | 銀行名 | 文字列__1行__2 |
| SINGLE_LINE_TEXT | 申込者_姓名 | 文字列__1行__16 |
| SINGLE_LINE_TEXT | 金融機関コード | 文字列__1行__3 |
| SINGLE_LINE_TEXT | 申込者名_姓名カナ | 文字列__1行__15 |
| SINGLE_LINE_TEXT | お支払い内容 | 文字列__1行__8 |
| SINGLE_LINE_TEXT | 申込者名_名カナ | 文字列__1行__10 |
| REFERENCE_TABLE | 関連レコード　顧客一覧 | 関連レコード一覧 |
| SINGLE_LINE_TEXT | 申込者名_姓カナ | 文字列__1行__9 |
| SINGLE_LINE_TEXT | 口座番号 | 文字列__1行__6 |
| SINGLE_LINE_TEXT | 申込者名_名 | 文字列__1行__12 |
| SINGLE_LINE_TEXT | 口座名義カナ | 文字列__1行__7 |
| SINGLE_LINE_TEXT | 申込者名_姓 | 文字列__1行__11 |
| LINK | 振込実行結果 | リンク_1 |
| REFERENCE_TABLE | 振込一覧 | 関連レコード一覧_3 |
| REFERENCE_TABLE | 振込実行 | 関連レコード一覧_4 |
| DATE | 振込実行日 | 日付_1 |
| SINGLE_LINE_TEXT | 口座種別（x） | 文字列__1行__18 |
| DATE | 支払期日 | 日付_0 |
| SINGLE_LINE_TEXT | 商流名 | 文字列__1行__17 |
| DATE | 受注日 | 日付_3 |
| DATE | 二重チェック日 | 日付_2 |
| SINGLE_LINE_TEXT | CBID | 文字列__1行__19 |

合計: 83 フィールド

# 振込実行 (app 98 / /k/98/)

| type | ラベル | フィールドコード |
|---|---|---|
| RECORD_NUMBER | レコード番号 | レコード番号 |
| STATUS | ステータス | ステータス |
| GROUP | キャッシュバック依頼一覧 | グループ |
| CATEGORY | カテゴリー | カテゴリー |
| SINGLE_LINE_TEXT | 受取人相違確認 | 文字列__1行__43 |
| SINGLE_LINE_TEXT | 受取人金額 | 文字列__1行__42 |
| DATE | 依頼日 | 日付 |
| SUBTABLE | 振込履歴 | テーブル |
| └ DATETIME | └ 入力日時 | 日時 |
| └ MULTI_LINE_TEXT | └ 詳細 | 文字列__複数行_ |
| └ USER_SELECT | └ 入力者 | ユーザー選択 |
| STATUS_ASSIGNEE | 作業者 | 作業者 |
| SINGLE_LINE_TEXT | 登録情報識別子 | 文字列__1行__41 |
| SINGLE_LINE_TEXT | 受取人識別子 | 文字列__1行__40 |
| NUMBER | パートナーコード | 数値_0 |
| CHECK_BOX | ▼みずほ銀行 | チェックボックス_0 |
| NUMBER | 振込手数料 | 数値_1 |
| SINGLE_LINE_TEXT | 支払期日(YYYYMMDD) | 文字列__1行__36 |
| SINGLE_LINE_TEXT | empty_2 | 文字列__1行__35 |
| DROP_DOWN | 商材名（×） | ドロップダウン_1 |
| SINGLE_LINE_TEXT | 受取人口座番号 | 文字列__1行__38 |
| DROP_DOWN | 商流名（×） | ドロップダウン_0 |
| SINGLE_LINE_TEXT | 受取人銀行番号 | 文字列__1行__37 |
| SINGLE_LINE_TEXT | empty_5 | 文字列__1行__32 |
| SINGLE_LINE_TEXT | empty_6 | 文字列__1行__31 |
| CHECK_BOX | お支払い内容（条件分岐） | チェックボックス |
| SINGLE_LINE_TEXT | empty_3 | 文字列__1行__34 |
| SINGLE_LINE_TEXT | empty_4 | 文字列__1行__33 |
| USER_SELECT | 二重チェック者 | ユーザー選択_1 |
| NUMBER | 振込金額 | 数値 |
| DROP_DOWN | 受取人預金種目 | ドロップダウン_7 |
| DROP_DOWN | ステータス | ドロップダウン_6 |
| LINK | 請求書・支払明細 | リンク |
| DROP_DOWN | 実行登録 | ドロップダウン_8 |
| DROP_DOWN | 実行会社名 | ドロップダウン_3 |
| DROP_DOWN | 依頼会社名 | ドロップダウン_2 |
| SINGLE_LINE_TEXT | 受取人支店番号 | 文字列__1行__39 |
| CREATED_TIME | 作成日時 | 作成日時 |
| DROP_DOWN | 口座種別 | ドロップダウン_5 |
| DROP_DOWN | 実行銀行名 | ドロップダウン_4 |
| USER_SELECT | 振込実行者 | ユーザー選択_0 |
| GROUP | 空欄 | グループ_0 |
| MODIFIER | 更新者 | 更新者 |
| SINGLE_LINE_TEXT | 振込ID | 文字列__1行_ |
| SINGLE_LINE_TEXT | empty_7 | 文字列__1行__30 |
| GROUP | 振込データインポート | グループ_1 |
| SINGLE_LINE_TEXT | 楽天サービス区分 | 文字列__1行__25 |
| MULTI_LINE_TEXT | 備考 | 文字列__複数行__0 |
| SINGLE_LINE_TEXT | empty_1 | 文字列__1行__24 |
| SINGLE_LINE_TEXT | empty_10 | 文字列__1行__27 |
| SINGLE_LINE_TEXT | 重複キー | 文字列__1行__26 |
| SINGLE_LINE_TEXT | 顧客番号xx | 文字列__1行__21 |
| SINGLE_LINE_TEXT | 顧客番号x | 文字列__1行__20 |
| SINGLE_LINE_TEXT | 支払期日(MMDD) | 文字列__1行__23 |
| SINGLE_LINE_TEXT | 振込名 | 文字列__1行__22 |
| SINGLE_LINE_TEXT | empty_8 | 文字列__1行__29 |
| SINGLE_LINE_TEXT | empty_9 | 文字列__1行__28 |
| REFERENCE_TABLE | 明細一覧 | 関連レコード一覧_0 |
| REFERENCE_TABLE | 関連レコード　パートナー名簿 | 関連レコード一覧_1 |
| CREATOR | 作成者 | 作成者 |
| REFERENCE_TABLE | キャッシュバック依頼一覧 | 関連レコード一覧_2 |
| DROP_DOWN | 依頼者 | ドロップダウン |
| SINGLE_LINE_TEXT | お支払い先 | 文字列__1行__0 |
| SINGLE_LINE_TEXT | 商材名 | 文字列__1行__1 |
| UPDATED_TIME | 更新日時 | 更新日時 |
| SINGLE_LINE_TEXT | 支店名 | 文字列__1行__4 |
| SINGLE_LINE_TEXT | 顧客番号 | 文字列__1行__14 |
| DATE | 振込希望日 | 日付_5 |
| SINGLE_LINE_TEXT | 支店コード | 文字列__1行__5 |
| SINGLE_LINE_TEXT | 申込者電話番号 | 文字列__1行__13 |
| DATE | 開通日 | 日付_4 |
| SINGLE_LINE_TEXT | 銀行名 | 文字列__1行__2 |
| SINGLE_LINE_TEXT | 申込者_姓名 | 文字列__1行__16 |
| SINGLE_LINE_TEXT | 金融機関コード | 文字列__1行__3 |
| SINGLE_LINE_TEXT | 申込者名_姓名カナ | 文字列__1行__15 |
| SINGLE_LINE_TEXT | お支払い内容 | 文字列__1行__8 |
| SINGLE_LINE_TEXT | 申込者名_名カナ | 文字列__1行__10 |
| REFERENCE_TABLE | 関連レコード　顧客一覧 | 関連レコード一覧 |
| SINGLE_LINE_TEXT | 申込者名_姓カナ | 文字列__1行__9 |
| SINGLE_LINE_TEXT | 口座番号 | 文字列__1行__6 |
| SINGLE_LINE_TEXT | 申込者名_名 | 文字列__1行__12 |
| SINGLE_LINE_TEXT | 口座名義カナ | 文字列__1行__7 |
| SINGLE_LINE_TEXT | 申込者名_姓 | 文字列__1行__11 |
| LINK | 振込実行結果 | リンク_1 |
| REFERENCE_TABLE | 振込一覧 | 関連レコード一覧_3 |
| DATE | 振込実行日 | 日付_1 |
| SINGLE_LINE_TEXT | 口座種別（x） | 文字列__1行__18 |
| DATE | 支払期日 | 日付_0 |
| SINGLE_LINE_TEXT | 商流名 | 文字列__1行__17 |
| DATE | 受注日 | 日付_3 |
| DATE | 二重チェック日 | 日付_2 |
| SINGLE_LINE_TEXT | CBID | 文字列__1行__19 |

合計: 89 フィールド

