import { describe, expect, it } from "vitest";
import { maskAddressFields, maskBankAccountFields, splitTemplateBoundaries } from "./contract-template-fields";

describe("literal bank fields", () => {
  it.each([
    ["金融機関名：楽天銀行", "金融機関名：＿＿＿＿"],
    ["銀行名：三井住友銀行", "銀行名：＿＿＿＿"],
    ["金融機関名：〇〇信用金庫", "金融機関名：＿＿＿＿"],
    ["〇〇信用金庫", "＿＿＿＿"],
    ["支店名：第三営業支店", "支店名：＿＿＿＿"],
    ["支 店 名：本店営業部", "支店名：＿＿＿＿"],
    ["口 座 番 号：1234567", "口座番号：＿＿＿＿"],
    ["口座名義：株式会社〇〇", "口座名義：＿＿＿＿"],
    ["口 座 名 義（カ ナ）：カ）リンクサポート", "口座名義（カナ）：＿＿＿＿"],
  ])("masks the value, not the label: %s", (input, output) => {
    expect(maskBankAccountFields(input)).toBe(output);
  });
  it("bounds adjacent fields and keeps account-type choices", () => {
    expect(maskBankAccountFields("金融機関名：楽天銀行 支 店 名：第三営業支店口座種別 ： 普通 当座 口 座 番 号：1234567口座名義（カナ）：カ）リンクサポート"))
      .toBe("金融機関名：＿＿＿＿ 支店名：＿＿＿＿ 口座種別：普通 当座 口座番号：＿＿＿＿ 口座名義（カナ）：＿＿＿＿");
  });
  it("handles a value on the next physical line without consuming a clause", () => {
    expect(maskBankAccountFields("口座名義（カナ）：\nカ）リンクサポート\n銀行名：\n金融機関への通知は乙が行う。"))
      .toBe("口座名義（カナ）：\n＿＿＿＿\n銀行名：\n金融機関への通知は乙が行う。");
  });
  it.each(["甲は金融機関名を通知する。", "口座名義の変更は乙に通知する。", "銀行名：乙が指定する銀行", "指定する金融機関口座へ振り込む方法により支払うものとする。"])("does not erase a bank-related clause: %s", (line) => {
    expect(maskBankAccountFields(line)).toBe(line);
  });
});

describe("address/signature context", () => {
  it.each(["大阪市浪速区立葉一丁目3番1号", "名古屋市瑞穂区雁道町1-16", "立葉1-3-1", "雁道町1-16"])("recognizes an address line without a prefecture: %s", (line) => {
    expect(maskAddressFields(line)).toBe("＿＿＿＿");
  });
  it.each(["MaisonPartir303号", "アメニティ雁道", "本町UNICOビル4F"])("masks a building in a labeled field and its continuation: %s", (building) => {
    expect(maskAddressFields(`甲：${building}`)).toBe("甲：＿＿＿＿");
    expect(maskAddressFields(`所在地：大阪市浪速区立葉一丁目3番1号\n${building}`)).toBe("所在地：＿＿＿＿\n＿＿＿＿");
  });
  it("ends continuation at the next clause; leaves representative masking to 253b", () => {
    expect(maskAddressFields("甲：大阪市浪速区立葉一丁目3番1号\nアメニティ雁道\n代表取締役 山田 太郎\n第1条 内容\nハイツの提供条件を定める。"))
      .toBe("甲：＿＿＿＿\n＿＿＿＿\n代表取締役 山田 太郎\n第1条 内容\nハイツの提供条件を定める。");
  });
  it.each(["名古屋地方裁判所", "大阪地方裁判所", "甲：名古屋地方裁判所を合意管轄とする。", "甲：乙は支払義務を負う", "甲：損害賠償責任", "乙：契約変更", "大阪市内の1-3-1の番号を持つ商品を提供する", "アメニティ雁道"])("preserves clauses and ambiguous unlabeled names: %s", (line) => {
    expect(maskAddressFields(line)).toBe(line);
  });
  it("separates an address from adjacent company/representative fields", () => {
    expect(maskAddressFields("甲：大阪市浪速区立葉一丁目3番1号MaisonPartir303号 株式会社リンクサポート 代表取締役 山田 太郎"))
      .toBe("甲：＿＿＿＿\n株式会社リンクサポート 代表取締役 山田 太郎");
  });
  it.each(["1-1 本基準書の位置づけ", "1-2 マニュアルの位置づけ", "1-3 定義", "3-1 活動場所・環境", "3-2 申込書管理", "3-3 特殊販売手法", "3-4 販売スタッフ教育", "3-5 広告宣伝（基本契約第12条関連）", "3-6 標章の使用（基本契約第13条関連）", "5-1 商品情報", "5-2 提供条件", "2025-3-18契約成立", "商品コード1-3-1"])("does not mistake a numbered heading/date/code for an address: %s", (line) => {
    expect(maskAddressFields(line)).toBe(line);
  });
  it("retains the party label when a literal address follows it without a colon", () => {
    expect(maskAddressFields("甲 大阪市浪速区立葉一丁目3番1号")).toBe("甲：＿＿＿＿");
  });
  it("splits concatenated closing/date/party fields without changing characters", () => {
    const text = "名古屋地方裁判所とする。以上、本契約の成立を証するため、本書2通を作成し、記名押印の上各自保有する。締結日：2025年3月18日甲：住所乙：住所丙：住所";
    const result = splitTemplateBoundaries(text);
    expect(result.split("\n")).toEqual(["名古屋地方裁判所とする。", "以上、本契約の成立を証するため、本書2通を作成し、記名押印の上各自保有する。", "締結日：2025年3月18日", "甲：住所", "乙：住所", "丙：住所"]);
    expect(result.replace(/\n/g, "")).toBe(text);
  });
  it("does not split an ordinary signing obligation into a closing statement", () => {
    const line = "乙は受領書に記名押印の上、甲に提出するものとする。";
    expect(splitTemplateBoundaries(line)).toBe(line);
  });
});
