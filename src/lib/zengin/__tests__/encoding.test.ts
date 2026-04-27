import { describe, it, expect } from "vitest";
import { encodeToShiftJis } from "../encoding";

describe("encodeToShiftJis", () => {
  it("ASCII を Shift-JIS Buffer に変換する", () => {
    const buf = encodeToShiftJis("ABC123");
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBe(6);
    expect(buf.toString("binary")).toBe("ABC123");
  });

  it("半角カタカナを Shift-JIS に変換する", () => {
    const buf = encodeToShiftJis("ｱｲｳ");
    expect(buf.length).toBe(3);
    expect(buf[0]).toBe(0xb1);
    expect(buf[1]).toBe(0xb2);
    expect(buf[2]).toBe(0xb3);
  });

  it("CRLF がそのまま入る", () => {
    const buf = encodeToShiftJis("A\r\nB");
    expect(buf.length).toBe(4);
    expect(buf[0]).toBe(0x41);
    expect(buf[1]).toBe(0x0d);
    expect(buf[2]).toBe(0x0a);
    expect(buf[3]).toBe(0x42);
  });

  it("EOF マーク（0x1A）を含められる", () => {
    const buf = encodeToShiftJis("A\x1A");
    expect(buf.length).toBe(2);
    expect(buf[1]).toBe(0x1a);
  });
});
