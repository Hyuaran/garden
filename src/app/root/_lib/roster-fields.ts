export const ROSTER_FIELDS: Record<string, Record<string, string>> = {
  "address": {
    "postal_code": "郵便番号",
    "prefecture": "文字列__1行_",
    "city": "文字列__1行__0",
    "town": "文字列__1行__2",
    "building": "文字列__1行__3",
    "room": "文字列__1行__4",
    "full": "住所"
  },
  "contact": {
    "phone": "連絡先",
    "phone_1": "文字列__1行__15",
    "phone_2": "文字列__1行__16",
    "phone_3": "文字列__1行__17",
    "email": "メールアドレス"
  },
  "commute": {
    "one_way": "交通費_片道",
    "round_trip": "交通費_往復",
    "monthly_cap": "交通費上限",
    "nearest_station": "ドロップダウン_3",
    "route": "文字列__1行__6",
    "paid": "ドロップダウン_1"
  },
  "employment": {
    "employment_type": "雇用形態",
    "hire_date": "入社日",
    "business": "ドロップダウン",
    "department": "ドロップダウン_0",
    "affiliation": "ドロップダウン_15",
    "team": "チーム名",
    "salary_system": "配属・異動_1",
    "base_hourly": "基準時給",
    "training_hourly": "数値_0",
    "training_cap": "数値",
    "year_end_adjustment": "ドロップダウン_8",
    "social_insurance": "ドロップダウン_5",
    "employment_insurance": "ドロップダウン_4",
    "employment_insurance_no": "雇用保険番号",
    "pension_no": "文字列__1行__8",
    "advance_pay": "ドロップダウン_6",
    "call_type": "ドロップダウン_16"
  },
  "bank_account": {
    "bank_name": "銀行名_1",
    "bank_code": "金融機関コード_1",
    "branch_name": "文字列__1行__18",
    "branch_code": "支店コード_1",
    "account_type": "種別",
    "account_number": "口座番号_1",
    "holder_kana": "文字列__1行__9"
  },
  "sub_account": {
    "bank_name": "銀行名_2",
    "bank_code": "金融機関コード_2",
    "branch_name": "文字列__1行__19",
    "branch_code": "支店コード_2",
    "account_type": "種別_1",
    "account_number": "口座番号_2",
    "holder_kana": "文字列__1行__10"
  }
};
export const ROSTER_CHOICES: Record<string, readonly string[]> = {
ドロップダウン:['テレマーケティング','SES','所属なし'], ドロップダウン_0:['営業0部','営業1部','営業2部','所属なし'],
ドロップダウン_1:['あり','なし','不明'], ドロップダウン_3:['長堀橋','心斎橋','難波','堺筋本町','本町'],
ドロップダウン_4:['加入経験あり','加入中','未加入'], ドロップダウン_5:['加入経験あり','加入中','未加入','国民健康保険','扶養'],
ドロップダウン_6:['必要','不要'], ドロップダウン_8:['する','しない'], ドロップダウン_15:['ヒュアラン','センターライズ','リンクサポート','ARATA','たいよう','不明','給与支払なし'],
ドロップダウン_16:['トス','クローザー','事務','なし'], チーム名:['小泉チーム','宮永チーム','石原チーム','ヒュアラングループ','バックヤード','所属なし'],
雇用形態:['役員','正社員','準社員','アルバイト','パート','派遣','パートナー'], 種別:['普通','当座'], 種別_1:['普通','当座'], 銀行名_1:['楽天銀行'], 従業員ステータス:['在籍中','退職済み','給与支払なし'],
};
