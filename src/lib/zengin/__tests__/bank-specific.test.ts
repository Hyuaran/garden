import { describe, it, expect } from "vitest";
import { getBankProfile } from "../bank-specific";

describe("getBankProfile", () => {
  it("楽天銀行は .csv 拡張子、EOF マークなし", () => {
    const profile = getBankProfile("rakuten");
    expect(profile.fileExtension).toBe(".csv");
    expect(profile.useEofMark).toBe(false);
  });

  it("みずほ銀行は .txt 拡張子、EOF マークあり", () => {
    const profile = getBankProfile("mizuho");
    expect(profile.fileExtension).toBe(".txt");
    expect(profile.useEofMark).toBe(true);
  });

  it("PayPay 銀行は .csv 拡張子、EOF マークなし", () => {
    const profile = getBankProfile("paypay");
    expect(profile.fileExtension).toBe(".csv");
    expect(profile.useEofMark).toBe(false);
  });

  it("京都銀行は未実装エラー", () => {
    expect(() => getBankProfile("kyoto")).toThrow(/未実装/);
  });
});
