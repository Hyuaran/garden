import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
// Local in-memory PostgreSQL only. Never reads credentials or environment files.
const { PGlite } = await import(pathToFileURL(path.resolve(process.argv[2], 'dist/index.js')).href);
const db = new PGlite();
let checks = 0;
const ok = (a,b) => { assert.deepEqual(a,b); checks++; };
const fails = async sql => { await assert.rejects(db.exec(sql)); checks++; };
try {
 await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema auth;
 create function auth.role() returns text language sql as $$ select current_setting('test.role') $$;
 set test.role = 'authenticated';
 create table root_employees(employee_id text, garden_role text, is_active boolean default true, deleted_at timestamptz);
 insert into root_employees(employee_id,garden_role) values ('M','manager'),('S','super_admin'),('V','staff');
 create table my_number_access_logs(actor_employee_id text,employee_id text,action text,detail text);
 create table system_onboarding(id integer default 1,employee_id text primary key,status text default 'submitted',name text,email text,householder_name text,householder_relation text,my_number text default '',my_number_secret jsonb,dependents jsonb,created_at timestamptz default now(),updated_at timestamptz default now(),nda_agreed_at timestamptz,submitted_at timestamptz default now());
 insert into system_onboarding(employee_id,name,dependents) values ('E','self','[{"name":"A","annual_income":"","occupation":"","my_number":""},{"name":"B","annual_income":"","occupation":"","my_number":""}]');
 `);
 await db.exec(fs.readFileSync('supabase/migrations/20261112000525_onboarding_dependents_after_submit.sql','utf8'));
 await db.exec(`create trigger before_write before insert or update on system_onboarding for each row execute function system_onboarding_before_write()`);
 const original = fs.readFileSync('supabase/migrations/20261029000479_my_number_encrypt.sql','utf8');
 const plaintextGuard = original.slice(original.indexOf('create or replace function public.reject_plain_onboarding_number()'), original.indexOf('-- Bud'));
 await db.exec(plaintextGuard);
 await fails(`update system_onboarding set dependents=jsonb_set(dependents,'{0,my_number}','"123456789018"')`);
 const read = async () => (await db.query(`select * from system_onboarding where employee_id='E'`)).rows[0];
 const before = await read();
 await db.exec(`select save_admin_onboarding_dependent('E','M',1,'{"annual_income":"1200000","occupation":"student"}',false)`);
 ok((await read()).dependents[1].annual_income,'1200000');
 ok((await read()).dependents[1].occupation,'student');
 ok((await read()).submitted_at,before.submitted_at);
 for(const sql of [
 `update system_onboarding set name='changed'`,
 `update system_onboarding set dependents=dependents || '[{"name":"C"}]'`,
 `update system_onboarding set dependents=jsonb_build_array(dependents->1,dependents->0)`,
 `update system_onboarding set dependents=jsonb_set(dependents,'{0,name}','"changed"')`,
 `select save_admin_onboarding_dependent('E','V',0,'{"occupation":"x"}',false)`,
 `select save_admin_onboarding_dependent('E','M',0,'{"annual_income":"-1"}',false)`,
 `select save_admin_onboarding_dependent('E','M',0,'{"name":"x"}',false)`,
 `select save_admin_onboarding_dependent('E','M',8,'{"occupation":"x"}',false)`]) await fails(sql);
 const secret={my_number_cipher:'encrypted',my_number_iv:'iv',my_number_tag:'tag',my_number_last4:'9018',key_version:1};
 const changes=JSON.stringify({my_number:'',my_number_secret:secret});
 await fails(`select save_admin_onboarding_dependent('E','M',0,'${changes}',false)`);
 await db.query(`select save_admin_onboarding_dependent('E','S',0,$1,false)`,[changes]);
 ok((await read()).dependents[0].my_number,'');
 ok((await read()).dependents[0].my_number_secret,secret);
 ok((await db.query(`select action from my_number_access_logs`)).rows,[{action:'confirm'}]);
 await fails(`select save_admin_onboarding_dependent('E','S',0,'${changes}',false)`);
 await db.query(`select save_admin_onboarding_dependent('E','S',0,$1,true)`,[changes]);
 ok((await db.query(`select count(*)::int as n from my_number_access_logs`)).rows[0].n,2);
 await db.exec(`alter table my_number_access_logs add constraint reject_log check(false) not valid`);
 await fails(`select save_admin_onboarding_dependent('E','S',1,'${changes}',false)`);
 ok((await read()).dependents[1].my_number_secret,undefined);
 await db.exec(`set test.role='service_role'; update system_onboarding set my_number_secret='{"migration":true}'`);
 ok((await read()).my_number_secret,{migration:true});
 await fails(`update system_onboarding set name='changed'`);
 ok((await db.query(`select has_function_privilege('authenticated','save_admin_onboarding_dependent(text,text,integer,jsonb,boolean)','execute') as allowed`)).rows[0].allowed,false);
 console.log(`${checks} local PostgreSQL checks passed`);
} finally { await db.close(); }
