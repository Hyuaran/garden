import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn(),send:vi.fn(),ai:vi.fn(),question:{id:"11111111-1111-1111-1111-111111111111",module:"system",title:"交通費",answer_type:"choice",options:[{key:"a",label:"定期代"}]}}));
vi.mock("@/app/system/dev-board/server",()=>({requireBoard:m.auth}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:()=>({rpc:m.rpc,from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:m.question})}),order:async()=>({data:[]})})})})}));
vi.mock("@/app/system/_lib/chatwork",()=>({sendChatworkMessageWithToken:m.send}));
vi.mock("@anthropic-ai/sdk",()=>({default:class{messages={create:m.ai};}}));
import { GET, POST } from "./route";
import { ViewPermissionError } from "@/lib/auth/view-permission.server";
const request=(extra:object)=>new Request("http://localhost/api/system/dev-board",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:m.question.id,choice:"a",text:"定期でお願いします",...extra})});
beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue({viewer:{employeeId:"EMP-0008"}});m.rpc.mockResolvedValue({error:null});m.send.mockResolvedValue({ok:true});m.ai.mockResolvedValue({content:[{type:"text",text:"定期代でお願いします。"}],stop_reason:"end_turn"});});
describe("開発ボードAPI",()=>{
 it("他の従業員は読み書きできない",async()=>{m.auth.mockRejectedValue(new ViewPermissionError("閲覧権限がありません"));expect((await GET()).status).toBe(403);expect((await POST(request({action:"answer",answer:"定期代"})))).toHaveProperty("status",403);expect(m.rpc).not.toHaveBeenCalled();});
 it("確認時には保存せず、確定後に履歴付きRPCで保存して通知する",async()=>{const p=await POST(request({action:"prepare"}));expect(await p.json()).toMatchObject({raw:"定期代\n定期でお願いします",text:"定期代でお願いします。"});expect(m.rpc).not.toHaveBeenCalled();expect(m.send).not.toHaveBeenCalled();const r=await POST(request({action:"answer",answer:"定期代でお願いします。"}));expect(r.status).toBe(200);expect(m.rpc).toHaveBeenCalledWith("system_dev_answer_question",expect.objectContaining({p_raw:"定期代\n定期でお願いします",p_text:"定期代でお願いします。",p_actor:"EMP-0008"}));expect(m.send).toHaveBeenCalledWith(expect.objectContaining({text:"開発ボードに回答がありました：System／交通費"}));});
 it("補完に失敗しても元の文で送れる",async()=>{m.ai.mockRejectedValue(new Error("offline"));const d=await(await POST(request({action:"prepare"}))).json();expect(d.warning).toContain("もとの文のまま送れます");expect(d.text).toBe(d.raw);expect((await POST(request({action:"answer",answer:d.raw}))).status).toBe(200);});
 it("補足が空ならClaudeを呼ばない",async()=>{expect((await POST(request({action:"prepare",text:""}))).status).toBe(200);expect(m.ai).not.toHaveBeenCalled();});
 it("通知失敗でも保存成功を返す",async()=>{m.send.mockRejectedValue(new Error("offline"));expect(await(await POST(request({action:"answer",answer:"定期代"}))).json()).toMatchObject({ok:true,warning:expect.stringContaining("回答は保存しました")});});
});
