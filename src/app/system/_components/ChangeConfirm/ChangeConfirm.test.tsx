import {render,screen} from "@testing-library/react";
import {beforeEach,expect,it,vi} from "vitest";
import ChangeConfirm from "./ChangeConfirm";
beforeEach(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};
});
it("前後の順に表示し、同じなら後だけ表示する",()=>{
 const props={title:"送る内容の確認",beforeLabel:"もとの文",before:"原文",afterLabel:"整えた文",after:"整文",question:"送ってよいですか？",actions:<button>送る</button>,onClose:vi.fn(),selectedAnswer:"その他"};
 const {container,rerender}=render(<ChangeConfirm {...props}/>);
 expect([...container.querySelectorAll('dt')].map(n=>n.textContent)).toEqual(["もとの文","整えた文"]);
 expect(screen.getByText("選んだ答え：その他")).toBeInTheDocument();
 rerender(<ChangeConfirm {...props} same after="原文"/>);
 expect(container.querySelectorAll('dt')).toHaveLength(1);
 expect(screen.getByText("整える所はありませんでした")).toBeInTheDocument();
});
