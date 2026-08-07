import type { KintoneRecord } from "./kintone.server";

export type KandenLookup = {
  listName: string; customerNumber: string; phone: string; contractNameKanji: string;
  contractNameKana: string; postalCode: string; address1: string; address2: string;
  leavingDestination: string; leavingDate: string; contractType: string;
  contractCapacityLight: string; contractCapacityPower: string; kandenGasContract: string;
  powerContract: string; demandStartDate: string; annualUsageLight: string;
  monthlyUsageLight: string; monthlyUsagePower: string;
};

export type TossFormInput = {
  email: string; useTossCb: string; tossCbAmount: string; tossUpItems: string[];
  comment: string; rank: string; preferredTimes: string[]; listCategory: string;
  pdManagementNumber: string; pd: string; applicantType: string; applicantLastName: string;
  applicantFirstName: string; applicantLastKana: string; applicantFirstKana: string;
  birthDate: string; addressType: string; postalCode: string; prefecture: string;
  city: string; town: string; building: string; room: string; contactType: string;
  contactPhone: string; smartphoneCarrier: string;
};

const v = (value: unknown) => ({ value: value == null ? "" : String(value) });

export function buildTossRecord(input: TossFormInput, partnerCode: string): KintoneRecord {
  return {
    LINK: v(input.email),
    ドロップダウン_2: v(input.useTossCb),
    数値_0: v(input.tossCbAmount),
    チェックボックス: { value: input.tossUpItems },
    文字列__複数行_: v(input.comment),
    ドロップダウン_3: v(input.rank),
    チェックボックス_1: { value: input.preferredTimes },
    ドロップダウン_1: v(input.listCategory),
    ルックアップ_0: v(input.pdManagementNumber),
    文字列__1行__19: v(input.pd),
    ドロップダウン_8: v(input.applicantType),
    文字列__1行__4: v(input.applicantLastName),
    文字列__1行__5: v(input.applicantFirstName),
    文字列__1行__2: v(input.applicantLastKana),
    文字列__1行__3: v(input.applicantFirstKana),
    日付_3: v(input.birthDate),
    ドロップダウン_12: v(input.addressType),
    文字列__1行__8: v(input.postalCode),
    文字列__1行__17: v(input.prefecture),
    文字列__1行__16: v(input.city),
    文字列__1行__15: v(input.town),
    文字列__1行__9: v(input.building),
    文字列__1行__18: v(input.room),
    ドロップダウン_10: v(input.contactType),
    文字列__1行__33: v(input.contactPhone),
    ドロップダウン_9: v(input.smartphoneCarrier),
    ルックアップ: v(partnerCode),
  };
}

export function validateTossInput(value: unknown): TossFormInput {
  if (!value || typeof value !== "object") throw new Error("入力内容が不正です");
  const input = value as Partial<TossFormInput>;
  const required: (keyof TossFormInput)[] = ["email", "useTossCb", "rank", "listCategory", "pdManagementNumber", "pd", "applicantLastName", "applicantFirstName", "applicantLastKana", "applicantFirstKana", "birthDate", "postalCode", "prefecture", "city", "town", "contactPhone"];
  for (const key of required) if (typeof input[key] !== "string" || !input[key]?.trim()) throw new Error(`${key} は必須です`);
  if (!/^\S+@\S+\.\S+$/.test(input.email!)) throw new Error("メールアドレスが不正です");
  if (!/^\d{7}$/.test(input.postalCode!.replace(/-/g, ""))) throw new Error("郵便番号は7桁で入力してください");
  return { ...input, tossUpItems: Array.isArray(input.tossUpItems) ? input.tossUpItems.map(String) : [], preferredTimes: Array.isArray(input.preferredTimes) ? input.preferredTimes.map(String) : [] } as TossFormInput;
}

export function field(record: KintoneRecord, code: string) {
  const value = record[code]?.value;
  return value == null || Array.isArray(value) ? "" : String(value);
}
