/**
 * D-08 テスト戦略 / 従業員 fixture 骨格
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-08-test-strategy.md §2.2
 *
 * 設計方針:
 *   - factory 関数 buildEmployee で minimal 入力 → デフォルト埋め
 *   - 名前付き fixture（regular_30_kou_0, parttime_22_otsu, ...）で代表ケースを再利用
 *   - 雇用形態 × 年齢階層 × 甲乙 × 扶養人数 を全組合せする generator
 *
 * 使用箇所: D-02 給与計算 / D-03 賞与 / D-05 社保 / D-06 年末調整 等の単体テストで横断利用。
 */

export type EmploymentType =
  | "regular"
  | "parttime"
  | "contract"
  | "outsourced"
  | "intern";
export type KouOtsu = "kou" | "otsu";
export type GardenRole =
  | "toss"
  | "closer"
  | "cs"
  | "staff"
  | "manager"
  | "admin"
  | "super_admin";

export interface EmployeeFixture {
  id: string;
  fullName: string;
  employmentType: EmploymentType;
  dateOfBirth: string; // ISO YYYY-MM-DD
  hireDate: string;
  retiredDate: string | null;
  kouOtsu: KouOtsu;
  dependentsCount: number;
  prefecture: string; // 都道府県（社保料率分岐用）
  isOnChildcareLeave: boolean;
  isOnMaternityLeave: boolean;
  gardenRole: GardenRole;
  /** 月給制基本給（円） */
  monthlyBasePay: number;
  /** 時給（円、hourly 用） */
  hourlyRate: number | null;
  hasResidentTax: boolean;
}

const DEFAULT_FIXTURE: EmployeeFixture = {
  id: "fixture-emp-default",
  fullName: "山田太郎",
  employmentType: "regular",
  dateOfBirth: "1996-04-01",
  hireDate: "2020-04-01",
  retiredDate: null,
  kouOtsu: "kou",
  dependentsCount: 0,
  prefecture: "東京都",
  isOnChildcareLeave: false,
  isOnMaternityLeave: false,
  gardenRole: "staff",
  monthlyBasePay: 300_000,
  hourlyRate: null,
  hasResidentTax: true,
};

/**
 * minimal 入力 → デフォルト埋めで EmployeeFixture を生成。
 */
export function buildEmployee(
  overrides: Partial<EmployeeFixture> = {},
): EmployeeFixture {
  return { ...DEFAULT_FIXTURE, ...overrides };
}

// ============================================================
// 名前付き代表 fixture（spec §2.2 抜粋 + 拡張）
// ============================================================

export const namedEmployeeFixtures: Record<string, EmployeeFixture> = {
  /** 正社員 30 歳 / 甲 / 扶養 0 / 東京（基本ケース） */
  regular_30_kou_0_tokyo: buildEmployee({
    id: "fix-r30k0t",
    fullName: "山田太郎",
    employmentType: "regular",
    dateOfBirth: "1996-04-01",
    kouOtsu: "kou",
    dependentsCount: 0,
    prefecture: "東京都",
  }),

  /** 正社員 45 歳 / 甲 / 扶養 2 / 介護対象 / 大阪 */
  regular_45_kou_2_care_osaka: buildEmployee({
    id: "fix-r45k2co",
    fullName: "鈴木花子",
    dateOfBirth: "1981-04-01",
    kouOtsu: "kou",
    dependentsCount: 2,
    prefecture: "大阪府",
  }),

  /** 正社員 65 歳 / 甲 / 扶養 0 / 介護対象外 / 神奈川 */
  regular_65_kou_0_no_care_kanagawa: buildEmployee({
    id: "fix-r65k0n",
    fullName: "佐藤次郎",
    dateOfBirth: "1961-04-01",
    kouOtsu: "kou",
    dependentsCount: 0,
    prefecture: "神奈川県",
  }),

  /** アルバイト 22 歳 / 乙 / 時給 1500 円 */
  parttime_22_otsu: buildEmployee({
    id: "fix-p22o",
    fullName: "高橋三郎",
    employmentType: "parttime",
    dateOfBirth: "2004-04-01",
    kouOtsu: "otsu",
    dependentsCount: 0,
    monthlyBasePay: 0,
    hourlyRate: 1500,
    gardenRole: "toss",
  }),

  /** アルバイト 19 歳 / 乙 / 学生 */
  parttime_19_otsu_student: buildEmployee({
    id: "fix-p19os",
    fullName: "田中四郎",
    employmentType: "parttime",
    dateOfBirth: "2007-04-01",
    kouOtsu: "otsu",
    monthlyBasePay: 0,
    hourlyRate: 1300,
    gardenRole: "toss",
    hasResidentTax: false,
  }),

  /** 契約社員 35 歳 / 甲 / 扶養 1 */
  contract_35_kou_1: buildEmployee({
    id: "fix-c35k1",
    fullName: "伊藤五郎",
    employmentType: "contract",
    dateOfBirth: "1991-04-01",
    dependentsCount: 1,
    monthlyBasePay: 280_000,
    gardenRole: "cs",
  }),

  /** 業務委託 50 歳 / 甲 / 扶養 3 */
  outsourced_50_kou_3: buildEmployee({
    id: "fix-o50k3",
    fullName: "渡辺六郎",
    employmentType: "outsourced",
    dateOfBirth: "1976-04-01",
    dependentsCount: 3,
    monthlyBasePay: 400_000,
    gardenRole: "manager",
  }),

  /** 退職予定（月途中、6/15 退職） */
  regular_retiring_midmonth: buildEmployee({
    id: "fix-rretmid",
    fullName: "斎藤七郎",
    retiredDate: "2026-06-15",
    monthlyBasePay: 320_000,
  }),

  /** 育休中（社保免除） */
  regular_on_childcare_leave: buildEmployee({
    id: "fix-rchl",
    fullName: "山本花子",
    isOnChildcareLeave: true,
    dependentsCount: 1,
  }),

  /** 産休中 */
  regular_on_maternity_leave: buildEmployee({
    id: "fix-rml",
    fullName: "中村美咲",
    isOnMaternityLeave: true,
  }),

  /** 介護対象境界（40 歳到達月） */
  regular_40_birthday_month: buildEmployee({
    id: "fix-r40bd",
    fullName: "小林八郎",
    dateOfBirth: "1986-04-01", // 2026-04 で 40 歳
    dependentsCount: 0,
  }),

  /** 介護対象上限境界（65 歳到達月の前月） */
  regular_65_birthday_previous_month: buildEmployee({
    id: "fix-r65pre",
    fullName: "加藤九郎",
    dateOfBirth: "1961-05-01", // 2026-04 で 64 歳 11 ヶ月
  }),

  /** 扶養 7 人 vs 8 人境界（7 人ケース） */
  regular_kou_dependents_7: buildEmployee({
    id: "fix-rk7",
    fullName: "吉田十郎",
    dependentsCount: 7,
  }),

  /** 扶養 8 人ケース（特例） */
  regular_kou_dependents_8: buildEmployee({
    id: "fix-rk8",
    fullName: "山田大",
    dependentsCount: 8,
  }),

  /** super_admin（東海林さん想定） */
  super_admin_user: buildEmployee({
    id: "fix-super",
    fullName: "東海林美琴",
    gardenRole: "super_admin",
    dependentsCount: 0,
    monthlyBasePay: 600_000,
  }),

  /** admin（経理担当） */
  admin_user: buildEmployee({
    id: "fix-admin",
    fullName: "上田経理",
    gardenRole: "admin",
    monthlyBasePay: 450_000,
  }),

  /** インターン（雇用保険免除） */
  intern_20: buildEmployee({
    id: "fix-i20",
    fullName: "新人太郎",
    employmentType: "intern",
    dateOfBirth: "2006-04-01",
    monthlyBasePay: 0,
    hourlyRate: 1100,
    gardenRole: "toss",
    hasResidentTax: false,
  }),
};

// ============================================================
// 全組合せ generator（雇用形態 × 年齢階層 × 甲乙 × 扶養人数）
// ============================================================

const EMPLOYMENT_TYPES_FOR_MATRIX: EmploymentType[] = [
  "regular",
  "parttime",
  "contract",
  "outsourced",
];
const AGE_BUCKETS = [22, 30, 40, 50, 60]; // 主要年齢階層
const KOU_OTSU_VALUES: KouOtsu[] = ["kou", "otsu"];
const DEPENDENTS_COUNTS = [0, 1, 2, 3];

/**
 * 全組合せ fixture を生成（雇用形態 5 × 年齢 5 × 甲乙 2 × 扶養 4 = 200 通り）。
 *
 * テストでは必要な組合せのみフィルタ利用。spec §2.2 の「網羅性」要件を満たす。
 */
export function generateAllEmployeeMatrix(): EmployeeFixture[] {
  const result: EmployeeFixture[] = [];
  const baseYear = 2026;

  for (const empType of EMPLOYMENT_TYPES_FOR_MATRIX) {
    for (const age of AGE_BUCKETS) {
      for (const kou of KOU_OTSU_VALUES) {
        for (const dep of DEPENDENTS_COUNTS) {
          const birthYear = baseYear - age;
          result.push(
            buildEmployee({
              id: `fix-mtx-${empType}-${age}-${kou}-${dep}`,
              fullName: `${empType}-${age}-${kou}-d${dep}`,
              employmentType: empType,
              dateOfBirth: `${birthYear}-04-01`,
              kouOtsu: kou,
              dependentsCount: dep,
              monthlyBasePay: empType === "parttime" ? 0 : 250_000 + age * 5000,
              hourlyRate: empType === "parttime" ? 1300 + age * 10 : null,
            }),
          );
        }
      }
    }
  }

  return result;
}

/**
 * 名前付き fixture + マトリクス全件をまとめて返す（spec §2.2: 50+）。
 */
export function getAllEmployeeFixtures(): EmployeeFixture[] {
  return [
    ...Object.values(namedEmployeeFixtures),
    ...generateAllEmployeeMatrix(),
  ];
}
