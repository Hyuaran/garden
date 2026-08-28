import { describe, expect, it } from "vitest";
import {
  companyAbbreviation,
  MAX_CONTRACT_SIZE,
  validateContractUpload,
} from "./contract-types";
const pdf = (size = 1, type = "application/pdf") =>
  new File([new Uint8Array(size)], "契約.pdf", { type });
describe("contract validation and abbreviations", () => {
  it("maps all company abbreviations", () => {
    expect(["HR", "CR", "LKS", "ART", "TIY", "ICHI", "SB", "ALL"]).toEqual(
      [
        "COMP-001",
        "COMP-002",
        "COMP-003",
        "COMP-004",
        "COMP-005",
        "COMP-006",
        "COMP-007",
        "ALL",
      ].map(companyAbbreviation),
    );
  });
  it("accepts a complete PDF", () =>
    expect(
      validateContractUpload({
        counterparty: "A社",
        companyId: "COMP-001",
        contractType: "契約書",
        concludedOn: "2026-08-28",
        file: pdf(),
      }),
    ).toBeNull());
  it("requires fields and rejects type and size", () => {
    expect(validateContractUpload({ file: pdf() })).toMatch(/必須/);
    expect(
      validateContractUpload({
        counterparty: "A社",
        companyId: "COMP-001",
        contractType: "契約書",
        concludedOn: "2026-08-28",
        file: pdf(1, "text/plain"),
      }),
    ).toMatch(/PDF/);
    expect(
      validateContractUpload({
        counterparty: "A社",
        companyId: "COMP-001",
        contractType: "契約書",
        concludedOn: "2026-08-28",
        file: pdf(MAX_CONTRACT_SIZE + 1),
      }),
    ).toMatch(/20MB/);
  });
});
