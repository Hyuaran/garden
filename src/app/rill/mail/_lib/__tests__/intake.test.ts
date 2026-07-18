import { describe, expect, it } from "vitest";
import { intakeItemFromPost, intakeMarks, intakeStoragePath, isDuplicateIntakeError, isIntakeKind, type IntakeItem } from "../intake";

const item: IntakeItem = { id: "1", kind: "請求", attachment_id: "a1", created_by_name: "東海林", created_at: "2026-07-18T12:00:00Z" };

describe("Garden intake helpers", () => {
  it("accepts only the four intake kinds", () => {
    ["請求", "入金", "条件", "周知"].forEach((kind) => expect(isIntakeKind(kind)).toBe(true));
    expect(isIntakeKind("その他")).toBe(false);
  });

  it("builds a safe classified storage path", () => {
    expect(intakeStoragePath("周知", new Date("2026-07-18T00:00:00Z"), "uuid", "../FAX/案内.pdf")).toBe("周知/2026/07/uuid_FAX_案内.pdf");
  });

  it("recognizes duplicate inserts and converts 409 to an executed item", () => {
    expect(isDuplicateIntakeError({ code: "23505" })).toBe(true);
    expect(intakeItemFromPost(409, item)).toEqual(item);
    expect(intakeItemFromPost(500, item)).toBeNull();
  });

  it("indexes display marks by attachment id", () => {
    const mark = intakeMarks([item]).get("a1");
    expect(mark?.label).toBe("請求 済");
    expect(mark?.title).toContain("東海林");
  });
});
