import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../_components/PageHeader",()=>({PageHeader:()=>null}));
import InboxPage from "./page";
afterEach(()=>vi.unstubAllGlobals());
it("扶養の変更を一覧と詳細で確認できる",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({rows:[{id:"dep-1",employee_id:"E1",submission_type:"dependents",status:"received",payload:{count:"0",details:"扶養を外す",effectiveDate:"2026-10-29"},kintone_status:"not_applicable",pdf_status:"not_applicable",created_at:"2026-10-29T00:00:00Z",root_employees:{name:"社員A"}}]})}));
 render(<InboxPage/>);
 const row=await screen.findByRole("button",{name:/扶養の変更.*社員A/});
 expect(row).toHaveTextContent("受付済み");
 fireEvent.click(row);
 await waitFor(()=>expect(screen.getByRole("heading",{name:"扶養の変更"})).toBeInTheDocument());
 expect(screen.getByText("変更後の扶養の人数")).toBeInTheDocument();
 expect(screen.getByText("扶養を外す")).toBeInTheDocument();
 expect(screen.queryByRole("button",{name:"PDF再生成"})).not.toBeInTheDocument();
});
