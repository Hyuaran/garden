import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ViewerPicker from "./ViewerPicker";
afterEach(cleanup);
const employees=[{employee_id:"a",name:"上田 基人",name_kana:"ウエダ モトヒト"},{employee_id:"b",name:"後道 翔太",name_kana:"ウシロミチ ショウタ"}];
it("sorts selected first and changes selection",()=>{
 const onChange=vi.fn();render(<ViewerPicker employees={employees} value={["b"]} onChange={onChange}/>);
 expect(screen.getAllByRole("checkbox").map(e=>e.parentElement?.textContent)).toEqual(["後道 翔太","上田 基人"]);
 fireEvent.click(screen.getByRole("checkbox",{name:"上田 基人"}));expect(onChange).toHaveBeenCalledWith(["b","a"]);
});
it.each(["うえだ","ｳｴﾀﾞ","ウエダ","上田　基人"])("normalizes search: %s",search=>{
 render(<ViewerPicker employees={employees} value={[]} onChange={()=>{}}/>);
 fireEvent.change(screen.getByRole("textbox",{name:"名前で探す"}),{target:{value:search}});
 expect(screen.getAllByRole("checkbox")).toHaveLength(1);expect(screen.getByRole("checkbox",{name:"上田 基人"})).toBeTruthy();
});
it("keeps checked people while searching",()=>{
 render(<ViewerPicker employees={employees} value={["b"]} onChange={()=>{}}/>);
 fireEvent.change(screen.getByRole("textbox",{name:"名前で探す"}),{target:{value:"うえだ"}});
 expect(screen.getAllByRole("checkbox").map(e=>e.parentElement?.textContent)).toEqual(["後道 翔太","上田 基人"]);
});
