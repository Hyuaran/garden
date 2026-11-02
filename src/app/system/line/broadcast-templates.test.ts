import { expect,it } from 'vitest';
import { fillTemplate,templateTagIds } from './broadcast-templates';
import { templateFixtures } from './template-fixtures.test-data';
import { readFileSync } from 'node:fs';
it('日本時間の月・年・令和を題名と本文に差し込む',()=>{
 expect(fillTemplate('{年}年{月}月 令和{令和}年 {名前}',new Date('2026-12-31T16:00:00Z'))).toBe('2027年1月 令和9年 {名前}');
 expect(fillTemplate(templateFixtures[0].title,new Date('2026-11-30T16:00:00Z'))).toBe('2026年12月分 雇用契約書');
});
it('タグが見つからないときは名前で知らせる',()=>{
 expect(templateTagIds(templateFixtures[0],[]).missing).toEqual(['アルバイト','ブロードバンド事業','在籍中']);
 expect(templateTagIds(templateFixtures[0],templateFixtures[0].tags.map((t,i)=>({...t,id:String(i)}))).ids).toEqual(['0','1','2']);
});
it('migration の初期文は改行を含めて元の文と一致する',()=>{
 const sql=readFileSync('supabase/migrations/20261102000510_line_broadcast_templates.sql','utf8');
 for(const t of templateFixtures) for(const text of [t.label,t.title,t.body]) expect(sql).toContain("'"+text.replaceAll("'","''")+"'");
});
