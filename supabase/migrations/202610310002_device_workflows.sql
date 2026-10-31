begin;
-- Called only by authenticated server device routes, never directly by browser roles.
create function public.ingest_telemetry(p_gateway uuid,p_packet jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.gateways; sample jsonb; gt jsonb:=p_packet->'gateway'; v_telemetry uuid; v_enabled boolean; inserted_id uuid;
begin
 select * into g from public.gateways where id=p_gateway for update;
 if not found then raise exception 'Unknown gateway'; end if;
 if jsonb_array_length(p_packet->'nodes')>6 then raise exception 'Too many nodes'; end if;
 if (gt->>'sampled_at')::timestamptz<now()-interval '24 hours' or (gt->>'sampled_at')::timestamptz>now()+interval '1 minute' then raise exception 'Invalid sample time'; end if;
 if exists(select 1 from public.gateway_telemetry where gateway_id=g.id and boot_id=(gt->>'boot_id')::uuid and sequence=(gt->>'sequence')::bigint) then return jsonb_build_object('duplicate',true); end if;
 if (select count(*) from public.gateway_telemetry where gateway_id=g.id and received_at>now()-interval '1 minute')>=60 then raise exception 'Telemetry rate limit'; end if;
 insert into public.gateway_telemetry(gateway_id,boot_id,sequence,sampled_at,battery_percent,voltage,charging,solar_watts,solar_voltage,pump_state)
 values(g.id,(gt->>'boot_id')::uuid,(gt->>'sequence')::bigint,(gt->>'sampled_at')::timestamptz,(gt->>'battery_percent')::numeric,(gt->>'voltage')::numeric,(gt->>'charging')::boolean,(gt->>'solar_watts')::numeric,(gt->>'solar_voltage')::numeric,gt->>'pump_state') returning id into inserted_id;
 update public.gateways set last_seen_at=now() where id=g.id;
 -- Backfill never overwrites a more recent gateway snapshot.
 if g.last_sample_at is null or (gt->>'sampled_at')::timestamptz>g.last_sample_at then
  update public.gateways set last_sample_at=(gt->>'sampled_at')::timestamptz,battery_percent=(gt->>'battery_percent')::numeric,voltage=(gt->>'voltage')::numeric,charging=(gt->>'charging')::boolean,solar_watts=(gt->>'solar_watts')::numeric,solar_voltage=(gt->>'solar_voltage')::numeric,pump_state=gt->>'pump_state' where id=g.id;
 end if;
 for sample in select value from jsonb_array_elements(p_packet->'nodes') loop
  select ultrasonic_enabled into v_enabled from public.nodes where id=(sample->>'node_id')::uuid and gateway_id=g.id;
  if not found then raise exception 'Node is not assigned to gateway'; end if;
  if (sample->>'sampled_at')::timestamptz<now()-interval '24 hours' or (sample->>'sampled_at')::timestamptz>now()+interval '1 minute' then raise exception 'Invalid sample time'; end if;
  if sample ? 'acoustic' and not v_enabled then raise exception 'Ultrasonic sensor is not enabled'; end if;
  v_telemetry:=null;
  insert into public.node_telemetry(node_id,boot_id,sequence,sampled_at,temperature_c,water_level_m,battery_percent,sensor_health)
  values((sample->>'node_id')::uuid,(sample->>'boot_id')::uuid,(sample->>'sequence')::bigint,(sample->>'sampled_at')::timestamptz,(sample->>'temperature_c')::numeric,(sample->>'water_level_m')::numeric,(sample->>'battery_percent')::numeric,sample->>'sensor_health')
  on conflict(node_id,boot_id,sequence) do nothing returning id into v_telemetry;
  if v_telemetry is not null and sample ? 'acoustic' then
   insert into public.acoustic_samples(telemetry_id,echo_us,amplitude,valid_returns,quality) values(v_telemetry,(sample->'acoustic'->>'echo_us')::numeric,(sample->'acoustic'->>'amplitude')::numeric,(sample->'acoustic'->>'valid_returns')::smallint,sample->'acoustic'->>'quality');
  end if;
 end loop;
 return jsonb_build_object('duplicate',false,'id',inserted_id);
end $$;
revoke all on function public.ingest_telemetry(uuid,jsonb) from public;
grant execute on function public.ingest_telemetry(uuid,jsonb) to service_role;

create function public.claim_pump_commands(p_gateway uuid) returns setof public.pump_commands
language plpgsql security definer set search_path='' as $$
declare g public.gateways; c public.pump_commands;
begin
 select * into g from public.gateways where id=p_gateway for update;
 if not found then raise exception 'Unknown gateway'; end if;
 update public.pump_commands set status='expired',updated_at=now() where gateway_id=g.id and status='pending' and expires_at<=now();
 if not g.control_enabled then return; end if;
 for c in select * from public.pump_commands where gateway_id=g.id and status='pending' and expires_at>now() order by requested_at for update loop
  if g.last_sample_at is null or g.last_sample_at<now()-interval '90 seconds' or g.last_seen_at<now()-interval '90 seconds' or g.last_seen_at is null or (c.action='start' and (
   g.battery_percent is null or g.battery_percent<g.min_battery_percent or
   (select count(*) from public.nodes where gateway_id=g.id)<>6 or exists(select 1 from public.nodes n left join lateral(select * from public.node_telemetry t where t.node_id=n.id order by sampled_at desc limit 1)t on true where n.gateway_id=g.id and (t.id is null or t.sampled_at<now()-interval '90 seconds' or t.water_level_m is null or t.water_level_m<g.min_water_level_m or t.sensor_health<>'healthy'))
  )) then update public.pump_commands set status='rejected',updated_at=now() where id=c.id;
  else
   update public.pump_commands set status='delivered',updated_at=now() where id=c.id returning * into c;
   return next c;
  end if;
 end loop;
end $$;
revoke all on function public.claim_pump_commands(uuid) from public;
grant execute on function public.claim_pump_commands(uuid) to service_role;

create function public.acknowledge_pump_command(p_gateway uuid,p_command uuid,p_status text) returns public.pump_commands
language plpgsql security definer set search_path='' as $$
declare c public.pump_commands;
begin
 select * into c from public.pump_commands where id=p_command and gateway_id=p_gateway for update;
 if not found then raise exception 'Command not found'; end if;
 if p_status not in ('acknowledged','completed','rejected') then raise exception 'Invalid acknowledgment'; end if;
 if c.status=p_status then return c; end if;
 if c.status not in ('delivered','acknowledged') or (c.status='acknowledged' and p_status='acknowledged') then raise exception 'Invalid transition'; end if;
 if c.expires_at<=now() and p_status<>'rejected' then raise exception 'Command expired; reconcile execution manually'; end if;
 update public.pump_commands set status=p_status,updated_at=now() where id=c.id returning * into c;
 return c;
end $$;
revoke all on function public.acknowledge_pump_command(uuid,uuid,text) from public;
grant execute on function public.acknowledge_pump_command(uuid,uuid,text) to service_role;
commit;
