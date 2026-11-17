-- Rename project location for clarity and add an optional purchase-order reference.
-- The existing site field and stored site values remain unchanged.
update public.erp_module_definitions d
set fields = (
  select jsonb_agg(
    case
      when f.value->>'k' = 'site'
        then jsonb_set(f.value, '{label}', to_jsonb('Site Address'::text), true)
      else f.value
    end
    order by f.ordinality
  )
  from jsonb_array_elements(d.fields) with ordinality as f(value, ordinality)
)
where d.key = 'projects';

update public.erp_module_definitions d
set fields = (
  select jsonb_agg(x.value order by x.ordinality, x.position)
  from (
    select f.value, f.ordinality, 0 as position
    from jsonb_array_elements(d.fields) with ordinality as f(value, ordinality)
    union all
    select jsonb_build_object(
      'k', 'poNumber',
      'label', 'P.O. Number',
      'hidden', false,
      'type', 'text'
    ), f.ordinality, 1 as position
    from jsonb_array_elements(d.fields) with ordinality as f(value, ordinality)
    where f.value->>'k' = 'site'
  ) x
)
where d.key = 'projects'
  and not exists (
    select 1
    from jsonb_array_elements(d.fields) as f(value)
    where f.value->>'k' = 'poNumber'
  );