import { describe, expect, it } from "vitest";
import { diffBankMaster } from "./diff";

const snapshot = (banks: Parameters<typeof diffBankMaster>[0]["banks"], branchesByBank: Parameters<typeof diffBankMaster>[0]["branchesByBank"]) => ({ banks, branchesByBank });
const bank = (code: string, name: string, valid_to: string | null = null) => ({ bank_code: code, bank_name: name, bank_kana: name, valid_to });
const branch = (bankCode: string, code: string, name: string, valid_to: string | null = null) => ({ bank_code: bankCode, branch_code: code, branch_name: name, branch_kana: name, valid_to });

describe("diffBankMaster", () => {
  it("追加を検出する", () => {
    const diff = diffBankMaster(snapshot([], {}), snapshot([bank("0001", "みずほ")], { "0001": [branch("0001", "001", "本店")] }));
    expect(diff.banksAdded).toHaveLength(1);
    expect(diff.branchesAdded).toHaveLength(1);
  });

  it("改称を検出する", () => {
    const diff = diffBankMaster(snapshot([bank("0001", "旧")], { "0001": [branch("0001", "001", "旧店")] }), snapshot([bank("0001", "新")], { "0001": [branch("0001", "001", "新店")] }));
    expect(diff.banksRenamed[0].bank_name).toBe("新");
    expect(diff.branchesRenamed[0].branch_name).toBe("新店");
  });

  it("廃止を検出し、行は削除対象にしない", () => {
    const diff = diffBankMaster(snapshot([bank("0001", "みずほ")], { "0001": [branch("0001", "001", "本店")] }), snapshot([], {}));
    expect(diff.banksExpired).toHaveLength(1);
    expect(diff.branchesExpired).toHaveLength(1);
  });

  it("復活を検出する", () => {
    const diff = diffBankMaster(snapshot([bank("0001", "みずほ", "2026-08-24")], { "0001": [branch("0001", "001", "本店", "2026-08-24")] }), snapshot([bank("0001", "みずほ")], { "0001": [branch("0001", "001", "本店")] }));
    expect(diff.banksRestored).toHaveLength(1);
    expect(diff.branchesRestored).toHaveLength(1);
  });

  it("変更なしなら空で、支店は銀行ごとのファイル単位で扱う", () => {
    const current = snapshot([bank("0001", "みずほ"), bank("0005", "三菱ＵＦＪ")], { "0001": [branch("0001", "001", "本店")], "0005": [branch("0005", "001", "本店")] });
    const diff = diffBankMaster(current, current);
    expect(Object.values(diff).flat()).toHaveLength(0);
  });
});
