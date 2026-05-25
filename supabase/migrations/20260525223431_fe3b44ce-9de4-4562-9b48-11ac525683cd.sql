
-- Private bucket for automated backups
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do update set public = false;

-- Storage RLS: only super_admin can touch backup files
drop policy if exists "super_admin read backups" on storage.objects;
drop policy if exists "super_admin write backups" on storage.objects;
drop policy if exists "super_admin update backups" on storage.objects;
drop policy if exists "super_admin delete backups" on storage.objects;

create policy "super_admin read backups"
on storage.objects for select
to authenticated
using (bucket_id = 'backups' and public.is_super_admin());

create policy "super_admin write backups"
on storage.objects for insert
to authenticated
with check (bucket_id = 'backups' and public.is_super_admin());

create policy "super_admin update backups"
on storage.objects for update
to authenticated
using (bucket_id = 'backups' and public.is_super_admin())
with check (bucket_id = 'backups' and public.is_super_admin());

create policy "super_admin delete backups"
on storage.objects for delete
to authenticated
using (bucket_id = 'backups' and public.is_super_admin());

-- Required for scheduled HTTP-triggered backups
create extension if not exists pg_cron;
create extension if not exists pg_net;
