import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFTextField } from "pdf-lib";
import { hasSpouse, splitPostalCode, toWarekiDate } from "./fuyou-pdf";
import type { OnboardingInput } from "./onboarding";

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
    form.getDropdown("Dropdown1").select(birth.era);
    textField(form.getTextField("Text11"), birth.year);
    textField(form.getTextField("Text12"), birth.month);
    textField(form.getTextField("Text13"), birth.day);
  }
  textField(form.getTextField("Text9-1"), postal.first);
  textField(form.getTextField("Text9-2"), postal.last);
  // 住所は長いと欄からはみ出して末尾が切れるため、幅に収まる文字サイズまで自動で小さくする。
  fitTextField(form.getTextField("Text10"), data.values.address, font, 8, 4.5);
  form.getDropdown("Dropdown2").select(hasSpouse(data.values) ? "有" : "無");
  form.updateFieldAppearances(font);
  form.flatten();
  return Buffer.from(await pdf.save());
}
