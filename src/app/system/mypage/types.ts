export type MyPageProfile = {
  name: string;
  nameKana: string;
  employeeNumber: string;
  employmentType: string;
  birthday: string | null;
  email: string;
  gardenRole: string;
  bankName: string | null;
  branchName: string | null;
  commuteDailyAllowance: number | null;
  commuteMonthlyCap: number | null;
  mynaSubmitted: boolean;
};

export type MyPageTab = "profile" | "attendance" | "shift" | "zenkaku";
