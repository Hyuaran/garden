import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import DataTable, { type DataColumn } from "./DataTable";
const rows = [{id:"a",name:"振込",amount:30,date:"2026-10-20"},{id:"b",name:"手数料",amount:5,date:"2026-09-01"},{id:"c",name:"支払",amount:100,date:"2026-10-01"},{id:"d",name:"振込",amount:30,date:"2026-10-19"}];
const columns: DataColumn<typeof rows[number]>[] = [
  {id:"date",label:"日付",value:r => r.date,type:"date",filterValue:r => r.date.slice(0,7)},
  {id:"name",label:"内容",value:r => r.name,type:"text"},
  {id:"amount",label:"金額",value:r => r.amount,type:"number",right:true},
];
function fixture() { render(<DataTable rows={rows} columns={columns} rowKey={r => r.id} searchText={r => `${r.name} ${r.amount}`} defaultSort={{id:"date",direction:"desc"}} pageSize={2} />); }
function open(label = "内容") { fireEvent.click(screen.getByRole("button",{name:`${label}の並べ替え・絞り込み`})); return within(screen.getByRole("dialog")); }
it("sorts numeric values ascending and descending before paging", () => {
  fixture();
  fireEvent.click(open("金額").getByRole("button",{name:"昇順"}));
  expect(screen.getAllByRole("row")[1]).toHaveTextContent("手数料5");
  fireEvent.click(open("金額").getByRole("button",{name:"降順"}));
  expect(screen.getAllByRole("row")[1]).toHaveTextContent("支払100");
  fireEvent.click(open("日付").getByRole("button",{name:"昇順"}));
  expect(screen.getAllByRole("row")[1]).toHaveTextContent("2026-09-01");
});
it("searches options, applies multiple values, selects all and clears a column", () => {
  fixture();
  let menu = open();
  fireEvent.click(menu.getByLabelText("すべて選択"));
  fireEvent.click(menu.getByLabelText("振込 (2)"));
  fireEvent.click(menu.getByLabelText("支払 (1)"));
  fireEvent.click(menu.getByRole("button",{name:"OK"}));
  expect(screen.getByLabelText("絞り込み中")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"次へ"}));
  expect(screen.getAllByRole("row")).toHaveLength(2);
  expect(screen.queryByText("手数料")).not.toBeInTheDocument();
  menu = open();
  fireEvent.change(menu.getByRole("searchbox"),{target:{value:"振込"}});
  expect(menu.queryByText("支払 (1)")).not.toBeInTheDocument();
  expect(menu.getByText("振込 (2)")).toBeInTheDocument();
  fireEvent.click(menu.getByRole("button",{name:"解除"}));
  expect(screen.queryByLabelText("絞り込み中")).not.toBeInTheDocument();
  menu = open();
  fireEvent.click(menu.getByLabelText("すべて選択"));
  fireEvent.click(menu.getByLabelText("すべて選択"));
  fireEvent.click(menu.getByRole("button",{name:"OK"}));
  expect(screen.queryByLabelText("絞り込み中")).not.toBeInTheDocument();
});
it("cancels drafts with Escape or outside click and clamps the menu on small screens", () => {
  fixture();
  const menu = open();
  fireEvent.click(menu.getByLabelText("すべて選択"));
  fireEvent.keyDown(document,{key:"Escape"});
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button",{name:"内容の並べ替え・絞り込み"})).toHaveFocus();
  open();
  expect(Number.parseFloat(screen.getByRole("dialog").style.left)).toBeGreaterThanOrEqual(8);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("絞り込み中")).not.toBeInTheDocument();
});
it("filters months and supports an empty selection and global reset", () => {
  fixture();
  let menu = open("日付");
  fireEvent.click(menu.getByLabelText("2026-10 (3)"));
  fireEvent.click(menu.getByRole("button",{name:"OK"}));
  expect(screen.getAllByRole("row")[1]).toHaveTextContent("2026-09-01");
  menu = open("日付");
  fireEvent.click(menu.getByLabelText("2026-09 (1)"));
  fireEvent.click(menu.getByRole("button",{name:"OK"}));
  expect(screen.getByText("該当する明細はありません。")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"絞り込みをすべて解除"}));
  expect(screen.getByText("1 / 2")).toBeInTheDocument();
});


it("keeps a menu inside a 390px viewport and allows scrolling its options", () => {
  fixture();
  const width = window.innerWidth;
  Object.defineProperty(window, "innerWidth", {configurable:true,value:390});
  const trigger = screen.getByRole("button",{name:"内容の並べ替え・絞り込み"});
  const rect = vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({left:350,bottom:200} as DOMRect);
  try {
    open();
    const dialog = screen.getByRole("dialog");
    expect(Number.parseFloat(dialog.style.left) + 320).toBeLessThanOrEqual(382);
    fireEvent.scroll(within(dialog).getByText("振込 (2)").parentElement!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  } finally {
    rect.mockRestore();
    Object.defineProperty(window, "innerWidth", {configurable:true,value:width});
  }
});

it("uses the borderless search class and enables reset only while filtering", () => {
  fixture();
  const input = screen.getByRole("searchbox",{name:"検索"});
  expect(input.className).toContain("searchInput");
  const clear = screen.getByRole("button",{name:"絞り込みをすべて解除"});
  expect(clear).toBeDisabled(); fireEvent.change(input,{target:{value:"振込"}}); expect(clear).toBeEnabled();
  fireEvent.click(clear); expect(input).toHaveValue(""); expect(clear).toBeDisabled();
});

it("opens only enabled rows by pointer or keyboard and ignores interactive descendants",()=>{
 const click=vi.fn();
 render(<DataTable rows={rows} columns={[...columns,{id:"actions",label:"操作",type:"text",value:()=>"",render:()=> <><button>Action</button><a href="#">Link</a><input aria-label="操作"/><select aria-label="操作"><option>Link</option></select></>}]} rowKey={r=>r.id} searchText={r=>r.name} searchPlaceholder="氏名・カナで探す" defaultSort={{id:"date",direction:"desc"}} onRowClick={click} rowClickable={r=>r.id==="a"}/>);
 const enabled=screen.getAllByRole("row")[1];
 expect(enabled).toHaveAttribute("tabindex","0");
 fireEvent.click(within(enabled).getByText("振込"));
 fireEvent.keyDown(enabled,{key:"Enter"});fireEvent.keyDown(enabled,{key:" "});
 expect(click).toHaveBeenCalledTimes(3);
 for(const role of ["button","link","textbox","combobox"]){const element=within(enabled).getByRole(role);fireEvent.click(element);fireEvent.keyDown(element,{key:"Enter"});}
 fireEvent.click(screen.getAllByRole("row")[2]);
 expect(click).toHaveBeenCalledTimes(3);
 expect(screen.getAllByRole("row")[2]).not.toHaveAttribute("tabindex");
 expect(screen.getByPlaceholderText("氏名・カナで探す")).toBeInTheDocument();
});
