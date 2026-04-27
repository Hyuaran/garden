import { describe, it, expect } from "vitest";
import {
  formatApprovedMessage,
  formatRejectedMessage,
  formatBatchApprovedMessage,
  formatBatchRejectedMessage,
} from "../chatwork-formatter";

describe("formatApprovedMessage", () => {
  it("基本情報がすべて含まれる", () => {
    const msg = formatApprovedMessage({
      transferId: "FK-20260425-0001",
      payeeName: "株式会社山田",
      amount: 1250000,
      toStatus: "承認済み",
    });
    expect(msg).toContain("✓ 振込が承認されました");
    expect(msg).toContain("FK-20260425-0001");
    expect(msg).toContain("株式会社山田");
    expect(msg).toContain("¥1,250,000");
    expect(msg).toContain("[info]");
    expect(msg).toContain("[/info]");
  });

  it("承認者名が指定されたら含まれる", () => {
    const msg = formatApprovedMessage({
      transferId: "FK-001",
      payeeName: "テスト",
      amount: 1000,
      toStatus: "承認済み",
      actorName: "上田部長",
    });
    expect(msg).toContain("承認者: 上田部長");
  });

  it("Garden URL は transferId 込みで誘導文のみ（署名 URL は流通させない）", () => {
    const msg = formatApprovedMessage({
      transferId: "FK-001",
      payeeName: "テスト",
      amount: 100,
      toStatus: "承認済み",
    });
    expect(msg).toContain("/bud/transfers/FK-001");
    expect(msg).not.toMatch(/https?:\/\//);
  });
});

describe("formatRejectedMessage", () => {
  it("理由が必ず含まれる", () => {
    const msg = formatRejectedMessage({
      transferId: "FK-001",
      payeeName: "テスト",
      amount: 1000,
      toStatus: "差戻し",
      reason: "金額が請求書と異なります",
    });
    expect(msg).toContain("✗ 振込が差戻されました");
    expect(msg).toContain("理由: 金額が請求書と異なります");
  });

  it("理由空のときは「（理由未記入）」", () => {
    const msg = formatRejectedMessage({
      transferId: "FK-001",
      payeeName: "テスト",
      amount: 1000,
      toStatus: "差戻し",
    });
    expect(msg).toContain("（理由未記入）");
  });

  it("理由が空白のみの場合も「（理由未記入）」", () => {
    const msg = formatRejectedMessage({
      transferId: "FK-001",
      payeeName: "テスト",
      amount: 1000,
      toStatus: "差戻し",
      reason: "   ",
    });
    expect(msg).toContain("（理由未記入）");
  });
});

describe("formatBatchApprovedMessage", () => {
  it("件数と対象 ID が含まれる", () => {
    const msg = formatBatchApprovedMessage({
      transferIds: ["FK-001", "FK-002"],
      toStatus: "承認済み",
    });
    expect(msg).toContain("一括承認");
    expect(msg).toContain("件数: 2 件");
    expect(msg).toContain("FK-001");
    expect(msg).toContain("FK-002");
  });

  it("21 件以上は最初の 20 件のみ + 残件数を表示", () => {
    const ids = Array.from({ length: 25 }, (_, i) => `FK-${String(i).padStart(3, "0")}`);
    const msg = formatBatchApprovedMessage({
      transferIds: ids,
      toStatus: "承認済み",
    });
    expect(msg).toContain("件数: 25 件");
    expect(msg).toContain("FK-019");
    expect(msg).not.toContain("FK-020");
    expect(msg).toContain("他 5 件");
  });
});

describe("formatBatchRejectedMessage", () => {
  it("理由・件数・対象 ID が含まれる", () => {
    const msg = formatBatchRejectedMessage({
      transferIds: ["FK-001", "FK-002"],
      toStatus: "差戻し",
      reason: "再確認が必要",
    });
    expect(msg).toContain("一括差戻");
    expect(msg).toContain("件数: 2 件");
    expect(msg).toContain("理由: 再確認が必要");
  });
});
