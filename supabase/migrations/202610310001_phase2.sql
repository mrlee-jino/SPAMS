-- Apply once through Supabase SQL Editor or `supabase db push`.
-- No demo telemetry or administrator accounts are inserted by this migration.
begin;
create table public.ponds (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100), created_at timestamptz not null default now()
);
create table public.pond_admins (
 pond_id uuid not null references public.ponds on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 primary key(pond_id,user_id)
);
create index pond_admins_user on public.pond_admins(user_id);
create table public.gateways (
 id uuid primary key default gen_random_uuid(), pond_id uuid not null references public.ponds on delete cascade,
 name text not null, control_enabled boolean not null default false,
 min_water_level_m numeric not null default 0.5 check(min_water_level_m>=0), min_battery_percent numeric not null default 25 check(min_battery_percent between 0 and 100),
 last_seen_at timestamptz, last_sample_at timestamptz, battery_percent numeric check(battery_percent between 0 and 100), voltage numeric check(voltage between 0 and 100),
 charging boolean, solar_watts numeric check(solar_watts between 0 and 10000), solar_voltage numeric check(solar_voltage between 0 and 100),
 pump_state text not null default 'unknown' check(pump_state in ('on','off','unknown')),
 unique(id,pond_id)
);
create index gateways_pond on public.gateways(pond_id);
create table public.nodes (
 id uuid primary key default gen_random_uuid(), gateway_id uuid not null references public.gateways on delete cascade,
 label text not null check(length(label) between 1 and 100), position text not null default '', slot smallint not null check(slot between 1 and 6),
 ultrasonic_enabled boolean not null default false, unique(gateway_id,slot), unique(id,gateway_id)
);
create table public.node_telemetry (
 id uuid primary key default gen_random_uuid(), node_id uuid not null references public.nodes on delete cascade,
 boot_id uuid not null, sequence bigint not null check(sequence>=0), sampled_at timestamptz not null, received_at timestamptz not null default now(),
 temperature_c numeric check(temperature_c between -10 and 60), water_level_m numeric check(water_level_m between 0 and 20), battery_percent numeric check(battery_percent between 0 and 100),
 sensor_health text not null check(sensor_health in ('healthy','degraded','failed')),
 unique(node_id,boot_id,sequence)
);
create index node_telemetry_time on public.node_telemetry(node_id,sampled_at desc);
create table public.gateway_telemetry (
 id uuid primary key default gen_random_uuid(), gateway_id uuid not null references public.gateways on delete cascade,
 boot_id uuid not null, sequence bigint not null check(sequence>=0), sampled_at timestamptz not null, received_at timestamptz not null default now(),
 battery_percent numeric not null check(battery_percent between 0 and 100), voltage numeric not null check(voltage between 0 and 100), charging boolean not null,
 solar_watts numeric check(solar_watts between 0 and 10000), solar_voltage numeric check(solar_voltage between 0 and 100),
 pump_state text not null check(pump_state in ('on','off','unknown')), unique(gateway_id,boot_id,sequence)
);
create index gateway_telemetry_time on public.gateway_telemetry(gateway_id,sampled_at desc);
create table public.acoustic_samples (
 id uuid primary key default gen_random_uuid(), telemetry_id uuid not null unique references public.node_telemetry on delete cascade,
 echo_us numeric not null check(echo_us between 0 and 1000000), amplitude numeric not null check(amplitude between 0 and 1),
 valid_returns smallint not null check(valid_returns between 0 and 100), quality text not null check(quality in ('usable','noisy','invalid'))
);
create table public.forecasts (
 id uuid primary key default gen_random_uuid(), pond_id uuid not null references public.ponds on delete cascade,
 generated_at timestamptz not null default now(), target_at timestamptz not null, predicted_temperature_c numeric not null,
 model_version text not null, training_start timestamptz not null, training_end timestamptz not null, valid_nodes smallint not null check(valid_nodes between 1 and 6),
 check(training_end>training_start), check(target_at>training_end)
);
create index forecasts_target on public.forecasts(pond_id,target_at desc);
create table public.pump_commands (
 id uuid primary key default gen_random_uuid(), gateway_id uuid not null references public.gateways,
 requested_by uuid not null references auth.users, action text not null check(action in ('start','stop')),
 status text not null default 'pending' check(status in ('pending','delivered','acknowledged','completed','rejected','expired')),
 idempotency_key uuid not null, requested_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '60 seconds',
 updated_at timestamptz not null default now(), check(expires_at>requested_at), unique(requested_by,idempotency_key)
);
create index pump_commands_gateway on public.pump_commands(gateway_id,status,requested_at desc);
create table public.command_events (
 id uuid primary key default gen_random_uuid(), command_id uuid not null references public.pump_commands,
 event text not null, created_at timestamptz not null default now(), detail text check(length(detail)<=500)
);
create index command_events_command on public.command_events(command_id,created_at);
create table public.alerts (
 id uuid primary key default gen_random_uuid(), pond_id uuid not null references public.ponds,
 title text not null, severity text not null check(severity in ('info','warning','critical')),
 opened_at timestamptz not null default now(), resolved_at timestamptz
);
create index alerts_pond on public.alerts(pond_id,opened_at desc);
-- Service-only, hash-only device identity. No browser role can read or mutate it.
create table public.device_credentials (
 id uuid primary key default gen_random_uuid(), gateway_id uuid not null references public.gateways on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'), revoked_at timestamptz, created_at timestamptz not null default now()
);

create function public.is_pond_admin(p_pond uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.pond_admins where pond_id=p_pond and user_id=(select auth.uid()));
$$;
revoke all on function public.is_pond_admin(uuid) from public;
grant execute on function public.is_pond_admin(uuid) to authenticated;

-- Every user-facing table has RLS and SELECT only. No self-provisioning policies.
alter table public.ponds enable row level security;
alter table public.pond_admins enable row level security;
alter table public.gateways enable row level security;
alter table public.nodes enable row level security;
alter table public.node_telemetry enable row level security;
alter table public.gateway_telemetry enable row level security;
alter table public.acoustic_samples enable row level security;
alter table public.forecasts enable row level security;
alter table public.pump_commands enable row level security;
alter table public.command_events enable row level security;
alter table public.alerts enable row level security;
alter table public.device_credentials enable row level security;
revoke all on public.ponds,public.pond_admins,public.gateways,public.nodes,public.node_telemetry,public.gateway_telemetry,public.acoustic_samples,public.forecasts,public.pump_commands,public.command_events,public.alerts,public.device_credentials from public,anon,authenticated;
grant select on public.ponds,public.pond_admins,public.gateways,public.nodes,public.node_telemetry,public.gateway_telemetry,public.acoustic_samples,public.forecasts,public.pump_commands,public.command_events,public.alerts to authenticated;
grant all on public.ponds,public.pond_admins,public.gateways,public.nodes,public.node_telemetry,public.gateway_telemetry,public.acoustic_samples,public.forecasts,public.pump_commands,public.command_events,public.alerts,public.device_credentials to service_role;
revoke update,delete,truncate on public.command_events from service_role;
create policy pond_read on public.ponds for select to authenticated using(public.is_pond_admin(id));
create policy membership_read on public.pond_admins for select to authenticated using(user_id=(select auth.uid()));
create policy gateway_read on public.gateways for select to authenticated using(public.is_pond_admin(pond_id));
create policy node_read on public.nodes for select to authenticated using(exists(select 1 from public.gateways g where g.id=gateway_id));
create policy node_sample_read on public.node_telemetry for select to authenticated using(exists(select 1 from public.nodes n where n.id=node_id));
create policy gateway_sample_read on public.gateway_telemetry for select to authenticated using(exists(select 1 from public.gateways g where g.id=gateway_id));
create policy acoustic_read on public.acoustic_samples for select to authenticated using(exists(select 1 from public.node_telemetry t where t.id=telemetry_id));
create policy forecast_read on public.forecasts for select to authenticated using(public.is_pond_admin(pond_id));
create policy command_read on public.pump_commands for select to authenticated using(exists(select 1 from public.gateways g where g.id=gateway_id));
create policy event_read on public.command_events for select to authenticated using(exists(select 1 from public.pump_commands c where c.id=command_id));
create policy alert_read on public.alerts for select to authenticated using(public.is_pond_admin(pond_id));

create function public.request_pump_command(p_gateway uuid,p_action text,p_key uuid) returns public.pump_commands
language plpgsql security definer set search_path='' as $$
declare g public.gateways; c public.pump_commands;
begin
 select * into g from public.gateways where id=p_gateway for update;
 if not found or not public.is_pond_admin(g.pond_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 select * into c from public.pump_commands where requested_by=auth.uid() and idempotency_key=p_key;
 if found then
  if c.gateway_id<>p_gateway or c.action<>p_action then raise exception 'Idempotency key conflict'; end if;
  return c;
 end if;
 if p_action not in ('start','stop') then raise exception 'Invalid action'; end if;
 if not g.control_enabled then raise exception 'Physical control is disabled'; end if;
 if g.last_seen_at is null or g.last_seen_at<now()-interval '90 seconds' then raise exception 'Gateway heartbeat is stale'; end if;
 if p_action='start' then
  if g.last_sample_at is null or g.last_sample_at<now()-interval '90 seconds' or g.battery_percent is null or g.battery_percent<g.min_battery_percent then raise exception 'Battery interlock'; end if;
  -- All six stationary nodes must have a fresh, healthy level observation before starting.
  if (select count(*) from public.nodes where gateway_id=g.id)<>6 or exists(
   select 1 from public.nodes n left join lateral(select * from public.node_telemetry t where t.node_id=n.id order by sampled_at desc limit 1)t on true
   where n.gateway_id=g.id and (t.id is null or t.sampled_at<now()-interval '90 seconds' or t.sensor_health<>'healthy' or t.water_level_m is null or t.water_level_m<g.min_water_level_m)
  ) then raise exception 'Water-level interlock'; end if;
 end if;
 -- Retire expired pending deliveries; delivered/acknowledged uncertainty blocks new starts.
 update public.pump_commands set status='expired',updated_at=now() where gateway_id=g.id and status='pending' and expires_at<=now();
 if exists(select 1 from public.pump_commands where gateway_id=g.id and status in ('pending','delivered','acknowledged')) then raise exception 'An unresolved command already exists'; end if;
 if exists(select 1 from public.pump_commands where gateway_id=g.id and requested_at>now()-interval '5 seconds') then raise exception 'Command rate limit'; end if;
 insert into public.pump_commands(gateway_id,requested_by,action,idempotency_key) values(g.id,auth.uid(),p_action,p_key) returning * into c;
 return c;
end $$;
revoke all on function public.request_pump_command(uuid,text,uuid) from public;
grant execute on function public.request_pump_command(uuid,text,uuid) to authenticated;

-- Append audit events for every request/state transition. No direct user writes are granted.
create function public.audit_pump_command() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then insert into public.command_events(command_id,event) values(new.id,'requested');
 elsif new.status is distinct from old.status then insert into public.command_events(command_id,event) values(new.id,new.status); end if;
 return new;
end $$;
create trigger audit_pump_command after insert or update on public.pump_commands for each row execute function public.audit_pump_command();
revoke all on function public.audit_pump_command() from public;

-- Enable only appropriate user-readable tables for Realtime; never credentials.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['gateways','nodes','node_telemetry','gateway_telemetry','pump_commands','command_events','alerts','forecasts','acoustic_samples'] loop
   execute format('alter publication supabase_realtime add table public.%I',t);
  end loop;
 end if;
end $$;
commit;
