-- Run once after all migrations. No account or Auth user is needed.
-- To create an isolated software test pond, change source below to 'simulation'.
begin;
do $$
declare pond uuid:=gen_random_uuid(); gateway uuid:=gen_random_uuid(); source text:='hardware';
begin
 insert into public.ponds(id,name,is_public) values(pond,case when source='simulation' then 'Software test pond (simulated)' else 'Research pond A' end,true);
 insert into public.gateways(id,pond_id,name,data_source) values(gateway,pond,'Central gateway 01',source);
 insert into public.nodes(gateway_id,slot,label,position,ultrasonic_enabled)
 select gateway,n,'Node '||lpad(n::text,2,'0'),(array['North inlet','Northeast bank','East center','South outlet','Southwest bank','West center'])[n],n<=3 from generate_series(1,6)n;
end $$;
commit;
-- Query public.gateways and public.nodes in Supabase to obtain IDs for provisioning.
-- Never put a raw device token in a public table. Store its SHA-256 digest only
-- in device_credentials through SQL Editor; provision the raw token on the gateway.
