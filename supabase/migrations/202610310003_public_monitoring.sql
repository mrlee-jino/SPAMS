begin;
-- This application is now public monitoring. Owners can opt a pond out in SQL.
alter table public.ponds add column is_public boolean not null default true;
alter table public.gateways add column data_source text not null default 'hardware' check(data_source in ('hardware','simulation'));
alter table public.node_telemetry add column source text not null default 'hardware' check(source in ('hardware','simulation'));
alter table public.gateway_telemetry add column source text not null default 'hardware' check(source in ('hardware','simulation'));
alter table public.forecasts add column source text not null default 'hardware' check(source in ('hardware','simulation'));
alter table public.alerts add column source text not null default 'hardware' check(source in ('hardware','simulation'));
alter table public.alerts add column rule_key text;
create unique index alerts_open_rule on public.alerts(pond_id,source,rule_key) where resolved_at is null and rule_key is not null;
create unique index forecasts_model_target on public.forecasts(pond_id,source,model_version,target_at);
alter table public.forecasts add column evaluation jsonb;
-- Public viewing never grants access to identities, device credentials or command audits.
grant select on public.ponds,public.gateways,public.nodes,public.node_telemetry,public.gateway_telemetry,public.acoustic_samples,public.forecasts,public.alerts to anon;
create policy public_pond_read on public.ponds for select to anon using(is_public);
create policy public_gateway_read on public.gateways for select to anon using(exists(select 1 from public.ponds p where p.id=pond_id));
create policy public_node_read on public.nodes for select to anon using(exists(select 1 from public.gateways g where g.id=gateway_id));
create policy public_node_sample_read on public.node_telemetry for select to anon using(exists(select 1 from public.nodes n where n.id=node_id));
create policy public_gateway_sample_read on public.gateway_telemetry for select to anon using(exists(select 1 from public.gateways g where g.id=gateway_id));
create policy public_acoustic_read on public.acoustic_samples for select to anon using(exists(select 1 from public.node_telemetry t where t.id=telemetry_id));
create policy public_forecast_read on public.forecasts for select to anon using(exists(select 1 from public.ponds p where p.id=pond_id));
create policy public_alert_read on public.alerts for select to anon using(exists(select 1 from public.ponds p where p.id=pond_id));
update public.gateways set control_enabled=false;
revoke execute on function public.request_pump_command(uuid,text,uuid) from authenticated;
-- Source is derived from the registered gateway, never accepted from an untrusted packet.
create function public.label_telemetry_source() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='gateway_telemetry' then select data_source into new.source from public.gateways where id=new.gateway_id;
 else select g.data_source into new.source from public.gateways g join public.nodes n on n.gateway_id=g.id where n.id=new.node_id; end if;
 return new;
end $$;
revoke all on function public.label_telemetry_source() from public;
create trigger label_node_source before insert on public.node_telemetry for each row execute function public.label_telemetry_source();
create trigger label_gateway_source before insert on public.gateway_telemetry for each row execute function public.label_telemetry_source();
alter table public.gateway_telemetry alter column battery_percent drop not null;
alter table public.gateway_telemetry alter column voltage drop not null;
alter table public.gateway_telemetry alter column charging drop not null;
commit;
