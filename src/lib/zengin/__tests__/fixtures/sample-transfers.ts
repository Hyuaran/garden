import type {
  ZenginSourceAccount,
  ZenginTransferInput,
} from "../../types";

export const SAMPLE_SOURCE: ZenginSourceAccount = {
  consignor_code: "0000001234",
  consignor_name: "ｶ)ﾋｭｱﾗﾝ",
  transfer_date: "0425",
  source_bank_code: "0036",
  source_bank_name: "ﾗｸﾃﾝ",
  source_branch_code: "251",
  source_branch_name: "ﾀﾞｲｲﾁｴｲｷﾞｮｳ",
  source_account_type: "1",
  source_account_number: "7853952",
};

export const SAMPLE_TRANSFERS: ZenginTransferInput[] = [
  {
    payee_bank_code: "0001",
    payee_branch_code: "100",
    payee_account_type: "1",
    payee_account_number: "1234567",
    payee_account_holder_kana: "ﾔﾏﾀﾞ ﾀﾛｳ",
    amount: 50000,
    edi_info: "KEIHI 4GATSU",
  },
  {
    payee_bank_code: "0005",
    payee_branch_code: "200",
    payee_account_type: "1",
    payee_account_number: "2345678",
    payee_account_holder_kana: "ｽｽﾞｷ ﾊﾅｺ",
    amount: 75000,
  },
  {
    payee_bank_code: "0179",
    payee_branch_code: "685",
    payee_account_type: "1",
    payee_account_number: "1207991",
    payee_account_holder_kana: "ﾐﾔｻﾞｷ ｶﾂﾔ",
    amount: 24980,
  },
];
