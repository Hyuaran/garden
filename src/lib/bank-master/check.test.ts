import { describe, expect, it } from "vitest";
import { checkBankAccount, type BankMasterLookup } from "./check";

const lookup: BankMasterLookup = {
  banksByCode: new Map([
    ["0036", { bankCode: "0036", bankName: "楽天" }],
    ["0005", { bankCode: "0005", bankName: "三菱ＵＦＪ" }],
    ["9900", { bankCode: "9900", bankName: "ゆうちょ", validTo: "2026-08-24" }],
  ]),
  branchesByCode: new Map([
    ["0036:241", { bankCode: "0036", branchCode: "241", branchName: "テナー" }],
    ["0036:244", { bankCode: "0036", branchCode: "244", branchName: "オンプ" }],
    ["0005:001", { bankCode: "0005", branchCode: "001", branchName: "本店" }],
    ["9900:408", { bankCode: "9900", branchCode: "408", branchName: "四〇八", validTo: "2026-08-24" }],
  ]),
  successors: [{ oldBankCode: "9900", oldBranchCode: "408", newBankCode: "0036", newBranchCode: "244" }],
  findBanksByName: (name) => name.includes("三菱") ? [{ bankCode: "0005", bankName: "三菱ＵＦＪ" }] : [],
};

describe("checkBankAccount", () => {
  it("コード無しは名前の候補を返す", () => {
    const result = checkBankAccount({ bank_name: "三菱UFJ銀行" }, lookup);
    expect(result.issues).toContain("missing_code");
    expect(result.candidate.bank_code).toBe("0005");
  });

  it("台帳に無いコードを検出する", () => {
    expect(checkBankAccount({ bank_code: "9999", branch_code: "001" }, lookup).issues).toContain("not_found");
  });

  it("廃止済みと後継候補を返す", () => {
    const result = checkBankAccount({ bank_code: "9900", branch_code: "408" }, lookup);
    expect(result.issues).toContain("expired");
    expect(result.candidate).toMatchObject({ bank_code: "0036", branch_code: "244" });
  });

  it("銀行・支店の一般語を除いて名前を比較する", () => {
    expect(checkBankAccount({ bank_name: "楽天銀行", bank_code: "0036", branch_name: "テナー支店", branch_code: "241" }, lookup).issues).toHaveLength(0);
  });

  it("似た別名は名前違いにする", () => {
    const result = checkBankAccount({ bank_name: "楽天", bank_code: "0036", branch_name: "難波南", branch_code: "241" }, lookup);
    expect(result.issues).toContain("name_mismatch");
  });

  it("支店名なしを検出する", () => {
    expect(checkBankAccount({ bank_name: "楽天", bank_code: "0036", branch_code: "241" }, lookup).issues).toContain("missing_branch_name");
  });
});
