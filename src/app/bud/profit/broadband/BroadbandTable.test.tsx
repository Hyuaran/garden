import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Details } from "./BroadbandTable";
import type { TableRecord } from "@/lib/bud/broadband/table";
it("shows fee, actual bank details and server supplied Kintone link",()=>{
 render(<Details rows={[{kintone_record_id:"12",business:"事業",partner:"取引先",scheduled_date:"2026-10-31",actual_period:"2026-09-01",product:"商品",profit_net:10000,expected_gross:11000,recon_fee:440,recon_status:"matched",mf_date:"2026-10-30",mf_amount:10560,mf_bank:"楽天銀行",mf_content:"振込"} as TableRecord]} kintoneBase="https://example.cybozu.com/k/174" onClose={()=>{}} />);
 expect(screen.getByText("手数料 440 円")).toBeTruthy();expect(screen.getByText(/楽天銀行/)).toBeTruthy();expect(screen.getByRole("link").getAttribute("href")).toBe("https://example.cybozu.com/k/174/show#record=12");
});
