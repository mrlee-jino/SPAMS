-- Run AFTER both migrations and AFTER creating an administrator in Supabase Auth.
-- Replace the placeholder UUID with that existing Auth user's ID.
-- This script creates one pond, one gateway, six stationary nodes and membership.
-- It never creates fake telemetry, device credentials, or enables pump control.
begin;
do $$
declare
 admin_user uuid := '00000000-0000-0000-0000-000000000000'; -- REPLACE
 pond uuid := gen_random_uuid();
 gateway uuid := gen_random_uuid();
begin
 if not exists(select 1 from auth.users where id=admin_user) then
  raise exception 'Replace admin_user with the existing Supabase Auth user UUID';
 end if;
 insert into public.ponds(id,name) values(pond,'Research pond A');
 insert into public.pond_admins(pond_id,user_id) values(pond,admin_user);
 insert into public.gateways(id,pond_id,name) values(gateway,pond,'Central gateway 01');
 insert into public.nodes(gateway_id,slot,label,position,ultrasonic_enabled)
 select gateway,n,'Node '||lpad(n::text,2,'0'),
  (array['North inlet','Northeast bank','East center','South outlet','Southwest bank','West center'])[n],n<=3
 from generate_series(1,6)n;
end $$;
commit;
-- To grant an additional existing user access, a project owner can insert a
-- (pond_id,user_id) pair into public.pond_admins through secure administration.
