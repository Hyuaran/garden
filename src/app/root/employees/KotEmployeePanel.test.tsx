import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import KotEmployeePanel from "./KotEmployeePanel";
const registration = { code: "1571", divisionCode: "1", typeCode: "a", divisions: [{ code: "1", name: "本社" }, { code: "2", name: "事務" }], workingTypes: [{ code: "a", name: "パート・アルバイト" }] };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("confirms a named change and submits only changed codes", async () => {
 const fetch = vi.fn().mockResolvedValueOnce(Response.json(registration)).mockResolvedValueOnce(Response.json({ok:true}));
 vi.stubGlobal("fetch",fetch);
 render(<KotEmployeePanel employeeId="EMP-1" name="後道 愛美" />);
 fireEvent.click(screen.getByRole("button",{name:"KING OF TIME から読み直す"}));
 await screen.findByText("KING OF TIME の従業員コード 1571");
 fireEvent.change(screen.getByRole("combobox", { name: "変更後の所属" }), { target: { value: "2" } });
 fireEvent.click(screen.getByRole("button",{name:"KING OF TIME に反映する"}));
 expect(screen.getByRole("alertdialog").textContent).toContain("後道 愛美さん（1571）の所属を 本社 → 事務");
 expect(fetch).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole("button",{name:/^反映する$/}));
 await screen.findByText("KING OF TIME に反映しました");
 expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({divisionCode:"2",updateDate:expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)});
});
it("shows read errors", async () => {
 vi.stubGlobal("fetch",vi.fn(async()=>Response.json({error:"KING OF TIME が止まっている時間です"},{status:400})));
 render(<KotEmployeePanel employeeId="EMP-1" name="後道 愛美" />);
 fireEvent.click(screen.getByRole("button",{name:"KING OF TIME から読み直す"}));
 await waitFor(()=>expect(screen.getByRole("status").textContent).toBe("KING OF TIME が止まっている時間です"));
});