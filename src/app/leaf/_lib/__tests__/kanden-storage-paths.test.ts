import { describe, it, expect } from "vitest";
import {
  recentPath,
  recentThumbPath,
  monthlyPath,
  yearlyPath,
  RECENT_BUCKET,
  MONTHLY_BUCKET,
  YEARLY_BUCKET,
} from "../kanden-storage-paths";

describe("kanden-storage-paths", () => {
  describe("bucket 定数", () => {
    it("exposes 3 bucket ids with correct kebab-case naming", () => {
      expect(RECENT_BUCKET).toBe("leaf-kanden-photos-recent");
      expect(MONTHLY_BUCKET).toBe("leaf-kanden-photos-monthly");
      expect(YEARLY_BUCKET).toBe("leaf-kanden-photos-yearly");
    });

    it("bucket ids are immutable string literal types", () => {
      // 型レベルで const assertion されていることを確認
      const r: "leaf-kanden-photos-recent" = RECENT_BUCKET;
      const m: "leaf-kanden-photos-monthly" = MONTHLY_BUCKET;
      const y: "leaf-kanden-photos-yearly" = YEARLY_BUCKET;
      expect(r).toBeDefined();
      expect(m).toBeDefined();
      expect(y).toBeDefined();
    });
  });

  describe("recentPath", () => {
    it("builds <case_id>/<attachment_id>.jpg", () => {
      expect(recentPath("CASE-0001", "aaa-bbb")).toBe("CASE-0001/aaa-bbb.jpg");
    });

    it("supports UUID-style attachment_id", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      expect(recentPath("CASE-9999", uuid)).toBe(`CASE-9999/${uuid}.jpg`);
    });

    it("supports multibyte case_id without breaking", () => {
      // 日本語 case_id は使わない想定だが、念のため pass-through 確認
      expect(recentPath("案件-001", "x")).toBe("案件-001/x.jpg");
    });
  });

  describe("recentThumbPath", () => {
    it("builds <case_id>/thumb/<attachment_id>.jpg", () => {
      expect(recentThumbPath("CASE-0001", "aaa-bbb")).toBe(
        "CASE-0001/thumb/aaa-bbb.jpg",
      );
    });

    it("inserts /thumb/ between case_id and attachment_id", () => {
      const result = recentThumbPath("X", "y");
      expect(result.split("/")).toEqual(["X", "thumb", "y.jpg"]);
    });
  });

  describe("monthlyPath", () => {
    it("builds <yyyy-mm>/<case_id>_<attachment_id>.pdf", () => {
      expect(monthlyPath("2026-04", "CASE-0001", "aaa-bbb")).toBe(
        "2026-04/CASE-0001_aaa-bbb.pdf",
      );
    });

    it("uses underscore separator between case_id and attachment_id", () => {
      const result = monthlyPath("2026-12", "C", "a");
      expect(result).toBe("2026-12/C_a.pdf");
    });
  });

  describe("yearlyPath", () => {
    it("builds <yyyy>/<case_id>_<attachment_id>.pdf", () => {
      expect(yearlyPath("2026", "CASE-0001", "aaa-bbb")).toBe(
        "2026/CASE-0001_aaa-bbb.pdf",
      );
    });

    it("does not include month component", () => {
      const result = yearlyPath("2025", "C", "a");
      expect(result).toBe("2025/C_a.pdf");
      expect(result).not.toMatch(/\d{4}-\d{2}/);
    });
  });

  describe("path consistency between recent and thumb", () => {
    it("recent and thumb share same case_id prefix", () => {
      const caseId = "CASE-0001";
      const attachmentId = "abc-def";
      const main = recentPath(caseId, attachmentId);
      const thumb = recentThumbPath(caseId, attachmentId);
      expect(main.startsWith(`${caseId}/`)).toBe(true);
      expect(thumb.startsWith(`${caseId}/thumb/`)).toBe(true);
    });
  });
});
