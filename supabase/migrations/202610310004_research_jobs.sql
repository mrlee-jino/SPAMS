begin;
-- Atomic publication with per-pond serialization. Service role only.
create function public.publish_research(p_pond uuid,p_source text,p_forecast jsonb,p_alerts jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare a jsonb;
begin
 perform 1 from public.ponds where id=p_pond for update;
 if not found or p_source not in ('hardware','simulation') then raise exception 'Invalid research scope'; end if;
 if jsonb_array_length(p_alerts)>100 then raise exception 'Too many alert rules'; end if;
 if p_forecast is not null then
  insert into public.forecasts(pond_id,source,target_at,predicted_temperature_c,model_version,training_start,training_end,valid_nodes,evaluation)
  values(p_pond,p_source,(p_forecast->>'target_at')::timestamptz,(p_forecast->>'predicted_temperature_c')::numeric,p_forecast->>'model_version',(p_forecast->>'training_start')::timestamptz,(p_forecast->>'training_end')::timestamptz,(p_forecast->>'valid_nodes')::smallint,p_forecast->'evaluation')
  on conflict(pond_id,source,model_version,target_at) do nothing;
 end if;
 update public.alerts existing set resolved_at=now() where pond_id=p_pond and source=p_source and rule_key is not null and resolved_at is null
 and not exists(select 1 from jsonb_array_elements(p_alerts) e where e->>'rule_key'=existing.rule_key);
 for a in select value from jsonb_array_elements(p_alerts) loop
  insert into public.alerts(pond_id,source,rule_key,title,severity) values(p_pond,p_source,a->>'rule_key',a->>'title',a->>'severity')
  on conflict(pond_id,source,rule_key) where resolved_at is null and rule_key is not null do nothing;
 end loop;
end $$;
revoke all on function public.publish_research(uuid,text,jsonb,jsonb) from public;
grant execute on function public.publish_research(uuid,text,jsonb,jsonb) to service_role;
commit;
