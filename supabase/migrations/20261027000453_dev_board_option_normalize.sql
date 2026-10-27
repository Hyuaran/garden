-- 開発ボード：選択肢を文字だけで渡しても {key,label} の形にそろえて保存する（2026-10-27・画面に選択肢が出ない不具合の再発防止）
begin;
create or replace function public.system_dev_create_question(p_module text, p_title text, p_body text, p_answer_type text, p_options jsonb, p_actor text)
 returns uuid
 language plpgsql
 set search_path to 'public'
as $function$
declare result uuid; normalized jsonb := p_options;
begin
 if jsonb_typeof(p_options) = 'array' then
  select coalesce(jsonb_agg(case when jsonb_typeof(e) = 'string' then jsonb_build_object('key', chr(96 + ord::int), 'label', e #>> '{}') else e end order by ord), '[]'::jsonb)
   into normalized from jsonb_array_elements(p_options) with ordinality as x(e, ord);
 end if;
 perform set_config('garden.dev_actor',p_actor,true);
 insert into system_dev_questions(module,title,body,answer_type,options,created_by) values(p_module,p_title,p_body,p_answer_type,normalized,p_actor) returning id into result;
 return result;
end $function$;
update system_dev_questions q set options=(select jsonb_agg(case when jsonb_typeof(e)='string' then jsonb_build_object('key',chr(96+ord::int),'label',e#>>'{}') else e end order by ord) from jsonb_array_elements(q.options) with ordinality as x(e,ord))
 where answer_type='choice' and jsonb_typeof(options)='array' and exists(select 1 from jsonb_array_elements(q.options) e where jsonb_typeof(e)='string');
commit;
