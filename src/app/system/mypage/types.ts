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

export const MY_PAGE_ROUTES: Record<MyPageTab, string> = {
  profile: "/system/mypage",
  attendance: "/system/attendance",
  shift: "/system/shift",
  zenkaku: "/system/zenkaku",
};

export const MY_PAGE_TITLES: Record<MyPageTab, string> = {
  profile: "自分の情報",
  attendance: "勤怠打刻",
  shift: "シフト",
  zenkaku: "前確依頼",
};
