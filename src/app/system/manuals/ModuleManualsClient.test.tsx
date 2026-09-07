import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ModuleManualsClient from "./ModuleManualsClient";
import { getVisibleManualDocs, MANUAL_MODULES, SYSTEM_MANUALS } from "./_lib/manuals-registry";

describe("ModuleManualsClient", () => {
  it("lists manuals with the readable document labels", () => {
    const manual = SYSTEM_MANUALS[3];
    render(<ModuleManualsClient module={MANUAL_MODULES[0]} manuals={[{ ...manual, visibleDocs: getVisibleManualDocs(manual, "staff") }]} />);

    expect(screen.getByRole("heading", { name: "System のマニュアル" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "勤怠打刻と KOT 取込" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "操作マニュアル" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "開く" })).toHaveAttribute("href", "/system/manuals/system/kot-attendance");
  });
});
