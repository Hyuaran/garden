import { render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import DataTable from "./DataTable";
afterEach(()=>window.history.replaceState(null,"","/"));
it("initializes the destination search from q and matches comma formatted amounts",()=>{
 window.history.replaceState(null,"","/system/test?q=1000");
 render(<DataTable rows={[{id:"1",amount:"1,000"},{id:"2",amount:"2,000"}]} columns={[{id:"amount",label:"金額",type:"text",value:row=>row.amount}]} rowKey={row=>row.id} searchText={row=>row.amount} defaultSort={{id:"amount",direction:"asc"}}/>);
 expect(screen.getByRole("searchbox")).toHaveValue("1000");expect(screen.getByText("1,000")).toBeInTheDocument();expect(screen.queryByText("2,000")).toBeNull();
});
