import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SiteNotifyEditor,{useSiteNotify} from "./SiteNotifyEditor";
import { saveNotifyRecipients } from "../notify-actions";
vi.mock("../notify-actions",()=>({saveNotifyRecipients:vi.fn().mockResolvedValue(undefined)}));
const site={notify_key:"hyuaran-company",company:"ヒュアラン",kind:"会社HP",status:"live" as const};
function Card(){const notify=useSiteNotify();return <button onClick={()=>notify.open(site)}>TO {notify.names(site)}</button>;}
const initial={employees:[{value:"a",label:"甲"},{value:"b",label:"乙"}],recipients:{"hyuaran-company":["a"]}};
beforeEach(()=>{vi.clearAllMocks();HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};});
it("selects employees with BoxSelect and saves",async()=>{
 render(<SiteNotifyEditor initial={initial} canEdit><Card/></SiteNotifyEditor>);
 fireEvent.click(screen.getByRole("button",{name:"TO 甲"}));fireEvent.click(screen.getByRole("button",{name:"通知先"}));
 fireEvent.click(screen.getByRole("checkbox",{name:"乙"}));fireEvent.click(screen.getByRole("button",{name:"OK"}));fireEvent.click(screen.getByRole("button",{name:"登録する"}));
 await waitFor(()=>expect(saveNotifyRecipients).toHaveBeenCalledWith("hyuaran-company",["a","b"]));
 await waitFor(()=>expect(screen.getByRole("button",{name:"TO 甲・乙"})).toBeInTheDocument());
});
it("shows read-only recipients to other viewers",()=>{render(<SiteNotifyEditor initial={initial} canEdit={false}><Card/></SiteNotifyEditor>);fireEvent.click(screen.getByRole("button",{name:"TO 甲"}));expect(screen.queryByRole("button",{name:"登録する"})).not.toBeInTheDocument();});
it("can clear all recipients",async()=>{render(<SiteNotifyEditor initial={initial} canEdit><Card/></SiteNotifyEditor>);fireEvent.click(screen.getByRole("button",{name:"TO 甲"}));fireEvent.click(screen.getByRole("button",{name:"通知先を空にする"}));fireEvent.click(screen.getByRole("button",{name:"登録する"}));await waitFor(()=>expect(saveNotifyRecipients).toHaveBeenCalledWith("hyuaran-company",[]));});
