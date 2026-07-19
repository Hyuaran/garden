import { describe, expect, it } from "vitest";
import { detailRecipientAddresses } from "../detail-recipients";

describe("Rill Mail detail recipient formatting", () => {
  it("formats Cc and Bcc recipient arrays and skips empty entries", () => {
    expect(detailRecipientAddresses([
      { emailAddress: { address: " cc1@example.com " } },
      { emailAddress: { address: "cc2@example.com" } },
      { emailAddress: { address: "" } },
      {},
    ])).toEqual(["cc1@example.com", "cc2@example.com"]);
  });

  it("returns an empty array for missing or empty Graph fields", () => {
    expect(detailRecipientAddresses(undefined)).toEqual([]);
    expect(detailRecipientAddresses(null)).toEqual([]);
    expect(detailRecipientAddresses([])).toEqual([]);
  });
});
