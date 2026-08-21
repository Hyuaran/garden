export type MyPageProfile = {
  name: string;
  nameKana: string;
  employeeNumber: string;
  employmentType: string;
  birthday: string | null;
  email: string;
  gardenRole: string;
};

export type MyPageTab = "profile" | "attendance" | "shift" | "zenkaku";
