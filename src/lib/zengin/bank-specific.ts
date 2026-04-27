/**
 * Garden-Bud / 全銀協 CSV — 銀行別差異吸収
 *
 * 各銀行のネットバンキング取込画面で要求される仕様差を集約。
 * 将来の銀行追加は `BankProfile` を拡張し、`BANK_PROFILES` に登録するだけ。
 */

import type { BankType } from "./types";

export interface BankProfile {
  bank: BankType;
  displayName: string;
  fileExtension: string;
  useEofMark: boolean;
  lineEnding: "\r\n" | "\n";
}

const BANK_PROFILES: Partial<Record<BankType, BankProfile>> = {
  rakuten: {
    bank: "rakuten",
    displayName: "楽天銀行ビジネス",
    fileExtension: ".csv",
    useEofMark: false,
    lineEnding: "\r\n",
  },
  mizuho: {
    bank: "mizuho",
    displayName: "みずほビジネスWEB",
    fileExtension: ".txt",
    useEofMark: true,
    lineEnding: "\r\n",
  },
  paypay: {
    bank: "paypay",
    displayName: "PayPay 銀行法人",
    fileExtension: ".csv",
    useEofMark: false,
    lineEnding: "\r\n",
  },
  // kyoto は未実装（送金必要時に追加）
};

export function getBankProfile(bank: BankType): BankProfile {
  const profile = BANK_PROFILES[bank];
  if (!profile) {
    throw new Error(`銀行 "${bank}" の全銀協CSV 出力は未実装です`);
  }
  return profile;
}
