import {expect,it} from "vitest";
import {rawAnswer,type Question} from "./board";
const q={answer_type:"choice",options:[{key:"a",label:"答えA"}]} as Question;
it("補足のみとその他を受け付け、不正な選択と空回答は拒む",()=>{expect(rawAnswer(q,"","補足だけ")).toBe("補足だけ");expect(rawAnswer(q,"other","別案")).toBe("別案");expect(()=>rawAnswer(q,"other","")).toThrow("補足に書いてください");expect(()=>rawAnswer(q,"","")).toThrow();expect(()=>rawAnswer(q,"invalid","文")).toThrow();expect(rawAnswer(q,"a","補足")).toBe("答えA\n補足");});
