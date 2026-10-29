import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
it('shares the sliding window under a row lock and restricts execution',()=>{
 const sql=readFileSync('supabase/migrations/20261029000475_liff_submission_limit.sql','utf8');
 expect(sql).toContain('for update');
 expect(sql).toContain("interval '1 minute'");
 expect(sql).toContain('cardinality(recent) >= 5');
 expect(sql).toContain('from public, anon, authenticated');
 expect(sql).toContain('to service_role');
});
