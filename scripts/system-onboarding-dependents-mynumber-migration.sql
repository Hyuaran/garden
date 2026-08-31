-- Codex-269: ファイル作成のみ。本番へ適用しない。
-- dependents JSONBで許可するキーに扶養家族のマイナンバーを追加する。

create or replace function public.system_onboarding_dependents_valid(value jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select case when jsonb_typeof(value) <> 'array' then false else
    jsonb_array_length(value) <= 30 and not exists (
      select 1 from jsonb_array_elements(value) item where
      case when jsonb_typeof(item) <> 'object' then true else
        exists (select 1 from jsonb_each(item) entry where
          entry.key not in ('name','name_kana','relation','birth_date','annual_income','occupation','my_number')
          or jsonb_typeof(entry.value) <> 'string')
      end
    ) end;
$$;
