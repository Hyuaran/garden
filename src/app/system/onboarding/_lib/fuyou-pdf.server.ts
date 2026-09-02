import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFDropdown, type PDFFont, type PDFForm, type PDFTextField } from "pdf-lib";
import { UNDER16_DEPENDENT_PDF_FIELDS, hasSpouse, splitFuyouDependents, splitPostalCode, toWarekiDate } from "./fuyou-pdf";
import type { Dependent, OnboardingInput } from "./onboarding";

export type FuyouCompany = {
  company_name: string;
  corporate_number: string | null;
  address: string | null;
};

export type FuyouPdfData = {
  company: FuyouCompany;
  values: OnboardingInput;
};

function digits(value: string, length?: number) {
  const result = value.replace(/\D/g, "");
  return length == null || result.length === length ? result : "";
}

function textField(field: PDFTextField, value: string, fontSize?: number) {
  field.setText(value);
  if (fontSize) field.setFontSize(fontSize);
}

function maybeTextField(form: PDFForm, name: string) {
  try {
    return form.getTextField(name);
  } catch {
    return null;
  }
}

function maybeDropdown(form: PDFForm, name: string) {
  try {
    return form.getDropdown(name);
  } catch {
    return null;
  }
}

function setOptionalText(form: PDFForm, name: string, value: string, fontSize?: number) {
  const field = maybeTextField(form, name);
  if (field) textField(field, value, fontSize);
}

function selectOptional(dropdown: PDFDropdown | null, value: string) {
  if (!dropdown || !value) return;
  try {
    dropdown.select(value);
  } catch {
    // Template variants may omit an expected choice even when the field exists.
  }
}

function fitTextField(field: PDFTextField, value: string, font: PDFFont, maxSize: number, minSize: number) {
  field.setText(value);
  const widget = field.acroField.getWidgets()[0];
  const width = widget ? Math.abs(widget.getRectangle().width) - 4 : 0;
  let size = maxSize;
  if (value && width > 0) {
    while (size > minSize && font.widthOfTextAtSize(value, size) > width) size -= 0.5;
  }
  field.setFontSize(size);
}

function fillBirth(form: PDFForm, names: { era: string; year: string; month: string; day: string }, birthDate: string) {
  const birth = toWarekiDate(birthDate);
  if (!birth) return;
  selectOptional(maybeDropdown(form, names.era), birth.era);
  setOptionalText(form, names.year, birth.year);
  setOptionalText(form, names.month, birth.month);
  setOptionalText(form, names.day, birth.day);
}

function fillAddress(form: PDFForm, name: string, value: string, font: PDFFont) {
  const field = maybeTextField(form, name);
  if (field) fitTextField(field, value, font, 8, 4.5);
}

function fillSpouse(form: PDFForm, dependent: Dependent, address: string, font: PDFFont) {
  setOptionalText(form, "Text16", dependent.name_kana, 7);
  setOptionalText(form, "Text17", dependent.name, 9);
  setOptionalText(form, "Text18", digits(dependent.my_number, 12));
  fillBirth(form, { era: "Dropdown4", year: "Text19", month: "Text20", day: "Text21" }, dependent.birth_date);
  setOptionalText(form, "Text22", digits(dependent.annual_income));
  fillAddress(form, "Text23", address, font);
}

const ADULT_DEPENDENT_FIELDS = [
  { kana: "Text25", name: "Text26", myNumber: "Text27", relation: "Text28", era: "Dropdown5", year: "Text29", month: "Text30", day: "Text31", income: "Text32", address: "Text33" },
  { kana: "Text35", name: "Text36", myNumber: "Text37", relation: "Text38", era: "Dropdown6", year: "Text39", month: "Text40", day: "Text41", income: "Text42", address: "Text43" },
  { kana: "Text45", name: "Text46", myNumber: "Text47", relation: "Text48", era: "Dropdown7", year: "Text49", month: "Text50", day: "Text51", income: "Text52", address: "Text53" },
  { kana: "Text55", name: "Text56", myNumber: "Text57", relation: "Text58", era: "Dropdown8", year: "Text59", month: "Text60", day: "Text61", income: "Text62", address: "Text63" },
] as const;

function fillAdultDependent(form: PDFForm, dependent: Dependent, fields: (typeof ADULT_DEPENDENT_FIELDS)[number], address: string, font: PDFFont) {
  setOptionalText(form, fields.kana, dependent.name_kana, 7);
  setOptionalText(form, fields.name, dependent.name, 9);
  setOptionalText(form, fields.myNumber, digits(dependent.my_number, 12));
  setOptionalText(form, fields.relation, dependent.relation, 9);
  fillBirth(form, { era: fields.era, year: fields.year, month: fields.month, day: fields.day }, dependent.birth_date);
  setOptionalText(form, fields.income, digits(dependent.annual_income));
  fillAddress(form, fields.address, address, font);
}

function fillUnder16Dependent(form: PDFForm, dependent: Dependent, fields: (typeof UNDER16_DEPENDENT_PDF_FIELDS)[number], address: string, font: PDFFont) {
  setOptionalText(form, fields.kana, dependent.name_kana, 7);
  setOptionalText(form, fields.name, dependent.name, 9);
  setOptionalText(form, fields.myNumber, digits(dependent.my_number, 12));
  setOptionalText(form, fields.relation, dependent.relation, 8);
  fillBirth(form, { era: fields.era, year: fields.year, month: fields.month, day: fields.day }, dependent.birth_date);
  fillAddress(form, fields.address, address, font);
  setOptionalText(form, fields.income, digits(dependent.annual_income));
}

export async function buildFuyouPdf(template: Uint8Array, data: FuyouPdfData) {
  const pdf = await PDFDocument.load(template);
  pdf.registerFontkit((fontkit as unknown as { default?: typeof fontkit }).default ?? fontkit);
  const font = await pdf.embedFont(
    new Uint8Array(await readFile(path.join(process.cwd(), "public/fonts/NotoSansJP-Regular.ttf"))),
    // subset:true にすると日本語の字が欠けるため、フォントは丸ごと埋め込む。
    { subset: false },
  );
  const form = pdf.getForm();
  const postal = splitPostalCode(data.values.postal_code);
  const birth = toWarekiDate(data.values.birth_date);

  textField(form.getTextField("Text3"), data.company.company_name);
  textField(form.getTextField("Text4"), digits(String(data.company.corporate_number ?? "")));
  textField(form.getTextField("Text5"), String(data.company.address ?? ""));
  textField(form.getTextField("Text6"), data.values.name_kana, 7);
  textField(form.getTextField("Text7"), data.values.name, 10);
  textField(form.getTextField("Text8"), digits(data.values.my_number, 12));
  if (birth) {
    selectOptional(maybeDropdown(form, "Dropdown1"), birth.era);
    textField(form.getTextField("Text11"), birth.year);
    textField(form.getTextField("Text12"), birth.month);
    textField(form.getTextField("Text13"), birth.day);
  }
  textField(form.getTextField("Text9-1"), postal.first);
  textField(form.getTextField("Text9-2"), postal.last);
  // 住所は長いと欄からはみ出して末尾が切れるため、幅に収まる文字サイズまで自動で小さくする。
  fitTextField(form.getTextField("Text10"), data.values.address, font, 8, 4.5);
  setOptionalText(form, "Text14", data.values.householder_name, 9);
  setOptionalText(form, "Text15", data.values.householder_relation, 10);
  const dependents = splitFuyouDependents(data.values);
  if (dependents.spouse) fillSpouse(form, dependents.spouse, data.values.address, font);
  dependents.adultDependents.forEach((dependent, index) => fillAdultDependent(form, dependent, ADULT_DEPENDENT_FIELDS[index], data.values.address, font));
  dependents.under16Dependents.forEach((dependent, index) => fillUnder16Dependent(form, dependent, UNDER16_DEPENDENT_PDF_FIELDS[index], data.values.address, font));
  selectOptional(maybeDropdown(form, "Dropdown2"), hasSpouse(data.values) ? "有" : "無");
  form.updateFieldAppearances(font);
  form.flatten();
  return Buffer.from(await pdf.save());
}
