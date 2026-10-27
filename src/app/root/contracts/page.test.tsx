import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../_components/PageHeader",()=>({PageHeader:()=>null}));
import Page from "./page";
afterEach(()=>vi.unstubAllGlobals());
it("defaults to the dated minimum and blocks a lower wage in the form",async()=>{
 const fetcher=vi.fn(async(url:unknown)=>({ok:true,json:async()=>String(url).endsWith("minimum-wages")?{rows:[{id:"w",prefecture:"大阪府",hourly_amount:1231,effective_from:"2026-10-01"}]}:{employees:[],rows:[]}}));vi.stubGlobal("fetch",fetcher);
 render(<Page/>);await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
 fireEvent.change(screen.getByLabelText("契約期間（から）"),{target:{value:"2026-10-01"}});
 await waitFor(()=>expect(screen.getByLabelText("基本賃金（時給・円）")).toHaveValue(1231));
 fireEvent.change(screen.getByLabelText("基本賃金（時給・円）"),{target:{value:"1200"}});
 expect(screen.getByRole("button",{name:"PDFを発行"})).toBeDisabled();expect(screen.getByText("大阪府の最低賃金（2026-10-01 から 1,231 円）を下回っています")).toBeVisible();
 fireEvent.change(screen.getByLabelText("給与区分"),{target:{value:"monthly"}});
 expect(screen.getByLabelText("週の所定時間")).toBeRequired();expect(screen.getByRole("button",{name:"PDFを発行"})).toBeDisabled();
});
