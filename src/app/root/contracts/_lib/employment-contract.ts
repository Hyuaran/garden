export type ContractKind = "new" | "renewal";
export type JobType = "sales" | "office" | "tech" | "other";
export type EmploymentContractPayload = {
  kind: ContractKind;
  contractStart: string;
  contractEnd: string;
  jobType: JobType;
  jobTypeOther: string;
  hourlyWage: number;
  workLocation: string;
  concludedOn: string;
  employeeAddress: string;
};
export type ContractEmployee = {
  employee_id: string;
  employee_number: string;
  name: string;
  company_id: string;
  employment_type: string;
  is_active: boolean;
  root_companies?: {
    company_name: string;
    representative: string;
    address: string;
  } | null;
};
export type ContractRow = {
  id: string;
  employee_id: string;
  payload: EmploymentContractPayload;
  pdf_status: "generated" | "skipped" | "failed";
  pdf_drive_file_id: string | null;
  pdf_drive_url: string | null;
  pdf_note: string | null;
  created_at: string;
  root_employees?: ContractEmployee | null;
};

export const CONTRACT_TEXT = {
  agreement: [
    "1. 甲は乙を雇用し、乙は甲に対し労務を提供することを合意する。",
    "2. 労働条件は、本書に定める。",
    "3. 乙は甲の就業規則、私物持込・保管管理規定、その他諸規定および所属長の指揮に従い、誠実に従事するものとする。",
  ],
  renewal:
    "原則として更新しない。 ただし、業務量、勤務成績・態度、能力、経営状況により甲が判断し、合意の上で新たな契約を締結する場合がある。",
  renewalCriteria:
    "勤怠状況、職務遂行能力、勤務態度（協調性・規律保持）、経営状況等。",
  trial:
    "最初の採用日から起算して14日間とする。不適格と判断した場合、即時に本契約を解除できる。",
  work: [
    "1. 所定労働時間、始業・就業時刻、昼休憩\n1ヵ月単位の変形労働時間制・シフト制とし、1か月70時間以上173時間以内の範囲内で次の勤務時間の組み合わせにより決定します。また残業は甲の事前の指示・承認がある場合に限る。",
    "ただし、業務の都合により上記就業時間を変更する場合があります。",
    "2. 昼休憩　シフトBのみ、上記休憩時間に加えて13時00分～14時00分の昼休憩を与えます。休憩時間、昼休憩はともに無給とします。",
    "3. 所定外労働時間外の労働をさせることがあります。",
    "4. 休日　シフト制により少なくとも1週間に1日または4週間に4日以上の休みを確保する。（詳細は会社の部門カレンダー）",
    "5. 有給休暇　有給休暇については初回勤務より6か月ホに就業規則に基づき付与します。契約期間が6か月未満の場合には、有休休暇の付与はありません。",
  ],
  wage: [
    "2. 営業達成手当（歩合）\n(ア) 甲が定める「クルー人事制度」に基づき算出した額を、基本時給に加算、または当該加算分から減額して支給する。\n(イ) 減額により実際の支払時給が基本時給（最低賃金）を下回ることはない。\n(ウ) 甲が指定する方法により周知される最新の「クルー人事制度」の規定を適用するものとする。なお、当該制度は業務状況等により月途中に改定される場合があり、乙は常に最新の規定が適用されることに同意する。",
    "3. 入社時特別保障　累計120時間までは時給 1,500 円を保障する。",
    "4. 手当の支給条件　営業達成手当（保障分含む）は、支給日に在籍し、所定の業務（退職時の引継ぎ等を含む）を誠実に遂行した者を評価対象とする。",
    "5. 諸手当　通勤交通費は、1日500円または月額上限 20,000円とし、1か月の定期代相当または実費の金額の安価な方を適用します。",
    "6. 所定外労働等に対する割増率\n(ア) 所定外\nA)　法定超　1.25\nB)　所定超　1.00\nC)　深夜　　A+B+0.25\n(イ) 休日\nA)　法定休日　1.35\nB)　法定休日以外　1.00（ただし、法定越1.25）",
    "7. 賃金締切日　毎月末日締め",
    "8. 賃金支払日　翌月最終営業日（振込反映時間は金融機関に依存するため個別の回答は行わず、また甲への直接の前借申請は受け付けない）",
    "9. 賞与　　賞与の支給はありません。",
    "10. 退職金　退職金の支給はありません。",
  ],
  other: [
    "1. 就業規則、人事制度、秘密保持、私物持込・保管管理規定等を遵守すること。",
    "2. 甲が指定する通信手段等の利用状況を甲が確認・閲覧することに同意すること。",
    "3. 緊急連絡先は身元保証人を兼ねるものとし、その承諾を得ていることを確約すること。",
    "4. 退職後を含め、連絡は指定の方法で行い、過度な催促や業務妨害を行わないこと。",
    "5. 欠勤・遅刻等の連絡は、原則として始業時刻前までに会社が指定する方法で行うこと。",
    "6. 勤怠の打刻修正は、正確な給与計算のため原則当日中に行うこと。",
  ],
} as const;

export function validateContract(
  employeeId: string,
  p: Partial<EmploymentContractPayload>,
) {
  if (
    !employeeId ||
    !["new", "renewal"].includes(String(p.kind)) ||
    !p.contractStart ||
    !p.contractEnd ||
    !["sales", "office", "tech", "other"].includes(String(p.jobType)) ||
    !p.concludedOn ||
    !String(p.workLocation ?? "").trim()
  )
    return "必須項目を入力してください。";
  if (p.jobType === "other" && !String(p.jobTypeOther ?? "").trim())
    return "その他の業務内容を入力してください。";
  if (!Number.isInteger(Number(p.hourlyWage)) || Number(p.hourlyWage) <= 0)
    return "時給は正の整数で入力してください。";
  if (p.contractStart >= p.contractEnd)
    return "契約終了日は開始日より後の日付にしてください。";
  return null;
}
