import { describe, expect, it } from "vitest";
import { intakeButtonLabel, intakeItemFromPost, intakeMarks, intakeStoragePath, isDuplicateIntakeError, isIntakeKind, type IntakeItem } from "../intake";

const item: IntakeItem = { id: "1", kind: "請求", attachment_id: "a1", created_by_name: "東海林", created_at: "2026-07-18T12:00:00Z", notice_saved: false };

describe("Garden intake helpers", () => {
  it("accepts only the five intake kinds", () => {
    ["請求", "入金", "条件", "周知", "契約書"].forEach((kind) => expect(isIntakeKind(kind)).toBe(true));
    expect(isIntakeKind("その他")).toBe(false);
  });

  it("builds an ASCII-only classified storage path", () => {
    expect(intakeStoragePath("周知", new Date("2026-07-18T00:00:00Z"), "uuid", "../FAX/案内.PDF")).toBe("shuchi/2026/07/uuid.pdf");
    expect(intakeStoragePath("請求", new Date("2026-07-18T00:00:00Z"), "uuid", "拡張子なし")).toBe("seikyu/2026/07/uuid");
    expect(intakeStoragePath("契約書", new Date("2026-07-18T00:00:00Z"), "uuid", "契約.PDF")).toBe("keiyaku/2026/07/uuid.pdf");
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
    expect(mark).toMatchObject({ actorName: "東海林", actorInitial: "東" });
  });

  it("marks an unsaved notice incomplete and switches the action label", () => {
    const incomplete = { ...item, kind: "周知" as const, notice_saved: false };
    expect(intakeMarks([incomplete]).get("a1")).toMatchObject({ label: "周知 未完", complete: false });
    expect(intakeButtonLabel(incomplete)).toBe("周知を続ける");
    const complete = { ...incomplete, notice_saved: true };
    expect(intakeMarks([complete]).get("a1")).toMatchObject({ label: "周知 済", complete: true });
    expect(intakeButtonLabel(complete)).toBe("取込済");
  });

  it("marks a contract complete immediately after intake", () => {
    const contract = { ...item, kind: "契約書" as const };
    expect(intakeMarks([contract]).get("a1")).toMatchObject({ label: "契約書 済", complete: true, actorInitial: "東" });
    expect(intakeButtonLabel(contract)).toBe("取込済");
  });
});
