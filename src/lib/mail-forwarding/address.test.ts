import { expect, it } from "vitest";
import { composeAddress, normalizeAddress, splitAddress, validPostal } from "./address";
it("全角英数字と空白をそろえ、数字の間だけハイフンを変える", () => {
  expect(normalizeAddress("　南船場２－１０ー３０　 ＮＬＣ  サンマリオンタワー　")).toBe("南船場2-10-30 NLC サンマリオンタワー");
  expect(normalizeAddress("１‐２―３−４ｰ５")).toBe("1-2-3-4-5");
});
it.each(["〒542-0081 大阪府大阪市中央区南船場2-10-30 NLC心斎橋アースビル503", "〒541-0054 大阪府大阪市中央区南本町2-6-12 サンマリオンタワー地上2階西号室"])("既存の住所を往復できる: %s", value => {
  expect(composeAddress(splitAddress(value))).toBe(value);
});
it("郵便番号や建物の省略と郵便番号の表記を扱う", () => {
  expect(composeAddress({ postal: "〒５４２００８１", address: " 大阪　", building: "" })).toBe("〒542-0081 大阪");
  expect(composeAddress({ postal: "", address: "大阪", building: " ビル  ５０３ " })).toBe("大阪 ビル 503");
  expect(splitAddress("5420081 大阪")).toEqual({postal:"542-0081",address:"大阪",building:""});
  expect(splitAddress("大阪")).toEqual({postal:"",address:"大阪",building:""});
  expect(validPostal("〒542-0081")).toBe(true);
  expect(validPostal("")).toBe(true);
  expect(validPostal("123")).toBe(false);
  expect(validPostal("〒")).toBe(false);
});
