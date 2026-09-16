import { getColumnName, type SoilListConditionPayload, type SoilListSortKey } from "@/app/system/list/_lib/list-fields";

import { IMPORT_COLUMNS, normalizePhone } from "./upload-parser";
import { buildExportPhoneSql } from "./export-sql";

export type FmImportSourceRow = {
  phoneNumber: string | null;
  mobileNumber: string | null;
  fullName: string | null;
  lastName: string | null;
  firstName: string | null;
  birthday: string | null;
  postalCode: string | null;
  prefecture: string | null;
  city: string | null;
  town: string | null;
  block: string | null;
  orderPhoneNumber: string | null;
  orderMobileNumber: string | null;
  mobileCarrier: string | null;
  applicantLastName: string | null;
  applicantFirstName: string | null;
  applicantBirthday: string | null;
  contactLastName: string | null;
  contactFirstName: string | null;
  contactBirthday: string | null;
  contractLastName: string | null;
  contractFirstName: string | null;
  contractBirthday: string | null;
  installationPostalCode: string | null;
  installationPrefecture: string | null;
  installationCity: string | null;
  installationTown: string | null;
  installationBuilding: string | null;
  installationRoom: string | null;
};

export type FmImportRow = Record<(typeof IMPORT_COLUMNS)[number], string | null>;

const [
  LIST_NAME,
  PHONE,
  MOBILE,
  MOBILE_CARRIER,
  APPLICANT_LAST,
  APPLICANT_FIRST,
  APPLICANT_BIRTHDAY,
  CONTACT_LAST,
  CONTACT_FIRST,
  CONTACT_BIRTHDAY,
  CONTRACT_LAST,
  CONTRACT_FIRST,
  CONTRACT_BIRTHDAY,
  POSTAL_CODE,
  PREFECTURE,
  CITY,
  TOWN,
  BUILDING,
  ROOM,
] = IMPORT_COLUMNS;

function valueOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function firstValue(...values: Array<unknown>): string | null {
  for (const value of values) {
    const text = valueOrNull(value);
    if (text !== null) return text;
  }
  return null;
}

function formatDate(value: unknown): string | null {
  const text = valueOrNull(value);
  if (!text) return null;
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(text);
  if (!match) return text;
  return `${match[1]}/${match[2].padStart(2, "0")}/${match[3].padStart(2, "0")}`;
}

export function formatPostalCode(value: unknown): string | null {
  const text = valueOrNull(value);
  if (!text) return null;
  const digits = normalizePhone(text);
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (/^\d{3}-\d{4}$/.test(text)) return text;
  return text;
}

export function splitLedgerName(input: { fullName?: string | null; lastName?: string | null; firstName?: string | null }): { lastName: string | null; firstName: string | null } {
  const lastName = valueOrNull(input.lastName);
  const firstName = valueOrNull(input.firstName);
  if (lastName || firstName) return { lastName, firstName };
  const fullName = valueOrNull(input.fullName);
  if (!fullName) return { lastName: null, firstName: null };
  const parts = fullName.replace(/\s+/g, " ").split(" ");
  if (parts.length >= 2) return { lastName: parts[0], firstName: parts.slice(1).join(" ") };
  return { lastName: fullName, firstName: null };
}

export function buildFmImportRow(row: FmImportSourceRow, listName: string): FmImportRow {
  const ledgerName = splitLedgerName({ fullName: row.fullName, lastName: row.lastName, firstName: row.firstName });
  return {
    [LIST_NAME]: listName,
    [PHONE]: normalizePhone(firstValue(row.orderPhoneNumber, row.phoneNumber) ?? ""),
    [MOBILE]: normalizePhone(firstValue(row.orderMobileNumber, row.mobileNumber) ?? "") || null,
    [MOBILE_CARRIER]: firstValue(row.mobileCarrier),
    [APPLICANT_LAST]: firstValue(row.applicantLastName),
    [APPLICANT_FIRST]: firstValue(row.applicantFirstName),
    [APPLICANT_BIRTHDAY]: formatDate(row.applicantBirthday),
    [CONTACT_LAST]: firstValue(row.contactLastName),
    [CONTACT_FIRST]: firstValue(row.contactFirstName),
    [CONTACT_BIRTHDAY]: formatDate(row.contactBirthday),
    [CONTRACT_LAST]: firstValue(row.contractLastName, ledgerName.lastName),
    [CONTRACT_FIRST]: firstValue(row.contractFirstName, ledgerName.firstName),
    [CONTRACT_BIRTHDAY]: formatDate(firstValue(row.contractBirthday, row.birthday)),
    [POSTAL_CODE]: formatPostalCode(firstValue(row.installationPostalCode, row.postalCode)),
    [PREFECTURE]: firstValue(row.installationPrefecture, row.prefecture),
    [CITY]: firstValue(row.installationCity, row.city),
    [TOWN]: firstValue(row.installationTown, row.town),
    [BUILDING]: firstValue(row.installationBuilding, row.block),
    [ROOM]: firstValue(row.installationRoom),
  };
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function ledgerColumn(key: Parameters<typeof getColumnName>[0]): string {
  return `p.${quoteIdentifier(getColumnName(key))}`;
}

const ORDER_SELECT_COLUMNS = [
  ["orderPhoneNumber", "電話番号_ハイフンなし"],
  ["orderMobileNumber", "携帯番号_ハイフンなし"],
  ["mobileCarrier", "携帯キャリア"],
  ["applicantLastName", "申込者名_姓"],
  ["applicantFirstName", "申込者名_名"],
  ["applicantBirthday", "申込者名_生年月日"],
  ["contactLastName", "連絡担当者名_姓"],
  ["contactFirstName", "連絡担当者名_名"],
  ["contactBirthday", "連絡担当者名_生年月日"],
  ["contractLastName", "既契約者名_姓"],
  ["contractFirstName", "既契約者名_名"],
  ["contractBirthday", "既契約者名_生年月日"],
  ["installationPostalCode", "設置先_郵便番号"],
  ["installationPrefecture", "設置先_住所_都道府県"],
  ["installationCity", "設置先_住所_市町村"],
  ["installationTown", "設置先_住所_町域"],
  ["installationBuilding", "設置先_住所_建物名"],
  ["installationRoom", "設置先_住所_部屋番号"],
] as const;

export function buildFmImportStreamSql(condition: SoilListConditionPayload, sortKey: SoilListSortKey, phoneNumbers: string[] | null): { text: string; values: unknown[] } {
  const base = buildExportPhoneSql(condition, sortKey, 50000);
  const phoneColumn = quoteIdentifier(getColumnName("phoneNumber"));
  const orderedPhones = phoneNumbers
    ? {
        cte: "with selected_phones as (select unnest($1::text[]) as phone, generate_subscripts($1::text[], 1) as position)",
        from: "from selected_phones s\njoin public.soil_list_phone p on p." + phoneColumn + " = s.phone",
        order: "order by s.position",
        values: [phoneNumbers],
      }
    : {
        cte: `with selected_phones as (${base.text.replace(/limit 50000 offset 0\s*$/m, "")})`,
        from: "from selected_phones s\njoin public.soil_list_phone p on p." + phoneColumn + ' = s."phoneNumber"',
        order: `order by p.${quoteIdentifier(getColumnName("listLoadedOn"))} ${sortKey === "listLoadedOnDesc" ? "desc" : "asc"} nulls last, p.${phoneColumn} asc`,
        values: base.values,
      };
  const orderSelect = ORDER_SELECT_COLUMNS.map(([alias, column]) => `latest_order.${quoteIdentifier(column)} as ${quoteIdentifier(alias)}`);
  const select = [
    `${ledgerColumn("phoneNumber")} as "phoneNumber"`,
    `${ledgerColumn("mobileNumber")} as "mobileNumber"`,
    `${ledgerColumn("name")} as "fullName"`,
    `p."氏名_姓" as "lastName"`,
    `p."氏名_名" as "firstName"`,
    `${ledgerColumn("birthday")} as "birthday"`,
    `${ledgerColumn("postalCode")} as "postalCode"`,
    `${ledgerColumn("prefecture")} as "prefecture"`,
    `${ledgerColumn("city")} as "city"`,
    `${ledgerColumn("town")} as "town"`,
    `${ledgerColumn("block")} as "block"`,
    ...orderSelect,
  ].join(",\n  ");
  const text = [
    orderedPhones.cte,
    `select ${select}`,
    orderedPhones.from,
    "left join lateral (",
    `  select ${ORDER_SELECT_COLUMNS.map(([, column]) => `o.${quoteIdentifier(column)}`).join(", ")}`,
    "  from public.soil_list_order o",
    `  where o.${quoteIdentifier("電話番号")} = p.${phoneColumn}`,
    `  order by o.${quoteIdentifier("受注日")} desc nulls last, o.${quoteIdentifier("取込日時")} desc nulls last, o.ctid desc`,
    "  limit 1",
    ") latest_order on true",
    orderedPhones.order,
  ].join("\n");
  return { text, values: orderedPhones.values };
}
